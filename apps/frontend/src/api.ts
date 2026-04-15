import { enqueueRequest, readQueue, clearQueue } from './store/offlineQueue';
import { clearSession } from './store/auth';
import { getApiUrl } from './runtimeConfig';
import type { KitchenTicketPreview, OrderReceiptPreview } from './types';

const API_URL = getApiUrl();

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function handleUnauthorized() {
  clearSession();
  window.dispatchEvent(new Event('lacasona:unauthorized'));
}

export async function api<T>(
  path: string,
  method: Method,
  token?: string,
  body?: unknown,
): Promise<T> {
  const doRequest = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  if (!navigator.onLine && method !== 'GET') {
    enqueueRequest({ path, method: method as 'POST' | 'PATCH' | 'DELETE', body });
    throw new Error('Sin conexion: accion en cola offline');
  }

  const response = await doRequest();

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('No autorizado');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Error de API');
  }

  return response.json() as Promise<T>;
}

export async function flushOfflineQueue(token: string) {
  if (!navigator.onLine) {
    return;
  }

  const queue = readQueue();
  if (!queue.length) {
    return;
  }

  for (const item of queue) {
    const response = await fetch(`${API_URL}${item.path}`, {
      method: item.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: item.body ? JSON.stringify(item.body) : undefined,
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
  }

  clearQueue();
}
