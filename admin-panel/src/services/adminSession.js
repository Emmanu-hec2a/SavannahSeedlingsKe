export const SESSION_ENDED = 'nursery-admin-session-ended';
const TOKEN_KEY = 'ts_admin_token';
const EXPIRY_KEY = 'ts_admin_expires_at';

export const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY);

export function saveAdminSession(data) {
  if (!data.token || !data.user?.is_staff || !data.user.username ||
      !(Date.parse(data.expires_at) > Date.now())) {
    throw new Error('The server did not return a valid staff session.');
  }
  sessionStorage.setItem(EXPIRY_KEY, data.expires_at);
  sessionStorage.setItem(TOKEN_KEY, data.token);
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  // Old, non-expiring tokens must never grant access to the admin panel.
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_ENDED));
}
