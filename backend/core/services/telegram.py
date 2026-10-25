import requests
import logging
from html import escape
from django.conf import settings

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
        self.chat_ids = getattr(settings, 'TELEGRAM_CHAT_IDS', [])
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"

    def send_message(self, message):
        """
        Sends a message to all configured chat IDs.
        """
        if not self.bot_token or not self.chat_ids:
            logger.warning("Telegram alerts are not configured.")
            return

        for chat_id in self.chat_ids:
            url = f"{self.base_url}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            try:
                response = requests.post(url, json=payload, timeout=10)
                response.raise_for_status()
            except Exception as e:
                logger.error(f"Failed to send Telegram message to {chat_id}: {e}")

    def notify_new_order(self, order):
        """
        Formats and sends a notification for a new order.
        """
        items_list = "\n".join([f"- {item.quantity}x {escape(item.product.name)}" for item in order.items.all()])
        total = f'KSh {order.total_amount:,.2f}' if order.total_amount is not None else 'Awaiting delivery quote'
        delivery = f'KSh {order.delivery_fee:,.2f}' if order.delivery_fee is not None else 'To be agreed on WhatsApp'
        
        message = (
            f"🌱 <b>New Savannah Seedlings Order!</b>\n\n"
            f"<b>Order Number:</b> <code>{order.order_number}</code>\n"
            f"<b>Customer:</b> {escape(order.customer_name)}\n"
            f"<b>Phone:</b> {escape(order.customer_phone)}\n"
            f"<b>Payment Method:</b> {order.get_payment_method_display()}\n"
            f"<b>Seedling subtotal:</b> KSh {order.subtotal:,.2f}\n"
            f"<b>Total:</b> {total}\n"
            f"<b>Delivery Fee:</b> {delivery}\n\n"
            f"<b>Seedlings Ordered:</b>\n{items_list}\n\n"
            f"<b>Delivery Location:</b> {escape(order.delivery_address)}, {escape(order.city)}, {escape(order.county)}"
        )
        self.send_message(message)

    def notify_payment_confirmed(self, order, receipt):
        """
        Formats and sends a notification when payment is confirmed.
        """
        message = (
            f"✅ <b>Payment Confirmed!</b>\n\n"
            f"<b>Order:</b> <code>{order.order_number}</code>\n"
            f"<b>Receipt:</b> <code>{receipt}</code>\n"
            f"<b>Amount:</b> KSh {order.total_amount:,.2f}\n"
            f"<b>Customer:</b> {order.customer_name}\n\n"
            f"Order status has been updated to <b>Confirmed</b>."
        )
        self.send_message(message)

telegram_service = TelegramService()
