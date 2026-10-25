import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ToastContainer from './components/ui/ToastContainer.jsx';
import { OptionalGoogleOAuthProvider } from './components/auth/GoogleSignIn.jsx';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ToastProvider>
        <BrowserRouter>
          <OptionalGoogleOAuthProvider>
            <ThemeProvider>
              <AuthProvider>
                <WishlistProvider>
                  <CartProvider>
                    <App />
                    <ToastContainer />
                  </CartProvider>
                </WishlistProvider>
              </AuthProvider>
            </ThemeProvider>
          </OptionalGoogleOAuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </HelmetProvider>
  </React.StrictMode>
);
