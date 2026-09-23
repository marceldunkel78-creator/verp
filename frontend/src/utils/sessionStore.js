// Lightweight sessionStorage wrapper with safe JSON handling and optional namespace
const prefix = 'verp_';

function _hasSession() {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

export function getSession(key, fallback = null) {
  if (!_hasSession()) return fallback;
  try {
    const raw = sessionStorage.getItem(prefix + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('getSession parse error', e);
    return fallback;
  }
}

export function setSession(key, value) {
  if (!_hasSession()) return;
  try {
    sessionStorage.setItem(prefix + key, JSON.stringify(value));
  } catch (e) {
    console.warn('setSession error', e);
  }
}

export function removeSession(key) {
  if (!_hasSession()) return;
  try {
    sessionStorage.removeItem(prefix + key);
  } catch (e) {
    console.warn('removeSession error', e);
  }
}

export function clearNamespace() {
  if (!_hasSession()) return;
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {
    console.warn('clearNamespace error', e);
  }
}

const sessionStore = {
  get: getSession,
  set: setSession,
  remove: removeSession,
  clear: clearNamespace
};

export default sessionStore;