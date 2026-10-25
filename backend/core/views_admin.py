from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from orders.models import Order
from payments.models import MpesaTransaction
from datetime import timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_me(request):
    return Response({
        "username": request.user.username,
        "email": request.user.email,
        "is_staff": request.user.is_staff
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not user.check_password(old_password):
        return Response({"detail": "Current password is incorrect"}, status=status.HTTP_400_BAD_REQUEST)
    
    user.set_password(new_password)
    user.save()
    return Response({"detail": "Password updated successfully"})

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_dashboard_stats(request):
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    
    # Orders needing attention (pending deposit AND not viewed)
    unread_orders_count = Order.objects.filter(is_viewed=False).count()
    unread_orders = Order.objects.filter(is_viewed=False).order_by('-created_at')[:5]
    from orders.serializers import OrderSerializer
    unread_data = OrderSerializer(unread_orders, many=True).data

    # 1. Today's orders
    orders_today_count = Order.objects.filter(created_at__date=today).count()
    orders_yesterday_count = Order.objects.filter(created_at__date=yesterday).count()
    
    # 2. Revenue today (confirmed orders deposits)
    revenue_today = Order.objects.filter(
        created_at__date=today, 
        deposit_paid=True
    ).aggregate(total=Sum('deposit_amount'))['total'] or 0
    
    # 3. Pending deposits
    pending_deposits_count = Order.objects.filter(status__in=['pending_confirmation', 'pending_deposit']).count()
    pending_deposits_total = Order.objects.filter(status='pending_deposit').aggregate(total=Sum('deposit_amount'))['total'] or 0
    
    # 4. Balance to collect
    balance_outstanding = Order.objects.filter(status='shipped', balance_collected=False).aggregate(total=Sum('balance_amount'))['total'] or 0
    balance_orders_count = Order.objects.filter(status='shipped', balance_collected=False).count()
    
    # Chart A: Orders last 30 days
    orders_last_30 = []
    for i in range(29, -1, -1):
        date = today - timedelta(days=i)
        count = Order.objects.filter(created_at__date=date).count()
        orders_last_30.append({"date": date.strftime('%Y-%m-%d'), "count": count})
        
    # Chart B: Revenue last 30 days
    revenue_last_30 = []
    for i in range(29, -1, -1):
        date = today - timedelta(days=i)
        # Deposits paid on this day
        deposits_data = Order.objects.filter(
            updated_at__date=date, # Status changed to confirmed when paid
            deposit_paid=True
        ).aggregate(total=Sum('deposit_amount'))['total'] or 0
        # Balances collected on this day
        balances_data = Order.objects.filter(
            updated_at__date=date, 
            status='delivered', 
            balance_collected=True
        ).aggregate(total=Sum('balance_amount'))['total'] or 0
        revenue_last_30.append({
            "date": date.strftime('%Y-%m-%d'), 
            "deposit": float(deposits_data), 
            "balance": float(balances_data)
        })
        
    # Recent orders (last 10)
    from orders.serializers import OrderSerializer
    recent_orders_qs = Order.objects.all().order_by('-created_at')[:10]
    recent_orders = OrderSerializer(recent_orders_qs, many=True).data
    
    return Response({
        "unread_orders_count": unread_orders_count,
        "unread_orders": unread_data,
        "orders_today": orders_today_count,
        "orders_yesterday": orders_yesterday_count,
        "revenue_today": float(revenue_today),
        "pending_deposits_count": pending_deposits_count,
        "pending_deposits_total": float(pending_deposits_total),
        "balance_outstanding": float(balance_outstanding),
        "balance_orders_count": balance_orders_count,
        "orders_last_30_days": orders_last_30,
        "revenue_last_30_days": revenue_last_30,
        "recent_orders": recent_orders
    })
