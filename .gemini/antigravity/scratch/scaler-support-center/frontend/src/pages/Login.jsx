import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleMockGoogleLogin = (e) => {
    e.preventDefault();
    if (!email.endsWith('@scaler.com')) {
      setError('Unauthorized. Only @scaler.com emails are allowed.');
      return;
    }
    
    // Determine admin role based on the mock email to simulate user vs admin
    // For now, any @scaler.com can access the admin dashboard in our mock implementation.
    localStorage.setItem('admin_token', 'mock_oauth_token_' + email);
    localStorage.setItem('admin_email', email);
    navigate('/admin/dashboard');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="premium-logo login-logo">
            <span className="logo-text">SCALER</span>
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="scaler-icon">
              <path d="M10 3 H21 V14 L13 22 H2 V11 L10 3 Z M5 14 H10 V19 H5 V14 Z" fill="#0055FF" fillRule="evenodd"/>
            </svg>
          </div>
          <h2>Admin Login</h2>
          <p>Sign in with your Scaler Google Account</p>
        </div>
        
        <form onSubmit={handleMockGoogleLogin} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="name@scaler.com" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              required 
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-button">
            Login with Google (Mock)
          </button>
        </form>
        <div className="login-footer">
          <a href="/">← Back to Support Center</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
