const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    const problem = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(problem?.message) ? problem.message.join(', ') : problem?.message;
    if (response.status === 403) {
      throw new Error(message ?? 'Forbidden');
    }
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function getApi<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'GET' });
}

export function postApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patchApi<T>(path: string, body?: unknown): Promise<T> {
  return fetchApi<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}
