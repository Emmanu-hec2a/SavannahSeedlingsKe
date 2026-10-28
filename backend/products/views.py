from django.db import transaction
from django.db.models.deletion import ProtectedError
from rest_framework.exceptions import APIException
from rest_framework import generics, filters, status
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from core.permissions import StaffWriteOrReadOnly
from django.views.decorators.cache import cache_page
from django.shortcuts import get_object_or_404
from .models import Category, Product
from .serializers import CategorySerializer, ProductListSerializer, ProductDetailSerializer
from .saves import validate_batches, prepare_images, close_images, save_batches, save_images, cleanup_uploads


from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


def visible_products(queryset, user):
    return queryset if user.is_staff else queryset.filter(is_active=True)


class InventoryInUse(APIException):
    status_code = 409
    default_detail = 'This inventory is used by saved orders and cannot be deleted. Hide the product or update its stock instead.'


class ProtectOrderedInventory:
    def perform_destroy(self, instance):
        try:
            with transaction.atomic():
                if isinstance(instance, Product):
                    products = Product.objects.filter(pk=instance.pk)
                else:
                    Category.objects.select_for_update().get(pk=instance.pk)
                    products = Product.objects.filter(category=instance)
                products = list(products.select_for_update().order_by('pk'))
                if any(product.orderitem_set.exists() for product in products):
                    raise InventoryInUse()
                instance.delete()
        except ProtectedError as exc:
            raise InventoryInUse() from exc


@api_view(['GET'])
@permission_classes([IsAdminUser])
def debug_storage(request):
    from django.conf import settings
    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile

    # Test upload from live server
    test_path = default_storage.save('test/live-server-test.txt', ContentFile(b'hello from live server'))
    test_url = default_storage.url(test_path)

    return Response({
        'storage': settings.DEFAULT_FILE_STORAGE,
        'bucket': getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'NOT SET'),
        'test_upload_path': test_path,
        'test_upload_url': test_url,
    })

class CategoryListView(generics.ListCreateAPIView):
    permission_classes = [StaffWriteOrReadOnly]
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer

class ProductListView(generics.ListCreateAPIView):
    permission_classes = [StaffWriteOrReadOnly]
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug', 'description']
    ordering_fields = ['price', 'created_at']

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        batches = validate_batches(data)
        images = prepare_images(request.FILES.getlist('images'))
        uploads = []
        try:
            with transaction.atomic():
                product = serializer.save()
                save_batches(product, batches)
                save_images(product, images, uploads)
                response_data = serializer.data
                headers = self.get_success_headers(response_data)
            return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception:
            cleanup_uploads(uploads)
            raise
        finally:
            close_images(images)

    def get_queryset(self):
        queryset = visible_products(super().get_queryset(), self.request.user)
        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        return queryset

class ProductDetailView(ProtectOrderedInventory, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [StaffWriteOrReadOnly]
    queryset = Product.objects.all()
    serializer_class = ProductDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return visible_products(super().get_queryset(), self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        data = request.data.copy()
        images = []
        uploads = []
        try:
            with transaction.atomic():
                self.queryset = self.get_queryset().select_for_update()
                instance = self.get_object()
                serializer = self.get_serializer(instance, data=data, partial=partial)
                serializer.is_valid(raise_exception=True)
                batches = validate_batches(data, instance)
                images = prepare_images(request.FILES.getlist('images'))
                self.perform_update(serializer)
                save_batches(instance, batches)
                save_images(instance, images, uploads)
                if getattr(instance, '_prefetched_objects_cache', None):
                    instance._prefetched_objects_cache = {}
                response_data = serializer.data
            return Response(response_data)
        except Exception:
            cleanup_uploads(uploads)
            raise
        finally:
            close_images(images)

class RelatedProductView(generics.ListAPIView):
    serializer_class = ProductListSerializer

    def get_queryset(self):
        slug = self.kwargs.get('slug')
        product = generics.get_object_or_404(visible_products(Product.objects.all(), self.request.user), slug=slug)
        return Product.objects.filter(
            category=product.category,
            is_active=True
        ).exclude(id=product.id)[:4]

class CategoryDetailView(ProtectOrderedInventory, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [StaffWriteOrReadOnly]
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = 'slug'


from rest_framework.response import Response
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

@api_view(['POST'])
@permission_classes([IsAdminUser])
def test_upload(request):
    if 'image' not in request.FILES:
        return Response({'error': 'No image provided'}, status=400)

    image = request.FILES['image']
    try:
        path = default_storage.save(f'test/{image.name}', ContentFile(image.read()))
        url = default_storage.url(path)
        return Response({'success': True, 'path': path, 'url': url})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
