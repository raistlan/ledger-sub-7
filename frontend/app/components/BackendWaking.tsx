import { useEffect, useRef, useState } from "react";
import {
  C,
  font,
  raisedBorder,
  sunkenBorder,
  progressBlocks,
} from "~/utils/win95";
import {
  useWakeBackend,
  type WakeBackendOptions,
} from "~/hooks/useWakeBackend";

/** Total segments in the Win95-style progress bar. */
const BLOCK_COUNT = 20;
/** How often we advance the fill animation (ms). */
const TICK_MS = 100;

/**
 * Shown by the root ErrorBoundary when a loader hit a sleeping (502/503/504)
 * Render free-tier backend. Drives a browser-side wake (useWakeBackend) and,
 * on success, revalidates so the real page replaces this screen.
 */
export function BackendWaking({
  options,
}: { options?: WakeBackendOptions } = {}) {
  const { status, attempts, retry, attemptTimeoutMs } = useWakeBackend(options);

  const [fill, setFill] = useState(0);
  const attemptStart = useRef(Date.now());

  // New attempt → reset the bar to empty and restart the fill clock.
  useEffect(() => {
    attemptStart.current = Date.now();
    setFill(0);
  }, [attempts]);

  useEffect(() => {
    if (status !== "waking") return;
    const id = setInterval(() => {
      const elapsed = Date.now() - attemptStart.current;
      setFill(Math.min(elapsed / attemptTimeoutMs, 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, attemptTimeoutMs]);

  const isTimeout = status === "timeout";
  const heading = isTimeout
    ? "STILL SLEEPING"
    : status === "recovered"
      ? "READY"
      : "WAKING SERVER";

  const displayFill = status === "waking" ? fill : 1;
  const filled = progressBlocks(displayFill, BLOCK_COUNT);
  const blockColor = isTimeout ? "#cc4444" : C.cyan;
  const accent = isTimeout ? "#cc4444" : C.cyan;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        backgroundColor: C.bg,
        color: C.text,
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          ...raisedBorder(),
          backgroundColor: C.surface,
          padding: "28px 32px",
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.06em",
            marginBottom: 18,
            color: accent,
          }}
        >
          {heading}
        </div>

        <div
          style={{
            ...sunkenBorder,
            backgroundColor: C.bg,
            display: "flex",
            gap: 2,
            padding: 3,
            height: 22,
            boxSizing: "border-box",
          }}
        >
          {Array.from({ length: BLOCK_COUNT }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: i < filled ? blockColor : "transparent",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
