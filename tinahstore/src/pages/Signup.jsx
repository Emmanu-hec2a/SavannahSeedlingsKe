import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GoogleSignIn from '../components/auth/GoogleSignIn.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/icons/Icon.jsx';

import { API_BASE_URL as API_URL } from '../services/apiBase.js';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await axios.post(`${API_URL}/auth/registration/`, {
        email,
        password1: password,
        password2: confirmPassword,
      });

      navigate('/account');
    } catch (err) {
      setError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : 'Registration failed. Please try again.'
      );
    }
  };

  return (
    <>
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span className="current">Create Account</span>
        </nav>
        <div className="page-head">
          <div>
            <p className="eyebrow">Join Savannah Seedlings</p>
            <h2 className="h2">Create your farmer account</h2>
            <span className="muted" style={{ fontSize: 13.5 }}>Join our community of fruit growers and commercial farmers across Kenya.</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 90 }}>
        <div className="account-layout">
          <form className="account-card" onSubmit={handleSignup}>
            <h3>Get started</h3>
            {error && <p className="error-text" style={{ color: 'var(--oxblood)', fontSize: 14, marginBottom: 15 }}>{error}</p>}
            <div className="form-field">
              <label>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="farmer@email.com" required />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
            </div>
            <div className="form-field">
              <label>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required />
            </div>
            <button className="btn btn-primary btn-block" type="submit">Create account</button>
            <p className="policy-form-note">Read our <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> before continuing.</p>

            <GoogleSignIn
              label="Sign up with Google"
              onSuccess={async (response) => {
                await googleLogin(response.access_token);
                navigate('/');
              }}
              onError={() => setError('Google sign-in failed. Please try again or use your email and password.')}
            />

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: 14 }}>Already have an account?</p>
              <Link to="/account" className="account-link" style={{ marginTop: 4 }}>Sign in here</Link>
            </div>
          </form>

          <div className="account-card account-benefits">
            <h3>Why create an account?</h3>
            {[
              ['truck', 'Seamless delivery', 'Save your farm and county address for quick re-orders.'],
              ['leaf', 'Planting records', 'Access your digital seedling receipts and planting guides anytime.'],
              ['star', 'Agronomy alerts', 'Get notified about seasonal grafting drops and bulk seedling offers.'],
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
