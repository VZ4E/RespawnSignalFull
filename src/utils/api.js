/**
 * API Wrapper - Auto-refreshes token before requests, retries on 401
 */

import { getValidToken, refreshAccessToken } from './tokenManager.js';

/**
 * Wrapper around fetch that auto-refreshes token if expired
 */
async function apiCall(endpoint, options = {}) {
  let token;

  try {
    token = await getValidToken();
  } catch (err) {
    console.error('Authentication failed:', err.message);
    // Redirect to login or show error
    window.location.href = '/login';
    throw err;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  let response = await fetch(endpoint, {
    ...options,
    headers,
  });

  // If token became invalid mid-request, refresh and retry once
  if (response.status === 401) {
    console.log('401 received, attempting refresh and retry...');
    try {
      const newToken = await refreshAccessToken();
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(endpoint, {
        ...options,
        headers,
      });
    } catch (err) {
      console.error('Refresh + retry failed:', err);
      window.location.href = '/login';
      throw err;
    }
  }

  return response;
}

// Export convenience methods
export const api = {
  get: (endpoint) => apiCall(endpoint, { method: 'GET' }),
  post: (endpoint, body) =>
    apiCall(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) =>
    apiCall(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => apiCall(endpoint, { method: 'DELETE' }),
  patch: (endpoint, body) =>
    apiCall(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
};

export default apiCall;
