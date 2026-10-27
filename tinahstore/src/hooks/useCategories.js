import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    api.listCategories({ signal: controller.signal })
      .then(data => { if (active) setCategories(data); })
      .catch(err => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  return { categories, isLoading, error, retry: () => setAttempt(value => value + 1) };
}
