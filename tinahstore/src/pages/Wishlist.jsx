import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/icons/Icon.jsx';
import SEO from '../components/common/SEO.jsx';
import ProductCard from '../components/product/ProductCard.jsx';
import { WishlistContext } from '../context/WishlistContext.jsx';
import { api } from '../services/api.js';

export default function Wishlist() {
  const wishlist = useContext(WishlistContext);
  const [wishedProducts, setWishedProducts] = useState([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWishedProducts() {
      if (wishlist.ids.length === 0) {
        setWishedProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await api.listProducts();
        const allProducts = data.results || data;
        const filtered = allProducts.filter((p) => wishlist.ids.includes(p.id));
        setWishedProducts(filtered);
      } catch (err) {
        console.error('Failed to fetch wished seedlings', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWishedProducts();
  }, [wishlist.ids]);

  return (
    <>
      <SEO title="My Wishlist - Savannah Seedlings" description="View your saved fruit seedlings." url="/wishlist" />
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span className="current">Wishlist</span>
        </nav>
        <div className="page-head">
          <div>
            <p className="eyebrow">Saved Seedlings</p>
            <h2 className="h2">Your Wishlist</h2>
            <span className="muted" style={{ fontSize: 13.5 }}>{wishlist.ids.length} saved varieties</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 90 }}>
        {isLoading ? (
          <div className="shop-empty"><h3>Loading your wishlist...</h3></div>
        ) : wishedProducts.length > 0 ? (
          <div className="product-grid">
            {wishedProducts.map((product) => (
              <ProductCard product={product} key={product.id} quickAdd />
            ))}
          </div>
        ) : (
          <div className="cart-empty">
            <Icon name="heart" />
            <h3>No saved seedlings yet</h3>
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              Click the heart icon on any seedling to save it for later.
            </p>
            <Link to="/shop" className="btn btn-primary btn-sm" style={{ marginTop: 18 }}>Shop Seedlings</Link>
          </div>
        )}
      </div>
    </>
  );
}
