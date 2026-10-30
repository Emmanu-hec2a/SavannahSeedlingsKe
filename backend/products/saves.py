"""Validated product writes and compensating cleanup for non-transactional media."""
import json
import logging
import os
from io import BytesIO
from uuid import uuid4
import warnings

from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.db import transaction
from django.utils.text import slugify
from PIL import Image
from rest_framework import serializers
from rest_framework.exceptions import APIException

from .models import ProductImage, ProductVariant

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class ProductUploadUnavailable(APIException):
    status_code = 503
    default_detail = 'Photo upload failed. No product changes were saved. Please try again.'
    default_code = 'product_upload_failed'


class BatchInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, min_value=1)
    color_name = serializers.CharField(max_length=50, allow_blank=True, required=False)
    color_hex = serializers.RegexField(r'^#[0-9a-fA-F]{6}$', required=False)
    # Existing admin clients use Standard for a new batch. Preserve that legacy
    # value as well as the model's displayed Regular/Large options.
    size = serializers.ChoiceField(choices=['Regular', 'Large', 'Standard'], required=False)
    stock = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)


def validate_batches(data, product=None):
    """None means leave batches alone; an explicit [] means remove unused ones."""
    if 'variants_json' not in data:
        return None
    raw = data.get('variants_json')
    try:
        values = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError, RecursionError):
        raise serializers.ValidationError({'variants_json': 'Enter a valid JSON array of stock batches.'})
    if not isinstance(values, list):
        raise serializers.ValidationError({'variants_json': 'Stock batches must be a JSON array.'})
    serializer = BatchInputSerializer(data=values, many=True)
    if not serializer.is_valid():
        raise serializers.ValidationError({'variants_json': serializer.errors})
    batches = serializer.validated_data
    ids = [batch['id'] for batch in batches if 'id' in batch]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError({'variants_json': 'A stock batch may only appear once.'})
    if product is None:
        if ids:
            raise serializers.ValidationError({'variants_json': 'A new product cannot reuse existing stock batches.'})
        return batches

    # The caller has locked the product row, using the same product-first lock
    # order as checkout. Lock its batches before validating ownership/removals.
    existing = list(product.variants.select_for_update().order_by('pk'))
    if not set(ids).issubset({batch.pk for batch in existing}):
        raise serializers.ValidationError({'variants_json': 'A stock batch does not belong to this product.'})
    removed = product.variants.exclude(pk__in=ids)
    if removed.filter(Q(orderitem__isnull=False) | Q(stock_allocations__isnull=False)).exists():
        raise serializers.ValidationError({
            'variants_json': 'A batch used by an order cannot be removed. Keep its ID and update it instead.',
        })
    return batches


def prepare_images(files):
    """Decode and validate every file before any database or storage writes."""
    prepared = []
    try:
        for index, upload in enumerate(files):
            if upload.size > MAX_IMAGE_BYTES:
                raise serializers.ValidationError({'images': {index: 'Images must be 5 MB or smaller.'}})
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('error', Image.DecompressionBombWarning)
                    serializers.ImageField().run_validation(upload)
                    upload.seek(0)
                    with Image.open(upload) as source:
                        source.load()
                        image = source.convert('RGB')
                        try:
                            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                            output = BytesIO()
                            image.save(output, format='JPEG', quality=85, optimize=True)
                            name = slugify(os.path.splitext(os.path.basename(upload.name))[0]) or 'photo'
                            prepared.append(ContentFile(output.getvalue(), name=name + '.jpg'))
                        finally:
                            image.close()
            except (serializers.ValidationError, DjangoValidationError, OSError, ValueError,
                    Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise serializers.ValidationError({'images': {index: 'Upload a valid, readable product image.'}})
        return prepared
    except BaseException:
        close_images(prepared)
        raise


def close_images(images):
    for image in images:
        image.close()


def save_batches(product, batches):
    if batches is None:
        return
    retained = []
    for batch in batches:
        attributes = dict(batch)
        pk = attributes.pop('id', None)
        if pk is None:
            attributes = {'color_name': '', 'color_hex': '#000000', 'size': 'Regular', 'stock': 0, **attributes}
            instance = ProductVariant.objects.create(product=product, **attributes)
            retained.append(instance.pk)
        else:
            product.variants.filter(pk=pk).update(**attributes)
            retained.append(pk)
    # validate_batches already rejected removal of anything referenced by orders.
    product.variants.exclude(pk__in=retained).delete()


def save_images(product, images, uploads):
    field = ProductImage._meta.get_field('image')
    created = []
    for content in images:
        photo = ProductImage(product=product)
        storage = photo.image.storage
        # Always use a fresh key. Retrying/replacing a product upload must never
        # overwrite an existing photo, even with an overwrite-enabled backend.
        try:
            for _ in range(5):
                name = field.generate_filename(photo, f'{product.pk}_{uuid4().hex}.jpg').replace('\\', '/')
                if not storage.exists(name):
                    break
            else:
                raise OSError('Could not allocate a fresh product image key.')
            # Track the intended key first, including a provider that writes
            # then raises before it reports success. Never track an existing key.
            uploads.append((storage, name))
            saved_name = storage.save(name, content, max_length=field.max_length)
        except Exception as error:
            logger.exception('Product photo upload failed for product %s', product.pk)
            raise ProductUploadUnavailable() from error
        if saved_name != name:
            uploads.append((storage, saved_name))
        photo.image = saved_name
        photo.save()
        created.append(photo)
    return created


class ImageSelectionSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, min_value=1)
    upload_index = serializers.IntegerField(required=False, min_value=0)

    def validate(self, attrs):
        if len(attrs) != 1:
            raise serializers.ValidationError('Choose exactly one saved photo ID or new-upload index.')
        return attrs


class ImageChangesSerializer(serializers.Serializer):
    remove_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), default=list)
    primary = ImageSelectionSerializer(required=False, allow_null=True)


def validate_image_changes(data, upload_count, product=None):
    """Explicit removals only: omitted photos must never imply deletion."""
    if 'image_changes_json' not in data:
        return None
    raw = data.get('image_changes_json')
    try:
        values = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError, RecursionError):
        raise serializers.ValidationError({'image_changes_json': 'Enter valid photo changes.'})
    if not isinstance(values, dict) or set(values) - {'remove_ids', 'primary'}:
        raise serializers.ValidationError({'image_changes_json': 'Photo changes must contain only remove_ids and primary.'})
    selection = values.get('primary')
    if selection is not None and (not isinstance(selection, dict) or set(selection) - {'id', 'upload_index'}):
        raise serializers.ValidationError({'image_changes_json': 'Choose a saved photo ID or new-upload index.'})
    serializer = ImageChangesSerializer(data=values)
    if not serializer.is_valid():
        raise serializers.ValidationError({'image_changes_json': serializer.errors})
    changes = serializer.validated_data
    removed = changes['remove_ids']
    if len(removed) != len(set(removed)):
        raise serializers.ValidationError({'image_changes_json': 'A photo can only be removed once.'})
    # Callers already hold the product lock (or are creating a fresh product).
    existing = list(product.images.select_for_update().order_by('pk')) if product else []
    ids = {photo.pk for photo in existing}
    if not set(removed).issubset(ids):
        raise serializers.ValidationError({'image_changes_json': 'A removed photo no longer exists or belongs to another product. Reload this product.'})
    remaining = ids - set(removed)
    if 'primary' in changes:
        primary = changes['primary']
        if primary is None:
            if remaining or upload_count:
                raise serializers.ValidationError({'image_changes_json': 'Choose a primary photo while this product has photos.'})
        elif 'id' in primary:
            if primary['id'] not in remaining:
                raise serializers.ValidationError({'image_changes_json': 'The primary photo must belong to this product and must not be removed.'})
        elif primary['upload_index'] >= upload_count:
            raise serializers.ValidationError({'image_changes_json': 'The selected new primary photo is missing from this upload.'})
    return changes


def cleanup_removed_images(files):
    """Post-commit only. Shared legacy keys remain; cleanup failures are logged."""
    for storage, name in files:
        try:
            if name and not ProductImage.objects.filter(image=name).exists():
                storage.delete(name)
        except Exception:
            logger.exception('Removed product photo needs storage cleanup: %s', name)


def apply_image_changes(product, changes, created):
    removed = changes['remove_ids'] if changes else []
    files = [(photo.image.storage, photo.image.name) for photo in product.images.filter(pk__in=removed)]
    if removed:
        product.images.filter(pk__in=removed).delete()
    selection = changes.get('primary') if changes else None
    if selection:
        primary_id = selection.get('id') or created[selection['upload_index']].pk
    else:
        # Preserve the existing primary for old clients. Deleting it promotes
        # the first remaining photo; old multiple/zero-primary states normalize.
        first = product.images.order_by('-is_primary', 'pk').first()
        primary_id = first.pk if first else None
    product.images.exclude(pk=primary_id).update(is_primary=False)
    if primary_id:
        product.images.filter(pk=primary_id).update(is_primary=True)
    if files:
        transaction.on_commit(lambda: cleanup_removed_images(files))


def cleanup_uploads(uploads):
    """Only compensate keys created by this failed request, never older photos."""
    seen = set()
    for storage, name in reversed(uploads):
        key = (id(storage), name)
        if key in seen:
            continue
        seen.add(key)
        try:
            storage.delete(name)
        except Exception:
            # Keep the original request failure. Log the precise new key so an
            # operator can retry cleanup if the storage provider is unavailable.
            logger.exception('Failed product upload needs cleanup: %s', name)
