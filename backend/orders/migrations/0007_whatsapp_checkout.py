import uuid
from django.db import migrations, models


def populate_access_tokens(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    for order in Order.objects.using(schema_editor.connection.alias).filter(access_token__isnull=True).iterator():
        Order.objects.using(schema_editor.connection.alias).filter(pk=order.pk).update(access_token=uuid.uuid4())


class Migration(migrations.Migration):
    dependencies = [('orders', '0006_deliverysetting')]

    operations = [
        migrations.AddField(model_name='order', name='access_token', field=models.UUIDField(null=True, editable=False)),
        migrations.RunPython(populate_access_tokens, migrations.RunPython.noop),
        migrations.AlterField(model_name='order', name='access_token', field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
        migrations.AddField(model_name='order', name='checkout_key', field=models.UUIDField(null=True, blank=True, unique=True)),
        migrations.AlterField(model_name='order', name='payment_method', field=models.CharField(max_length=10, choices=[('whatsapp', 'Arrange on WhatsApp'), ('mpesa', 'M-PESA'), ('card', 'Card'), ('manual', 'Manual (Send Money)')])),
        migrations.AlterField(model_name='order', name='status', field=models.CharField(max_length=20, default='pending_deposit', choices=[('pending_confirmation', 'Awaiting WhatsApp confirmation'), ('pending_deposit', 'Pending Deposit'), ('confirmed', 'Confirmed'), ('shipped', 'Shipped'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled')])),
        *[migrations.AlterField(model_name='order', name=name, field=models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)) for name in ('total_amount', 'delivery_fee', 'deposit_amount', 'balance_amount')],
    ]
