import { useState, useEffect } from 'react';
import { api } from '../services/api.js';

export function useProducts(params = {}, { limit } = {}) {
  const [products, setProducts] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function fetchProducts() {
      setLoading(true);
      setError(null);
      setProducts([]);
      try {
        const data = await api.listAllProducts(JSON.parse(paramsKey), { signal: controller.signal, limit });
        if (active) setProducts(data);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProducts();
    return () => { active = false; controller.abort(); };
  }, [paramsKey, limit]);

  return { products, isLoading, error };
}
