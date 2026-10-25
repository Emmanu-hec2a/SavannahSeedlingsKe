import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { paymentsService } from '../services/payments';
import { authService } from '../services/auth';
import { SESSION_ENDED, clearAdminSession, getAdminToken, saveAdminSession } from '../services/adminSession';

export const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current += 1;
    setUser(null);
    setExpiresAt(null);
    setPendingCount(0);
    setNotifications([]);
    setSessionError('');
    setLoading(false);
  }, []);

  const restoreSession = useCallback(async () => {
    const attempt = ++generation.current;
    const token = getAdminToken();
    if (!token) { reset(); return; }
    try {
      const data = await authService.getMe();
      if (generation.current !== attempt || getAdminToken() !== token) return;
      if (!data.user?.is_staff || !(Date.parse(data.expires_at) > Date.now())) {
        clearAdminSession();
        return;
      }
      setUser(data.user);
      setExpiresAt(data.expires_at);
      setSessionError('');
    } catch (error) {
      if (generation.current !== attempt || getAdminToken() !== token) return;
      if ([401, 403].includes(error.response?.status)) {
        clearAdminSession();
      } else {
        setUser(null);
        setPendingCount(0);
        setNotifications([]);
        setSessionError('Unable to verify your staff session. Check your connection and try again.');
      }
    } finally {
      if (generation.current === attempt) setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    window.addEventListener(SESSION_ENDED, reset);
    localStorage.removeItem('ts_admin_token');
    restoreSession();
    window.addEventListener('focus', restoreSession);
    return () => {
      generation.current += 1;
      window.removeEventListener(SESSION_ENDED, reset);
      window.removeEventListener('focus', restoreSession);
    };
  }, [reset, restoreSession]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(clearAdminSession, Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const login = async (username, password) => {
    const attempt = ++generation.current;
    const data = await authService.login(username, password);
    if (generation.current !== attempt) throw new Error('Sign-in interrupted. Please try again.');
    saveAdminSession(data);
    setUser(data.user);
    setExpiresAt(data.expires_at);
    setSessionError('');
    setLoading(false);
  };

  const logout = async () => {
    const token = getAdminToken();
    clearAdminSession();
    if (!token) return;
    try {
      await authService.logout(token);
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error('Signed out on this browser. Server sign-out could not be confirmed; the session will expire automatically.');
      }
    }
  };

  const fetchGlobalData = useCallback(async () => {
    const token = getAdminToken();
    if (!user || !token) return;
    try {
      const data = await paymentsService.getStats();
      if (getAdminToken() !== token) return;
      setPendingCount(data.unread_orders_count || 0);
      setNotifications(data.unread_orders || []);
    } catch (error) {
      if (error.response?.status !== 401) console.warn('Unable to refresh admin notifications.');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 30000);
    return () => clearInterval(interval);
  }, [user, fetchGlobalData]);

  return (
    <AdminContext.Provider value={{ user, loading, sessionError, restoreSession, login, logout,
      pendingCount, setPendingCount, notifications, refreshGlobalData: fetchGlobalData }}>
      {children}
    </AdminContext.Provider>
  );
};
