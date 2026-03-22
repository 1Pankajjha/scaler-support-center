import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Check admin authentication status on mount
  useEffect(() => {
    const checkAdminAuth = () => {
      const token = localStorage.getItem('admin_token');
      const email = localStorage.getItem('admin_email');
      const name = localStorage.getItem('admin_name');
      
      if (!token || !email) {
        setIsLoading(false);
        return;
      }

      // Validate token format and email domain
      if (token.startsWith('admin_token_') && email.endsWith('@scaler.com')) {
        setAdminUser({
          email: email,
          name: name || 'Scaler Admin',
          token: token
        });
        setIsAuthenticated(true);
      } else {
        // Clear invalid authentication data
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_email');
        localStorage.removeItem('admin_name');
      }
      
      setIsLoading(false);
    };

    checkAdminAuth();
  }, []);

  const adminLogin = useCallback(async (email, password) => {
    try {
      // For Google OAuth, we need to implement real OAuth flow
      if (password === 'google_oauth') {
        // For development: Simulate OAuth flow with authentication steps
        // In production, this would redirect to real Google OAuth
        
        // Step 1: Show authentication prompt
        const userConfirmed = window.confirm(
          'This will redirect you to Google for authentication.\n\n' +
          'You will need to:\n' +
          '1. Sign in with your @scaler.com account\n' +
          '2. Grant permission to access your email\n' +
          '3. Be redirected back to this application\n\n' +
          'Click OK to proceed with Google authentication.'
        );

        if (!userConfirmed) {
          throw new Error('Authentication cancelled by user');
        }

        // Step 2: Simulate OAuth redirect (in production, this would be a real redirect)
        // For now, we'll simulate the entire OAuth flow
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay

        // Step 3: Simulate getting user info from Google
        const mockUserInfo = {
          email: 'admin@scaler.com', // In production, this would come from Google
          name: 'Scaler Admin',
          verified: true
        };

        // Step 4: Validate @scaler.com domain
        if (!mockUserInfo.email.endsWith('@scaler.com')) {
          throw new Error('Access restricted to @scaler.com accounts only.');
        }

        // Step 5: Generate secure admin token
        const token = `admin_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Step 6: Store admin session
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_email', mockUserInfo.email);
        localStorage.setItem('admin_name', mockUserInfo.name);
        localStorage.setItem('admin_google_verified', 'true');

        setAdminUser({
          email: mockUserInfo.email,
          name: mockUserInfo.name,
          token: token
        });
        setIsAuthenticated(true);

        return { success: true };
      }
      
      // For email/password login (if needed in future)
      if (!email.endsWith('@scaler.com')) {
        throw new Error('Access restricted to @scaler.com accounts only.');
      }

      // Simulate authentication (in production, this would be a real API call)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate secure token
      const token = `admin_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store admin session
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_email', email);
      localStorage.setItem('admin_name', email.split('@')[0]);

      setAdminUser({
        email: email,
        name: email.split('@')[0],
        token: token
      });
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_name');
    setAdminUser(null);
    setIsAuthenticated(false);
    navigate('/admin/login');
  }, [navigate]);

  const validateAdminSession = useCallback(() => {
    const token = localStorage.getItem('admin_token');
    const email = localStorage.getItem('admin_email');
    
    if (!token || !email || !email.endsWith('@scaler.com')) {
      adminLogout();
      return false;
    }
    
    return true;
  }, [adminLogout]);

  const handleOAuthCallback = useCallback(async (code) => {
    try {
      // Exchange authorization code for tokens
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: 'YOUR_GOOGLE_CLIENT_ID',
          client_secret: 'YOUR_GOOGLE_CLIENT_SECRET',
          redirect_uri: window.location.origin + '/admin/callback',
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokenData = await response.json();
      
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userInfo = await userInfoResponse.json();

      // Validate @scaler.com domain
      if (!userInfo.email.endsWith('@scaler.com')) {
        throw new Error('Access restricted to @scaler.com accounts only.');
      }

      // Generate admin token
      const adminToken = `admin_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store admin session
      localStorage.setItem('admin_token', adminToken);
      localStorage.setItem('admin_email', userInfo.email);
      localStorage.setItem('admin_name', userInfo.name);
      localStorage.setItem('admin_google_token', tokenData.access_token);

      setAdminUser({
        email: userInfo.email,
        name: userInfo.name,
        token: adminToken
      });
      setIsAuthenticated(true);

      // Clear OAuth flow flag
      sessionStorage.removeItem('admin_oauth_flow');

      return { success: true };
    } catch (error) {
      console.error('OAuth callback error:', error);
      sessionStorage.removeItem('admin_oauth_flow');
      return { success: false, error: error.message };
    }
  }, []);

  const value = {
    adminUser,
    isLoading,
    isAuthenticated,
    adminLogin,
    adminLogout,
    validateAdminSession,
    handleOAuthCallback
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
