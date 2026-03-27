import { supabase } from './supabaseClient';

export const fetchWithAuth = async (url, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const defaultOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
  };

  return fetch(url, defaultOptions);
};
