const TOKEN_KEY = 'hantutor.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  if (IS_DEMO) {
    const { mockFetch } = await import('./demo/mockServer');
    const r = await mockFetch(opts.method || (opts.body ? 'POST' : 'GET'), path, token, opts.body);
    if (r.status >= 400) throw new ApiError(r.status, (r.body as any)?.error || 'Error', (r.body as any)?.code);
    return r.body as T;
  }
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (isJson && (data as any).error) || res.statusText, isJson ? (data as any).code : undefined);
  return data as T;
}

/** Download a file from an authenticated endpoint. */
export async function download(path: string, filename: string) {
  let blob: Blob;
  if (IS_DEMO) {
    const data = await api(path);
    blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)]);
  } else {
    const res = await fetch('/api' + path, { headers: { Authorization: `Bearer ${getToken()}` } });
    blob = await res.blob();
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
