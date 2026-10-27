"""Admin-action regression checks. Run only with tinahstore.test_settings.

The optional browser test uses real local APIs, a disposable database/storage,
and the existing production frontend bundles. No live service credentials.
"""
import json
import os
from decimal import Decimal
from io import BytesIO
from pathlib import Path
import subprocess
from unittest import skipUnless

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import FileResponse
from django.test import LiveServerTestCase, TestCase, override_settings
from django.urls import path
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from orders.models import DeliverySetting
from products.models import Category, Product, ProductVariant
from tinahstore.urls import urlpatterns as application_urls


def test_media(request, filename):
    return FileResponse(default_storage.open(filename, 'rb'))


# Only used by the disposable browser test, not the deployed application.
urlpatterns = [path('media/<path:filename>', test_media), *application_urls]


class AdminActionTests(TestCase):
    def setUp(self):
        if not os.environ.get('DJANGO_SETTINGS_MODULE', '').endswith('.test_settings'):
            self.skipTest('Use the isolated test settings, never the application database/storage.')
        cache.clear()
        self.staff = get_user_model().objects.create_user(
            username='qa-actions-staff', password='QA-Original-Password-42!', is_staff=True)
        self.client = APIClient()
        self.public = APIClient()
        login = self.client.post('/api/v1/admin/auth/login/', {
            'username': self.staff.username, 'password': 'QA-Original-Password-42!',
        }, format='json')
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"AdminToken {login.data['token']}")
        self.category = Category.objects.create(name='QA Fruit')

    def image(self, name='qa-seedling.png'):
        image = BytesIO()
        # A wide, thin fixture exercises resizing without allocating a large photo.
        Image.new('RGBA', (1800, 12), (46, 125, 50, 255)).save(image, format='PNG')
        return SimpleUploadedFile(name, image.getvalue(), content_type='image/png')

    def product(self):
        return Product.objects.create(name='QA Seedling', category=self.category,
                                      price='350.00', stock=12, description='QA description')

    def test_multipart_upload_is_saved_and_available_to_public_storefront_reads(self):
        response = self.client.post('/api/v1/products/', {
            'name': 'QA Uploaded Seedling', 'slug': 'qa-uploaded-seedling',
            'category_id': self.category.pk, 'price': '350.00',
            'description': 'Uploaded from admin', 'is_active': '1',
            'variants_json': json.dumps([{'color_name': 'Grafted', 'size': 'Regular', 'stock': 19}]),
            'images': [self.image()],
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        product = Product.objects.get(slug='qa-uploaded-seedling')
        photo = product.images.get()
        self.assertTrue(default_storage.exists(photo.image.name))
        with default_storage.open(photo.image.name, 'rb') as stored:
            image = Image.open(stored)
            self.assertEqual(image.format, 'JPEG')
            self.assertEqual(image.size, (1200, 8))
        listing = self.public.get('/api/v1/products/').data['results'][0]
        detail = self.public.get('/api/v1/products/qa-uploaded-seedling/').data
        self.assertEqual(listing['stock'], 19)
        self.assertTrue(listing['primary_image'].endswith('.jpg'))
        self.assertEqual(detail['images'][0]['image'], listing['primary_image'])
        self.assertEqual(detail['variants'][0]['stock'], 19)

    def test_product_edit_reaches_public_list_and_detail(self):
        product = self.product()
        category = Category.objects.create(name='QA Citrus')
        response = self.client.patch(f'/api/v1/products/{product.slug}/', {
            'name': 'QA Updated Seedling', 'price': '425.50',
            'category_id': category.pk, 'description': 'Updated description',
            'planting_procedure': 'Updated care instructions',
            'variants_json': json.dumps([{'color_name': 'Grafted', 'size': 'Regular', 'stock': 7}]),
            'images': [self.image('qa-added-photo.png')],
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        listing = self.public.get('/api/v1/products/').data['results'][0]
        detail = self.public.get(f'/api/v1/products/{product.slug}/').data
        for data in (listing, detail):
            self.assertEqual(data['name'], 'QA Updated Seedling')
            self.assertEqual(data['price'], '425.50')
            self.assertEqual(data['description'], 'Updated description')
            self.assertEqual(data['planting_procedure'], 'Updated care instructions')
        self.assertEqual(listing['stock'], 7)
        self.assertEqual(listing['category'], 'QA Citrus')
        self.assertEqual(detail['category']['id'], category.pk)
        self.assertEqual(len(detail['images']), 1)
        self.assertEqual(detail['stock'], 7, 'Product page stock disagrees with the catalog batch total')

    def test_deactivated_product_is_hidden_from_public_catalog(self):
        product = self.product()
        response = self.client.patch(f'/api/v1/products/{product.slug}/', {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200)
        products = self.public.get('/api/v1/products/').data['results']
        self.assertNotIn(product.pk, [row['id'] for row in products], 'Inactive product is still public')

    def test_invalid_product_edit_does_not_replace_stock_or_add_images(self):
        product = self.product()
        variant = ProductVariant.objects.create(product=product, color_name='Original', stock=12)
        response = self.client.patch(f'/api/v1/products/{product.slug}/', {
            'price': 'not-a-price', 'images': [self.image('should-not-save.png')],
            'variants_json': json.dumps([{'color_name': 'Replacement', 'stock': 3}]),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(product.variants.filter(pk=variant.pk, stock=12).exists(),
                        'Rejected update changed the saved stock variants')
        self.assertEqual(product.images.count(), 0, 'Rejected update saved an image')

    def test_invalid_uploaded_image_is_rejected_not_silently_ignored(self):
        response = self.client.post('/api/v1/products/', {
            'name': 'QA Bad Image', 'category_id': self.category.pk,
            'price': '350.00', 'description': 'Invalid image test',
            'images': [SimpleUploadedFile('broken.png', b'not an image', content_type='image/png')],
        }, format='multipart')
        self.assertEqual(response.status_code, 400, 'Invalid upload was reported as successful')

    def test_settings_patch_used_by_admin_ui_persists_fees(self):
        response = self.client.patch('/api/v1/orders/delivery-settings/', {
            'nairobi_delivery_fee': 80.5, 'upcountry_delivery_fee': 375,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        data = self.public.get('/api/v1/orders/delivery-settings/').data
        self.assertEqual(data['nairobi_delivery_fee'], 80.5)
        self.assertEqual(data['upcountry_delivery_fee'], 375)

    def test_settings_put_supported_by_backend_persists_fees(self):
        response = self.client.put('/api/v1/orders/delivery-settings/', {
            'nairobi_delivery_fee': 80.5, 'upcountry_delivery_fee': 375,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        settings = DeliverySetting.get_settings()
        self.assertEqual(settings.nairobi_delivery_fee, Decimal('80.50'))
        self.assertEqual(settings.upcountry_delivery_fee, Decimal('375'))

    def test_negative_delivery_fee_is_rejected_without_changing_saved_rates(self):
        settings = DeliverySetting.get_settings()
        response = self.client.put('/api/v1/orders/delivery-settings/', {
            'nairobi_delivery_fee': -25, 'upcountry_delivery_fee': 375,
        }, format='json')
        self.assertEqual(response.status_code, 400, 'Negative delivery fee was accepted')
        settings.refresh_from_db()
        self.assertEqual(settings.nairobi_delivery_fee, Decimal('0.00'))

    def test_public_and_customer_cannot_update_delivery_settings(self):
        buyer = get_user_model().objects.create_user('qa-actions-buyer', password='QA-Buyer-Password-42!')
        token = Token.objects.create(user=buyer)
        for authorization in ('', f'Token {token.key}'):
            self.public.credentials(HTTP_AUTHORIZATION=authorization)
            response = self.public.put('/api/v1/orders/delivery-settings/', {
                'nairobi_delivery_fee': 100, 'upcountry_delivery_fee': 500,
            }, format='json')
            self.assertEqual(response.status_code, 403)
        self.assertFalse(DeliverySetting.objects.exists())

    def test_password_change_rejects_old_login_accepts_new_and_revokes_session(self):
        response = self.client.post('/api/v1/admin/auth/password/', {
            'old_password': 'QA-Original-Password-42!', 'new_password': 'QA-Replaced-Password-73!',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get('/api/v1/admin/auth/me/').status_code, 401)
        for password, expected in [('QA-Original-Password-42!', 400), ('QA-Replaced-Password-73!', 200)]:
            response = self.public.post('/api/v1/admin/auth/login/', {
                'username': self.staff.username, 'password': password,
            }, format='json')
            self.assertEqual(response.status_code, expected)


@skipUnless(os.environ.get('RUN_ADMIN_BROWSER_TESTS') == '1', 'Opt in to real local API browser checks')
@override_settings(ROOT_URLCONF=__name__)
class AdminActionsBrowserTests(LiveServerTestCase):
    def test_admin_actions_and_storefront_with_real_local_api(self):
        self.assertTrue(os.environ['DJANGO_SETTINGS_MODULE'].endswith('.test_settings'))
        cache.clear()
        get_user_model().objects.create_user(username='qa-actions-staff',
            password='QA-Original-Password-42!', is_staff=True)
        Category.objects.create(name='QA Fruit', slug='qa-fruit')
        DeliverySetting.get_settings()
        root = Path(__file__).resolve().parents[2]
        try:
            result = subprocess.run(['node', '--experimental-websocket',
                                     str(root / 'admin-panel/scripts/check-admin-actions.mjs'),
                                     self.live_server_url], cwd=root, capture_output=True,
                                    encoding='utf-8', errors='replace', timeout=100)
        except subprocess.TimeoutExpired as error:
            print('Browser helper timed out; partial output:')
            print(error.stdout.decode('utf-8', errors='replace') if isinstance(error.stdout, bytes) else error.stdout)
            raise
        print(result.stdout)
        if result.stderr:
            print(result.stderr[-5000:])
        self.assertEqual(result.returncode, 0, 'See browser report above for actual end-to-end failures')
