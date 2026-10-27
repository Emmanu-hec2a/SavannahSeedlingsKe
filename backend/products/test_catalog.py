"""Public catalog availability and staff preview regression checks."""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Category, Product, ProductVariant


class CatalogAvailabilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name='QA catalog fruit')
        self.product = Product.objects.create(name='QA active seedling', category=self.category,
            price='350.00', stock=99, description='Visible seedling')
        self.hidden = Product.objects.create(name='QA hidden seedling', category=self.category,
            price='400.00', stock=25, is_active=False, description='Hidden seedling')
        self.staff = get_user_model().objects.create_user('qa-catalog-staff', is_staff=True)
        self.buyer = get_user_model().objects.create_user('qa-catalog-buyer')
        self.customer_token = Token.objects.create(user=self.buyer)

    def catalog(self, **params):
        response = self.client.get('/api/v1/products/', params)
        self.assertEqual(response.status_code, 200)
        return response.data['results']

    def assert_stock(self, expected):
        rows = self.catalog()
        row = next(row for row in rows if row['id'] == self.product.pk)
        detail = self.client.get(f'/api/v1/products/{self.product.slug}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(row['stock'], expected)
        self.assertEqual(detail.data['stock'], expected)

    def test_no_batches_use_product_stock_in_both_responses(self):
        self.assert_stock(99)

    def test_batch_total_overrides_product_stock_in_both_responses(self):
        ProductVariant.objects.create(product=self.product, color_name='Batch A', stock=4)
        ProductVariant.objects.create(product=self.product, color_name='Batch B', stock=8)
        self.assert_stock(12)

    def test_zero_stock_batches_do_not_fall_back_to_old_product_stock(self):
        ProductVariant.objects.create(product=self.product, color_name='Empty batch', stock=0)
        self.assert_stock(0)

    def test_batch_edit_is_reflected_by_fresh_customer_reads(self):
        batch = ProductVariant.objects.create(product=self.product, stock=12)
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f'/api/v1/products/{self.product.slug}/', {
            'variants_json': json.dumps([{'id': batch.pk, 'stock': 7}]),
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['stock'], 7)
        self.client.force_authenticate(None)
        self.assert_stock(7)

    def test_unbatched_stock_write_contract_is_preserved(self):
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f'/api/v1/products/{self.product.slug}/', {'stock': 5}, format='json')
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.client.force_authenticate(None)
        self.assert_stock(5)

    def test_negative_stock_update_is_still_rejected(self):
        self.client.force_authenticate(self.staff)
        response = self.client.patch(f'/api/v1/products/{self.product.slug}/', {'stock': -1}, format='json')
        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 99)

    def test_public_and_customer_queries_cannot_reveal_hidden_products(self):
        for token in ('', f'Token {self.customer_token.key}'):
            self.client.credentials(HTTP_AUTHORIZATION=token)
            for params in ({}, {'search': 'hidden'}, {'category': self.category.slug},
                           {'include_inactive': 'true', 'is_active': 'false'}):
                with self.subTest(customer=bool(token), params=params):
                    self.assertNotIn(self.hidden.pk, [row['id'] for row in self.catalog(**params)])
            self.assertEqual(self.client.get(f'/api/v1/products/{self.hidden.slug}/').status_code, 404)

    def test_staff_can_preview_edit_and_reactivate_hidden_product(self):
        self.client.force_authenticate(self.staff)
        self.assertIn(self.hidden.pk, [row['id'] for row in self.catalog()])
        path = f'/api/v1/products/{self.hidden.slug}/'
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.patch(path, {'is_active': True}, format='json').status_code, 200)
        self.client.force_authenticate(None)
        self.assertIn(self.hidden.pk, [row['id'] for row in self.catalog()])
        self.assertEqual(self.client.get(path).status_code, 200)

    def test_related_products_hide_inactive_cards_and_inactive_source(self):
        response = self.client.get(f'/api/v1/products/{self.product.slug}/related/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.hidden.pk, [row['id'] for row in response.data['results']])
        self.assertEqual(self.client.get(f'/api/v1/products/{self.hidden.slug}/related/').status_code, 404)

    def test_visibility_toggle_removes_and_restores_customer_catalog_entry(self):
        path = f'/api/v1/products/{self.product.slug}/'
        for active in (False, True):
            self.client.force_authenticate(self.staff)
            self.assertEqual(self.client.patch(path, {'is_active': active}, format='json').status_code, 200)
            self.client.force_authenticate(None)
            self.assertEqual(self.product.pk in [row['id'] for row in self.catalog()], active)
            self.assertEqual(self.client.get(path).status_code, 200 if active else 404)
