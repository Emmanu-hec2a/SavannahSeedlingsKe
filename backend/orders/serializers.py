from decimal import Decimal
import logging
import re
from django.db import transaction
from rest_framework import serializers
from products.models import Product, ProductVariant
from .models import Order, OrderItem, DeliverySetting
from payments.models import MpesaTransaction
from payments.serializers import MpesaTransactionSerializer
from payments.services.mpesa import mpesa_service
from core.services.telegram import telegram_service

logger = logging.getLogger(__name__)


class OrderItemSerializer(serializers.ModelSerializer):
    product_slug = serializers.SlugRelatedField(slug_field='slug', queryset=Product.objects.filter(is_active=True), source='product')
    product_name = serializers.CharField(source='product.name', read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.all(), source='variant', required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1)
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['product_slug', 'product_name', 'variant_id', 'quantity', 'unit_price', 'primary_image']
        read_only_fields = ['unit_price', 'primary_image']

    def validate(self, attrs):
        if attrs.get('variant') and attrs['variant'].product_id != attrs['product'].pk:
            raise serializers.ValidationError('This variant does not belong to the selected seedling.')
        return attrs

    def get_primary_image(self, obj):
        image = obj.product.images.filter(is_primary=True).first() or obj.product.images.first()
        if not image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(image.image.url) if request else image.image.url


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, allow_empty=False)
    transactions = MpesaTransactionSerializer(many=True, read_only=True)
    checkout_request_id = serializers.CharField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    delivery_quoted = serializers.BooleanField(read_only=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'), allow_null=True, required=False)
    checkout_key = serializers.UUIDField(write_only=True, required=False)
    payment_method = serializers.ChoiceField(choices=Order.PAYMENT_METHOD_CHOICES, default='whatsapp')

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'access_token', 'checkout_key', 'customer_name', 'customer_email', 'customer_phone',
            'delivery_address', 'city', 'county', 'payment_method', 'status', 'subtotal', 'delivery_quoted',
            'total_amount', 'delivery_fee', 'deposit_amount', 'balance_amount', 'deposit_paid', 'balance_collected',
            'items', 'transactions', 'checkout_request_id', 'is_fully_reviewed', 'created_at',
        ]
        read_only_fields = ['id', 'order_number', 'access_token', 'total_amount', 'deposit_amount', 'balance_amount', 'is_fully_reviewed', 'created_at']

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        staff_update = self.instance is not None and request and request.user.is_staff
        for name in ('status', 'deposit_paid', 'balance_collected', 'delivery_fee'):
            fields[name].read_only = not staff_update
        if self.instance is not None:
            for name in ('items', 'payment_method', 'checkout_key'):
                fields[name].read_only = True
        return fields

    def validate_items(self, items):
        keys = [(item['product'].pk, item.get('variant').pk if item.get('variant') else None) for item in items]
        if len(keys) != len(set(keys)):
            raise serializers.ValidationError('Combine duplicate seedling entries before submitting.')
        return items

    def validate_customer_phone(self, value):
        digits = re.sub(r'[\s()+-]', '', value)
        if not digits.isdigit() or not 7 <= len(digits) <= 15:
            raise serializers.ValidationError('Enter a valid phone or WhatsApp number.')
        return value

    def validate(self, attrs):
        order = self.instance
        if order is None:
            return attrs
        fee = attrs.get('delivery_fee', order.delivery_fee)
        paid = attrs.get('deposit_paid', order.deposit_paid)
        status = attrs.get('status', order.status)
        if 'delivery_fee' in attrs and (order.deposit_paid or order.status not in ('pending_confirmation', 'pending_deposit')):
            raise serializers.ValidationError({'delivery_fee': 'Delivery can only be quoted before payment and dispatch.'})
        if paid and (fee is None or (status == 'cancelled' and not order.deposit_paid)):
            raise serializers.ValidationError({'deposit_paid': 'Save the agreed delivery fee before confirming payment on an active order.'})
        if order.deposit_paid and not paid:
            raise serializers.ValidationError({'deposit_paid': 'A verified payment cannot be cleared through this action.'})
        if status in ('confirmed', 'shipped', 'delivered') and not paid:
            raise serializers.ValidationError({'status': 'Verify payment before confirming or dispatching this order.'})
        transitions = {
            'pending_confirmation': {'pending_confirmation', 'pending_deposit', 'confirmed', 'cancelled'},
            'pending_deposit': {'pending_deposit', 'confirmed', 'cancelled'},
            'confirmed': {'confirmed', 'shipped', 'cancelled'},
            'shipped': {'shipped', 'delivered', 'cancelled'},
            'delivered': {'delivered'}, 'cancelled': {'cancelled'},
        }
        if status not in transitions.get(order.status, {order.status}):
            raise serializers.ValidationError({'status': 'This order status change is not allowed.'})
        return attrs

    def existing_checkout(self, validated_data, items_data):
        key = validated_data.get('checkout_key')
        if not key:
            return None
        existing = Order.objects.select_for_update().filter(checkout_key=key).first()
        if existing is None:
            return None
        fields = ('customer_name', 'customer_email', 'customer_phone', 'delivery_address', 'city', 'county', 'payment_method', 'user')
        same_details = all(getattr(existing, name) == validated_data.get(name) for name in fields)
        requested = sorted((item['product'].pk, item.get('variant').pk if item.get('variant') else 0, item['quantity']) for item in items_data)
        saved = sorted((item.product_id, item.variant_id or 0, item.quantity) for item in existing.items.all())
        if not same_details or requested != saved:
            raise serializers.ValidationError({'checkout_key': 'This checkout reference was already used. Start a new order.'})
        return existing

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        existing = self.existing_checkout(validated_data, items_data)
        if existing:
            return existing
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=[i['product'].pk for i in items_data]).order_by('pk')}
        variants = {v.pk: v for v in ProductVariant.objects.select_for_update().filter(pk__in=[i['variant'].pk for i in items_data if i.get('variant')]).order_by('pk')}
        existing = self.existing_checkout(validated_data, items_data)
        if existing:
            return existing
        subtotal = Decimal('0.00')
        for item in items_data:
            product = products.get(item['product'].pk)
            variant = variants.get(item['variant'].pk) if item.get('variant') else None
            stock = variant.stock if variant else product.stock if product else 0
            if not product or not product.is_active or stock < item['quantity']:
                raise serializers.ValidationError({'items': 'One or more seedlings are no longer available in the requested quantity. Please update your cart.'})
            item.update(product=product, variant=variant, unit_price=product.price)
            subtotal += product.price * item['quantity']
        if subtotal > Decimal('99999999.99'):
            raise serializers.ValidationError({'items': 'Please contact the nursery directly for an order of this size.'})
        whatsapp = validated_data.get('payment_method') == 'whatsapp'
        fee = None
        if not whatsapp:
            cfg = DeliverySetting.get_settings()
            location = f"{validated_data.get('county', '')} {validated_data.get('city', '')}".lower()
            fee = cfg.nairobi_delivery_fee if 'nairobi' in location else cfg.upcountry_delivery_fee
        total = subtotal + fee if fee is not None else None
        order = Order.objects.create(
            total_amount=total, delivery_fee=fee, deposit_amount=total,
            balance_amount=Decimal('0.00') if total is not None else None,
            status='pending_confirmation' if whatsapp else 'pending_deposit',
            deposit_paid=False, balance_collected=False, **validated_data,
        )
        for item in items_data:
            OrderItem.objects.create(order=order, **item)
        order.reduce_stock()

        def notify():
            try:
                telegram_service.notify_new_order(order)
            except Exception:
                logger.exception('New-order notification failed for %s', order.order_number)
        transaction.on_commit(notify)

        if order.payment_method == 'mpesa':
            try:
                response = mpesa_service.initiate_stk_push(order)
                if response.get('ResponseCode') == '0':
                    MpesaTransaction.objects.create(order=order, checkout_request_id=response['CheckoutRequestID'], merchant_request_id=response['MerchantRequestID'], phone_number=order.customer_phone, amount=order.deposit_amount)
                    order.checkout_request_id = response['CheckoutRequestID']
            except Exception:
                logger.exception('STK push failed for %s', order.order_number)
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        was_cancelled = instance.status == 'cancelled'
        if 'delivery_fee' in validated_data:
            fee = validated_data['delivery_fee']
            total = instance.subtotal + fee if fee is not None else None
            if total is not None and total > Decimal('99999999.99'):
                raise serializers.ValidationError({'delivery_fee': 'The final total exceeds the supported order amount.'})
            instance.total_amount = total
            instance.deposit_amount = total
            instance.balance_amount = Decimal('0.00') if total is not None else None
            if instance.payment_method == 'whatsapp' and instance.status in ('pending_confirmation', 'pending_deposit'):
                instance.status = 'pending_deposit' if fee is not None else 'pending_confirmation'
        if validated_data.get('deposit_paid') and instance.status in ('pending_confirmation', 'pending_deposit'):
            validated_data['status'] = 'confirmed'
        instance = super().update(instance, validated_data)
        if instance.status == 'cancelled' and not was_cancelled:
            instance.restock()
        return instance
