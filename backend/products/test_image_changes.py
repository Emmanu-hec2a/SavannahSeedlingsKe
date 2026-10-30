"""Primary/removal regression tests, isolated database and storage only."""
import json
import os
from io import BytesIO
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Category, Product, ProductImage
from .serializers import ProductDetailSerializer


class ProductImageChangesTests(TestCase):
    def setUp(self):
        if not os.environ.get('DJANGO_SETTINGS_MODULE', '').endswith('.test_settings'):
            self.skipTest('Use isolated test settings, never a real database/storage.')
        self.client = APIClient()
        self.staff = get_user_model().objects.create_user('photo-staff', is_staff=True)
        self.client.force_authenticate(self.staff)
        self.category = Category.objects.create(name='Photo fixtures')
        self.product = Product.objects.create(name='Photo seedling', category=self.category, price='350', description='Original')
        self.first = self.photo(primary=True)
        self.second = self.photo()
        self.url = f'/api/v1/products/{self.product.slug}/'
        self.storage = default_storage

    def upload(self):
        buffer = BytesIO()
        Image.new('RGB', (12, 12), '#2e7d32').save(buffer, 'PNG')
        return SimpleUploadedFile('fixture.png', buffer.getvalue(), content_type='image/png')

    def photo(self, primary=False, product=None):
        photo = ProductImage(product=product or self.product, is_primary=primary)
        photo.image.save('fixture.jpg', ContentFile(b'original fixture photo'), save=True)
        return photo

    def changes(self, remove=None, primary='omitted'):
        changes = {'remove_ids': remove or []}
        if primary != 'omitted':
            changes['primary'] = primary
        return json.dumps(changes)

    def update(self, **data):
        return self.client.patch(self.url, data, format='multipart')

    def assert_primary(self, pk):
        self.assertEqual(list(self.product.images.filter(is_primary=True).values_list('pk', flat=True)), [] if pk is None else [pk])
        response = APIClient().get(self.url)
        self.assertEqual(response.status_code, 200)
        expected = next((photo['image'] for photo in response.data['images'] if photo['id'] == pk), None)
        self.assertEqual(response.data['primary_image'], expected)
        listing = APIClient().get('/api/v1/products/').data['results']
        self.assertEqual(next(product['primary_image'] for product in listing if product['id'] == self.product.pk), expected)

    def test_detail_exposes_stable_ids_and_primary_image(self):
        response = self.client.get(self.url)
        self.assertEqual([photo['id'] for photo in response.data['images']], [self.first.pk, self.second.pk])
        self.assert_primary(self.first.pk)

    def test_existing_photo_can_be_selected_without_uploads(self):
        response = self.update(image_changes_json=self.changes(primary={'id': self.second.pk}))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.product.images.count(), 2)
        self.assert_primary(self.second.pk)

    def test_create_can_choose_second_new_photo(self):
        response = self.client.post('/api/v1/products/', {
            'name': 'New photo seedling', 'category_id': self.category.pk, 'description': 'Fixture', 'price': '300',
            'images': [self.upload(), self.upload()], 'image_changes_json': self.changes(primary={'upload_index': 1}),
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        product = Product.objects.get(slug='new-photo-seedling')
        photos = list(product.images.order_by('pk'))
        self.assertEqual([photo.is_primary for photo in photos], [False, True])
        self.assertTrue(response.data['primary_image'].endswith(photos[1].image.name))

    def test_new_photo_can_replace_primary_while_old_photos_remain(self):
        response = self.update(images=[self.upload()], image_changes_json=self.changes(primary={'upload_index': 0}))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.product.images.count(), 3)
        self.assert_primary(self.product.images.latest('pk').pk)
        self.assertTrue(self.storage.exists(self.first.image.name))

    def test_legacy_append_and_omitted_changes_preserve_existing_photos_and_primary(self):
        response = self.update(images=[self.upload()], price='375')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.product.images.count(), 3)
        self.assert_primary(self.first.pk)

    def test_remove_nonprimary_keeps_primary(self):
        response = self.update(image_changes_json=self.changes(remove=[self.second.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ProductImage.objects.filter(pk=self.second.pk).exists())
        self.assert_primary(self.first.pk)

    def test_remove_primary_promotes_first_remaining_photo(self):
        response = self.update(image_changes_json=self.changes(remove=[self.first.pk]))
        self.assertEqual(response.status_code, 200)
        self.assert_primary(self.second.pk)

    def test_remove_all_photos_returns_empty_gallery(self):
        response = self.update(image_changes_json=self.changes(remove=[self.first.pk, self.second.pk], primary=None))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['images'], [])
        self.assert_primary(None)

    def test_unspecified_photos_are_never_removed(self):
        later_photo = self.photo()
        response = self.update(image_changes_json=self.changes(remove=[self.first.pk], primary={'id': self.second.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(self.product.images.values_list('pk', flat=True)), {self.second.pk, later_photo.pk})

    def test_invalid_changes_fail_before_uploads_or_metadata_writes(self):
        other = Product.objects.create(name='Other seedling', category=self.category, price='300', description='Other')
        foreign = self.photo(product=other)
        invalid = ['{', '[]', 'null', '{} extra', json.dumps({'unexpected': 1}),
                   self.changes(remove=[foreign.pk]), self.changes(remove=[999999]),
                   self.changes(remove=[self.first.pk, self.first.pk]),
                   self.changes(primary={'id': foreign.pk}), self.changes(primary={'upload_index': 1}),
                   self.changes(primary=None), self.changes(primary={}),
                   self.changes(primary={'id': self.first.pk, 'upload_index': 0}),
                   self.changes(primary={'url': 'https://example.test/photo.jpg'}),
                   self.changes(remove=[self.first.pk], primary={'id': self.first.pk})]
        original = list(self.product.images.order_by('pk').values())
        for raw in invalid:
            with self.subTest(raw=raw), patch.object(self.storage, 'save', wraps=self.storage.save) as save:
                response = self.update(image_changes_json=raw, images=[self.upload()], price='425')
                self.assertEqual(response.status_code, 400, response.data)
                save.assert_not_called()
                self.assertEqual(list(self.product.images.order_by('pk').values()), original)
                self.product.refresh_from_db()
                self.assertEqual(self.product.price, 350)

    def test_create_cannot_remove_or_select_existing_photos(self):
        for changes in [self.changes(remove=[self.first.pk]), self.changes(primary={'id': self.first.pk})]:
            response = self.client.post('/api/v1/products/', {
                'name': 'Rejected seedling', 'category_id': self.category.pk, 'description': 'Fixture',
                'price': '300', 'image_changes_json': changes,
            }, format='multipart')
            self.assertEqual(response.status_code, 400)
            self.assertFalse(Product.objects.filter(name='Rejected seedling').exists())

    def test_upload_failure_preserves_old_photos_and_primary(self):
        with patch.object(self.storage, 'save', side_effect=OSError('fixture failure')):
            response = self.update(images=[self.upload()], image_changes_json=self.changes(remove=[self.first.pk], primary={'upload_index': 0}))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.product.images.count(), 2)
        self.assert_primary(self.first.pk)
        self.assertTrue(self.storage.exists(self.first.image.name))

    def test_failure_after_removal_rolls_back_rows_and_never_deletes_original_file(self):
        original = list(self.product.images.order_by('pk').values())
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with patch.object(ProductDetailSerializer, 'to_representation', side_effect=RuntimeError('fixture serialization failure')):
                with self.assertRaises(RuntimeError):
                    self.update(images=[self.upload()], image_changes_json=self.changes(remove=[self.first.pk], primary={'upload_index': 0}))
        self.assertEqual(callbacks, [])
        self.assertEqual(list(self.product.images.order_by('pk').values()), original)
        self.assertTrue(self.storage.exists(self.first.image.name))

    def test_storage_cleanup_is_deferred_until_commit(self):
        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            response = self.update(image_changes_json=self.changes(remove=[self.first.pk]))
            self.assertEqual(response.status_code, 200)
            self.assertTrue(self.storage.exists(self.first.image.name))
        self.assertEqual(len(callbacks), 1)
        self.assertFalse(self.storage.exists(self.first.image.name))
        self.assertTrue(self.storage.exists(self.second.image.name))

    def test_cleanup_failure_does_not_turn_a_committed_save_into_a_failed_response(self):
        with patch.object(self.storage, 'delete', side_effect=OSError('fixture cleanup outage')):
            with self.assertLogs('products.saves', level='ERROR'):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.update(image_changes_json=self.changes(remove=[self.first.pk]))
        self.assertEqual(response.status_code, 200)
        self.assert_primary(self.second.pk)
        self.assertTrue(self.storage.exists(self.first.image.name))

    def test_shared_legacy_storage_key_is_not_deleted(self):
        other = Product.objects.create(name='Shared seedling', category=self.category, price='300', description='Other')
        ProductImage.objects.create(product=other, image=self.first.image.name)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.update(image_changes_json=self.changes(remove=[self.first.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.storage.exists(self.first.image.name))

    def test_multiple_or_missing_legacy_primary_flags_are_normalized_on_save(self):
        self.second.is_primary = True
        self.second.save()
        self.update(price='360')
        self.assert_primary(self.first.pk)
        self.product.images.update(is_primary=False)
        self.update(price='370')
        self.assert_primary(self.first.pk)

    def test_nonstaff_and_guests_cannot_change_photos(self):
        client = APIClient()
        self.assertIn(client.patch(self.url, {'image_changes_json': self.changes(remove=[self.first.pk])}).status_code, [401, 403])
        client.force_authenticate(get_user_model().objects.create_user('photo-customer'))
        self.assertEqual(client.patch(self.url, {'image_changes_json': self.changes(remove=[self.first.pk])}).status_code, 403)
        self.assert_primary(self.first.pk)
