const API_URL = 'http://localhost:5001/api';

class AuthService {
  // Get the current token
  getToken() {
    return localStorage.getItem('admin_token');
  }

  // Check if user is authenticated
  isAuthenticated() {
    const token = this.getToken();
    return !!token;
  }

  // Make authenticated API calls
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // For development, if backend is not available, use regular fetch
    // In production, this would handle token refresh properly
    try {
      const response = await fetch(url, { ...options, ...defaultOptions });

      // Handle token expiration
      if (response.status === 401) {
        // For now, just logout - in production would try refresh
        this.logout();
        throw new Error('Session expired. Please login again.');
      }

      return response;
    } catch (error) {
      // If it's a network error (backend not available), use regular fetch
      if (error.message.includes('Failed to fetch')) {
        console.warn('Backend not available, using unauthenticated fetch for development');
        return fetch(url, options);
      }
      throw error;
    }
  }

  // Refresh the authentication token
  async refreshToken() {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('admin_token', data.token);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  // Logout user
  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_name');
    window.location.href = '/admin/login';
  }

  // Verify token with backend
  async verifyToken() {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  // Login with email and password
  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  // Login with Google
  async loginWithGoogle() {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Google login failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();
