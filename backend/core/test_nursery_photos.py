"""Isolated nursery publishing, authorization and file replacement checks."""
from io import BytesIO
import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from .models import NurseryPhoto
from .views_nursery import NurseryPhotoSerializer, NurseryPhotoViewSet


class NurseryPhotoTests(TestCase):
    url = '/api/v1/nursery-photos/'

    def setUp(self):
        if not os.environ.get('DJANGO_SETTINGS_MODULE', '').endswith('.test_settings'):
            self.skipTest('Use isolated test settings; never real media or database.')
        cache.clear()
        staff = get_user_model().objects.create_user('nursery-editor', password='Nursery-QA-42!', is_staff=True)
        self.client = APIClient()
        login = self.client.post('/api/v1/admin/auth/login/', {'username': staff.username, 'password': 'Nursery-QA-42!'}, format='json')
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"AdminToken {login.data['token']}")
        self.public = APIClient()
        self.storage = default_storage
        self.original = NurseryPhoto(alt_text='Original nursery', caption='Original caption', is_featured=True)
        self.original.image.save('original.jpg', ContentFile(b'keep-original'), save=True)
        self.detail = f'{self.url}{self.original.pk}/'
        self.initial = self.snapshot()

    def image(self, size=(32, 24), name='nursery.png'):
        with BytesIO() as output:
            Image.new('RGB', size, '#2e7d32').save(output, 'PNG')
            return SimpleUploadedFile(name, output.getvalue(), content_type='image/png')

    def snapshot(self):
        return (list(NurseryPhoto.objects.order_by('pk').values()), sorted(self.storage.listdir('nursery')[1]))

    def assert_unchanged(self):
        self.assertEqual(self.snapshot(), self.initial)
        self.assertEqual(self.storage.open(self.original.image.name).read(), b'keep-original')

    def create_photo(self, **changes):
        return self.client.post(self.url, {'image': self.image(), 'alt_text': 'Healthy seedlings', **changes}, format='multipart')

    def test_staff_upload_and_public_photo_metadata(self):
        response = self.create_photo(caption='At our nursery', position=3)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn('/media/nursery/', response.data['image'])
        self.assertEqual(response.data['alt_text'], 'Healthy seedlings')
        with self.storage.open(NurseryPhoto.objects.get(pk=response.data['id']).image.name) as saved:
            with Image.open(saved) as photo:
                self.assertEqual(photo.format, 'JPEG')
                self.assertEqual(photo.size, (32, 24))
                self.assertFalse(photo.getexif())
        public = self.public.get(self.url)
        self.assertEqual(public['Cache-Control'], 'no-store')
        self.assertEqual(len(public.data), 2)

    def test_resize_large_photo_and_strip_orientation_metadata(self):
        with BytesIO() as output:
            exif = Image.Exif()
            exif[274] = 6
            Image.new('RGB', (1800, 900), '#2e7d32').save(output, 'JPEG', exif=exif)
            upload = SimpleUploadedFile('rotated.jpg', output.getvalue(), content_type='image/jpeg')
        response = self.client.post(self.url, {'image': upload, 'alt_text': 'Upright trees'}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        with self.storage.open(NurseryPhoto.objects.get(pk=response.data['id']).image.name) as saved:
            with Image.open(saved) as photo:
                self.assertEqual(photo.size, (800, 1600))
                self.assertFalse(photo.getexif())

    def test_public_and_nonstaff_cannot_create_edit_or_delete(self):
        buyer = get_user_model().objects.create_user('nursery-buyer', password='Buyer-QA-42!')
        for user in (None, buyer):
            self.public.force_authenticate(user=user)
            self.assertIn(self.public.post(self.url, {'caption': 'Malicious'}, format='json').status_code, (401, 403))
            self.assertIn(self.public.patch(self.detail, {'caption': 'Malicious'}, format='json').status_code, (401, 403))
            self.assertIn(self.public.delete(self.detail).status_code, (401, 403))
        self.assert_unchanged()

    def test_hide_and_republish_photo(self):
        self.assertEqual(self.client.patch(self.detail, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(self.public.get(self.url).data, [])
        self.assertEqual(self.public.get(self.detail).status_code, 404)
        self.assertEqual(len(self.client.get(self.url).data), 1)
        self.assertEqual(self.client.patch(self.detail, {'is_active': True}, format='json').status_code, 200)
        self.assertEqual(len(self.public.get(self.url).data), 1)

    def test_feature_switch_and_display_order(self):
        second = self.create_photo(position=4).data
        third = self.create_photo(position=1).data
        response = self.client.patch(f"{self.url}{second['id']}/", {'is_featured': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.original.refresh_from_db()
        self.assertFalse(self.original.is_featured)
        self.assertEqual(NurseryPhoto.objects.filter(is_featured=True).count(), 1)
        self.assertEqual([p['id'] for p in self.public.get(self.url).data], [second['id'], self.original.pk, third['id']])

    def test_invalid_fields_reject_before_upload_and_keep_saved_data(self):
        for changes in ({'alt_text': ''}, {'position': -1}, {'position': 2147483648}, {'caption': 'x' * 201}, {'is_active': 'invalid'}):
            with patch.object(self.storage, 'save', wraps=self.storage.save) as save:
                response = self.client.patch(self.detail, {'image': self.image(), **changes}, format='multipart')
            self.assertEqual(response.status_code, 400, response.data)
            save.assert_not_called()
            self.assert_unchanged()

    def test_missing_invalid_and_oversized_photos_reject_without_writes(self):
        self.assertEqual(self.client.post(self.url, {'alt_text': 'No photo'}, format='json').status_code, 400)
        for upload in (SimpleUploadedFile('bad.png', b'not-image', content_type='image/png'),
                       SimpleUploadedFile('big.png', self.image().read() + b'0' * (5 * 1024 * 1024), content_type='image/png')):
            response = self.client.patch(self.detail, {'image': upload}, format='multipart')
            self.assertEqual(response.status_code, 400, response.data)
            self.assert_unchanged()

    def test_metadata_edit_preserves_image_and_supports_clearing_caption(self):
        get_object = NurseryPhotoViewSet.get_object
        def get_locked_object(view):
            self.assertTrue(view.get_queryset().query.select_for_update, 'Saved photo must be locked during edits')
            return get_object(view)
        with patch.object(NurseryPhotoViewSet, 'get_object', new=get_locked_object):
            response = self.client.patch(self.detail, {'caption': '', 'alt_text': 'Updated description', 'position': 12}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.original.refresh_from_db()
        self.assertEqual(self.original.caption, '')
        self.assertEqual(self.original.alt_text, 'Updated description')
        self.assertEqual(self.original.image.name, self.initial[0][0]['image'])

    def test_successful_replacement_deletes_old_file_only_after_commit(self):
        old_name = self.original.image.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(self.detail, {'image': self.image()}, format='multipart')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(self.storage.exists(old_name))
        self.assertFalse(self.storage.exists(old_name))
        self.original.refresh_from_db()
        self.assertNotEqual(self.original.image.name, old_name)
        self.assertTrue(self.storage.exists(self.original.image.name))

    def test_write_then_raise_cleans_new_key_and_preserves_saved_photo(self):
        original_save = self.storage.save
        def failure(name, content, **kwargs):
            original_save(name, content, **kwargs)
            raise OSError('Simulated storage outage')
        with self.assertLogs('core.views_nursery', level='ERROR'), patch.object(self.storage, 'save', side_effect=failure):
            response = self.client.patch(self.detail, {'image': self.image(), 'caption': 'Must not stick'}, format='multipart')
        self.assertEqual(response.status_code, 503)
        self.assert_unchanged()

    def test_failed_response_serialization_rolls_back_replacement_and_feature_switch(self):
        second = self.create_photo().data
        self.initial = self.snapshot()
        with patch.object(NurseryPhotoSerializer, 'to_representation', side_effect=RuntimeError('Broken media URL')):
            with self.assertRaises(RuntimeError):
                self.client.patch(f"{self.url}{second['id']}/", {'image': self.image(), 'is_featured': True}, format='multipart')
        self.assert_unchanged()

    def test_database_failure_cleans_upload_and_rolls_back_feature_flag(self):
        with patch.object(NurseryPhoto.objects, 'create', side_effect=IntegrityError('Concurrent promotion')):
            response = self.create_photo(is_featured=True)
        self.assertEqual(response.status_code, 400)
        self.assert_unchanged()

    def test_delete_removes_file_only_after_commit(self):
        name = self.original.image.name
        get_object = NurseryPhotoViewSet.get_object
        def get_locked_object(view):
            self.assertTrue(view.get_queryset().query.select_for_update, 'Saved photo must be locked during deletion')
            return get_object(view)
        with self.captureOnCommitCallbacks(execute=True), patch.object(NurseryPhotoViewSet, 'get_object', new=get_locked_object):
            response = self.client.delete(self.detail)
            self.assertEqual(response.status_code, 204)
            self.assertTrue(self.storage.exists(name))
        self.assertFalse(self.storage.exists(name))
        self.assertEqual(self.public.get(self.url).data, [])

    def test_cleanup_outage_does_not_break_successful_replacement(self):
        with self.assertLogs('core.views_nursery', level='ERROR'), patch.object(self.storage, 'delete', side_effect=OSError('Cleanup unavailable')):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.patch(self.detail, {'image': self.image()}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.original.refresh_from_db()
        self.assertTrue(self.storage.exists(self.original.image.name))
