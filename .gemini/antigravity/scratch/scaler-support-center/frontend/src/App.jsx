import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import Home from './pages/Home';
import AdminLogin from './pages/AdminLogin';
import AdminOAuthCallback from './pages/AdminOAuthCallback';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Help Center Routes - NO AUTHENTICATION */}
          <Route path="/" element={<Home />} />
          
          {/* Admin Routes - WITH AUTHENTICATION */}
          <Route 
            path="/admin/login" 
            element={
              <AdminAuthProvider>
                <AdminLogin />
              </AdminAuthProvider>
            } 
          />
          <Route 
            path="/admin/callback" 
            element={
              <AdminAuthProvider>
                <AdminOAuthCallback />
              </AdminAuthProvider>
            } 
          />
          <Route 
            path="/admin/dashboard" 
            element={
              <AdminAuthProvider>
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              </AdminAuthProvider>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
