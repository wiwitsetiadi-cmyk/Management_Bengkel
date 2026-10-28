// src/api.ts
const API_BASE = 'http://localhost:3000';

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
    // Token kadaluarsa atau tidak valid, paksa logout
    localStorage.removeItem('bengkel_token');
    localStorage.removeItem('bengkel_user');
    window.location.reload();
    throw new Error('Sesi habis, silakan login ulang');
  }

  return response;
};