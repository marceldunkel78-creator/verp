// Lightweight storage wrapper using localStorage with safe JSON handling and optional namespace
const prefix = 'verp_';

function _hasLocal() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function getSession(key, fallback = null) {
  if (!_hasLocal()) return fallback;
  try {
    const raw = localStorage.getItem(prefix + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('getSession parse error', e);
    return fallback;
  }
}

export function setSession(key, value) {
  if (!_hasLocal()) return;
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch (e) {
    console.warn('setSession error', e);
  }
}

export function removeSession(key) {
  if (!_hasLocal()) return;
  try {
    localStorage.removeItem(prefix + key);
  } catch (e) {
    console.warn('removeSession error', e);
  }
}

export function clearNamespace() {
  if (!_hasLocal()) return;
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('clearNamespace error', e);
  }
}

export default {
  get: getSession,
  set: setSession,
  remove: removeSession,
  clear: clearNamespace
};