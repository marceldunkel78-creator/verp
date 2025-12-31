import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

// Convenience wrappers
const get = (url, config) => api.get(url, config);
const post = (url, data, config) => api.post(url, data, config);
const put = (url, data, config) => api.put(url, data, config);
const del = (url, config) => api.delete(url, config);

export { api, get, post, put, del };
export default api;
