import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import IntegrityError, close_old_connections, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.test import APIClient

from products.models import Category, Product, ProductVariant
from .models import Order, OrderItem, OrderStockAllocation


def payload(product, quantity=2, **overrides):
    return {
        'customer_name': 'QA Grower', 'customer_email': 'grower@example.test',
        'customer_phone': '0712345678', 'delivery_address': 'QA Farm near market',
        'city': 'Ruiru', 'county': 'Kiambu', 'payment_method': 'whatsapp',
        'checkout_key': str(uuid4()), 'items': [{'product_slug': product.slug, 'quantity': quantity}],
        **overrides,
    }


class StockAllocationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='QA Fruit')
        self.product = Product.objects.create(name='QA Seedling', category=self.category, price='350.00', stock=0)
        self.first = ProductVariant.objects.create(product=self.product, color_name='Batch One', stock=5)
        self.second = ProductVariant.objects.create(product=self.product, color_name='Batch Two', stock=6)
        self.staff = get_user_model().objects.create_user(username='qa-stock-staff', is_staff=True)
        self.notify = patch('orders.serializers.telegram_service.notify_new_order').start()
        self.addCleanup(patch.stopall)

    def create(self, quantity=2, **overrides):
        response = self.client.post('/api/v1/orders/', payload(self.product, quantity, **overrides), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Order.objects.get(order_number=response.data['order_number']), response

    def stocks(self):
        self.product.refresh_from_db()
        return self.product.stock, list(self.product.variants.order_by('pk').values_list('stock', flat=True))

    def cancel(self, order):
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f'/api/v1/orders/{order.order_number}/', {'status': 'cancelled'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_batch_totals_are_orderable_with_zero_legacy_stock_and_one_receipt_line(self):
        self.assertEqual(self.client.get(f'/api/v1/products/{self.product.slug}/').data['stock'], 11)
        order, response = self.create(quantity=8)
        self.assertEqual(self.stocks(), (0, [0, 3]))
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['quantity'], 8)
        self.assertEqual(response.data['subtotal'], '2800.00')
        self.assertIsNone(response.data['delivery_fee'])
        self.assertIsNone(response.data['total_amount'])
        self.assertEqual(response.data['status'], 'pending_confirmation')
        self.assertFalse(response.data['deposit_paid'])
        self.assertEqual(list(OrderStockAllocation.objects.filter(item__order=order)
                              .order_by('variant_id').values_list('variant_id', 'quantity')),
                         [(self.first.pk, 5), (self.second.pk, 3)])
        self.assertEqual(self.client.get(f'/api/v1/products/{self.product.slug}/').data['stock'], 3)

    def test_zero_batches_do_not_fall_back_to_legacy_stock(self):
        self.product.stock = 99
        self.product.save()
        self.product.variants.update(stock=0)
        response = self.client.post('/api/v1/orders/', payload(self.product), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['stock_issues'][0]['available']), '0')
        self.assertEqual(response.data['stock_issues'][0]['product_slug'], self.product.slug)
        self.assertEqual(response.data['stock_issues'][0]['product_name'], self.product.name)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.stocks(), (99, [0, 0]))

    def test_no_batch_product_uses_legacy_stock_and_restores_same_source(self):
        self.product.variants.all().delete()
        self.product.stock = 10
        self.product.save()
        order, _ = self.create(quantity=3)
        self.assertEqual(self.stocks(), (7, []))
        self.assertIsNone(OrderStockAllocation.objects.get().variant_id)
        ProductVariant.objects.create(product=self.product, stock=20)
        self.cancel(order)
        self.assertEqual(self.stocks(), (10, [20]))

    def test_explicit_batch_is_reserved_before_general_request(self):
        items = [{'product_slug': self.product.slug, 'quantity': 5},
                 {'product_slug': self.product.slug, 'variant_id': self.first.pk, 'quantity': 5}]
        order, _ = self.create(items=items)
        general = order.items.get(variant__isnull=True)
        explicit = order.items.get(variant=self.first)
        self.assertEqual(general.stock_allocations.get().variant_id, self.second.pk)
        self.assertEqual(explicit.stock_allocations.get().variant_id, self.first.pk)
        self.assertEqual(self.stocks(), (0, [0, 1]))

    def test_combined_requests_cannot_double_spend_same_inventory(self):
        items = [{'product_slug': self.product.slug, 'quantity': 7},
                 {'product_slug': self.product.slug, 'variant_id': self.first.pk, 'quantity': 5}]
        response = self.client.post('/api/v1/orders/', payload(self.product, items=items), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.stocks(), (0, [5, 6]))

    def test_foreign_batch_is_rejected(self):
        other = Product.objects.create(name='Other', category=self.category, price=10)
        batch = ProductVariant.objects.create(product=other, stock=20)
        response = self.client.post('/api/v1/orders/', payload(self.product, items=[{
            'product_slug': self.product.slug, 'variant_id': batch.pk, 'quantity': 1,
        }]), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_explicit_batch_shortage_cannot_use_another_batch(self):
        response = self.client.post('/api/v1/orders/', payload(self.product, items=[{
            'product_slug': self.product.slug, 'variant_id': self.first.pk, 'quantity': 6,
        }]), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['stock_issues'][0]['available']), '5')
        self.assertEqual(self.stocks(), (0, [5, 6]))

    def test_multi_product_failure_is_atomic(self):
        other = Product.objects.create(name='Empty', category=self.category, price=10, stock=0)
        items = [{'product_slug': self.product.slug, 'quantity': 4}, {'product_slug': other.slug, 'quantity': 1}]
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/api/v1/orders/', payload(self.product, items=items), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderStockAllocation.objects.exists())
        self.assertEqual(self.stocks(), (0, [5, 6]))
        self.notify.assert_not_called()

    def test_allocation_write_failure_rolls_back_deductions_and_order(self):
        with patch.object(OrderStockAllocation.objects, 'bulk_create', side_effect=IntegrityError('QA failure')):
            with self.assertRaises(IntegrityError):
                self.create(quantity=8)
        self.assertEqual(self.stocks(), (0, [5, 6]))
        self.assertFalse(Order.objects.exists())

    def test_retry_and_repeated_reservation_deduct_once(self):
        body = payload(self.product, quantity=8)
        first = self.client.post('/api/v1/orders/', body, format='json')
        second = self.client.post('/api/v1/orders/', body, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(first.data['order_number'], second.data['order_number'])
        Order.objects.get().reduce_stock()
        self.assertEqual(self.stocks(), (0, [0, 3]))
        self.assertEqual(OrderStockAllocation.objects.count(), 2)

    def test_cancel_restores_exact_batches_once_even_after_stock_edit(self):
        order, _ = self.create(quantity=8)
        self.second.stock = 13
        self.second.save()
        self.cancel(order)
        self.cancel(order)
        order.restock()
        self.assertEqual(self.stocks(), (0, [5, 16]))
        self.assertFalse(OrderStockAllocation.objects.filter(released_at__isnull=True).exists())

    def test_uncancelled_order_cannot_release_stock(self):
        order, _ = self.create()
        with self.assertRaises(ValueError):
            order.restock()
        self.assertEqual(self.stocks(), (0, [3, 6]))

    def test_historical_order_restores_old_product_source_not_current_batches(self):
        body = payload(self.product)
        body.pop('items')
        body.pop('checkout_key')
        old = Order.objects.create(**body, status='pending_confirmation')
        OrderItem.objects.create(order=old, product=self.product, quantity=3, unit_price=350)
        self.assertFalse(old.items.first().stock_allocations.exists())
        self.cancel(old)
        old.restock()
        self.assertEqual(self.stocks(), (3, [5, 6]))

    def test_historical_explicit_order_restores_its_batch(self):
        body = payload(self.product)
        body.pop('items')
        body.pop('checkout_key')
        old = Order.objects.create(**body, status='pending_confirmation')
        OrderItem.objects.create(order=old, product=self.product, variant=self.second, quantity=3, unit_price=350)
        self.cancel(old)
        self.assertEqual(self.stocks(), (0, [5, 9]))

    def test_used_batch_cannot_be_removed_or_deleted(self):
        self.create()
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f'/api/v1/products/{self.product.slug}/', {
            'variants_json': json.dumps([{'id': self.second.pk, 'stock': 6}]),
        }, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('cannot be removed', str(response.data))
        with self.assertRaises(ProtectedError):
            self.first.delete()
        self.assertEqual(self.stocks(), (0, [3, 6]))

    def test_used_product_and_category_deletion_returns_readable_conflict(self):
        self.create()
        self.client.force_authenticate(self.staff)
        for path in (f'/api/v1/products/{self.product.slug}/', f'/api/v1/categories/{self.category.slug}/'):
            response = self.client.delete(path)
            self.assertEqual(response.status_code, 409, response.data)
            self.assertIn('saved orders', str(response.data))
        self.assertEqual(Order.objects.count(), 1)

    def test_allocation_quantity_must_be_positive(self):
        order, _ = self.create()
        with self.assertRaises(IntegrityError), transaction.atomic():
            OrderStockAllocation.objects.create(item=order.items.first(), quantity=0)


@skipUnlessDBFeature('has_select_for_update')
class PostgresStockConcurrencyTests(TransactionTestCase):
    """Must run on disposable PostgreSQL; SQLite cannot prove row-lock behavior."""
    def setUp(self):
        category = Category.objects.create(name='Concurrency Fruit')
        self.product = Product.objects.create(name='Last Seedlings', category=category, price=350)
        self.batch = ProductVariant.objects.create(product=self.product, stock=5)

    def concurrent_posts(self, bodies):
        barrier = Barrier(len(bodies))
        def post(body):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                response = APIClient().post('/api/v1/orders/', body, format='json')
                return response.status_code, response.data
            finally:
                close_old_connections()
        with patch('orders.serializers.telegram_service.notify_new_order'), ThreadPoolExecutor(max_workers=len(bodies)) as pool:
            futures = [pool.submit(post, body) for body in bodies]
            return [future.result(timeout=20) for future in futures]

    def test_competing_orders_cannot_oversell_last_batch(self):
        results = self.concurrent_posts([payload(self.product, 4), payload(self.product, 4)])
        self.assertEqual(sorted(status for status, _ in results), [201, 400])
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.stock, 1)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(OrderStockAllocation.objects.get().quantity, 4)

    def test_concurrent_identical_checkout_returns_same_order_without_second_deduction(self):
        body = payload(self.product, 4)
        results = self.concurrent_posts([body, body])
        self.assertEqual([status for status, _ in results], [201, 201])
        self.assertEqual(results[0][1]['order_number'], results[1][1]['order_number'])
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.stock, 1)
        self.assertEqual(Order.objects.count(), 1)

    def test_concurrent_cancellation_restores_stock_once(self):
        with patch('orders.serializers.telegram_service.notify_new_order'):
            created = APIClient().post('/api/v1/orders/', payload(self.product, 4), format='json')
        self.assertEqual(created.status_code, 201)
        staff = get_user_model().objects.create_user(username='qa-concurrent-staff', is_staff=True)
        barrier = Barrier(2)
        def cancel():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(staff)
                barrier.wait(timeout=10)
                return client.patch(f"/api/v1/orders/{created.data['order_number']}/", {'status': 'cancelled'}, format='json').status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(cancel) for _ in range(2)]
            self.assertEqual([future.result(timeout=20) for future in futures], [200, 200])
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.stock, 5)
        self.assertTrue(OrderStockAllocation.objects.get().released_at)
