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
/** Student-only Android app build: no teacher screens (teachers use the class server in a browser). */
export const IS_APP = import.meta.env.VITE_APP === '1';
/** Class server the app talks to, e.g. https://api.example.com ('' = the same site that served the page). */
export const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const apiUrl = (path: string) => `${API_BASE}/api${path}`;

// App + class server: keep the last copy of lessons/dramas/tests so they still open without internet.
const CACHE_PREFIX = 'hantutor.cache:';
const cacheable = (method: string, path: string) => IS_APP && Boolean(API_BASE) && method === 'GET' && !path.startsWith('/admin') && path !== '/me';
const OFFLINE_MSG = 'Cannot reach the server. Check your internet and try again. 서버에 연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  if (IS_DEMO) {
    const { mockFetch } = await import('./demo/mockServer');
    const r = await mockFetch(opts.method || (opts.body ? 'POST' : 'GET'), path, token, opts.body);
    if (r.status >= 400) throw new ApiError(r.status, (r.body as any)?.error || 'Error', (r.body as any)?.code);
    return r.body as T;
  }
  const method = opts.method || (opts.body ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // no internet / server down: last saved copy if there is one
    if (cacheable(method, path)) {
      try {
        const saved = localStorage.getItem(CACHE_PREFIX + path);
        if (saved) return JSON.parse(saved) as T;
      } catch {
        /* storage unavailable */
      }
    }
    throw new ApiError(0, OFFLINE_MSG, 'offline');
  }
  const isJson = res.headers.get('content-type')?.includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (isJson && (data as any).error) || res.statusText, isJson ? (data as any).code : undefined);
  if (cacheable(method, path) && isJson) {
    try {
      localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
    } catch {
      /* storage full: just no offline copy */
    }
  }
  return data as T;
}

/** Download a file from an authenticated endpoint. */
export async function download(path: string, filename: string) {
  let blob: Blob;
  if (IS_DEMO) {
    const data = await api(path);
    blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)]);
  } else {
    const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${getToken()}` } });
    blob = await res.blob();
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
