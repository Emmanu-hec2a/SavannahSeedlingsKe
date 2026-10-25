from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from products.models import Category, Product, ProductVariant
from orders.models import Order


class WhatsAppCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='Fruit')
        self.product = Product.objects.create(name='Hass Avocado', category=self.category, price='350.00', stock=20)
        self.staff = get_user_model().objects.create_user(username='nursery', password='test', is_staff=True)
        self.notify = patch('orders.serializers.telegram_service.notify_new_order').start()
        self.stk = patch('orders.serializers.mpesa_service.initiate_stk_push').start()
        self.addCleanup(patch.stopall)

    def payload(self, **changes):
        return {
            'customer_name': 'Test Grower', 'customer_email': 'grower@example.com',
            'customer_phone': '0712345678', 'delivery_address': 'Test Farm, near the market',
            'city': 'Ruiru', 'county': 'Kiambu', 'payment_method': 'whatsapp',
            'checkout_key': str(uuid4()), 'items': [{'product_slug': self.product.slug, 'quantity': 2}],
            **changes,
        }

    def create_order(self, **changes):
        response = self.client.post('/api/v1/orders/', self.payload(**changes), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_whatsapp_order_is_unpaid_unquoted_and_priced_by_server(self):
        data = self.create_order(total_amount='1.00', delivery_fee='0.00', deposit_paid=True, status='confirmed')
        self.assertEqual(data['subtotal'], '700.00')
        self.assertEqual(data['status'], 'pending_confirmation')
        for field in ('delivery_fee', 'total_amount', 'deposit_amount', 'balance_amount'):
            self.assertIsNone(data[field])
        self.assertFalse(data['deposit_paid'])
        self.assertFalse(data['delivery_quoted'])
        self.assertEqual(data['items'][0]['product_name'], self.product.name)
        self.assertEqual(data['delivery_address'], 'Test Farm, near the market')
        self.stk.assert_not_called()
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 18)

    def test_retry_returns_same_order_and_reserves_stock_only_once(self):
        payload = self.payload()
        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post('/api/v1/orders/', payload, format='json')
            second = self.client.post('/api/v1/orders/', payload, format='json')
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data['order_number'], second.data['order_number'])
        self.assertEqual(Order.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 18)
        self.notify.assert_called_once()

    def test_reused_checkout_key_with_changed_order_is_rejected(self):
        payload = self.payload()
        self.client.post('/api/v1/orders/', payload, format='json')
        payload['customer_name'] = 'Different customer'
        response = self.client.post('/api/v1/orders/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Order.objects.count(), 1)

    def test_empty_cart_and_invalid_quantities_are_rejected(self):
        for items in ([], [{'product_slug': self.product.slug, 'quantity': 0}], [{'product_slug': self.product.slug, 'quantity': 21}]):
            response = self.client.post('/api/v1/orders/', self.payload(items=items), format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 20)

    def test_duplicate_lines_and_mismatched_variants_are_rejected(self):
        item = {'product_slug': self.product.slug, 'quantity': 2}
        response = self.client.post('/api/v1/orders/', self.payload(items=[item, item]), format='json')
        self.assertEqual(response.status_code, 400)
        other = Product.objects.create(name='Mango', category=self.category, price=200, stock=10)
        variant = ProductVariant.objects.create(product=other, color_name='Green', color_hex='#000000', stock=10)
        response = self.client.post('/api/v1/orders/', self.payload(items=[{**item, 'variant_id': variant.pk}]), format='json')
        self.assertEqual(response.status_code, 400)

    def test_required_delivery_details(self):
        for field in ('delivery_address', 'city', 'county', 'customer_phone'):
            response = self.client.post('/api/v1/orders/', self.payload(**{field: ''}), format='json')
            self.assertEqual(response.status_code, 400, field)

    def test_guest_cannot_list_orders_or_guess_details(self):
        data = self.create_order()
        self.assertIn(self.client.get('/api/v1/orders/').status_code, (401, 403))
        path = f"/api/v1/orders/{data['order_number']}/"
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.get(path, HTTP_X_ORDER_TOKEN=str(uuid4())).status_code, 404)
        self.assertEqual(self.client.get(path, HTTP_X_ORDER_TOKEN=data['access_token']).status_code, 200)
        self.assertFalse(Order.objects.get(order_number=data['order_number']).is_viewed)

    def test_authenticated_buyer_only_sees_own_orders(self):
        guest = self.create_order()
        user = get_user_model().objects.create_user(username='buyer', password='test')
        self.client.force_authenticate(user)
        own = self.create_order()
        response = self.client.get('/api/v1/orders/')
        self.assertEqual([o['order_number'] for o in response.data['results']], [own['order_number']])
        self.assertEqual(self.client.get(f"/api/v1/orders/{guest['order_number']}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/orders/{own['order_number']}/").status_code, 200)

    def test_only_staff_can_quote_delivery(self):
        data = self.create_order()
        path = f"/api/v1/orders/{data['order_number']}/"
        self.assertIn(self.client.patch(path, {'delivery_fee': '250.00'}, format='json', HTTP_X_ORDER_TOKEN=data['access_token']).status_code, (401, 403))
        self.client.force_authenticate(self.staff)
        response = self.client.patch(path, {'delivery_fee': '250.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total_amount'], '950.00')
        self.assertEqual(response.data['deposit_amount'], '950.00')
        self.assertEqual(response.data['status'], 'pending_deposit')
        self.assertFalse(response.data['deposit_paid'])
        self.assertEqual(self.client.patch(path, {'delivery_fee': '-1'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(path, {'delivery_fee': '99999999.99'}, format='json').status_code, 400)

    def test_payment_requires_delivery_quote_and_free_quote_is_explicit(self):
        data = self.create_order()
        self.client.force_authenticate(self.staff)
        path = f"/api/v1/orders/{data['order_number']}/"
        self.assertEqual(self.client.patch(path, {'deposit_paid': True}, format='json').status_code, 400)
        response = self.client.patch(path, {'delivery_fee': '0.00'}, format='json')
        self.assertTrue(response.data['delivery_quoted'])
        self.assertEqual(response.data['total_amount'], '700.00')
        response = self.client.patch(path, {'deposit_paid': True, 'status': 'confirmed'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'confirmed')
        self.assertTrue(response.data['deposit_paid'])
        self.assertEqual(self.client.patch(path, {'delivery_fee': '500'}, format='json').status_code, 400)
        response = self.client.patch(path, {'status': 'cancelled'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['deposit_paid'])  # Cancellation must not erase payment history.

    def test_unpaid_order_cannot_be_dispatched(self):
        data = self.create_order()
        self.client.force_authenticate(self.staff)
        path = f"/api/v1/orders/{data['order_number']}/"
        self.assertEqual(self.client.patch(path, {'status': 'shipped'}, format='json').status_code, 400)

    def test_cancellation_releases_stock_only_once(self):
        data = self.create_order()
        self.client.force_authenticate(self.staff)
        path = f"/api/v1/orders/{data['order_number']}/"
        for _ in range(2):
            self.assertEqual(self.client.patch(path, {'status': 'cancelled'}, format='json').status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 20)
        self.assertEqual(self.client.patch(path, {'deposit_paid': True}, format='json').status_code, 400)

    def test_notification_handles_unquoted_delivery_and_escapes_customer_text(self):
        from core.services.telegram import TelegramService
        data = self.create_order(customer_name='<Grower>')
        order = Order.objects.get(order_number=data['order_number'])
        with patch.object(TelegramService, 'send_message') as send:
            TelegramService().notify_new_order(order)
        text = send.call_args.args[0]
        self.assertIn('To be agreed on WhatsApp', text)
        self.assertIn('&lt;Grower&gt;', text)

    def test_payment_actions_are_staff_only(self):
        data = self.create_order()
        for path, payload in (
            ('/api/v1/payments/mpesa/initiate/', {'order_number': data['order_number']}),
            ('/api/v1/payments/mpesa/query/', {'checkout_request_id': 'test-id'}),
        ):
            self.assertIn(self.client.post(path, payload, format='json').status_code, (401, 403))
        self.assertIn(self.client.get('/api/v1/payments/transactions/').status_code, (401, 403))
        self.stk.assert_not_called()

    def test_payment_status_requires_order_access(self):
        from payments.models import MpesaTransaction
        data = self.create_order()
        MpesaTransaction.objects.create(order=Order.objects.get(order_number=data['order_number']), checkout_request_id='test-id', merchant_request_id='test-merchant', phone_number='254712345678', amount=Decimal('700.00'))
        path = '/api/v1/payments/mpesa/status/test-id/'
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.get(path, HTTP_X_ORDER_TOKEN=data['access_token']).status_code, 200)
