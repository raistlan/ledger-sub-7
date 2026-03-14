/**
 * Server-side API client for SSR loaders and actions.
 * Forwards the incoming Cookie header so the backend can authenticate the request.
 * Never runs in the browser — only in React Router loaders/actions.
 */

const API_BASE = process.env.BACKEND_URL ?? "http://localhost:8000";

export function extractCookie(cookieStr: string, name: string): string | null {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getLocalDateFromCookie(cookieStr: string): Date {
  const dateStr = extractCookie(cookieStr, "localDate");
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T12:00:00");
  }
  return new Date(); // fallback: server UTC (only on very first SSR before hydration)
}

export class ApiClient {
  private headers: Record<string, string>;

  constructor(cookie: string) {
    const csrfToken = extractCookie(cookie, "csrf_token");
    this.headers = {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      headers: this.headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Response("Unauthorized", { status: 401 });
      }
      const text = await res.text().catch(() => res.statusText);
      throw new Response(text, { status: res.status });
    }

    const json = await res.json();
    return (json.data ?? json) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
