// API URL configuration for different environments
// Deployed at: 2026-03-22T21:00:00Z
const getApiBaseUrl = () => {
  console.log('Current hostname:', window.location.hostname);
  
  // Check if explicitly set in environment
  if (import.meta.env.VITE_API_URL) {
    console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're on Railway
  if (window.location.hostname.includes('.up.railway.app')) {
    console.log('Detected Railway deployment');
    
    // Use the actual backend URL
    const backendUrl = 'https://scaler-support-center-production.up.railway.app';
    console.log('Using backend URL:', backendUrl);
    return backendUrl;
  }
  
  // Check if we're in local development (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Detected local development');
    const localBackendUrl = 'http://localhost:5001';
    console.log('Using local backend URL:', localBackendUrl);
    return localBackendUrl;
  }
  
  // Default to same origin (for other cases)
  console.log('Using same origin:', window.location.origin);
  return window.location.origin;
};

export default getApiBaseUrl;
