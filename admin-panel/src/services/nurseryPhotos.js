import api from './api';

export const nurseryPhotosService = {
  list: async () => (await api.get('/nursery-photos/')).data,
  save: async (id, data) => (await (id
    ? api.patch(`/nursery-photos/${id}/`, data)
    : api.post('/nursery-photos/', data))).data,
  remove: async (id) => api.delete(`/nursery-photos/${id}/`),
};
