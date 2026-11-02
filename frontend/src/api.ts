// src/api.ts

// Perubahan: Menggunakan Environment Variable untuk URL API
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('bengkel_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('bengkel_token');
    localStorage.removeItem('bengkel_user');
    
    window.dispatchEvent(new CustomEvent('auth:expired'));
    
    throw new Error('Sesi habis, silakan login ulang');
  }

  return response;
};