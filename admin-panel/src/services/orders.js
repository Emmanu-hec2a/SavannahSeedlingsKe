import api from './api';

export const ordersService = {
  list: async (params) => {
    const response = await api.get('/orders/', { params });
    return response.data;
  },

  get: async (orderNumber) => {
    const response = await api.get(`/orders/${orderNumber}/`);
    return response.data;
  },

  updateStatus: async (orderNumber, status, extraData = {}) => {
    const response = await api.patch(`/orders/${orderNumber}/`, { status, ...extraData });
    return response.data;
  },

  quoteDelivery: async (orderNumber, deliveryFee) => {
    const response = await api.patch(`/orders/${orderNumber}/`, { delivery_fee: deliveryFee });
    return response.data;
  },

  markDelivered: async (orderNumber) => {
    const response = await api.patch(`/orders/${orderNumber}/`, {
        status: 'delivered',
        balance_collected: true
    });
    return response.data;
  },

  cancel: async (orderNumber) => {
    const response = await api.patch(`/orders/${orderNumber}/`, { status: 'cancelled' });
    return response.data;
  },

  getPendingCount: async () => {
    const response = await api.get('/admin/dashboard/');
    return response.data.unread_orders_count;
  }
};
