import { Link, useParams } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import Icon from '../components/icons/Icon.jsx';
import SEO from '../components/common/SEO.jsx';
import Accordion from '../components/ui/Accordion.jsx';
import HangTag from '../components/ui/HangTag.jsx';
import Stepper from '../components/ui/Stepper.jsx';
import ProductCard from '../components/product/ProductCard.jsx';
import ProductGallery from '../components/product/ProductGallery.jsx';
import RatingStars from '../components/ui/RatingStars.jsx';
import SizePicker from '../components/product/SizePicker.jsx';
import { WishlistContext } from '../context/WishlistContext.jsx';
import { useCart } from '../hooks/useCart.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatKes } from '../data/products.js';
import { api } from '../services/api.js';

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [isLoading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);

  const wishlist = useContext(WishlistContext);
  const cart = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        const [data, relatedData] = await Promise.all([
          api.getProduct(slug),
          api.getRelatedProducts(slug)
        ]);

        setProduct(data);
        setRelated(relatedData.results || relatedData);
      } catch (err) {
        console.error('Failed to fetch seedling details', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [slug]);

  if (isLoading) {
    return <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}><h3>Loading seedling details...</h3></div>;
  }

  if (!product) {
    return <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}><h3>Seedling not found.</h3><Link to="/shop" className="btn btn-outline" style={{ marginTop: 20 }}>Back to Shop</Link></div>;
  }

  const categoryName = typeof product.category === 'object' ? product.category?.name : product.category;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.primary_image || "https://savannahseedlings.co.ke/og-image.png",
    "description": product.description,
    "sku": product.id.toString(),
    "brand": {
      "@type": "Brand",
      "name": "Savannah Seedlings"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://savannahseedlings.co.ke/product/${slug}`,
      "priceCurrency": "KES",
      "price": product.price,
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating || 4.9,
      "reviewCount": product.reviews || 15
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://savannahseedlings.co.ke/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Shop",
        "item": "https://savannahseedlings.co.ke/shop"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": product.name,
        "item": `https://savannahseedlings.co.ke/product/${slug}`
      }
    ]
  };

  const whatsappMessage = encodeURIComponent(
    `Hello Savannah Seedlings, I would like to order ${quantity}x ${product.name} (KES ${product.price} each). Please advise on delivery.`
  );

  const defaultPlantingProcedure = product.planting_procedure ||
    `1. Dig a hole measuring 2ft x 2ft x 2ft (60cm x 60cm x 60cm).\n2. Separate topsoil from subsoil and mix topsoil with well-rotted manure (15-20kg).\n3. Carefully remove the plastic sleeve without disturbing the root ball.\n4. Place the seedling graft union 2-3 inches above ground level.\n5. Water thoroughly immediately after planting (20 liters) and mulch to conserve moisture.`;

  return (
    <>
      <SEO
        title={`${product.name} - Savannah Seedlings`}
        description={product.description}
        image={product.primary_image}
        url={`/product/${slug}`}
        type="product"
        schemaData={[productSchema, breadcrumbSchema]}
      />
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          <span className="sep">/</span>
          <Link to="/shop">Shop Seedlings</Link>
          <span className="sep">/</span>
          <span className="current">{product.name}</span>
        </nav>

        <div className="pd-layout">
          <ProductGallery product={product} />

          <div className="pd-info">
            <p className="eyebrow">
              🌱 {categoryName || 'Certified Grafted Seedling'}
            </p>
            <h1>{product.name}</h1>

            <div className="pd-rating">
              <RatingStars rating={product.rating || 4.9} reviews={product.reviews || 15} />
              <a href="#planting-procedure" style={{ marginLeft: 12 }}>Planting Guide</a>
            </div>

            <div className="pd-price">
              <HangTag price={product.price} compareAt={product.original_price} />
              <span className="muted" style={{ fontSize: 13 }}>{formatKes(product.price)} / seedling</span>
            </div>

            <p className="pd-desc">{product.description}</p>

            <div className="qty-row">
              <Stepper value={quantity} onChange={setQuantity} />
              <span className="muted" style={{ fontSize: 13 }}>Quantity of seedlings</span>
            </div>

            <div className="pd-actions" style={{ flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    cart.addItem(product, { quantity });
                    showToast(`${quantity}x ${product.name} added to cart!`);
                  }}
                >
                  <Icon name="leaf" className="icon icon-sm" /> Add to Order
                </button>
                <button
                  className={`icon-btn ${wishlist.ids.includes(product.id) ? 'active' : ''}`}
                  aria-label="Add to wishlist"
                  onClick={() => wishlist.toggle(product.id)}
                >
                  <Icon name="heart" />
                </button>
              </div>

              <a
                href={`https://wa.me/254710583989?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', fontWeight: 600 }}
              >
                <Icon name="whatsapp" className="icon icon-sm" /> Order directly on WhatsApp
              </a>
            </div>

            <div className="stock-note">
              <Icon name="checkCircle" className="icon icon-sm" />
              {product.stock > 0 ? `In stock at nursery (${product.stock} seedlings available)` : 'Out of stock - Next grafting drop coming soon'}
            </div>

            <div className="pd-trust">
              <div className="trust-item"><Icon name="shield" /><span style={{ fontSize: 12.5 }}>Arrange payment on WhatsApp</span></div>
              <div className="trust-item"><Icon name="truck" /><span style={{ fontSize: 12.5 }}>Delivery quoted by the nursery</span></div>
              <div className="trust-item"><Icon name="leaf" /><span style={{ fontSize: 12.5 }}>Certified Grafted</span></div>
            </div>

            <div id="planting-procedure" style={{ marginTop: 20 }}>
              <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ color: '#1b5e20', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '15px' }}>
                  <Icon name="leaf" /> Planting & Care Procedure
                </h4>
                <div style={{ marginTop: '10px', fontSize: '13.5px', color: '#2e7d32', whitespace: 'pre-line', lineHeight: '1.6' }}>
                  {defaultPlantingProcedure}
                </div>
              </div>

              <Accordion items={[
                {
                  title: '📍 Nursery Locations & Pickups',
                  content: '1. Nairobi Nursery: Kasarani Kastemil Junction, Nairobi.\n2. Murang\'a Nursery: Kwa Samaki Murang\'a along Nairobi-Nyeri Highway.\n\nYou can pick up directly from either nursery or request delivery.'
                },
                {
                  title: '🚚 Delivery Details & Rates',
                  content: 'Delivery is arranged with our nursery on WhatsApp. Share your county, town and delivery address at checkout. The seller will agree the delivery fee and final total with you before payment; no fixed delivery fee is charged online.'
                },
              ]} />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <div className="container">
            <div className="section-head">
              <div><p className="eyebrow">Complementary Fruit Seedlings</p><h2 className="h2">You may also like</h2></div>
            </div>
            <div className="product-grid">
              {related.map((item) => <ProductCard product={item} key={item.id} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
