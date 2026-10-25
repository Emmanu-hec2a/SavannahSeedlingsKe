import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ScrollToTop from './components/common/ScrollToTop.jsx';
import Layout from './components/layout/Layout.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Account from './pages/Account.jsx';
import Signup from './pages/Signup.jsx';

const legacyRoutes = {
  '/index.html': '/',
  '/shop.html': '/shop',
  '/cart.html': '/cart',
  '/checkout.html': '/checkout',
  '/confirmation.html': '/confirmation',
  '/product.html': '/shop',
  '/product': '/shop',
};

function LegacyPageRedirect({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {Object.entries(legacyRoutes).map(([path, to]) => (
          <Route key={path} path={path} element={<LegacyPageRedirect to={to} />} />
        ))}
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account" element={<Account />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/confirmation" element={<OrderConfirmation />} />
      </Routes>
    </>
  );
}
