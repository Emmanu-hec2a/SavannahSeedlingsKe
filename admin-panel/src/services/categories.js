import api from './api';

export const categoriesService = {
  list: async () => {
    const categories = [];
    const seenPages = new Set();
    let page = 1;
    while (true) {
      if (!Number.isSafeInteger(page) || page < 1 || seenPages.has(page)) {
        throw new Error('Invalid category pagination. Please refresh and try again.');
      }
      seenPages.add(page);
      const { data } = await api.get('/categories/', { params: { page } });
      const rows = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(rows)) throw new Error('Invalid category list.');
      categories.push(...rows);
      if (Array.isArray(data) || !data.next) return categories;
      if (!rows.length) throw new Error('Incomplete category list.');
      const next = Number(new URL(data.next, 'https://pagination.invalid/').searchParams.get('page'));
      if (next <= page) throw new Error('Repeated category pagination.');
      // Only use the page number, never forward AdminToken to a returned URL.
      page = next;
    }
  },

  create: async (data) => {
    const response = await api.post('/categories/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  update: async (slug, data) => {
    const response = await api.patch(`/categories/${slug}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  delete: async (slug) => {
    const response = await api.delete(`/categories/${slug}/`);
    return response.data;
  }
};
