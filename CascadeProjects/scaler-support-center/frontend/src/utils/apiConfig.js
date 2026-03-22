// API URL configuration for different environments
// Using Vite proxy for local development to avoid CORS issues
const getApiBaseUrl = () => {
  console.log('=== API CONFIG DEBUG ===');
  console.log('Current hostname:', window.location.hostname);
  console.log('Current origin:', window.location.origin);
  
  // Check if explicitly set in environment
  if (import.meta.env.VITE_API_URL) {
    console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're on Railway (production)
  if (window.location.hostname.includes('.up.railway.app')) {
    console.log('Detected Railway deployment');
    // For Railway, we need to use the backend service URL
    // This should be set as an environment variable VITE_API_URL
    // Fallback to a different Railway service URL pattern
    const backendUrl = import.meta.env.VITE_API_URL || `https://${window.location.hostname.replace('courteous-charm', 'scaler-support-backend')}`;
    console.log('Using backend URL:', backendUrl);
    return backendUrl;
  }
  
  // For local development, use empty string (Vite proxy handles /api routes)
  // This works because vite.config.js proxies /api to http://localhost:5001
  console.log('Using Vite proxy (empty base URL)');
  return '';
};

export default getApiBaseUrl;
