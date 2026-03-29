import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

const Auth0ProviderWithRedirectCallback = ({ children }) => {
  const navigate = useNavigate();
  
  const onRedirectCallback = (appState) => {
    navigate((appState && appState.returnTo) || '/admin/dashboard', { replace: true });
  };

  const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
  
  if (!domain || !clientId) {
     console.warn('⚠️ Auth0 credentials missing in environment variables.');
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/admin/dashboard`
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
};

function App() {
  return (
    <Router>
      <Auth0ProviderWithRedirectCallback>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
        </div>
      </Auth0ProviderWithRedirectCallback>
    </Router>
  );
}

export default App;
