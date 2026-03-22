// API URL configuration for different environments
const getApiBaseUrl = () => {
  console.log('Current hostname:', window.location.hostname);
  
  // Check if explicitly set in environment
  if (import.meta.env.VITE_API_URL) {
    console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're on Railway
  if (window.location.hostname.includes('.up.railway.app')) {
    // Try different patterns for backend URL
    const baseHostname = window.location.hostname;
    console.log('Detected Railway deployment');
    
    // Pattern 1: Add -1 suffix (most common)
    if (!baseHostname.includes('-1.up.railway.app')) {
      const projectName = baseHostname.split('.up.railway.app')[0];
      const url1 = `https://${projectName}-1.up.railway.app`;
      console.log('Trying pattern 1:', url1);
      return url1;
    }
    
    // Pattern 2: Try backend subdomain
    const projectName = baseHostname.split('.up.railway.app')[0];
    const url2 = `https://backend-${projectName}.up.railway.app`;
    console.log('Trying pattern 2:', url2);
    return url2;
  }
  
  // Default to same origin (for local development)
  console.log('Using same origin:', window.location.origin);
  return window.location.origin;
};

export default getApiBaseUrl;
