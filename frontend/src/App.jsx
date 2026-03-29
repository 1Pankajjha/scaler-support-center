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
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';
  
  if (!domain || !clientId || !audience) {
     return (
       <div style={{ textAlign: 'center', marginTop: '100px', padding: '20px', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ff4d4f' }}>🚨 Auth0 Configuration Missing</h2>
          <p style={{ color: '#fff', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
            The Auth0 variables (<code>VITE_AUTH0_DOMAIN</code>, <code>VITE_AUTH0_CLIENT_ID</code>, and <code>VITE_AUTH0_AUDIENCE</code>) are empty or missing from your environment. 
            <br/><br/>
            <strong>Are you testing locally?</strong> Make sure you created a <code>.env</code> file with those variables. <br/>
            <strong>Are you on Railway?</strong> Make sure to add them to your Railway Variables dashboard and redeploy.
          </p>
       </div>
     );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/admin/dashboard`,
        audience: audience,
        scope: "openid profile email"
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
