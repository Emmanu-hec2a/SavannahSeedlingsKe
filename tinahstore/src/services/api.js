import { API_BASE_URL } from './apiBase.js';

async function request(path, options = {}) {
  const token = localStorage.getItem('ts_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.detail || errorData.error || JSON.stringify(errorData);
    } catch (e) {
      // Not JSON
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  listNurseryPhotos: () => request('/nursery-photos/'),
  // Products
  listCategories: () => request('/categories/'),
  listProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products/${query ? `?${query}` : ''}`);
  },
  getProduct: (slug) => request(`/products/${slug}/`),
  getRelatedProducts: (slug) => request(`/products/${slug}/related/`),

  // Orders
  createOrder: (payload) => request('/orders/', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getOrder: (orderNumber, accessToken) => request(`/orders/${encodeURIComponent(orderNumber)}/`, {
    headers: accessToken ? { 'X-Order-Token': accessToken } : {},
  }),
  listUserOrders: () => request('/orders/'),

  // Payments
  retriggerMpesaStkPush: (orderNumber) => request('/payments/mpesa/initiate/', {
    method: 'POST',
    body: JSON.stringify({ order_number: orderNumber })
  }),
  queryMpesaStatus: (checkoutRequestId) => request('/payments/mpesa/query/', {
    method: 'POST',
    body: JSON.stringify({ checkout_request_id: checkoutRequestId })
  }),
  getMpesaStatus: (checkoutRequestId) => request(`/payments/mpesa/status/${checkoutRequestId}/`),

  // Reviews
  listReviews: (productSlug) => request(`/products/reviews/?product_slug=${productSlug}`),
  submitReview: (payload) => request('/products/reviews/', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
};
