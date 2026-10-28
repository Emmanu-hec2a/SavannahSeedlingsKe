import random
import string
import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from products.models import Product, ProductVariant

class Order(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    STATUS_CHOICES = (
        ('pending_confirmation', 'Awaiting WhatsApp confirmation'),
        ('pending_deposit', 'Pending Deposit'),
        ('confirmed', 'Confirmed'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    )
    PAYMENT_METHOD_CHOICES = (
        ('whatsapp', 'Arrange on WhatsApp'),
        ('mpesa', 'M-PESA'),
        ('card', 'Card'),
        ('manual', 'Manual (Send Money)'),
    )

    order_number = models.CharField(max_length=10, unique=True, editable=False)
    access_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    checkout_key = models.UUIDField(null=True, blank=True, unique=True)
    customer_name = models.CharField(max_length=100)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=15)
    delivery_address = models.TextField()
    city = models.CharField(max_length=50)
    county = models.CharField(max_length=50)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_deposit')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    balance_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deposit_paid = models.BooleanField(default=False)
    balance_collected = models.BooleanField(default=False)
    is_viewed = models.BooleanField(default=False) # New field to track admin view status
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self.generate_order_number()
        super().save(*args, **kwargs)

    def generate_order_number(self):
        while True:
            digits = ''.join(random.choices(string.digits, k=5))
            order_number = f"TS-{digits}"
            if not Order.objects.filter(order_number=order_number).exists():
                return order_number

    def __str__(self):
        return self.order_number

    def confirm_deposit_payment(self):
        """
        Standardizes the logic for confirming a deposit payment.
        Used by both M-PESA callbacks and manual admin actions.
        """
        if self.delivery_fee is None or self.total_amount is None:
            raise ValueError('Agree and save the delivery fee before confirming payment.')
        if self.status == 'cancelled':
            raise ValueError('A cancelled order cannot be marked as paid.')
        if not self.deposit_paid:
            self.deposit_paid = True
            if self.status in ('pending_deposit', 'pending_confirmation'):
                self.status = 'confirmed'
            self.save()

    @property
    def subtotal(self):
        return sum((item.unit_price * item.quantity for item in self.items.all()), Decimal('0.00'))

    @property
    def delivery_quoted(self):
        return self.delivery_fee is not None

    def reduce_stock(self):
        from .inventory import reserve_stock
        reserve_stock(self)

    def restock(self):
        from .inventory import release_stock
        release_stock(self)

    @property
    def is_fully_reviewed(self):
        # Check if all items in this order have been reviewed
        from products.models import ProductReview
        item_count = self.items.count()
        review_count = ProductReview.objects.filter(order=self).count()
        return review_count >= item_count

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"


class OrderStockAllocation(models.Model):
    """Inventory source for new orders; a null variant means legacy product stock."""
    item = models.ForeignKey(OrderItem, related_name='stock_allocations', on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, related_name='stock_allocations',
                                on_delete=models.PROTECT, null=True, blank=True)
    quantity = models.PositiveIntegerField()
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(check=models.Q(quantity__gt=0),
                                              name='order_allocation_quantity_positive')]


class DeliverySetting(models.Model):
    nairobi_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    upcountry_delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=250.00)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1, defaults={
            'nairobi_delivery_fee': 0.00,
            'upcountry_delivery_fee': 250.00
        })
        return obj

    def __str__(self):
        return f"Delivery Settings (Nairobi: KES {self.nairobi_delivery_fee}, Upcountry: KES {self.upcountry_delivery_fee})"
