// API service for frontend to communicate with backend

// For different deployment environments:
// - Netlify: Use /api (will be redirected to Railway)
// - Railway: Use relative URLs
// - Local: Use localhost
// Determine the API base URL based on environment
const getApiBaseUrl = () => {
  // 1. Check for explicit API URL from environment (highest priority)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Fallback for production (Netlify or unified Railway)
  if (import.meta.env.PROD) {
    return '/api';
  }
  
  // 3. Fallback for development
  return 'http://localhost:5001';
};

const API_BASE_URL = getApiBaseUrl();

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    return await handleResponse(response);
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
};

// API endpoints
export const api = {
  // Health check
  health: () => apiRequest('/api/health'),

  // Articles
  getArticles: () => apiRequest('/api/articles'),
  createArticle: (article) => apiRequest('/api/articles', {
    method: 'POST',
    body: JSON.stringify(article),
  }),
  updateArticle: (id, article) => apiRequest(`/api/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(article),
  }),
  deleteArticle: (id) => apiRequest(`/api/articles/${id}`, {
    method: 'DELETE',
  }),

  // Categories
  getCategories: () => apiRequest('/api/categories'),

  // Popular Topics
  getPopularTopics: () => apiRequest('/api/popular-topics'),

  // Chat
  sendMessage: (messages) => apiRequest('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  }),

  // Tickets
  getTickets: () => apiRequest('/api/tickets'),
  createTicket: (ticket) => apiRequest('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(ticket),
  }),
  updateTicket: (id, updates) => apiRequest(`/api/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
};

export default api;
