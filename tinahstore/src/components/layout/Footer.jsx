import { Link } from 'react-router-dom';
import Icon from '../icons/Icon.jsx';
import SavannahLogo from '../common/SavannahLogo.jsx';
import { useRef } from 'react';
import { useSectionReveals } from '../../hooks/useSectionReveals.js';

export default function Footer({ compact = false }) {
  const footerRef = useRef(null);
  useSectionReveals(footerRef, compact);

  if (compact) {
    return (
      <footer className="site-footer">
        <div className="container footer-bottom" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span>© 2026 Savannah Seedlings. All rights reserved.</span>
          <div className="contact-line" style={{ margin: 0 }}><Icon name="mail" className="icon icon-sm" /> Need help? savannahseedlings@gmail.com</div>
        </div>
      </footer>
    );
  }

  return (
    <footer ref={footerRef} className="site-footer" id="footer-contact">
      <div className="container footer-grid" data-reveal="fade">
        <div className="footer-brand">
          <Link to="/" className="logo flex items-center gap-2 mb-3">
            <SavannahLogo showTagline />
          </Link>
          <p>Seeding Africa for Sustainable fruit farming. High-yielding certified grafted fruit seedlings in Kenya. Delivered nationwide with easy M-PESA & WhatsApp ordering.</p>
          <div className="footer-social" style={{ marginTop: 16 }}>
            <a href="https://wa.me/254710583989" target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
            <a href="mailto:savannahseedlings@gmail.com" aria-label="Email"><Icon name="mail" /></a>
            <a href="tel:+254710583989" aria-label="Phone"><Icon name="phone" /></a>
          </div>
        </div>
        <div className="footer-col">
          <h4>Seedling Catalog</h4>
          {['Grafted Hass Avocado', 'Grafted Pixie Orange', 'Grafted Kent Mango', 'Grafted Yellow Passion', 'Dragon Fruit & Exotic'].map((item) => (
            <Link to="/shop" key={item}>{item}</Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Nursery Locations</h4>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
            <strong>1. Nairobi Nursery:</strong><br />Kasarani Kastemil Junction, Nairobi
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            <strong>2. Murang'a Nursery:</strong><br />Kwa Samaki Murang'a along Nairobi-Nyeri Highway
          </p>
        </div>
        <div className="footer-col">
          <h4>Connect & Order</h4>
          <div className="contact-line"><Icon name="mapPin" className="icon icon-sm" /> Kasarani Kastemil Jct & Murang'a</div>
          <div className="contact-line"><Icon name="phone" className="icon icon-sm" /> +254 710 583 989</div>
          <div className="contact-line"><Icon name="whatsapp" className="icon icon-sm" /> +254 710 583 989</div>
          <div className="contact-line"><Icon name="mail" className="icon icon-sm" /> savannahseedlings@gmail.com</div>
        </div>
      </div>
      <div className="container footer-bottom" data-reveal="fade">
        <span>© 2026 Savannah Seedlings. All rights reserved. "Seeding Africa for Sustainable fruit farming"</span>
        <div className="pay-icons">
          <span className="pay-chip">M-PESA</span>
          <span className="pay-chip">WHATSAPP ORDER</span>
          <span className="pay-chip">DELIVERY BY ARRANGEMENT</span>
        </div>
      </div>
    </footer>
  );
}
