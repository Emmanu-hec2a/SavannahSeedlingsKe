from rest_framework import serializers
from .models import Category, Product, ProductImage, ProductVariant

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image', 'created_at']

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['image', 'alt_text', 'is_primary']

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

class ProductListSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField()
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        source='category', 
        write_only=True
    )
    primary_image = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'category', 'category_id', 'price', 'original_price', 'primary_image', 'is_active', 'stock', 'description', 'planting_procedure', 'material', 'rating', 'reviews']

    def get_primary_image(self, obj):
        image = obj.images.filter(is_primary=True).first()
        if not image:
            image = obj.images.first()
        if image:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(image.image.url)
            return image.image.url
        return None

    def get_stock(self, obj):
        # Calculate total stock across all variants, or use product stock if no variants
        if obj.variants.exists():
            return sum(v.stock for v in obj.variants.all())
        return obj.stock

    def get_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg else 4.5 # Default 4.5 if no reviews

    def get_reviews(self, obj):
        return obj.reviews.count()

class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        source='category', 
        write_only=True,
        required=False
    )
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    rating = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'category', 'category_id', 'description', 'planting_procedure', 'price',
            'original_price', 'material', 'is_active', 'stock', 
            'created_at', 'updated_at', 'images', 'variants', 'rating', 'reviews'
        ]

    def get_rating(self, obj):
        from django.db.models import Avg
        avg = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(float(avg), 1) if avg else 4.8

    def get_reviews(self, obj):
        return obj.reviews.count()
