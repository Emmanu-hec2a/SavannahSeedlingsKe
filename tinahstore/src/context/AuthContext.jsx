import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL as API_URL } from '../services/apiBase.js';

const AuthContext = createContext();


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ts_auth_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Decode token to get user info or fetch from backend
      try {
        // Since we are using dj-rest-auth, we might get a standard token or JWT.
        // For simplicity, let's assume we fetch user details if token exists.
        fetchUserProfile(token);
      } catch (err) {
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await axios.get(`${API_URL}/auth/user/`, {
        headers: { Authorization: `Token ${authToken}` }
      });
      setUser(response.data);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/auth/login/`, { email, password });
    const { key } = response.data;
    localStorage.setItem('ts_auth_token', key);
    setToken(key);
    return response.data;
  };

  const googleLogin = async (tokenString) => {
    // Only send the access_token.
    // Sending the same value as id_token causes 400 because id_token must be a JWT.
    const response = await axios.post(`${API_URL}/auth/google/`, {
      access_token: tokenString
    });
    const { key } = response.data;
    localStorage.setItem('ts_auth_token', key);
    setToken(key);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('ts_auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
