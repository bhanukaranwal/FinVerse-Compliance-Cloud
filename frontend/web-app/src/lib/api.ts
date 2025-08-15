import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '@finverse/shared-types';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          try {
            await this.refreshToken();
            // Retry the original request
            return this.instance.request(error.config);
          } catch (refreshError) {
            // Redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post('/api/auth/refresh', {
      refreshToken,
    });

    const { accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
  }

  // Generic request method
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.instance.request<ApiResponse<T>>(config);
      if (response.data.success) {
        return response.data.data as T;
      } else {
        throw new Error(response.data.error?.message || 'Request failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  // HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // File upload
  async uploadFile<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<T>({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
}

export const apiClient = new ApiClient();

// API endpoints
export const api = {
  // Auth
  auth: {
    login: (data: { email: string; password: string; mfaCode?: string }) =>
      apiClient.post('/api/auth/login', data),
    register: (data: any) => apiClient.post('/api/auth/register', data),
    logout: () => apiClient.post('/api/auth/logout'),
    refreshToken: (refreshToken: string) =>
      apiClient.post('/api/auth/refresh', { refreshToken }),
    forgotPassword: (email: string) =>
      apiClient.post('/api/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      apiClient.post('/api/auth/reset-password', { token, password }),
    verifyEmail: (token: string) =>
      apiClient.post('/api/auth/verify-email', { token }),
  },

  // Users
  users: {
    getProfile: () => apiClient.get('/api/users/profile'),
    updateProfile: (data: any) => apiClient.put('/api/users/profile', data),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.post('/api/users/change-password', data),
    enableMFA: () => apiClient.post('/api/users/enable-mfa'),
    disableMFA: (mfaCode: string) =>
      apiClient.post('/api/users/disable-mfa', { mfaCode }),
  },

  // Portfolio
  portfolio: {
    get: () => apiClient.get('/api/portfolio'),
    getHoldings: () => apiClient.get('/api/portfolio/holdings'),
    getPositions: () => apiClient.get('/api/portfolio/positions'),
    getPerformance: (period?: string) =>
      apiClient.get(`/api/portfolio/performance${period ? `?period=${period}` : ''}`),
  },

  // Trades
  trades: {
    list: (params?: any) => apiClient.get('/api/trades', { params }),
    get: (id: string) => apiClient.get(`/api/trades/${id}`),
    create: (data: any) => apiClient.post('/api/trades', data),
    update: (id: string, data: any) => apiClient.put(`/api/trades/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/trades/${id}`),
  },

  // Tax
  tax: {
    calculate: (year: string) => apiClient.get(`/api/tax/calculate/${year}`),
    getReports: () => apiClient.get('/api/tax/reports'),
    generateITR: (year: string, form: string) =>
      apiClient.post('/api/tax/generate-itr', { year, form }),
    fileITR: (data: any) => apiClient.post('/api/tax/file-itr', data),
  },

  // Compliance
  compliance: {
    getDashboard: () => apiClient.get('/api/compliance/dashboard'),
    getViolations: () => apiClient.get('/api/compliance/violations'),
    resolveViolation: (id: string, data: any) =>
      apiClient.post(`/api/compliance/violations/${id}/resolve`, data),
    getRules: () => apiClient.get('/api/compliance/rules'),
  },

  // Documents
  documents: {
    list: (params?: any) => apiClient.get('/api/documents', { params }),
    get: (id: string) => apiClient.get(`/api/documents/${id}`),
    upload: (file: File, onProgress?: (progress: number) => void) =>
      apiClient.uploadFile('/api/documents/upload', file, onProgress),
    delete: (id: string) => apiClient.delete(`/api/documents/${id}`),
    process: (id: string) => apiClient.post(`/api/documents/${id}/process`),
  },

  // Notifications
  notifications: {
    list: (params?: any) => apiClient.get('/api/notifications', { params }),
    markAsRead: (id: string) => apiClient.patch(`/api/notifications/${id}/read`),
    markAllAsRead: () => apiClient.patch('/api/notifications/read-all'),
    getPreferences: () => apiClient.get('/api/notifications/preferences'),
    updatePreferences: (data: any) =>
      apiClient.put('/api/notifications/preferences', data),
  },
};