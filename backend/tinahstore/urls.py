from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views_admin import admin_dashboard_stats, get_me, change_password
from core.views_auth import GoogleLogin
from core.views_admin_auth import AdminLoginView, AdminSessionView, AdminLogoutView, AdminPasswordView
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.routers import SimpleRouter
from core.views_nursery import NurseryPhotoViewSet

nursery_router = SimpleRouter()
nursery_router.register('nursery-photos', NurseryPhotoViewSet, basename='nursery-photo')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/v1/auth/token/', obtain_auth_token, name='api_token_auth'),
    path('api/v1/admin/auth/login/', AdminLoginView.as_view(), name='admin_login'),
    path('api/v1/admin/auth/me/', AdminSessionView.as_view(), name='admin_session'),
    path('api/v1/admin/auth/logout/', AdminLogoutView.as_view(), name='admin_logout'),
    path('api/v1/admin/auth/password/', AdminPasswordView.as_view(), name='admin_password'),
    path('api/v1/auth/me/', get_me, name='auth_me'),
    path('api/v1/auth/change-password/', change_password, name='change_password'),
    path('api/v1/auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('api/v1/auth/', include('dj_rest_auth.urls')),
    path('api/v1/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/v1/admin/dashboard/', admin_dashboard_stats, name='admin_dashboard'),
    path('api/v1/', include([
        path('', include(nursery_router.urls)),
        path('products/', include('products.urls')),
        path('categories/', include('products.urls_categories')),
        path('orders/', include('orders.urls')),
        path('payments/', include('payments.urls')),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
