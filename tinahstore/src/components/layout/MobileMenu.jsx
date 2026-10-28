import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from '../icons/Icon.jsx';
import SavannahLogo from '../common/SavannahLogo.jsx';
import LegalLinks from '../common/LegalLinks.jsx';

export default function MobileMenu({ open, onClose, signedIn }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const { pathname, hash } = useLocation();
  const previousLocation = useRef({ pathname, hash });

  useEffect(() => {
    if (previousLocation.current.pathname !== pathname || previousLocation.current.hash !== hash) {
      onClose();
      previousLocation.current = { pathname, hash };
    }
  }, [pathname, hash, onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const desktop = window.matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => {
      if (desktop.matches) onClose();
    };

    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeRef.current.focus({ preventScroll: true });
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();

    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  function dismissBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      onClose();
    }
  }

  function keepFocusInside(event) {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const controls = [...dialog.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(control => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    const outside = !dialog.contains(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || outside)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || outside)) {
      event.preventDefault(); first.focus();
    }
  }

  const sectionActive = (section) => pathname === '/' && hash === section;

  return createPortal(
    <dialog
      ref={dialogRef}
      id="mobile-menu"
      className="mobile-menu-dialog"
      aria-labelledby="mobile-menu-title"
      onClick={dismissBackdrop}
      onKeyDown={keepFocusInside}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="mobile-menu-header">
        <Link to="/" className="logo mobile-menu-logo" onClick={onClose} aria-label="Savannah Seedlings home">
          <SavannahLogo />
        </Link>
        <button ref={closeRef} type="button" className="mobile-menu-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>

      <div className="mobile-menu-content">
        <h2 id="mobile-menu-title">Menu</h2>
        <nav className="mobile-menu-links" aria-label="Mobile navigation">
          <NavLink to="/" end onClick={onClose} className={({ isActive }) => `mobile-menu-link${isActive && !hash ? ' is-active' : ''}`} aria-current={pathname === '/' && !hash ? 'page' : 'false'}>
            <Icon name="grid" /><span>Home</span><Icon name="chevronRight" />
          </NavLink>
          <NavLink to="/shop" onClick={onClose} className={({ isActive }) => `mobile-menu-link${isActive ? ' is-active' : ''}`}>
            <Icon name="leaf" /><span>Shop Seedlings</span><Icon name="chevronRight" />
          </NavLink>
          <Link to="/#services" onClick={onClose} className={`mobile-menu-link${sectionActive('#services') ? ' is-active' : ''}`} aria-current={sectionActive('#services') ? 'location' : undefined}>
            <Icon name="droplet" /><span>Our Services</span><Icon name="chevronRight" />
          </Link>
          <Link to="/#about" onClick={onClose} className={`mobile-menu-link${sectionActive('#about') ? ' is-active' : ''}`} aria-current={sectionActive('#about') ? 'location' : undefined}>
            <Icon name="mapPin" /><span>Nursery Locations</span><Icon name="chevronRight" />
          </Link>
          <Link to="/#contact" onClick={onClose} className={`mobile-menu-link${sectionActive('#contact') ? ' is-active' : ''}`} aria-current={sectionActive('#contact') ? 'location' : undefined}>
            <Icon name="whatsapp" /><span>Contact & WhatsApp</span><Icon name="chevronRight" />
          </Link>
        </nav>

        <div className="mobile-menu-account">
          <NavLink to="/account" onClick={onClose} className={({ isActive }) => `mobile-menu-link${isActive ? ' is-active' : ''}`}>
            <Icon name="user" /><span>{signedIn ? 'My Account' : 'Sign in / Create account'}</span><Icon name="chevronRight" />
          </NavLink>
        </div>
        <div className="mobile-menu-legal"><LegalLinks onNavigate={onClose} /></div>
      </div>

      <div className="mobile-menu-support">
        <p>Need help choosing seedlings?</p>
        <a className="mobile-menu-whatsapp" href="https://wa.me/254710583989" target="_blank" rel="noreferrer" onClick={onClose}>
          <Icon name="whatsapp" /><span>Chat with our nursery</span><Icon name="arrowRight" />
        </a>
        <a className="mobile-menu-phone" href="tel:+254710583989" onClick={onClose}>+254 710 583 989</a>
      </div>
    </dialog>,
    document.body,
  );
}
