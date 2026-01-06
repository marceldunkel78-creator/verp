import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});
// Response Interceptor - handle refresh via cookie-based endpoint
let isRefreshing = false;
let failedRefresh = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}
function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}
function rejectSubscribers(err) {
  refreshSubscribers.forEach((cb) => cb(err));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    // If request is unauthorized, try to refresh once using a single in-flight refresh
    if (status === 401) {
      // If refresh already failed previously, redirect immediately
      if (failedRefresh) {
        if (!sessionStorage.getItem('logoutRedirect')) {
          sessionStorage.setItem('logoutRedirect', '1');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // If a refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((err) => {
            if (err) return reject(err);
            resolve(api(originalRequest));
          });
        });
      }

      // Mark as retrying this request
      if (originalRequest._retry) {
        // Already retried -> redirect once
        if (!sessionStorage.getItem('logoutRedirect')) {
          sessionStorage.setItem('logoutRedirect', '1');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/auth/refresh/`;
        await axios.post(refreshUrl, {}, { withCredentials: true });
        isRefreshing = false;
        onRefreshed();
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        failedRefresh = true;
        rejectSubscribers(refreshError);
        if (!sessionStorage.getItem('logoutRedirect')) {
          sessionStorage.setItem('logoutRedirect', '1');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);


export default api;
export { API_BASE };
