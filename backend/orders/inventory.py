"""Atomic stock reservation with an auditable source for cancellation.

All writers lock products first (PK order), then batches (PK order). The order
serializer already holds the order/product locks when calling these helpers.
"""
from collections import defaultdict

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from products.models import Product, ProductVariant
from .models import Order, OrderStockAllocation


STOCK_MESSAGE = 'One or more seedlings are no longer available in the requested quantity. Please update your cart.'


def lock_inventory(items):
    ids = sorted({item.product_id for item in items})
    products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=ids).order_by('pk')}
    batches = list(ProductVariant.objects.select_for_update().filter(product_id__in=ids).order_by('pk'))
    return products, batches


@transaction.atomic
def reserve_stock(order):
    # Also safe for direct callers and repeat calls, not just serializer use.
    Order.objects.select_for_update().get(pk=order.pk)
    if OrderStockAllocation.objects.filter(item__order=order).exists():
        return
    items = list(order.items.order_by('pk'))
    products, batches = lock_inventory(items)
    by_product = defaultdict(list)
    by_id = {batch.pk: batch for batch in batches}
    remaining = {batch.pk: batch.stock for batch in batches}
    legacy = {pk: product.stock for pk, product in products.items()}
    for batch in batches:
        by_product[batch.product_id].append(batch)
    plan, issues = [], []
    # Explicit requests must not lose their batch to a preceding general line.
    for item in sorted(items, key=lambda line: (line.variant_id is None, line.pk)):
        product = products.get(item.product_id)
        pool = by_product[item.product_id]
        if item.variant_id:
            batch = by_id.get(item.variant_id)
            pool = [batch] if batch and batch.product_id == item.product_id else []
            available = sum(remaining[b.pk] for b in pool)
        else:
            available = sum(remaining[b.pk] for b in pool) if pool else legacy.get(item.product_id, 0)
        if not product or not product.is_active:
            available = 0
        if item.quantity > available:
            issues.append({
                'product_slug': product.slug if product else '',
                'product_name': product.name if product else 'Unavailable seedling',
                'variant_id': item.variant_id or '',
                'requested': item.quantity, 'available': available,
            })
            continue
        needed = item.quantity
        if pool:
            for batch in pool:
                taken = min(needed, remaining[batch.pk])
                if taken:
                    plan.append((item, batch, taken))
                    remaining[batch.pk] -= taken
                    needed -= taken
                if not needed:
                    break
        else:
            plan.append((item, None, needed))
            legacy[item.product_id] -= needed
    if issues:
        raise ValidationError({'items': STOCK_MESSAGE, 'stock_issues': issues})
    # Nothing changes until every line has been validated against the same locks.
    for batch in batches:
        if remaining[batch.pk] != batch.stock:
            ProductVariant.objects.filter(pk=batch.pk).update(stock=remaining[batch.pk])
    for pk, product in products.items():
        if legacy[pk] != product.stock:
            Product.objects.filter(pk=pk).update(stock=legacy[pk])
    OrderStockAllocation.objects.bulk_create([
        OrderStockAllocation(item=item, variant=batch, quantity=quantity)
        for item, batch, quantity in plan
    ])


@transaction.atomic
def release_stock(order):
    saved = Order.objects.select_for_update().get(pk=order.pk)
    if saved.status != 'cancelled':
        raise ValueError('Stock can only be released for a cancelled order.')
    items = list(saved.items.order_by('pk'))
    lock_inventory(items)
    allocations = list(OrderStockAllocation.objects.select_for_update()
                       .filter(item__order=saved).select_related('item').order_by('pk'))
    recorded = {allocation.item_id for allocation in allocations}
    for allocation in allocations:
        if allocation.released_at is not None:
            continue
        target = ProductVariant.objects.filter(pk=allocation.variant_id) if allocation.variant_id else Product.objects.filter(pk=allocation.item.product_id)
        target.update(stock=F('stock') + allocation.quantity)
        allocation.released_at = timezone.now()
        allocation.save(update_fields=['released_at'])
    # Historical orders have no allocation ledger. Preserve their actual old
    # source instead of guessing a batch. Record the release to prevent repeats.
    for item in items:
        if item.pk not in recorded:
            target = ProductVariant.objects.filter(pk=item.variant_id) if item.variant_id else Product.objects.filter(pk=item.product_id)
            target.update(stock=F('stock') + item.quantity)
            OrderStockAllocation.objects.create(item=item, variant_id=item.variant_id,
                                                quantity=item.quantity, released_at=timezone.now())
