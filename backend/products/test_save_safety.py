"""Product-save safety checks; use --settings=tinahstore.test_settings only."""
import json
import os
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from orders.models import Order, OrderItem
from .models import Category, Product, ProductImage, ProductVariant
from .serializers import ProductDetailSerializer


class ProductSaveSafetyTests(TestCase):
    def setUp(self):
        if not os.environ.get('DJANGO_SETTINGS_MODULE', '').endswith('.test_settings'):
            self.skipTest('These checks require the isolated test database and storage.')
        cache.clear()
        staff = get_user_model().objects.create_user('save-safety-staff', password='Save-Safety-42!', is_staff=True)
        self.client = APIClient()
        login = self.client.post('/api/v1/admin/auth/login/', {
            'username': staff.username, 'password': 'Save-Safety-42!',
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"AdminToken {login.data['token']}")
        self.category = Category.objects.create(name='Safety fruit')
        self.product = Product.objects.create(name='Original seedling', category=self.category,
            price='350.00', stock=12, description='Original description')
        self.variant = ProductVariant.objects.create(product=self.product, color_name='Grafted',
            color_hex='#2E7D32', size='Regular', stock=12)
        self.photo = ProductImage(product=self.product, is_primary=True)
        self.photo.image.save('old-photo.jpg', ContentFile(b'keep this original image'), save=True)
        self.storage = default_storage
        self.url = f'/api/v1/products/{self.product.slug}/'
        self.initial = self.snapshot()

    def image(self, name='new-photo.png'):
        buffer = BytesIO()
        Image.new('RGBA', (120, 8), (46, 125, 50, 255)).save(buffer, 'PNG')
        return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')

    def files(self):
        try:
            return sorted(self.storage.listdir('products')[1])
        except FileNotFoundError:
            return []

    def snapshot(self):
        return {
            'product': Product.objects.filter(pk=self.product.pk).values().get(),
            'variants': list(self.product.variants.order_by('id').values()),
            'images': list(self.product.images.order_by('id').values()),
            'files': self.files(),
        }

    def assert_unchanged(self):
        self.assertEqual(self.snapshot(), self.initial)
        with self.storage.open(self.photo.image.name, 'rb') as saved:
            self.assertEqual(saved.read(), b'keep this original image')

    def payload(self, **changes):
        return {
            'name': 'Updated seedling', 'price': '425.50',
            'variants_json': json.dumps([{'id': self.variant.pk, 'color_name': 'Grafted',
                'color_hex': '#2E7D32', 'size': 'Regular', 'stock': 7}]),
            **changes,
        }

    def new_payload(self, **changes):
        return {'name': 'New safety seedling', 'slug': 'new-safety-seedling',
            'category_id': self.category.pk, 'description': 'A test seedling', 'price': '350.00', **changes}

    def link_order(self):
        order = Order.objects.create(customer_name='QA grower', customer_email='qa@example.test',
            customer_phone='0712345678', delivery_address='QA farm', city='Ruiru', county='Kiambu',
            payment_method='whatsapp', status='pending_confirmation')
        return OrderItem.objects.create(order=order, product=self.product, variant=self.variant,
            quantity=2, unit_price='350.00')

    def test_invalid_product_fields_do_not_change_children_or_upload_files(self):
        with patch.object(self.storage, 'save', wraps=self.storage.save) as save:
            response = self.client.patch(self.url, self.payload(price='invalid', images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 400)
        save.assert_not_called()
        self.assert_unchanged()

    def test_malformed_batches_are_400_and_leave_everything_unchanged(self):
        for raw in ('{', 'null', '{}', '[1]', '[null]', '[{"stock":-1}]',
                    '[{"stock":1.5}]', '[{"stock":2147483648}]',
                    '[{"color_hex":"bad"}]', '[{"size":"unknown"}]',
                    json.dumps([{'color_name': 'x' * 51}])):
            with self.subTest(raw=raw), patch.object(self.storage, 'save', wraps=self.storage.save) as save:
                response = self.client.patch(self.url, self.payload(variants_json=raw, images=[self.image()]), format='multipart')
                self.assertEqual(response.status_code, 400, response.data)
                save.assert_not_called()
                self.assert_unchanged()

    def test_duplicate_or_foreign_batch_ids_are_rejected_before_writes(self):
        other = Product.objects.create(name='Other seedling', category=self.category, price='100.00')
        foreign = ProductVariant.objects.create(product=other, stock=9)
        for ids in ([self.variant.pk, self.variant.pk], [foreign.pk], [999999]):
            with self.subTest(ids=ids):
                response = self.client.patch(self.url, self.payload(
                    variants_json=json.dumps([{'id': pk, 'stock': 1} for pk in ids])), format='multipart')
                self.assertEqual(response.status_code, 400)
                self.assert_unchanged()
        foreign.refresh_from_db()
        self.assertEqual(foreign.stock, 9)

    def test_invalid_image_after_a_valid_image_causes_no_partial_update(self):
        broken = SimpleUploadedFile('broken.png', b'not an image', content_type='image/png')
        with patch.object(self.storage, 'save', wraps=self.storage.save) as save:
            response = self.client.patch(self.url, self.payload(images=[self.image(), broken]), format='multipart')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('images', response.data)
        save.assert_not_called()
        self.assert_unchanged()

    def test_oversized_image_is_rejected_before_any_writes(self):
        image = self.image()
        image.size = 5 * 1024 * 1024 + 1
        # Invoke preprocessing directly: multipart encoding recomputes file size.
        from .saves import prepare_images
        from rest_framework.exceptions import ValidationError
        with patch.object(self.storage, 'save', wraps=self.storage.save) as save:
            with self.assertRaises(ValidationError):
                prepare_images([image])
        save.assert_not_called()
        self.assert_unchanged()

    def test_create_rejects_invalid_image_without_creating_a_product(self):
        broken = SimpleUploadedFile('broken.png', b'not an image', content_type='image/png')
        with patch.object(self.storage, 'save', wraps=self.storage.save) as save:
            response = self.client.post('/api/v1/products/', self.new_payload(
                variants_json='[{"stock":5}]', images=[self.image(), broken]), format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Product.objects.count(), 1)
        save.assert_not_called()
        self.assert_unchanged()

    def test_create_rejects_malformed_batches_and_existing_ids(self):
        for raw in ('{', '{}', '[{"stock":-2}]', json.dumps([{'id': self.variant.pk}])):
            with self.subTest(raw=raw):
                response = self.client.post('/api/v1/products/', self.new_payload(variants_json=raw), format='multipart')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(Product.objects.count(), 1)
                self.assert_unchanged()

    def test_successful_edit_preserves_existing_batch_id_and_order_link(self):
        item = self.link_order()
        response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.variant.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(self.variant.stock, 7)
        self.assertEqual(item.variant_id, self.variant.pk)
        self.assertEqual(self.product.variants.count(), 1)
        self.assertEqual(self.product.images.count(), 2)
        self.assertEqual(response.data['variants'][0]['id'], self.variant.pk)
        with self.storage.open(self.photo.image.name, 'rb') as saved:
            self.assertEqual(saved.read(), b'keep this original image')

    def test_removing_ordered_batch_is_rejected_without_mutations(self):
        item = self.link_order()
        response = self.client.patch(self.url, self.payload(variants_json='[]', images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('variants_json', response.data)
        item.refresh_from_db()
        self.assertEqual(item.variant_id, self.variant.pk)
        self.assert_unchanged()

    def test_omitted_batches_leave_them_untouched(self):
        response = self.client.patch(self.url, {'price': '425.50'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(self.product.variants.values()), self.initial['variants'])

    def test_partial_batch_edit_preserves_unspecified_attributes(self):
        response = self.client.patch(self.url, {
            'variants_json': json.dumps([{'id': self.variant.pk, 'stock': 5}]),
        }, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 5)
        self.assertEqual(self.variant.color_name, 'Grafted')
        self.assertEqual(self.variant.color_hex, '#2E7D32')
        self.assertEqual(self.variant.size, 'Regular')

    def test_explicit_empty_batches_can_remove_unused_batches(self):
        response = self.client.patch(self.url, {'variants_json': '[]'}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.product.variants.exists())
        self.assertEqual(list(self.product.images.values()), self.initial['images'])

    def test_create_accepts_current_admin_standard_batch_and_multiple_photos(self):
        response = self.client.post('/api/v1/products/', self.new_payload(
            variants_json='[{"color_name":"Grafted","color_hex":"#2E7D32","size":"Standard","stock":17}]',
            images=[self.image('same-name.png'), self.image('same-name.png')]), format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        product = Product.objects.get(slug='new-safety-seedling')
        self.assertEqual(product.variants.get().stock, 17)
        photos = list(product.images.all())
        self.assertEqual(len(photos), 2)
        self.assertNotEqual(photos[0].image.name, photos[1].image.name)
        for photo in photos:
            self.assertTrue(self.storage.exists(photo.image.name))
        snapshot = self.snapshot()
        self.assertEqual(len(snapshot.pop('files')), len(self.initial['files']) + 2)
        self.assertEqual(snapshot, {key: value for key, value in self.initial.items() if key != 'files'})

    def test_storage_failure_returns_503_and_rolls_back_product_and_batches(self):
        with patch.object(self.storage, 'save', side_effect=OSError('Storage unavailable')):
            with self.assertLogs('products.saves', level='ERROR'):
                response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assertIn('No product changes were saved', str(response.data['detail']))
        self.assert_unchanged()

    def test_second_upload_failure_removes_first_new_file_not_existing_photo(self):
        original_save = self.storage.save
        calls = []

        def save_then_fail(name, content, max_length=None):
            calls.append(name)
            if len(calls) == 2:
                raise OSError('Second upload failed')
            return original_save(name, content, max_length=max_length)

        with patch.object(self.storage, 'save', side_effect=save_then_fail):
            with self.assertLogs('products.saves', level='ERROR'):
                response = self.client.patch(self.url, self.payload(
                    images=[self.image('one.png'), self.image('two.png')]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(calls), 2)
        self.assert_unchanged()

    def test_provider_write_then_raise_is_compensated(self):
        original_save = self.storage.save

        def write_then_raise(name, content, max_length=None):
            original_save(name, content, max_length=max_length)
            raise OSError('Upload acknowledgement failed')

        with patch.object(self.storage, 'save', side_effect=write_then_raise):
            with self.assertLogs('products.saves', level='ERROR'):
                response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assert_unchanged()

    def test_failed_create_removes_new_product_batches_and_uploaded_files(self):
        original_save = self.storage.save
        calls = []

        def save_then_fail(name, content, max_length=None):
            calls.append(name)
            if len(calls) == 2:
                raise OSError('Second upload failed')
            return original_save(name, content, max_length=max_length)

        with patch.object(self.storage, 'save', side_effect=save_then_fail):
            with self.assertLogs('products.saves', level='ERROR'):
                response = self.client.post('/api/v1/products/', self.new_payload(
                    variants_json='[{"stock":5}]', images=[self.image(), self.image()]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(ProductVariant.objects.count(), 1)
        self.assert_unchanged()

    def test_database_image_row_failure_rolls_back_and_cleans_upload(self):
        self.client.raise_request_exception = False
        with patch.object(ProductImage, 'save', side_effect=IntegrityError('Image row rejected')):
            with self.assertLogs('django.request', level='ERROR'):
                response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assert_unchanged()

    def test_database_batch_failure_rolls_back_earlier_batch_updates(self):
        self.client.raise_request_exception = False
        batches = [{'id': self.variant.pk, 'stock': 7}, {'stock': 3}]
        with patch.object(ProductVariant.objects, 'create', side_effect=IntegrityError('Batch rejected')):
            with self.assertLogs('django.request', level='ERROR'):
                response = self.client.patch(self.url, self.payload(variants_json=json.dumps(batches)), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assert_unchanged()

    def test_response_serialization_failure_also_rolls_back_and_cleans_upload(self):
        self.client.raise_request_exception = False
        with patch.object(ProductDetailSerializer, 'to_representation', side_effect=RuntimeError('Cannot build response')):
            with self.assertLogs('django.request', level='ERROR'):
                response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assert_unchanged()

    def test_cleanup_failure_is_logged_without_masking_original_error(self):
        with patch.object(self.storage, 'save', side_effect=OSError('Upload failed')):
            with patch.object(self.storage, 'delete', side_effect=OSError('Cleanup unavailable')):
                with self.assertLogs('products.saves', level='ERROR') as logs:
                    response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assertTrue(any('needs cleanup: products/' in message for message in logs.output))
        self.assert_unchanged()

    def test_new_key_collision_never_overwrites_or_cleans_existing_photo(self):
        collision = 'a' * 32
        existing_name = f'products/{self.product.pk}_{collision}.jpg'
        self.storage.save(existing_name, ContentFile(b'keep collided image'))
        self.initial = self.snapshot()
        with patch('products.saves.uuid4', side_effect=[
                SimpleNamespace(hex=collision), SimpleNamespace(hex='b' * 32)]):
            with patch.object(ProductImage, 'save', side_effect=IntegrityError('Image row rejected')):
                self.client.raise_request_exception = False
                with self.assertLogs('django.request', level='ERROR'):
                    response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assert_unchanged()
        with self.storage.open(existing_name, 'rb') as saved:
            self.assertEqual(saved.read(), b'keep collided image')

    def test_cleanup_uses_actual_storage_name_when_provider_renames_file(self):
        original_save = self.storage.save

        def renamed_save(name, content, max_length=None):
            return original_save(name.replace('.jpg', '-renamed.jpg'), content, max_length=max_length)

        self.client.raise_request_exception = False
        with patch.object(self.storage, 'save', side_effect=renamed_save):
            with patch.object(ProductImage, 'save', side_effect=IntegrityError('Image row rejected')):
                with self.assertLogs('django.request', level='ERROR'):
                    response = self.client.patch(self.url, self.payload(images=[self.image()]), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assert_unchanged()

    def test_failed_cleanup_does_not_prevent_cleanup_of_other_new_files(self):
        original_save, original_delete = self.storage.save, self.storage.delete
        uploaded = []

        def save_then_fail(name, content, max_length=None):
            if len(uploaded) == 2:
                raise OSError('Third upload failed')
            result = original_save(name, content, max_length=max_length)
            uploaded.append(result)
            return result

        def delete_with_one_failure(name):
            if name == uploaded[1]:
                raise OSError('One cleanup failed')
            original_delete(name)

        with patch.object(self.storage, 'save', side_effect=save_then_fail):
            with patch.object(self.storage, 'delete', side_effect=delete_with_one_failure):
                with self.assertLogs('products.saves', level='ERROR') as logs:
                    response = self.client.patch(self.url, self.payload(
                        images=[self.image(), self.image(), self.image()]), format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assertFalse(self.storage.exists(uploaded[0]))
        self.assertTrue(self.storage.exists(uploaded[1]))
        self.assertTrue(any(uploaded[1] in message for message in logs.output))
        # Remove this deliberately simulated orphan from the isolated test storage.
        self.storage.delete(uploaded[1])
        self.assert_unchanged()
