from rest_framework import generics, filters, permissions
from rest_framework.response import Response
from django.db import transaction
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import NotFound
from .models import Order
from .serializers import OrderSerializer

class OrderListCreateView(generics.ListCreateAPIView):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['order_number', 'customer_name', 'customer_phone']

    def get_permissions(self):
        return [permissions.AllowAny()] if self.request.method == 'POST' else [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related('items__product__images', 'transactions')
        
        # If user is authenticated, they should only see their own orders
        # UNLESS they are an admin (who uses the same endpoint for the admin panel)
        if self.request.user.is_authenticated and not self.request.user.is_staff:
            return queryset.filter(user=self.request.user)
            
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def perform_create(self, serializer):
        # Link order to user if logged in
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            serializer.save()

class OrderDetailView(generics.RetrieveUpdateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    lookup_field = 'order_number'

    def get_permissions(self):
        if self.request.method in ['PATCH', 'PUT']:
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get_object(self):
        instance = super().get_object()
        user = self.request.user
        owner = user.is_authenticated and instance.user_id == user.pk
        token = self.request.headers.get('X-Order-Token', '')
        if not (user.is_staff or owner or constant_time_compare(str(instance.access_token), token)):
            raise NotFound('Order not found.')
        return instance

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        self.queryset = Order.objects.select_for_update().all()
        return super().update(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Mark as viewed when an admin opens the detail page
        if request.user.is_staff and not instance.is_viewed:
            instance.is_viewed = True
            instance.save()
        return super().retrieve(request, *args, **kwargs)


from rest_framework.views import APIView
from .models import DeliverySetting

class DeliverySettingView(APIView):
    def get(self, request):
        setting = DeliverySetting.get_settings()
        return Response({
            'nairobi_delivery_fee': float(setting.nairobi_delivery_fee),
            'upcountry_delivery_fee': float(setting.upcountry_delivery_fee),
            'updated_at': setting.updated_at
        })
    def put(self, request):
        if not (request.user and request.user.is_staff):
            return Response({'detail': 'Admin permission required'}, status=403)
        setting = DeliverySetting.get_settings()
        if 'nairobi_delivery_fee' in request.data:
            setting.nairobi_delivery_fee = request.data['nairobi_delivery_fee']
        if 'upcountry_delivery_fee' in request.data:
            setting.upcountry_delivery_fee = request.data['upcountry_delivery_fee']
        setting.save()
        return Response({
            'nairobi_delivery_fee': float(setting.nairobi_delivery_fee),
            'upcountry_delivery_fee': float(setting.upcountry_delivery_fee),
            'updated_at': setting.updated_at
        })

