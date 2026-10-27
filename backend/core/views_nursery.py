"""Staff-managed nursery photos with validated, non-overwriting media writes."""
from io import BytesIO
import logging
from uuid import uuid4
import warnings

from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from PIL import Image, ImageOps
from rest_framework import serializers, viewsets
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from .models import NurseryPhoto
from .permissions import StaffWriteOrReadOnly

logger = logging.getLogger(__name__)


class NurseryPhotoSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False)
    position = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)
    is_active = serializers.BooleanField(required=False, default=True)
    is_featured = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = NurseryPhoto
        fields = ['id', 'image', 'caption', 'alt_text', 'position', 'is_active', 'is_featured', 'updated_at']
        read_only_fields = ['id', 'updated_at']
        # Feature switching is handled transactionally, rather than rejected by
        # the single-feature uniqueness validator before the old flag is cleared.
        validators = []

    def validate(self, attrs):
        if self.instance is None and 'image' not in attrs:
            raise serializers.ValidationError({'image': 'Choose a nursery photo.'})
        return attrs

    def validate_image(self, upload):
        if upload.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Photos must be 5 MB or smaller.')
        if getattr(upload, 'image', None) and upload.image.format not in ('JPEG', 'PNG', 'WEBP'):
            raise serializers.ValidationError('Use a JPEG, PNG or WebP photo.')
        return upload


class NurseryStorageUnavailable(APIException):
    status_code = 503
    default_detail = 'Photo upload failed. Your saved photos have not changed. Please try again.'


def delete_photo_files(files):
    for storage, name in files:
        try:
            storage.delete(name)
        except Exception:
            logger.exception('Nursery photo file needs cleanup: %s', name)


def prepare_photo(upload):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            upload.seek(0)
            with Image.open(upload) as source:
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                try:
                    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                    with BytesIO() as output:
                        image.save(output, 'JPEG', quality=85, optimize=True)
                        # A fresh image deliberately strips EXIF, including GPS.
                        return ContentFile(output.getvalue(), name='nursery.jpg')
                finally:
                    image.close()
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise serializers.ValidationError({'image': 'Upload a valid, readable nursery photo.'})


class NurseryPhotoViewSet(viewsets.ModelViewSet):
    queryset = NurseryPhoto.objects.all()
    permission_classes = [StaffWriteOrReadOnly]
    serializer_class = NurseryPhotoSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        photos = super().get_queryset()
        return photos if self.request.user.is_staff else photos.filter(is_active=True)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def create(self, request, *args, **kwargs):
        return self.save_photo(request)

    def partial_update(self, request, *args, **kwargs):
        return self.save_photo(request, updating=True)

    def save_photo(self, request, updating=False):
        uploads = []
        content = None
        try:
            with transaction.atomic():
                instance = None
                if updating:
                    self.queryset = self.get_queryset().select_for_update()
                    instance = self.get_object()
                serializer = self.get_serializer(instance, data=request.data, partial=updating)
                serializer.is_valid(raise_exception=True)
                attributes = dict(serializer.validated_data)
                upload = attributes.pop('image', None)
                if upload is not None:
                    content = prepare_photo(upload)
                    field = NurseryPhoto._meta.get_field('image')
                    storage = field.storage
                    try:
                        for _ in range(5):
                            name = f'nursery/{uuid4().hex}.jpg'
                            if not storage.exists(name):
                                break
                        else:
                            raise OSError('Could not allocate a new nursery photo key.')
                        uploads.append((storage, name))
                        saved = storage.save(name, content, max_length=field.max_length)
                        if saved != name:
                            uploads.append((storage, saved))
                        attributes['image'] = saved
                    except Exception as error:
                        logger.exception('Nursery photo upload failed')
                        raise NurseryStorageUnavailable() from error
                old_file = (instance.image.storage, instance.image.name) if instance and upload else None
                if attributes.get('is_featured'):
                    # The database constraint also guards concurrent promotions.
                    NurseryPhoto.objects.filter(is_featured=True).exclude(pk=instance.pk if instance else None).update(is_featured=False)
                photo = serializer.save(**attributes)
                # Keep serialization inside the transaction: a failed URL/storage
                # lookup must not turn a reported failure into a committed edit.
                data = self.get_serializer(photo).data
                if old_file:
                    transaction.on_commit(lambda: delete_photo_files([old_file]))
            return Response(data, status=200 if updating else 201)
        except IntegrityError as error:
            delete_photo_files(uploads)
            raise serializers.ValidationError({'detail': 'Another photo changed at the same time. Refresh and try again.'}) from error
        except Exception:
            delete_photo_files(uploads)
            raise
        finally:
            if content:
                content.close()

    def destroy(self, request, *args, **kwargs):
        with transaction.atomic():
            self.queryset = self.get_queryset().select_for_update()
            photo = self.get_object()
            old_file = (photo.image.storage, photo.image.name)
            photo.delete()
            transaction.on_commit(lambda: delete_photo_files([old_file]))
        return Response(status=204)
