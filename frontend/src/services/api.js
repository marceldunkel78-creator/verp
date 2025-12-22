import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});
// Response Interceptor - handle refresh via cookie-based endpoint
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Call refresh endpoint; cookie will be sent because withCredentials=true
        const refreshUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/refresh/`;
        await axios.post(refreshUrl, {}, { withCredentials: true });
        // Retry original request; cookies will be sent and backend will read access_token cookie
        return api(originalRequest);
      } catch (refreshError) {
        // Failed refresh -> go to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
