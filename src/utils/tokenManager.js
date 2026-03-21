/**
 * Token Manager - Handles JWT token parsing, expiry checking, and refresh logic
 */

// Decode JWT without verification (client-side only)
function parseJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return null;
  }
}

// Check if token is expired (with 5-min buffer)
function isTokenExpired(token) {
  const decoded = parseJWT(token);
  if (!decoded || !decoded.exp) return true;
  const expiresAt = decoded.exp * 1000; // Convert to ms
  const bufferMs = 5 * 60 * 1000; // 5 minutes before actual expiry
  return expiresAt - bufferMs < Date.now();
}

// Refresh token via server
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new Error('Refresh failed: ' + res.statusText);
    }

    const { accessToken, refreshToken: newRefreshToken } = await res.json();
    localStorage.setItem('accessToken', accessToken);
    if (newRefreshToken) {
      localStorage.setItem('refreshToken', newRefreshToken);
    }

    return accessToken;
  } catch (err) {
    console.error('Token refresh error:', err);
    // If refresh fails, user is logged out
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    throw err;
  }
}

// Get a valid token, refreshing if needed
async function getValidToken() {
  let token = localStorage.getItem('accessToken');
  
  if (!token) {
    throw new Error('No access token. Please log in.');
  }

  if (isTokenExpired(token)) {
    console.log('Token expired, refreshing...');
    token = await refreshAccessToken();
  }

  return token;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.tokenManager = { parseJWT, isTokenExpired, refreshAccessToken, getValidToken };
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseJWT,
    isTokenExpired,
    refreshAccessToken,
    getValidToken,
  };
}
