import { formatKes } from '../data/products.js';

export const nurseryPhone = '254710583989';
const savedOrderKey = 'ts_pending_order';

export function saveCheckoutOrder(order) {
  try { sessionStorage.setItem(savedOrderKey, JSON.stringify(order)); } catch { /* History state still retains this order. */ }
}

export function readCheckoutOrder(orderNumber) {
  try {
    const order = JSON.parse(sessionStorage.getItem(savedOrderKey) || 'null');
    return order && (!orderNumber || order.order_number === orderNumber) ? order : null;
  } catch { return null; }
}

export function checkoutAttempt(payload) {
  const signature = JSON.stringify(payload);
  try {
    const saved = JSON.parse(sessionStorage.getItem('ts_checkout_attempt') || 'null');
    if (saved?.signature === signature) return saved;
  } catch { /* Storage may be disabled. */ }
  const attempt = { signature, key: crypto.randomUUID() };
  try { sessionStorage.setItem('ts_checkout_attempt', JSON.stringify(attempt)); } catch { /* The form also keeps this key in memory. */ }
  return attempt;
}

export function clearCheckoutAttempt() {
  try { sessionStorage.removeItem('ts_checkout_attempt'); } catch { /* Storage may be disabled. */ }
}

export function whatsappOrderUrl(order) {
  const items = order.items || [];
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const message = [
    `Hello Savannah Seedlings, I'd like to arrange order #${order.order_number}.`,
    '',
    `Name: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Email: ${order.customer_email}`,
    '',
    'Seedlings:',
    ...items.map(item => `- ${item.quantity} x ${item.product_name || item.product_slug}: ${formatKes(Number(item.unit_price) * item.quantity)}`),
    `Seedling subtotal: ${formatKes(subtotal)}`,
    '',
    'Delivery location:',
    order.delivery_address,
    `Town / area: ${order.city}`,
    `County: ${order.county}`,
    '',
    `Delivery fee: ${order.delivery_fee == null ? 'To be agreed on WhatsApp' : formatKes(order.delivery_fee)}`,
    `Final total: ${order.total_amount == null ? 'To be confirmed after delivery is agreed' : formatKes(order.total_amount)}`,
    `Payment: ${order.deposit_paid ? 'Verified by the nursery' : 'Not yet verified'}`,
    '',
    'Please confirm delivery charges and payment arrangements. I can share a location pin here if needed.',
  ].join('\n');
  return `https://wa.me/${nurseryPhone}?text=${encodeURIComponent(message)}`;
}
