const fieldNames = {
  email: 'Email', password1: 'Password', password2: 'Confirm password',
  customer_name: 'Name', customer_email: 'Email', customer_phone: 'Phone',
  delivery_address: 'Delivery address', city: 'Town / area', county: 'County',
};

function messages(value, field = '') {
  if (typeof value === 'string') return [fieldNames[field] ? `${fieldNames[field]}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap(item => messages(item, field));
  if (value && typeof value === 'object') {
    return Object.entries(value).filter(([key]) => key !== 'stock_issues')
      .flatMap(([key, item]) => messages(item, key));
  }
  return [];
}

export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data ?? error?.data;
  // Never expose proxy HTML, stack traces, or arbitrary server-error bodies.
  if ((error?.response?.status ?? error?.status ?? 0) >= 500) return fallback;
  const readable = typeof data === 'string' ? [] : messages(data);
  if (readable.length) return [...new Set(readable)].join(' ');
  return error?.isApplicationError && error.message ? error.message : fallback;
}

export class ApiError extends Error {
  constructor(status, data) {
    super(errorMessage({ status, data }, 'Your request could not be completed. Please try again.'));
    this.status = status;
    this.data = data;
    this.isApplicationError = true;
  }
}
