import { Link } from 'react-router-dom';
import Icon from '../components/icons/Icon.jsx';
import Stepper from '../components/ui/Stepper.jsx';
import ProductArt from '../components/product/ProductArt.jsx';
import { formatKes } from '../data/products.js';
import { useCart } from '../hooks/useCart.js';

export default function Cart() {
  const cart = useCart();

  return (
    <>
      <div className="container">
        <nav className="breadcrumb"><Link to="/">Home</Link><span className="sep">/</span><span className="current">Shopping Cart</span></nav>
        <div className="page-head"><div><h2 className="h2">Your Seedling Cart</h2><span className="muted" style={{ fontSize: 13.5 }}>{cart.count} seedlings</span></div></div>
      </div>
      <div className="container" style={{ paddingBottom: 96 }}>
        <div className="cart-layout">
          <div>
            {cart.items.length === 0 && (
              <div className="cart-empty"><Icon name="leaf" /><h3>Your cart is empty</h3><Link to="/shop" className="btn btn-primary" style={{ marginTop: 18 }}>Shop Seedlings</Link></div>
            )}
            {cart.items.map((item) => (
              <div className="cart-row" key={item.productId}>
                <div className="thumb-box">
                  { (item.product.image || item.product.primary_image || (item.product.images && item.product.images[0]?.image)) ? (
                    <img
                      src={item.product.image || item.product.primary_image || item.product.images[0]?.image}
                      alt={item.product.name}
                      className="product-image"
                    />
                  ) : (
                    <ProductArt product={item.product} color="#2E7D32" />
                  )}
                </div>
                <div className="info-col">
                  <h3>{item.product.name}</h3>
                  <span className="variant" style={{ color: '#2e7d32', fontWeight: 500 }}>
                    {formatKes(item.product.price)} each
                  </span>
                </div>
                <div className="qty-col"><Stepper value={item.quantity} onChange={(qty) => cart.updateQuantity(item.productId, qty)} /></div>
                <div className="price-col"><span className="line-total">{formatKes(item.product.price * item.quantity)}</span></div>
                <button className="icon-btn remove-btn remove-col" aria-label="Remove item" onClick={() => cart.removeItem(item.productId)}><Icon name="trash" /></button>
              </div>
            ))}
            <div style={{ paddingTop: 24 }}><Link to="/shop" className="btn btn-ghost"><Icon name="arrowLeft" className="icon icon-sm" /> Continue shopping</Link></div>
          </div>

          <aside className="summary-card">
            <h3>Order summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>{formatKes(cart.subtotal)}</span></div>
            <div className="summary-row">
              <span>Delivery</span>
              <span>Quoted on WhatsApp</span>
            </div>
            <div className="summary-row total"><span>Seedling subtotal</span><span>{formatKes(cart.subtotal)}</span></div>
            <p className="checkout-fine-print">Final total and payment arrangements are confirmed with the nursery on WhatsApp.</p>
            {cart.items.length > 0 && <Link to="/checkout" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>Continue to delivery details</Link>}
            <div className="secure-note"><Icon name="whatsapp" className="icon icon-sm" /> Complete your order with our nursery team</div>
          </aside>
        </div>
      </div>
    </>
  );
}
