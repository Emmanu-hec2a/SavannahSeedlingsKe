import { NavLink } from 'react-router-dom';

export default function LegalLinks({ onNavigate, newTab = false }) {
  const destination = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <nav className="legal-links" aria-label="Legal information">
      <NavLink to="/privacy-policy" onClick={onNavigate} {...destination}>Privacy Policy</NavLink>
      <NavLink to="/terms-of-service" onClick={onNavigate} {...destination}>Terms of Service</NavLink>
    </nav>
  );
}
