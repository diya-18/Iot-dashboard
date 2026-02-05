// frontend/lib/api.js
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchAPI(endpoint, options = {}) {
  const token = Cookies.get('token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (response.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API Error: ${response.status}`);
    }
    
    // Handle CSV downloads
    if (response.headers.get('content-type')?.includes('text/csv')) {
      return response.blob();
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
export const authAPI = {
  login: (email, password) => 
    fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  me: () => fetchAPI('/api/auth/me'),
  
  changePassword: (currentPassword, newPassword) =>
    fetchAPI('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// User API
export const userAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/users${query ? `?${query}` : ''}`);
  },
  
  getOne: (id) => fetchAPI(`/api/users/${id}`),
  
  create: (data) => fetchAPI('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id, data) => fetchAPI(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => fetchAPI(`/api/users/${id}`, {
    method: 'DELETE',
  }),
  
  resetPassword: (id) => fetchAPI(`/api/users/${id}/reset-password`, {
    method: 'POST',
  }),
};

// Device API
export const deviceAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/devices${query ? `?${query}` : ''}`);
  },
  
  getOne: (serialNumber) => fetchAPI(`/api/devices/${serialNumber}`),
  
  create: (data) => fetchAPI('/api/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (serialNumber, data) => fetchAPI(`/api/devices/${serialNumber}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (serialNumber) => fetchAPI(`/api/devices/${serialNumber}`, {
    method: 'DELETE',
  }),
  
  assign: (serialNumber, userId, permissions) =>
    fetchAPI(`/api/devices/${serialNumber}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId, permissions }),
    }),
};

// Parameter API
export const parameterAPI = {
  getDeviceParameters: (serialNumber) =>
    fetchAPI(`/api/parameters/${serialNumber}`),
  
  create: (serialNumber, data) =>
    fetchAPI(`/api/parameters/${serialNumber}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id, data) => fetchAPI(`/api/parameters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => fetchAPI(`/api/parameters/${id}`, {
    method: 'DELETE',
  }),
};

// Alert API
export const alertAPI = {
  getDeviceAlerts: (serialNumber) =>
    fetchAPI(`/api/alerts/${serialNumber}`),
  
  create: (serialNumber, data) =>
    fetchAPI(`/api/alerts/${serialNumber}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id, data) => fetchAPI(`/api/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => fetchAPI(`/api/alerts/${id}`, {
    method: 'DELETE',
  }),
  
  getLogs: (serialNumber, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/alerts/${serialNumber}/logs${query ? `?${query}` : ''}`);
  },
  
  acknowledgeLog: (logId, notes) =>
    fetchAPI(`/api/alerts/logs/${logId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
};

// Telemetry API
export const telemetryAPI = {
  getData: (serialNumber, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/telemetry/${serialNumber}${query ? `?${query}` : ''}`);
  },
  
  getLatest: (serialNumber, count = 10) =>
    fetchAPI(`/api/telemetry/${serialNumber}/latest?count=${count}`),
  
  getAggregated: (serialNumber, params) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/telemetry/${serialNumber}/aggregate?${query}`);
  },
  
  exportCSV: async (serialNumber, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const blob = await fetchAPI(`/api/telemetry/${serialNumber}/export?${query}`);
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${serialNumber}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

// Analytics API
export const analyticsAPI = {
  getSummary: () => fetchAPI('/api/analytics/summary'),
  
  getActivity: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/api/analytics/activity${query ? `?${query}` : ''}`);
  },
};