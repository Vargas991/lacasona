declare global {
  interface Window {
    __LACASONA_CONFIG__?: {
      apiUrl?: string;
      socketUrl?: string;
    };
  }
}

function getRuntimeConfig() {
  return window.__LACASONA_CONFIG__ ?? {};
}

function normalizeUrl(url: string | undefined, fallback: string) {
  if (!url || !url.trim()) {
    return fallback;
  }

  return url.trim().replace(/\/$/, '');
}

export function getApiUrl() {
  return normalizeUrl(getRuntimeConfig().apiUrl, 'http://localhost:3000');
}

export function getSocketUrl() {
  return normalizeUrl(getRuntimeConfig().socketUrl, getApiUrl());
}

export {};
