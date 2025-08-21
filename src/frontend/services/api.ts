import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { token } = response.data;
          localStorage.setItem('token', token);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  
  register: (userData: { email: string; password: string; confirmPassword: string }) =>
    api.post('/auth/register', userData),
  
  verifyMFA: (data: { token: string; code: string }) =>
    api.post('/auth/verify-mfa', data),
  
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  
  logout: () => api.post('/auth/logout'),
  
  getProfile: () => api.get('/auth/profile'),
};

// Trading API
export const tradingAPI = {
  getSignals: (params?: { limit?: number; offset?: number }) =>
    api.get('/trading/signals', { params }),
  
  getPositions: () => api.get('/trading/positions'),
  
  getOrders: (params?: { limit?: number; offset?: number }) =>
    api.get('/trading/orders', { params }),
  
  getPortfolio: () => api.get('/trading/portfolio'),
  
  startBot: () => api.post('/trading/bot/start'),
  
  stopBot: () => api.post('/trading/bot/stop'),
  
  pauseBot: () => api.post('/trading/bot/pause'),
  
  getBotStatus: () => api.get('/trading/bot/status'),
};

// Market Data API
export const marketDataAPI = {
  getTickers: (symbols?: string[]) =>
    api.get('/market/tickers', { params: { symbols: symbols?.join(',') } }),
  
  getCandles: (symbol: string, timeframe: string, limit?: number) =>
    api.get(`/market/candles/${symbol}`, { params: { timeframe, limit } }),
  
  getOrderBook: (symbol: string) =>
    api.get(`/market/orderbook/${symbol}`),
};

// Analytics API
export const analyticsAPI = {
  getPerformanceMetrics: (timeframe?: string) =>
    api.get('/analytics/performance', { params: { timeframe } }),
  
  getTradeHistory: (params?: { limit?: number; offset?: number; symbol?: string }) =>
    api.get('/analytics/trades', { params }),
  
  getPatternAnalysis: (symbol: string, timeframe: string) =>
    api.get(`/analytics/patterns/${symbol}`, { params: { timeframe } }),
};

export default api;