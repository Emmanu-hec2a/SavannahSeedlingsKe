from django.urls import path
from .views import OrderListCreateView, OrderDetailView, DeliverySettingView

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='order-list-create'),
    path('delivery-settings/', DeliverySettingView.as_view(), name='delivery-settings'),
    path('<str:order_number>/', OrderDetailView.as_view(), name='order-detail'),
]

