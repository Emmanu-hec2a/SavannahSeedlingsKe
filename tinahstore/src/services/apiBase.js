// Accept either a server origin or the complete versioned API URL.
export function normalizeApiBase(value = 'http://127.0.0.1:8000') {
  const base = value.trim().replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base.replace(/\/api$/, '')}/api/v1`;
}

export const API_BASE_URL = normalizeApiBase(import.meta.env?.VITE_API_BASE_URL);
