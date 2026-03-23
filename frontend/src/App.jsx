import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
