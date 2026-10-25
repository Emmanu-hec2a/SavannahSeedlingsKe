import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import Footer from '../components/layout/Footer.jsx';
import Icon from '../components/icons/Icon.jsx';
import ProductArt from '../components/product/ProductArt.jsx';
import SavannahLogo from '../components/common/SavannahLogo.jsx';
import { formatKes } from '../data/products.js';
import { useCart } from '../hooks/useCart.js';
import { api } from '../services/api.js';
import { checkoutAttempt, clearCheckoutAttempt, saveCheckoutOrder, whatsappOrderUrl } from '../services/orderCheckout.js';

export default function Checkout() {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const attempt = useRef(null);
  const cart = useCart();
  const navigate = useNavigate();

  async function placeOrder(event) {
    event.preventDefault();
    if (submitting.current || !cart.items.length) return;
    submitting.current = true;
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const payload = {
      customer_name: data.get('fullName').trim(),
      customer_email: data.get('email').trim(),
      customer_phone: data.get('phone').trim(),
      delivery_address: data.get('address').trim(),
      city: data.get('city').trim(),
      county: data.get('county').trim(),
      payment_method: 'whatsapp',
      items: cart.items.map(item => ({ product_slug: item.product.slug, quantity: item.quantity })),
    };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = checkoutAttempt(payload);
    // Open during the user's click so mobile browsers can allow the WhatsApp handoff.
    // The confirmation page always offers the same link if popups are blocked.
    let whatsappWindow = null;
    try {
      whatsappWindow = window.open('about:blank', '_blank');
      if (whatsappWindow) whatsappWindow.opener = null;
    } catch { /* Continue using the saved confirmation page. */ }

    let order;
    try {
      order = await api.createOrder({ ...payload, checkout_key: attempt.current.key });
    } catch (err) {
      whatsappWindow?.close();
      setError(err.message || 'Your order could not be saved. Your cart has been kept. Please try again.');
      submitting.current = false;
      setSubmitting(false);
      return;
    }
    saveCheckoutOrder(order);
    clearCheckoutAttempt();
    cart.clear();
    navigate(`/confirmation?order=${encodeURIComponent(order.order_number)}`, { state: { order } });
    try {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.location.replace(whatsappOrderUrl(order));
    } catch { /* The confirmation page has a retry link; do not create another order. */ }
  }

  return (
    <>
      <header className="checkout-header"><div className="container">
        <Link to="/" className="logo"><SavannahLogo /></Link>
        <span className="secure-pill"><Icon name="whatsapp" className="icon icon-sm" /> WhatsApp checkout</span>
      </div></header>
      <main className="container checkout-page">
        <nav className="steps" aria-label="Checkout progress">
          <Link to="/cart" className="step done"><span className="num"><Icon name="check" className="icon icon-sm" /></span> Cart</Link>
          <div className="step-line" />
          <span className="step active" aria-current="step"><span className="num">2</span> Delivery</span>
          <div className="step-line" />
          <span className="step"><span className="num">3</span> WhatsApp</span>
        </nav>
        <div className="checkout-intro">
          <h1 className="h2">Let’s arrange your seedling delivery.</h1>
          <p className="lede">Save your order and continue on WhatsApp. Our nursery team will agree delivery charges and payment with you before you pay.</p>
        </div>
        {!cart.items.length ? (
          <div className="checkout-notice"><p>Your cart is empty. Add seedlings to start your order.</p><Link to="/shop" className="btn btn-primary">Shop seedlings</Link></div>
        ) : (
          <div className="checkout-layout">
            <form onSubmit={placeOrder} aria-busy={isSubmitting}>
              {error && <div role="alert" className="checkout-error">{error}</div>}
              <fieldset className="checkout-fields" disabled={isSubmitting}>
                <div className="form-section">
                  <h2 className="h3">Contact details</h2>
                  <div className="form-grid">
                    <Field label="Full name" name="fullName" autoComplete="name" placeholder="e.g. Samuel Maina" maxLength={100} className="full" />
                    <Field label="Phone / WhatsApp number" name="phone" type="tel" autoComplete="tel" placeholder="e.g. 0712345678" maxLength={15} />
                    <Field label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} />
                  </div>
                </div>
                <div className="form-section">
                  <h2 className="h3">Where should we deliver?</h2>
                  <div className="form-grid">
                    <Field label="County" name="county" autoComplete="address-level1" placeholder="e.g. Kiambu" maxLength={50} />
                    <Field label="Town / area" name="city" autoComplete="address-level2" placeholder="e.g. Ruiru, Kimbo" maxLength={50} />
                    <div className="form-field full">
                      <label htmlFor="checkout-address">Farm / delivery address and nearest landmark</label>
                      <textarea id="checkout-address" name="address" autoComplete="street-address" rows={3} maxLength={1500} placeholder="Farm name, road, estate, gate or a nearby landmark" aria-describedby="delivery-location-help" required />
                      <p id="delivery-location-help" className="checkout-fine-print">You can share a location pin with the seller in WhatsApp if more directions are needed.</p>
                    </div>
                  </div>
                </div>
              </fieldset>
              <div className="checkout-notice">
                <Icon name="whatsapp" />
                <div><strong>Delivery and payment, agreed together.</strong><p>No payment is taken here. Delivery is quoted by the nursery based on your location and order. You’ll review and send the prepared message in WhatsApp.</p></div>
              </div>
              <button type="submit" className="btn btn-primary btn-block checkout-submit" disabled={isSubmitting}>
                <Icon name="whatsapp" />{isSubmitting ? 'Saving your order…' : 'Save order & continue on WhatsApp'}
              </button>
              <p className="checkout-fine-print">Your order is saved before WhatsApp opens. Opening WhatsApp does not send the message or confirm payment.</p>
            </form>
            <aside className="summary-card checkout-summary" aria-label="Seedling order summary">
              <h2 className="h3">Your seedlings</h2>
              <div className="mini-cart">{cart.items.map(item => (
                <div className="mini-row" key={item.productId}>
                  <div className="thumb-box">{item.product.image || item.product.primary_image || item.product.images?.[0]?.image ? <img src={item.product.image || item.product.primary_image || item.product.images[0].image} alt={item.product.name} className="product-image" /> : <ProductArt product={item.product} color="#2E7D32" />}</div>
                  <div><div className="name">{item.product.name}</div><div className="qty-tag">{item.quantity} seedlings</div></div>
                  <span className="price">{formatKes(Number(item.product.price) * item.quantity)}</span>
                </div>
              ))}</div>
              <div className="summary-row total"><span>Seedling subtotal</span><span>{formatKes(cart.subtotal)}</span></div>
              <div className="summary-row"><span>Delivery</span><span>Quoted on WhatsApp</span></div>
              <p className="checkout-fine-print">Final total confirmed after delivery arrangements. Seedling prices are checked when your order is saved.</p>
              <Link to="/cart" className="account-link">Edit your cart</Link>
            </aside>
          </div>
        )}
      </main>
      <Footer compact />
    </>
  );
}

function Field({ label, name, className = '', ...props }) {
  return <div className={`form-field ${className}`}><label htmlFor={`checkout-${name}`}>{label}</label><input id={`checkout-${name}`} name={name} required {...props} /></div>;
}
