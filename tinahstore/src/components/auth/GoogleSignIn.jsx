import { Component, createContext, useContext, useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const GoogleStatus = createContext('unconfigured');

export function OptionalGoogleOAuthProvider({ children }) {
  const [status, setStatus] = useState('loading');

  // Do not load Google's SDK or mount its hooks without a client ID.
  if (!clientId) return children;

  return (
    <GoogleStatus.Provider value={status}>
      <GoogleOAuthProvider
        clientId={clientId}
        onScriptLoadSuccess={() => setStatus('ready')}
        onScriptLoadError={() => setStatus('failed')}
      >
        {children}
      </GoogleOAuthProvider>
    </GoogleStatus.Provider>
  );
}

function GoogleUnavailable() {
  return <p className="google-sign-in-message muted" role="status">Google sign-in is unavailable. Please use your email and password.</p>;
}

// A third-party SDK failure must never unmount the account/signup page.
class GoogleErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    console.warn('Google sign-in is unavailable; email sign-in remains available.');
  }

  render() {
    return this.state.failed ? <GoogleUnavailable /> : this.props.children;
  }
}

function GoogleLoginAction({ label, onSuccess, onError }) {
  const login = useGoogleLogin({
    onSuccess: async (response) => {
      try { await onSuccess(response); }
      catch { onError(); }
    },
    onError,
    onNonOAuthError: onError,
  });

  const handleClick = () => {
    try { login(); }
    catch { onError(); }
  };

  return (
    <>
      <div className="google-sign-in-divider" aria-hidden="true"><span>OR</span></div>
      <button type="button" onClick={handleClick} className="btn btn-outline btn-block" style={{ gap: 12 }}>
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18" />
        {label}
      </button>
    </>
  );
}

export default function GoogleSignIn(props) {
  const status = useContext(GoogleStatus);
  if (status === 'unconfigured') return null;
  if (status === 'failed') return <GoogleUnavailable />;
  if (status === 'loading') {
    return <p className="google-sign-in-message muted" role="status">Loading Google sign-in… You can also use your email and password.</p>;
  }
  return <GoogleErrorBoundary><GoogleLoginAction {...props} /></GoogleErrorBoundary>;
}
