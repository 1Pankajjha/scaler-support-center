let currentAuthToken = '';

export const setAuthToken = (token) => {
  currentAuthToken = token;
};

export const fetchWithAuth = async (url, options = {}) => {
  const defaultOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  };

  return fetch(url, defaultOptions);
};
