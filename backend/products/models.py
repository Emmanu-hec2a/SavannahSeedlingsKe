import os
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image
from django.db import models
from django.utils.text import slugify
from django.core.validators import MinValueValidator, MaxValueValidator

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    category = models.ForeignKey(Category, related_name='products', on_delete=models.CASCADE)
    description = models.TextField()
    planting_procedure = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    material = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    stock = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    class Meta:                          # ← add this entire block
        ordering = ['-created_at']

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='products/')
    alt_text = models.CharField(max_length=200, blank=True)
    is_primary = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Image for {self.product.name}"

class ProductVariant(models.Model):
    SIZE_CHOICES = (
        ('Regular', 'Regular'),
        ('Large', 'Large'),
    )
    product = models.ForeignKey(Product, related_name='variants', on_delete=models.CASCADE)
    color_name = models.CharField(max_length=50)
    color_hex = models.CharField(max_length=7)
    size = models.CharField(max_length=20, choices=SIZE_CHOICES, default='Regular')
    stock = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.product.name} - {self.color_name} ({self.size})"

class ProductReview(models.Model):
    product = models.ForeignKey(Product, related_name='reviews', on_delete=models.CASCADE)
    order = models.ForeignKey('orders.Order', related_name='product_reviews', on_delete=models.CASCADE)
    customer_name = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    is_verified_purchase = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('product', 'order')

    def __str__(self):
        return f"{self.rating} stars for {self.product.name} by {self.customer_name}"
