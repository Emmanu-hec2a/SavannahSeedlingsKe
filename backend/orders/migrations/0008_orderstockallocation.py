from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('orders', '0007_whatsapp_checkout')]
    operations = [
        migrations.CreateModel(
            name='OrderStockAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField()),
                ('released_at', models.DateTimeField(blank=True, null=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                          related_name='stock_allocations', to='orders.orderitem')),
                ('variant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                                             related_name='stock_allocations', to='products.productvariant')),
            ],
            options={'constraints': [models.CheckConstraint(check=models.Q(quantity__gt=0),
                                                            name='order_allocation_quantity_positive')]},
        ),
    ]
