import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../components/icons/Icon.jsx';
import SEO from '../components/common/SEO.jsx';
import ProductCard from '../components/product/ProductCard.jsx';
import SeedlingIllustration from '../assets/illustrations/SeedlingIllustration.jsx';
import { useProducts } from '../hooks/useProducts.js';
import { useCategories } from '../hooks/useCategories.js';
import { useSectionReveals } from '../hooks/useSectionReveals.js';
import NurseryGallery from '../components/common/NurseryGallery.jsx';
import HeroBackground from '../components/common/HeroBackground.jsx';
import HomeStats from '../components/common/HomeStats.jsx';
import HomeServices from '../components/common/HomeServices.jsx';

const contactLinks = [
  { label: 'WhatsApp', value: '+254 710 583 989', href: 'https://wa.me/254710583989', icon: 'whatsapp' },
  { label: 'Phone', value: '+254 710 583 989', href: 'tel:+254710583989', icon: 'phone' },
  { label: 'Email', value: 'savannahseedlings@gmail.com', href: 'mailto:savannahseedlings@gmail.com', icon: 'mail' },
  { label: 'Nairobi Nursery', value: 'Kasarani Kastemil Junction', href: '#about', icon: 'mapPin' },
];

export default function Home() {
  const { products, isLoading } = useProducts({ ordering: '-created_at' }, { limit: 4 });
  const { categories, isLoading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories();
  const { hash, key: locationKey } = useLocation();
  const homeRef = useRef(null);
  const heroRef = useRef(null);
  useSectionReveals(homeRef);

  useEffect(() => {
    if (!hash || isLoading || categoriesLoading) return;
    // Wait for catalog layout and dialog scroll-unlocking before an anchor jump.
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, locationKey, isLoading, categoriesLoading]);

  const homeSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Savannah Seedlings",
    "url": "https://savannahseedlings.co.ke",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://savannahseedlings.co.ke/shop?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Savannah Seedlings",
    "url": "https://savannahseedlings.co.ke",
    "logo": "https://savannahseedlings.co.ke/favicon.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+254-710-583-989",
      "contactType": "customer service",
      "areaServed": "KE",
      "availableLanguage": "en"
    }
  };

  return (
    <>
      <SEO schemaData={[homeSchema, orgSchema]} />
      <div ref={homeRef} className="home-page">
      <section ref={heroRef} className="hero hero--photographic">
        <HeroBackground heroRef={heroRef} />
        <div className="container">
          <div className="hero-copy">
            <p className="eyebrow">🌱 Seeding Africa for Sustainable fruit farming</p>
            <h1 className="h1">High-yielding fruit seedlings for every farm.</h1>
            <p className="lede">Certified grafted Hass Avocado, Pixie Orange, Kent Mango, Yellow Passion, Dragon Fruit & Pomegranate seedlings propagated for rapid growth, disease resistance, and premium harvests.</p>
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-primary">Shop Seedlings</Link>
              <a href="#about" className="btn btn-outline">Our Nurseries</a>
            </div>
          </div>
        </div>
      </section>

      <div className="trust-strip">
        <div className="container"><HomeStats /></div>
        <div className="container trust-grid">
          {[
            ['truck', 'Delivery Across Africa', 'Quoted on WhatsApp'],
            ['mapPin', 'Nairobi Nursery', 'Nairobi-Nyeri Highway'],
            ['leaf', 'Certified Grafted', 'High Yield & Fast Fruiting'],
            ['shield', 'Order on WhatsApp', '+254 710 583 989'],
          ].map(([icon, title, copy]) => (
            <div className="trust-item" key={title} data-reveal="fade"><Icon name={icon} className="icon icon-lg" /><div><strong>{title}</strong><span>{copy}</span></div></div>
          ))}
        </div>
      </div>

      <section>
        <div className="container">
          <div className="section-head" data-reveal="fade"><div><p className="eyebrow">Browse Catalog</p><h2 className="h2">Fruit Seedling Categories</h2></div></div>
          {categoriesLoading && <p className="muted" role="status">Loading seedling categories...</p>}
          {categoriesError && <p role="status">We could not load categories. <button type="button" className="clear-filters" onClick={retryCategories}>Try again</button></p>}
          {!categoriesLoading && !categoriesError && categories.length === 0 && <p className="muted">Categories are being prepared. <Link to="/shop">Browse all seedlings</Link></p>}
          <div className="cat-grid">
            {categories.slice(0, 4).map(category => (
              <Link to={`/shop?category=${encodeURIComponent(category.slug)}`} className="cat-card" key={category.id} data-reveal="fade">
                <div className="art"><SeedlingIllustration color="#2E7D32" /></div>
                <h3>{category.name}</h3>
                <span className="muted" style={{ fontSize: 13 }}>{category.description || 'Explore seedlings in this category'}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="container">
          <div className="section-head" data-reveal="fade">
            <div><p className="eyebrow">Top Rated Seedlings</p><h2 className="h2">Featured Fruit Seedlings</h2></div>
            <Link to="/shop" className="view-all">View all seedlings <Icon name="arrowRight" className="icon icon-sm" /></Link>
          </div>
          <div className="product-grid">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" style={{ height: 400, background: '#eee', borderRadius: 8 }}></div>)
            ) : (
              products.slice(0, 4).map((product) => <ProductCard product={product} quickAdd key={product.id} reveal />)
            )}
          </div>
        </div>
      </section>

      <HomeServices />

      <section id="about">
        <div className="container">
          <div className="story about-story">
            <div>
              <p className="eyebrow" data-reveal="fade">About Savannah Seedlings</p>
              <h2 className="h2" style={{ marginBottom: 20 }} data-reveal="fade">Propagating Sustainable Agriculture across Kenya.</h2>
              <p className="lede" style={{ marginBottom: 20 }} data-reveal="fade">Savannah Seedlings is dedicated to seeding Africa for sustainable fruit farming. Our certified horticulturists cultivate healthy, pest-free, high-yield grafted fruit seedlings to empower smallholders, commercial orchards, and household growers across Kenya.</p>
              <div className="about-points">
                <div data-reveal="fade"><strong>Nairobi Nursery</strong><span>Located at Kasarani Kastemil Junction, Nairobi for convenient city pickups and delivery arrangements.</span></div>
                <div data-reveal="fade"><strong>Murang'a Nursery</strong><span>Situated at Kwa Samaki Murang'a along the Nairobi-Nyeri Highway for upcountry farmers.</span></div>
                <div data-reveal="fade"><strong>Complete Planting Guides</strong><span>Every seedling comes with step-by-step planting, spacing, and care procedures for maximum yield.</span></div>
              </div>
              <div className="hero-actions" data-reveal="fade">
                <Link to="/shop" className="btn btn-primary">Browse Seedlings</Link>
                <a href="#contact" className="btn btn-outline">Contact Nursery</a>
              </div>
            </div>
            <div className="art about-panel" data-reveal="fade">
              <SeedlingIllustration color="#2E7D32" detailed />
              <div className="about-stats">
                <div><strong>Africa-wide</strong><span>Delivery arranged on WhatsApp</span></div>
                <div><strong>Our Locations</strong><span>Kasarani-Nairobi & Murang'a</span></div>
                <div><strong>Certified</strong><span>Grafted varieties</span></div>
              </div>
            </div>
          </div>
          <NurseryGallery />
        </div>
      </section>

      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="container">
          <div className="section-head" data-reveal="fade"><div><p className="eyebrow">Farmer Testimonials</p><h2 className="h2">What Growers Say</h2></div></div>
          <div className="testi-grid">
            {['Grafted Hass Avocado seedlings took root wonderfully on my Murang\'a farm. Already flowering early!', 'Ordered 50 Grafted Pixie Orange seedlings via WhatsApp. Delivered right to my farm in Machakos.', 'Excellent root stock quality and step-by-step planting guidance provided by the team.'].map((quote, index) => (
              <div className="testi-card" key={quote} data-reveal="fade">
                <div className="rating">
                  <div className="stars">
                    {Array.from({ length: 5 }).map((_, i) => <Icon name="star" key={i} className="star-active" />)}
                  </div>
                </div>
                <p>"{quote}"</p>
                <footer>{['John M. - Murang\'a', 'Grace N. - Machakos', 'David K. - Nakuru'][index]}</footer>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="container">
          <div className="contact-layout">
            <div data-reveal="fade">
              <p className="eyebrow">Contact & Inquiries</p>
              <h2 className="h2">Need advice on fruit farming or bulk seedling orders?</h2>
              <p className="lede">Get in touch with Savannah Seedlings for agronomy support, nursery location directions, bulk discounts, or WhatsApp ordering.</p>
            </div>
            <div className="contact-grid">
              {contactLinks.map((item) => (
                <a className="contact-card" href={item.href} key={item.label} data-reveal="fade" target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined}>
                  <span className="contact-icon"><Icon name={item.icon} /></span>
                  <span>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Newsletter />
      </div>
    </>
  );
}

function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="newsletter">
      <div className="container" data-reveal="fade">
        <p className="eyebrow">Farmer Community</p>
        <h2 className="h2">Get Seasonal Planting & Grafting Tips</h2>
        <form className="newsletter-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
          {!submitted && <div className="newsletter-row"><input type="email" placeholder="you@email.com" required /><button className="btn btn-primary" type="submit">Subscribe</button></div>}
        </form>
        <div className={`newsletter-success ${submitted ? 'show' : ''}`}><Icon name="checkCircle" /> Welcome to the Savannah Seedlings grower network!</div>
        <p className="newsletter-fine">No spam, only fruit farming insights and new seedling availability alerts.</p>
      </div>
    </section>
  );
}
