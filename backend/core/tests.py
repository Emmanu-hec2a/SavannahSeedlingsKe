from datetime import timedelta
from hashlib import sha256

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from products.models import Category, Product
from .models import AdminSession


class AdminAuthTests(TestCase):
    password = 'Nursery-Test-Password-92!'
    root = '/api/v1/admin/auth/'

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.staff = get_user_model().objects.create_user('staff-test', password=self.password, is_staff=True)
        self.buyer = get_user_model().objects.create_user('buyer-test', password=self.password)

    def login(self, username='staff-test', password=None):
        return self.client.post(self.root + 'login/', {
            'username': username, 'password': password or self.password,
        }, format='json')

    def authorize(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'no-store')
        token = response.data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'AdminToken {token}')
        return token

    def test_staff_login_stores_digest_and_returns_identity_and_expiry(self):
        before = timezone.now()
        response = self.login()
        self.assertEqual(response.status_code, 200)
        session = AdminSession.objects.get()
        self.assertEqual(session.token_digest, sha256(response.data['token'].encode()).hexdigest())
        self.assertNotEqual(session.token_digest, response.data['token'])
        self.assertGreaterEqual(session.expires_at, before + timedelta(hours=8))
        self.assertLess(session.expires_at, timezone.now() + timedelta(hours=8, seconds=1))
        self.assertEqual(response.data['user']['username'], self.staff.username)
        self.assertTrue(response.data['user']['is_staff'])
        self.assertNotIn('password_signature', response.data)
        self.assertNotIn('password', response.data['user'])

    def test_buyer_wrong_password_and_inactive_staff_cannot_login(self):
        self.assertEqual(self.login('buyer-test').status_code, 403)
        self.assertEqual(self.login(password='incorrect').status_code, 400)
        self.staff.is_active = False
        self.staff.save()
        self.assertEqual(self.login().status_code, 400)
        self.assertFalse(AdminSession.objects.exists())

    def test_identity_is_verified_on_refresh(self):
        self.authorize()
        response = self.client.get(self.root + 'me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], self.staff.pk)
        self.assertIn('expires_at', response.data)

    def test_anonymous_forged_and_malformed_sessions_are_denied(self):
        for header in ('', 'AdminToken forged', 'AdminToken', 'AdminToken a b', 'AdminToken ' + 'a' * 257):
            with self.subTest(header=header[:40]):
                self.client.credentials(HTTP_AUTHORIZATION=header)
                self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)

    def test_customer_and_old_staff_tokens_cannot_restore_admin_session(self):
        for user in (self.buyer, self.staff):
            token = Token.objects.create(user=user)
            self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
            self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)
            self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)

    def test_expired_session_is_revoked(self):
        self.authorize()
        AdminSession.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)
        self.assertFalse(AdminSession.objects.exists())

    def test_demoted_or_disabled_staff_session_is_revoked(self):
        self.authorize()
        self.staff.is_staff = False
        self.staff.save()
        self.assertEqual(self.client.get('/api/v1/admin/dashboard/').status_code, 401)
        self.assertFalse(AdminSession.objects.exists())
        self.staff.is_staff = True
        self.staff.save()
        self.authorize()
        self.staff.is_active = False
        self.staff.save()
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)

    def test_logout_revokes_only_current_admin_session_and_preserves_customer_token(self):
        customer_token = Token.objects.create(user=self.staff)
        other = self.login().data['token']
        self.authorize()
        self.assertEqual(self.client.get(self.root + 'logout/').status_code, 405)
        self.assertEqual(self.client.post(self.root + 'logout/').status_code, 204)
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)
        self.assertTrue(Token.objects.filter(key=customer_token.key).exists())
        self.client.credentials(HTTP_AUTHORIZATION=f'AdminToken {other}')
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 200)

    def test_password_change_validates_and_revokes_all_admin_sessions(self):
        self.login()
        self.authorize()
        for old, new in (('wrong', 'Another-Good-Password-42!'), (self.password, '123')):
            response = self.client.post(self.root + 'password/', {'old_password': old, 'new_password': new}, format='json')
            self.assertEqual(response.status_code, 400)
        response = self.client.post(self.root + 'password/', {
            'old_password': self.password, 'new_password': 'Another-Good-Password-42!',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password('Another-Good-Password-42!'))
        self.assertFalse(AdminSession.objects.exists())
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)

    def test_password_reset_elsewhere_invalidates_admin_session(self):
        self.authorize()
        self.staff.set_password('Reset-Test-Password-43!')
        self.staff.save()
        self.assertEqual(self.client.get(self.root + 'me/').status_code, 401)
        self.assertFalse(AdminSession.objects.exists())

    def test_login_attempts_are_throttled(self):
        for _ in range(10):
            self.assertEqual(self.login(password='wrong').status_code, 400)
        self.assertEqual(self.login(password='wrong').status_code, 429)

    def test_public_reads_and_staff_only_catalog_writes(self):
        category = Category.objects.create(name='Test category')
        product = Product.objects.create(name='Test seedling', category=category, price=100, stock=10)
        buyer_token = Token.objects.create(user=self.buyer)
        writes = [
            ('post', '/api/v1/products/'), ('post', '/api/v1/categories/'),
            ('patch', f'/api/v1/products/{product.slug}/'), ('put', f'/api/v1/products/{product.slug}/'),
            ('delete', f'/api/v1/products/{product.slug}/'), ('patch', f'/api/v1/categories/{category.slug}/'),
            ('put', f'/api/v1/categories/{category.slug}/'), ('delete', f'/api/v1/categories/{category.slug}/'),
            ('post', '/api/v1/products/test-upload/'), ('get', '/api/v1/products/debug-storage/'),
        ]
        for header in ('', f'Token {buyer_token.key}'):
            self.client.credentials(HTTP_AUTHORIZATION=header)
            self.assertEqual(self.client.get('/api/v1/products/').status_code, 200)
            self.assertEqual(self.client.get('/api/v1/categories/').status_code, 200)
            self.assertEqual(self.client.get(f'/api/v1/products/{product.slug}/').status_code, 200)
            for method, path in writes:
                with self.subTest(header=bool(header), method=method, path=path):
                    response = getattr(self.client, method)(path, {}, format='json')
                    self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(Category.objects.count(), 1)
        self.authorize()
        response = self.client.post('/api/v1/categories/', {'name': 'Staff category'}, format='json')
        self.assertEqual(response.status_code, 201)
        new_category = response.data
        response = self.client.post('/api/v1/products/', {
            'name': 'Staff seedling', 'category_id': new_category['id'], 'price': '350.00', 'description': 'Test only',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        path = f"/api/v1/products/{response.data['slug']}/"
        self.assertEqual(self.client.patch(path, {'stock': 5}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(path).status_code, 204)
        path = f"/api/v1/categories/{new_category['slug']}/"
        self.assertEqual(self.client.patch(path, {'description': 'Staff updated'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(path).status_code, 204)

    @override_settings(CORS_ALLOWED_ORIGINS=['http://localhost:5174'], CORS_ALLOW_ALL_ORIGINS=False)
    def test_admin_cors_preflight_is_explicit(self):
        for origin, allowed in [('http://localhost:5174', True), ('https://untrusted.example', False)]:
            response = self.client.options(self.root + 'login/', HTTP_ORIGIN=origin,
                HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST', HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type')
            self.assertEqual(response.has_header('access-control-allow-origin'), allowed)
