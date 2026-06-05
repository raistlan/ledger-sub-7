import { useCallback, useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { getBackendUrl } from "~/lib/clientEnv";

/**
 * Browser-driven wake for a cold Render free-tier backend.
 *
 * When an SSR loader hits a sleeping backend it 502s and the root ErrorBoundary
 * renders <BackendWaking/>, which mounts this hook. We can't reliably wake the
 * backend from the SSR server (Render returns a fast 502 to the abandoned
 * server-to-server fetch). Instead we hit the backend's public /health endpoint
 * directly from the *browser* — a long-lived request that Render holds open
 * while the service boots (~50s), exactly like a manual curl that wakes it.
 *
 * Each attempt is a real GET held up to `attemptTimeoutMs`. A real JSON 200
 * ({status:"ok"}) means the backend is warm; we then revalidate() so the SSR
 * loaders re-run and React Router swaps the error boundary for the real page
 * (this hook unmounts). If revalidation doesn't clear the boundary shortly, we
 * hard-reload as a fallback. After `overallDeadlineMs` with no luck we surface a
 * retryable "timeout".
 */

const HEALTH_PATH = "/api/v1/health";

export type WakeStatus = "waking" | "recovered" | "timeout";

export interface WakeBackendOptions {
  /** Override the readiness probe (tests). Returns true once the backend is warm. */
  probe?: (signal: AbortSignal) => Promise<boolean>;
  /** Max time to hold a single health request open. */
  attemptTimeoutMs?: number;
  /** Give up (status "timeout") after this long. */
  overallDeadlineMs?: number;
  /** Pause between probe attempts. */
  pollGapMs?: number;
  /** If revalidation hasn't replaced this screen after success, hard-reload. */
  reloadFallbackMs?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Default probe: read the backend's public /health and confirm a real JSON 200. */
async function defaultProbe(signal: AbortSignal): Promise<boolean> {
  const base = getBackendUrl();
  if (!base) return false;
  const res = await fetch(`${base}${HEALTH_PATH}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) return false;
  // Render's spin-up "loading" page is HTML — only a JSON body is the real app.
  if (!(res.headers.get("content-type") ?? "").includes("application/json"))
    return false;
  const body = await res.json().catch(() => null);
  return body?.status === "ok";
}

export function useWakeBackend(options: WakeBackendOptions = {}): {
  status: WakeStatus;
  attempts: number;
  retry: () => void;
  attemptTimeoutMs: number;
} {
  const {
    probe = defaultProbe,
    attemptTimeoutMs = 60_000,
    overallDeadlineMs = 120_000,
    pollGapMs = 1_500,
    reloadFallbackMs = 5_000,
  } = options;

  const revalidator = useRevalidator();
  const [status, setStatus] = useState<WakeStatus>("waking");
  const [attempts, setAttempts] = useState(0);
  const [nonce, setNonce] = useState(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    setStatus("waking");
    setAttempts(0);

    async function loop() {
      while (!cancelled && Date.now() - startedAt < overallDeadlineMs) {
        setAttempts((a) => a + 1);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
        let awake = false;
        try {
          awake = await probe(controller.signal);
        } catch {
          awake = false; // CORS/network/abort while cold — keep trying
        } finally {
          clearTimeout(timer);
        }
        if (cancelled) return;
        if (awake) {
          setStatus("recovered");
          revalidator.revalidate();
          reloadTimer.current = setTimeout(() => {
            if (!cancelled && typeof window !== "undefined")
              window.location.reload();
          }, reloadFallbackMs);
          return;
        }
        await sleep(pollGapMs);
      }
      if (!cancelled) setStatus("timeout");
    }

    loop();
    return () => {
      cancelled = true;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
    // Re-run only on explicit retry(); revalidator identity is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return { status, attempts, retry, attemptTimeoutMs };
}
