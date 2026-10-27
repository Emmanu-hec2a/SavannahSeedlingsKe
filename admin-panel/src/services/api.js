import axios from 'axios';
import { clearAdminSession, getAdminToken } from './adminSession';

const origin = (import.meta.env.VITE_API_URL || 'https://api.savannahseedlings.com').replace(/\/+$/, '');

const api = axios.create({
  baseURL: origin.endsWith('/api/v1') ? origin : `${origin}/api/v1`,
  timeout: 15000,
});

// Request interceptor: attach Authorization header
api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token && !config.skipAdminAuth) {
    config.headers.Authorization = `AdminToken ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentToken = getAdminToken();
    if (error.response?.status === 401 && currentToken &&
        error.config?.headers?.Authorization === `AdminToken ${currentToken}`) {
      clearAdminSession();
    }
    return Promise.reject(error);
  }
);

export default api;
