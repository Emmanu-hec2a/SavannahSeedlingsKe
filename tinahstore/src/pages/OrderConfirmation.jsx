import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import Footer from '../components/layout/Footer.jsx';
import Icon from '../components/icons/Icon.jsx';
import SavannahLogo from '../components/common/SavannahLogo.jsx';
import { formatKes } from '../data/products.js';
import { api } from '../services/api.js';
import { readCheckoutOrder, saveCheckoutOrder, whatsappOrderUrl } from '../services/orderCheckout.js';

export default function OrderConfirmation() {
  const location = useLocation();
  const [params] = useSearchParams();
  const orderNumber = params.get('order') || location.state?.order?.order_number;
  const navigatedOrder = location.state?.order;
  const initialOrder = navigatedOrder && navigatedOrder.order_number === orderNumber ? navigatedOrder : readCheckoutOrder(orderNumber);
  const [order, setOrder] = useState(initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const accessToken = order?.access_token || initialOrder?.access_token;

  const refresh = useCallback(async () => {
    if (!orderNumber) return;
    setRefreshing(true);
    setError('');
    try {
      const updated = await api.getOrder(orderNumber, accessToken);
      setOrder(updated);
      saveCheckoutOrder(updated);
    } catch {
      setError('We could not refresh this order. Your saved details are shown below if available; contact the nursery with your order number for the latest update.');
    } finally { setRefreshing(false); }
  }, [orderNumber, accessToken]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  if (!order || order.order_number !== orderNumber) {
    return <main className="container checkout-page"><h1 className="h2">{refreshing ? 'Loading your order…' : 'Order details unavailable'}</h1><p>{error || 'Open your order from your account or the confirmation tab where you placed it.'}</p><Link to="/account" className="btn btn-primary">My account</Link><Link to="/shop" className="btn btn-ghost">Shop seedlings</Link></main>;
  }

  const paid = order.deposit_paid;
  const cancelled = order.status === 'cancelled';
  const quoted = order.delivery_fee != null;
  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const heading = cancelled ? 'This order has been cancelled' : paid ? 'Payment verified. Thank you!' : quoted ? 'Delivery quoted. Arrange payment on WhatsApp.' : 'Order saved. Let’s arrange delivery.';
  const description = cancelled ? 'Contact the nursery if you need help placing a new order.' : paid ? 'The nursery has verified your payment. Contact the team for preparation and delivery updates.' : quoted ? 'The nursery has recorded your delivery fee. Confirm the final arrangements and payment details with the seller on WhatsApp.' : 'Your seedlings and delivery details have been saved. Send the prepared WhatsApp message so the nursery can quote delivery and agree payment with you. No payment has been recorded.';

  return <>
    <header className="checkout-header"><div className="container"><Link to="/" className="logo"><SavannahLogo /></Link><span className="secure-pill"><Icon name={paid ? 'checkCircle' : 'whatsapp'} className="icon icon-sm" />{paid ? 'Payment verified' : 'Order saved'}</span></div></header>
    <main className="container">
      <div className="confirm-layout">
        <section className="confirm-hero" aria-labelledby="confirmation-title">
          <div className="confirm-icon"><Icon name={cancelled ? 'x' : paid ? 'checkCircle' : 'whatsapp'} /></div>
          <p className="eyebrow" style={{ justifyContent: 'center' }}>Order #{order.order_number}</p>
          <h1 className="h2" id="confirmation-title">{heading}</h1>
          <p className="lede" style={{ margin: '16px auto 0', maxWidth: 600 }}>{description}</p>
          {error && <p role="status" className="checkout-fine-print">{error}</p>}
          <div className="confirm-actions">
            {!cancelled && <a href={whatsappOrderUrl(order)} className="btn btn-primary" target="_blank" rel="noreferrer"><Icon name="whatsapp" />{paid ? 'Contact nursery on WhatsApp' : 'Continue on WhatsApp'}</a>}
            <button className="btn btn-outline" type="button" disabled={refreshing} onClick={refresh}><Icon name="refresh" />{refreshing ? 'Refreshing…' : 'Refresh order status'}</button>
          </div>
          {!paid && !cancelled && <p className="checkout-fine-print">If WhatsApp did not open, use the button above. Review the message and tap Send in WhatsApp. You won’t create another order.</p>}
        </section>

        <section className="confirm-card" aria-label="Order and delivery details">
          <h2 className="h3">Your delivery details</h2>
          <div className="confirm-row"><span>Customer</span><span>{order.customer_name}</span></div>
          <div className="confirm-row"><span>Phone</span><span>{order.customer_phone}</span></div>
          <div className="confirm-row"><span>Email</span><span>{order.customer_email}</span></div>
          <div className="confirm-row"><span>Delivery location</span><span>{order.delivery_address}, {order.city}, {order.county}</span></div>
          <div className="confirm-row"><span>Order status</span><span>{order.status === 'pending_confirmation' ? 'Awaiting WhatsApp arrangements' : order.status === 'pending_deposit' ? 'Awaiting payment' : order.status.replaceAll('_', ' ')}</span></div>
          <div className="confirm-row"><span>Checkout method</span><span>{order.payment_method === 'whatsapp' ? 'Arrange on WhatsApp' : order.payment_method === 'manual' ? 'M-PESA Send Money' : order.payment_method.toUpperCase()}</span></div>
          <div className="confirm-row"><span>Payment</span><span>{paid ? 'Verified by the nursery' : 'Not yet verified'}</span></div>
        </section>

        <section className="confirm-card confirm-items" aria-label="Seedlings and pricing">
          <h2 className="h3">Your seedlings</h2>
          {order.items.map((item, index) => <div className="mini-row" key={index}><div><div className="name">{item.product_name || item.product_slug}</div><div className="qty-tag">Quantity: {item.quantity}</div></div><span className="price">{formatKes(Number(item.unit_price) * item.quantity)}</span></div>)}
          <div className="summary-row"><span>Seedling subtotal</span><span>{formatKes(subtotal)}</span></div>
          <div className="summary-row"><span>Delivery fee</span><span>{quoted ? formatKes(order.delivery_fee) : 'To be agreed on WhatsApp'}</span></div>
          <div className="summary-row total"><span>{paid ? 'Verified order total' : 'Final total'}</span><span>{order.total_amount == null ? 'Awaiting delivery quote' : formatKes(order.total_amount)}</span></div>
          {!quoted && <p className="checkout-fine-print">Delivery is not included in the seedling subtotal. The seller will confirm the final total before payment.</p>}
        </section>
        <div className="confirm-actions"><Link to="/shop" className="btn btn-ghost">Continue shopping</Link><button className="btn btn-outline" type="button" onClick={() => window.print()}><Icon name="printer" />Print order details</button></div>
      </div>
    </main>
    <Footer compact />
  </>;
}
