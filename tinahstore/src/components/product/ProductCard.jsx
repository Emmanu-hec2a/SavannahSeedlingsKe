import { Link } from 'react-router-dom';
import { useContext } from 'react';
import Icon from '../icons/Icon.jsx';
import HangTag from '../ui/HangTag.jsx';
import RatingStars from '../ui/RatingStars.jsx';
import Badge from '../ui/Badge.jsx';
import ProductArt from './ProductArt.jsx';
import { WishlistContext } from '../../context/WishlistContext.jsx';
import { useCart } from '../../hooks/useCart.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ProductCard({ product, quickAdd = false, className = '' }) {
  const wishlist = useContext(WishlistContext);
  const cart = useCart();
  const { showToast } = useToast();
  const wished = wishlist.ids.includes(product.id);

  const categoryName = typeof product.category === 'object' ? product.category?.name : product.category;

  return (
    <Link to={`/product/${product.slug}`} className={`product-card ${className}`}>
      <div className="media">
        {product.badge && <Badge tone={product.badge === 'New' ? 'new' : 'sale'} className="sale-pill">{product.badge}</Badge>}
        <button
          className={`icon-btn wish ${wished ? 'active' : ''}`}
          aria-label="Wishlist"
          onClick={(event) => {
            event.preventDefault();
            wishlist.toggle(product.id);
          }}
        >
          <Icon name="heart" />
        </button>
        {product.image || product.primary_image ? (
          <img src={product.image || product.primary_image} alt={product.name} className="product-image" />
        ) : (
          <div className="art-fallback">
            <ProductArt product={product} />
          </div>
        )}
        {quickAdd && (
          <div className="quick">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                cart.addItem(product);
                showToast(`${product.name} added to cart!`);
              }}
            >
              Add Seedling <Icon name="leaf" className="icon icon-sm" />
            </button>
          </div>
        )}
      </div>
      <div className="body">
        <div className="cat">{categoryName || 'Fruit Seedling'}</div>
        <h3>{product.name}</h3>
        <RatingStars rating={product.rating || 4.9} reviews={product.reviews || 12} compact={!quickAdd} />
        <HangTag price={product.price} compareAt={product.compareAt || product.original_price} />
      </div>
    </Link>
  );
}
