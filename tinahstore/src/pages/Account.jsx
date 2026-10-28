import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/icons/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignIn from '../components/auth/GoogleSignIn.jsx';
import { api } from '../services/api.js';
import { formatKes } from '../data/products.js';
import { errorMessage } from '../services/apiErrors.js';

export default function Account() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setLoadingOrders] = useState(false);
  const { login, googleLogin, user, logout, authenticating } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrderHistory();
    }
  }, [user]);

  const fetchOrderHistory = async () => {
    setLoadingOrders(true);
    try {
      const data = await api.listUserOrders();
      setOrders(data.results || data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (authenticating) return;
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err, 'Invalid email or password. Please try again.'));
    }
  };

  if (user) {
    return (
      <div className="container" style={{ paddingBottom: 90 }}>
        <nav className="breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span className="current">Account</span>
        </nav>

        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2 className="h2" style={{ marginBottom: 4 }}>{user.username || user.email}</h2>
            <button onClick={logout} className="text-xs font-medium text-oxblood hover:underline">Sign out</button>
          </div>
        </div>

        <div className="account-history-grid">
          <section className="order-history-section">
            <h3 className="h3" style={{ marginBottom: 24 }}>Seedling Order History</h3>

            {isLoadingOrders ? (
              <p className="muted">Loading your past seedling orders...</p>
            ) : orders.length > 0 ? (
              <div className="order-list">
                {orders.map(order => (
                  <div key={order.order_number} className="order-history-card">
                    <div className="order-main-info">
                      <div>
                        <p className="order-id font-mono">#{order.order_number}</p>
                        <p className="order-date text-xs muted">
                          {(() => {
                            if (!order.created_at) return '—';
                            const d = new Date(order.created_at);
                            if (isNaN(d.getTime())) return '—';
                            return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
                          })()}
                        </p>
                      </div>
                      <div className={`order-status-tag ${order.status}`}>
                        {order.status === 'pending_confirmation' ? 'Awaiting WhatsApp confirmation' : order.status.replaceAll('_', ' ')}
                      </div>
                    </div>

                    <div className="order-items-preview">
                      {order.items.slice(0, 3).map((item, i) => (
                         <span key={i} className="item-name text-sm">{item.product_slug}{i < order.items.length - 1 ? ',' : ''} </span>
                      ))}
                      {order.items.length > 3 && <span className="muted text-xs">+{order.items.length - 3} more</span>}
                    </div>

                    <div className="order-footer">
                      <p className="order-total font-bold">{order.total_amount == null ? `${formatKes(order.subtotal)} + delivery to be agreed` : formatKes(order.total_amount)}</p>
                      <Link to={`/confirmation?order=${encodeURIComponent(order.order_number)}`} state={{ order }} className="btn btn-outline btn-sm">View Details</Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <Icon name="leaf" />
                <h4>No seedling orders yet</h4>
                <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
                  When you place seedling orders, they will appear here.
                </p>
                <Link to="/shop" className="btn btn-primary btn-sm">Shop Seedlings</Link>
              </div>
            )}
          </section>

          <aside className="account-details-sidebar">
            <div className="card">
              <h3 className="h3" style={{ fontSize: 18, marginBottom: 20 }}>Account Details</h3>
              <div className="detail-row" style={{ marginBottom: 16 }}>
                <label className="text-xs muted uppercase font-bold tracking-wider">Email</label>
                <p className="text-sm">{user.email}</p>
              </div>
              <div className="detail-row">
                <label className="text-xs muted uppercase font-bold tracking-wider">Member Since</label>
                <p className="text-sm">{new Date(user.date_joined || Date.now()).getFullYear()}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span className="current">Account</span>
        </nav>
        <div className="page-head">
          <div>
            <p className="eyebrow">Grower account</p>
            <h2 className="h2">Sign in to Savannah Seedlings</h2>
            <span className="muted" style={{ fontSize: 13.5 }}>Track orders, save farm addresses, and manage your seedling wishlist.</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 90 }}>
        <div className="account-layout">
          <form className="account-card" onSubmit={handleLogin} aria-busy={authenticating}>
            <h3>Welcome back</h3>
            {error && <p role="alert" className="error-text" style={{ color: 'var(--oxblood)', fontSize: 14, marginBottom: 15 }}>{error}</p>}
            <div className="form-field">
              <label>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="farmer@email.com" required />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={authenticating}>{authenticating ? 'Signing in…' : 'Sign in'}</button>

            <GoogleSignIn
              label="Continue with Google"
              disabled={authenticating}
              onSuccess={(response) => googleLogin(response.access_token)}
              onError={err => setError(errorMessage(err, 'Google sign-in failed. Please try again or use your email and password.'))}
            />

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: 14 }}>Don't have an account?</p>
              <Link to="/signup" className="account-link" style={{ marginTop: 4 }}>Create one now</Link>
            </div>
          </form>

          <div className="account-card account-benefits">
            <h3>Account benefits</h3>
            {[
              ['leaf', 'Track seedling orders', 'See dispatch status and delivery details.'],
              ['heart', 'Save favourites', 'Keep your seedling wishlist saved.'],
              ['mapPin', 'Faster re-ordering', 'Reuse farm addresses for upcoming planting seasons.'],
            ].map(([icon, title, copy]) => (
              <div className="account-benefit" key={title}>
                <span className="contact-icon"><Icon name={icon} /></span>
                <div><strong>{title}</strong><span>{copy}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
