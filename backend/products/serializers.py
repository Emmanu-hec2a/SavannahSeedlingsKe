from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariant


def primary_image_url(product, request=None):
    image = product.images.order_by('-is_primary', 'pk').first()
    if not image:
        return None
    return request.build_absolute_uri(image.image.url) if request else image.image.url

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'created_at']

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text', 'is_primary']
        read_only_fields = ['id']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and ret.get('image'):
            ret['image'] = request.build_absolute_uri(ret['image'])
        return ret

class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['id', 'color_name', 'color_hex', 'size', 'stock']


class ProductStockField(serializers.IntegerField):
    """Read batch availability without changing legacy product-stock writes."""
    def get_attribute(self, instance):
        return instance

    def to_representation(self, product):
        return product.available_stock


class ProductListSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField()
    category_slug = serializers.SlugField(source='category.slug', read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        source='category', 
        write_only=True
    )
    primary_image = serializers.SerializerMethodField()
    stock = ProductStockField(read_only=True)
    rating = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'category', 'category_slug', 'category_id', 'price', 'original_price', 'primary_image', 'is_active', 'stock', 'description', 'planting_procedure', 'material', 'rating', 'reviews']

    def get_primary_image(self, obj):
        return primary_image_url(obj, self.context.get('request'))

    def get_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg else 4.5 # Default 4.5 if no reviews

    def get_reviews(self, obj):
        return obj.reviews.count()

class ProductDetailSerializer(serializers.ModelSerializer):
    stock = ProductStockField(required=False, min_value=0, max_value=2147483647)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        source='category', 
        write_only=True,
        required=False
    )
    images = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    variants = ProductVariantSerializer(many=True, read_only=True)
    rating = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'category', 'category_id', 'description', 'planting_procedure', 'price',
            'original_price', 'material', 'is_active', 'stock', 
            'created_at', 'updated_at', 'images', 'primary_image', 'variants', 'rating', 'reviews'
        ]

    def get_images(self, obj):
        return ProductImageSerializer(obj.images.order_by('pk'), many=True, context=self.context).data

    def get_primary_image(self, obj):
        return primary_image_url(obj, self.context.get('request'))

    def get_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg else 4.8

    def get_reviews(self, obj):
        return obj.reviews.count()
