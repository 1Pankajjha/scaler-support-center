// API URL configuration for different environments
const getApiBaseUrl = () => {
  // Check if explicitly set in environment
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're on Railway
  if (window.location.hostname.includes('.up.railway.app')) {
    // Try different patterns for backend URL
    const baseHostname = window.location.hostname;
    
    // Pattern 1: Add -1 suffix (most common)
    if (!baseHostname.includes('-1.up.railway.app')) {
      const projectName = baseHostname.split('.up.railway.app')[0];
      return `https://${projectName}-1.up.railway.app`;
    }
    
    // Pattern 2: Try backend subdomain
    const projectName = baseHostname.split('.up.railway.app')[0];
    return `https://backend-${projectName}.up.railway.app`;
  }
  
  // Default to same origin (for local development)
  return window.location.origin;
};

export default getApiBaseUrl;
