/**
 * KidTube API Client
 *
 * Centralized HTTP client for all backend calls.
 * Eliminates URL duplication and standardizes auth headers and error handling.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://kidtube-almy.onrender.com';

/** Retrieves the stored auth token from localStorage (client-side only). */
const getToken = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kidtube_token') || '';
};

/** Core fetch wrapper with auth headers and unified error handling. */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid — clear storage and reload to login
    localStorage.removeItem('kidtube_token');
    localStorage.removeItem('kidtube_userId');
    window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const api = {
  // ─── Settings ───────────────────────────────────────────────────────────────
  settings: {
    get: () => apiFetch<{ disableShorts: boolean; educationalTollbooth: boolean }>('/api/settings'),
    update: (data: Partial<{ disableShorts: boolean; educationalTollbooth: boolean }>) =>
      apiFetch('/api/settings', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ─── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    setDevicePassword: (password: string) =>
      apiFetch('/api/device-password', { method: 'POST', body: JSON.stringify({ password }) }),
  },

  // ─── Children ───────────────────────────────────────────────────────────────
  children: {
    list: () => apiFetch<any[]>('/api/children'),
    create: (name: string) =>
      apiFetch<any>('/api/children', { method: 'POST', body: JSON.stringify({ name }) }),
    updateSettings: (childId: string, settings: { dailyLimitMins?: number; bedtime?: string }) =>
      apiFetch(`/api/children/${childId}/settings`, {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
    delete: (childId: string) =>
      apiFetch(`/api/children/${childId}`, { method: 'DELETE' }),
  },

  // ─── Channels ───────────────────────────────────────────────────────────────
  channels: {
    list: (childId: string) => apiFetch<any[]>(`/api/channels?childId=${childId}`),
    add: (query: string, childId: string) =>
      apiFetch('/api/channels', { method: 'POST', body: JSON.stringify({ query, childId }) }),
    remove: (channelId: string, childId: string) =>
      apiFetch(`/api/channels/${channelId}?childId=${childId}`, { method: 'DELETE' }),
  },

  // ─── Videos ─────────────────────────────────────────────────────────────────
  videos: {
    list: (childId: string, includeHidden = false, channelId?: string) => {
      const qs = new URLSearchParams({ childId, includeHidden: String(includeHidden) });
      if (channelId) qs.append('channelId', channelId);
      return apiFetch<any[]>(`/api/videos?${qs.toString()}`);
    },
    hide: (childId: string, videoId: string) =>
      apiFetch('/api/videos/hide', { method: 'POST', body: JSON.stringify({ childId, videoId }) }),
    unhide: (childId: string, videoId: string) =>
      apiFetch('/api/videos/unhide', { method: 'POST', body: JSON.stringify({ childId, videoId }) }),
  },

  // ─── History ────────────────────────────────────────────────────────────────
  history: {
    list: (childId: string) => apiFetch<any[]>(`/api/history?childId=${childId}`),
  },
};
