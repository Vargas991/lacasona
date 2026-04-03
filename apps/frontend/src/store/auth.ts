import { UserSession } from '../types';

const AUTH_KEY = 'lacasona.auth';

export function saveSession(session: UserSession) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function loadSession(): UserSession | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}
