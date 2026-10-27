from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from products.models import Category, Product
from .models import DeliverySetting, Order


class DeliverySettingsTests(TestCase):
    path = '/api/v1/orders/delivery-settings/'

    def setUp(self):
        self.client = APIClient()
        self.public = APIClient()
        self.staff = get_user_model().objects.create_user('qa-delivery-staff', is_staff=True)
        self.client.force_authenticate(self.staff)

    def test_get_preserves_public_numeric_response(self):
        response = self.public.get(self.path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['nairobi_delivery_fee'], 0)
        self.assertEqual(response.json()['upcountry_delivery_fee'], 250)
        self.assertIsInstance(response.json()['upcountry_delivery_fee'], (int, float))
        self.assertIn('updated_at', response.data)

    def test_patch_and_put_accept_exact_decimal_strings(self):
        for method in ('patch', 'put'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.path, {
                    'nairobi_delivery_fee': '80.10', 'upcountry_delivery_fee': '375.25',
                }, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                saved = DeliverySetting.get_settings()
                self.assertEqual(saved.nairobi_delivery_fee, Decimal('80.10'))
                self.assertEqual(saved.upcountry_delivery_fee, Decimal('375.25'))
                self.assertEqual(self.public.get(self.path).json()['upcountry_delivery_fee'], 375.25)

    def test_partial_patch_and_legacy_partial_put_preserve_other_fee(self):
        for method in ('patch', 'put'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.path, {'nairobi_delivery_fee': '50.25'}, format='json')
                self.assertEqual(response.status_code, 200)
                saved = DeliverySetting.get_settings()
                self.assertEqual(saved.nairobi_delivery_fee, Decimal('50.25'))
                self.assertEqual(saved.upcountry_delivery_fee, Decimal('250.00'))

    def test_zero_and_maximum_allowed_fee_are_valid(self):
        response = self.client.patch(self.path, {
            'nairobi_delivery_fee': '0.00', 'upcountry_delivery_fee': '99999999.99',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DeliverySetting.get_settings().upcountry_delivery_fee, Decimal('99999999.99'))

    def test_invalid_values_leave_both_fees_and_timestamp_unchanged(self):
        saved = DeliverySetting.get_settings()
        before = DeliverySetting.objects.values().get(pk=saved.pk)
        for method in ('patch', 'put'):
            for field in ('nairobi_delivery_fee', 'upcountry_delivery_fee'):
                for invalid in ('-0.01', 'NaN', 'Infinity', 'not-a-price', '', None, True, '1.234', '100000000.00'):
                    with self.subTest(method=method, field=field, invalid=invalid):
                        payload = {'nairobi_delivery_fee': '80.50', 'upcountry_delivery_fee': '375.00', field: invalid}
                        response = getattr(self.client, method)(self.path, payload, format='json')
                        self.assertEqual(response.status_code, 400, response.data)
                        self.assertIn(field, response.data)
                        self.assertEqual(DeliverySetting.objects.values().get(pk=saved.pk), before)

    def test_invalid_update_does_not_create_settings(self):
        response = self.client.patch(self.path, {'nairobi_delivery_fee': '-1'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(DeliverySetting.objects.exists())

    def test_anonymous_and_customer_cannot_patch_or_put(self):
        buyer = get_user_model().objects.create_user('qa-delivery-buyer')
        token = Token.objects.create(user=buyer)
        for authorization in ('', f'Token {token.key}'):
            self.public.credentials(HTTP_AUTHORIZATION=authorization)
            for method in ('patch', 'put'):
                response = getattr(self.public, method)(self.path, {'nairobi_delivery_fee': 75}, format='json')
                self.assertEqual(response.status_code, 403)
                self.assertFalse(DeliverySetting.objects.exists())

    def test_global_rate_changes_do_not_reprice_existing_whatsapp_orders(self):
        order = Order.objects.create(customer_name='QA grower', customer_email='qa@example.test',
            customer_phone='0712345678', city='Ruiru', county='Kiambu', delivery_address='QA farm',
            payment_method='whatsapp', status='pending_confirmation',
            delivery_fee='90.00', total_amount='440.00')
        response = self.client.patch(self.path, {
            'nairobi_delivery_fee': '100.00', 'upcountry_delivery_fee': '600.00',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.delivery_fee, Decimal('90.00'))
        self.assertEqual(order.total_amount, Decimal('440.00'))

    def test_new_whatsapp_checkout_still_requires_a_separate_delivery_quote(self):
        category = Category.objects.create(name='QA delivery fruit')
        product = Product.objects.create(name='QA delivery seedling', category=category, price='350.00', stock=5)
        self.client.patch(self.path, {'nairobi_delivery_fee': '100.00', 'upcountry_delivery_fee': '600.00'}, format='json')
        with patch('orders.serializers.telegram_service.notify_new_order'):
            response = self.public.post('/api/v1/orders/', {
                'customer_name': 'QA grower', 'customer_email': 'qa@example.test', 'customer_phone': '0712345678',
                'delivery_address': 'QA farm', 'city': 'Ruiru', 'county': 'Kiambu',
                'payment_method': 'whatsapp', 'checkout_key': str(uuid4()),
                'items': [{'product_slug': product.slug, 'quantity': 1}],
            }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['delivery_fee'])
        self.assertIsNone(response.data['total_amount'])
