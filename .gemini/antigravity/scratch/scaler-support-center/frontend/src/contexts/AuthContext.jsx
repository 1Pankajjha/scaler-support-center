import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5001/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Check token validity on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      const email = localStorage.getItem('admin_email');
      const name = localStorage.getItem('admin_name');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // For now, if token exists and has valid format, allow access
        // In production, this would verify with backend
        if (token.startsWith('oauth_token_') || token.startsWith('Bearer ')) {
          setUser({
            email: email || 'admin@scaler.com',
            name: name || 'Scaler Admin',
            token: token
          });
          setIsAuthenticated(true);
        } else {
          // Invalid token format, clear it
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_email');
          localStorage.removeItem('admin_name');
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        // Clear invalid token
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_email');
        localStorage.removeItem('admin_name');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
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

      // Store secure token
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_email', data.user.email);
      localStorage.setItem('admin_name', data.user.name);

      setUser({
        email: data.user.email,
        name: data.user.name,
        token: data.token
      });
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      // For temporary development, simulate successful OAuth
      // In production, this would integrate with real Google OAuth backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      const mockEmail = 'admin@scaler.com';
      const mockName = 'Scaler Admin';
      const token = 'oauth_token_' + Date.now();

      // Verify the email domain
      if (!mockEmail.endsWith('@scaler.com')) {
        throw new Error('Access restricted to @scaler.com accounts only.');
      }

      // Store secure token
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_email', mockEmail);
      localStorage.setItem('admin_name', mockName);

      setUser({
        email: mockEmail,
        name: mockName,
        token: token
      });
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_name');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/admin/login');
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return false;

    try {
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
        setUser(prev => ({ ...prev, token: data.token }));
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  }, [logout]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
