import { Link, NavLink } from 'react-router-dom';
import { useCallback, useContext, useEffect, useState } from 'react';
import Icon from '../icons/Icon.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import AnnounceBar from './AnnounceBar.jsx';
import SavannahLogo from '../common/SavannahLogo.jsx';
import MobileMenu from './MobileMenu.jsx';
import { useCart } from '../../hooks/useCart.js';
import { WishlistContext } from '../../context/WishlistContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import CountBadge from '../ui/CountBadge.jsx';

export default function Header() {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const cart = useCart();
  const wishlist = useContext(WishlistContext);
  const { user } = useAuth();
  const closeMenu = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <AnnounceBar />
        <div className="nav-row-bg">
          <div className="container nav-row">
            <Link to="/" className="logo flex items-center gap-2">
              <SavannahLogo />
            </Link>
            <nav className="main-nav">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/shop">Shop Seedlings</NavLink>
              <a href="/#about">Nursery Locations</a>
              <a href="/#contact">Contact & WhatsApp</a>
            </nav>
            <div className="nav-icons">
              <ThemeToggle />
              <Link to="/account" className="icon-btn" aria-label="Account">
                {user ? <span className="text-xs font-bold bg-teal-pale text-teal-ink w-6 h-6 rounded-full flex items-center justify-center">{(user.username || user.email).charAt(0).toUpperCase()}</span> : <Icon name="user" />}
              </Link>
              <Link to="/wishlist" className="icon-btn header-secondary-action" aria-label="Wishlist"><Icon name="heart" /><CountBadge className="badge" count={wishlist.count} hideZero /></Link>
              <Link to="/cart" className="icon-btn header-secondary-action" aria-label="Cart"><Icon name="leaf" /><CountBadge className="badge" count={cart.count} /></Link>
              <button
                className="icon-btn nav-toggle"
                type="button"
                aria-label="Open menu"
                aria-expanded={navOpen}
                aria-controls="mobile-menu"
                aria-haspopup="dialog"
                onClick={() => setNavOpen(true)}
              >
                <Icon name="menu" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu open={navOpen} onClose={closeMenu} signedIn={Boolean(user)} />

      <div className="mobile-floating-actions" aria-label="Quick actions">
        <Link to="/wishlist" className="floating-action" aria-label={`Wishlist${wishlist.count ? `, ${wishlist.count} items` : ''}`}>
          <Icon name="heart" />
          <CountBadge className="floating-badge" count={wishlist.count} hideZero />
        </Link>
        <Link to="/cart" className="floating-action" aria-label={`Cart, ${cart.count} items`}>
          <Icon name="leaf" />
          <CountBadge className="floating-badge" count={cart.count} />
        </Link>
      </div>
    </>
  );
}
