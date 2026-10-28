import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../services/apiBase.js';

const AuthContext = createContext();


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('ts_auth_token'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const activeRequest = useRef(false);
  const sessionVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = sessionVersion.current;
    if (!token) { setLoading(false); return; }
    axios.get(`${API_URL}/auth/user/`, { headers: { Authorization: `Token ${token}` } })
      .then(response => { if (!cancelled && version === sessionVersion.current) setUser(response.data); })
      .catch(() => { if (!cancelled && version === sessionVersion.current) logout(); })
      .finally(() => { if (!cancelled && version === sessionVersion.current) setLoading(false); });
    return () => { cancelled = true; };
    // Restoration runs once; login/signup load the profile before accepting a session.
  }, []);

  const authenticate = async (path, payload) => {
    if (activeRequest.current) throw new Error('Authentication is already in progress.');
    activeRequest.current = true;
    setAuthenticating(true);
    const version = ++sessionVersion.current;
    try {
      const response = await axios.post(`${API_URL}${path}`, payload);
      const key = response.data?.key;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]+$/.test(key) || key === 'undefined' || key === 'null') {
        throw new Error('No valid session was returned.');
      }
      const profile = await axios.get(`${API_URL}/auth/user/`, { headers: { Authorization: `Token ${key}` } });
      if (!profile.data?.email || version !== sessionVersion.current) throw new Error('The session could not be completed.');
      try { localStorage.setItem('ts_auth_token', key); } catch { /* In-memory sign-in still works. */ }
      setUser(profile.data);
      setToken(key);
      setLoading(false);
      return response.data;
    } finally {
      activeRequest.current = false;
      setAuthenticating(false);
      if (version === sessionVersion.current) setLoading(false);
    }
  };

  const login = (email, password) => authenticate('/auth/login/', { email: email.trim(), password });
  const register = (email, password, confirmPassword) => authenticate('/auth/registration/', {
    email: email.trim(), password1: password, password2: confirmPassword,
  });
  // The popup supplies an access token, not an ID-token JWT.
  const googleLogin = tokenString => authenticate('/auth/google/', { access_token: tokenString });

  const logout = () => {
    sessionVersion.current += 1;
    try { localStorage.removeItem('ts_auth_token'); } catch { /* Storage can be disabled. */ }
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authenticating, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
