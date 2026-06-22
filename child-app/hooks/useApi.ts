import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://kidtube-almy.onrender.com';

/**
 * Custom hook that provides a typed, authenticated API client for the child app.
 * Centralizes base URL and token management in one place.
 * Pattern: Custom Hook wrapping a Repository.
 */
export function useApi() {
  const request = useCallback(
    async <T>(
      path: string,
      options: RequestInit = {}
    ): Promise<T | null> => {
      try {
        const token = await AsyncStorage.getItem('kidtube_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers as Record<string, string>),
        };
        const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        if (!res.ok) {
          console.warn(`[api] ${options.method || 'GET'} ${path} → ${res.status}`);
          return null;
        }
        return (await res.json()) as T;
      } catch (err) {
        console.error(`[api] network error on ${path}:`, err);
        return null;
      }
    },
    []
  );

  return {
    /** Fetch the parent's global settings (disableShorts, educationalTollbooth). */
    getSettings: () =>
      request<{ disableShorts: boolean; educationalTollbooth: boolean }>('/api/settings'),

    /** Fetch all child profiles for the authenticated parent account. */
    getChildren: () => request<any[]>('/api/children'),

    /** Fetch videos for a specific child's feed. */
    getVideos: (childId: string) =>
      request<any[]>(`/api/videos?childId=${childId}`),

    /** Log a video watch event to the backend. */
    logHistory: (childId: string, video: {
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnail: string;
    }) =>
      request('/api/history', {
        method: 'POST',
        body: JSON.stringify({ childId, ...video }),
      }),

    /** Award stars to a child for completing a math problem. */
    awardStars: (childId: string, starsToAdd = 10) =>
      request('/api/videos/stars', {
        method: 'POST',
        body: JSON.stringify({ childId, starsToAdd }),
      }),

    /** Authenticate the parent device (login). */
    login: (email: string, password: string) =>
      request<{ token: string; userId: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  };
}
