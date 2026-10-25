import api from './api';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/admin/auth/login/', { username, password }, { skipAdminAuth: true });
    return response.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/admin/auth/password/', {
      old_password: oldPassword,
      new_password: newPassword
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/admin/auth/me/');
    return response.data;
  },
  logout: (token) => api.post('/admin/auth/logout/', null, {
    skipAdminAuth: true,
    headers: { Authorization: `AdminToken ${token}` },
  }),
};
