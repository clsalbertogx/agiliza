const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | null | undefined>;
}

interface ApiErrorEnvelope {
  error?: unknown;
}

function getErrorMessage(payload: ApiErrorEnvelope, status: number): string {
  const error = payload?.error;
  // Backend envelope: { error: { code, message } } or { error: 'message' }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return `HTTP ${status}`;
}

export async function apiClient<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }
      searchParams.set(key, String(value));
    }
    const query = searchParams.toString();
    if (query) {
      url += `?${query}`;
    }
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(getErrorMessage(error, response.status));
  }
  return response.json();
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, string | number | null | undefined>) =>
    apiClient<T>(endpoint, { params }),
  post: <T = any>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = any>(endpoint: string, body?: any) => apiClient<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = any>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
};
