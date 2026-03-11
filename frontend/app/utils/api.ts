import type { ApiError, ErrorResponse } from "~/types/api";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiError };

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrfHeaders: Record<string, string> = {};
  if (isMutation && typeof document !== "undefined") {
    const token = getCsrfToken();
    if (token) csrfHeaders["X-CSRF-Token"] = token;
  }

  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include", // browser-side; SSR loaders forward Cookie header manually
    headers: { "Content-Type": "application/json", ...csrfHeaders, ...init?.headers },
  });
  if (res.ok) {
    const body = (await res.json()) as { data: T };
    return { ok: true, data: body.data };
  }
  const body = (await res.json()) as ErrorResponse;
  return { ok: false, status: res.status, error: body.error };
}
