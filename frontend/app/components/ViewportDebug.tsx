import { useEffect, useRef, useState } from "react";
import { C, font } from "~/utils/win95";

/**
 * TEMPORARY DIAGNOSTIC — not part of the product.
 *
 * Measures whether the document is actually scrolling (case B) or whether the
 * viewport is edge-to-edge and content is being covered by system UI (case A).
 *
 * The decisive number is MAX scrollY. See docs/plans/2026-07-27-fix-pwa-bottom-row-clipping.md
 *
 * Remove this component and its <ViewportDebug /> mount in root.tsx before merging.
 */

const VIEWPORT_BASE = "width=device-width, initial-scale=1";

interface Readings {
  innerHeight: number;
  clientHeight: number;
  visualHeight: number | null;
  scrollHeight: number;
  scrollY: number;
  maxScrollY: number;
  overflow: number;
  vh: number;
  svh: number;
  lvh: number;
  dvh: number;
  insetTop: number;
  insetBottom: number;
  dpr: number;
  standalone: boolean;
  viewportFit: string;
}

/** Measure what a CSS length actually resolves to, in CSS px. */
function measure(probe: HTMLDivElement, value: string): number {
  probe.style.height = value;
  return probe.getBoundingClientRect().height;
}

function read(probe: HTMLDivElement, maxScrollY: number): Readings {
  const doc = document.documentElement;
  const scrollY = window.scrollY;
  const meta = document.querySelector('meta[name="viewport"]');

  return {
    innerHeight: window.innerHeight,
    clientHeight: doc.clientHeight,
    visualHeight: window.visualViewport?.height ?? null,
    scrollHeight: doc.scrollHeight,
    scrollY,
    maxScrollY: Math.max(maxScrollY, scrollY),
    overflow: doc.scrollHeight - doc.clientHeight,
    vh: measure(probe, "100vh"),
    svh: measure(probe, "100svh"),
    lvh: measure(probe, "100lvh"),
    dvh: measure(probe, "100dvh"),
    insetTop: measure(probe, "env(safe-area-inset-top, 0px)"),
    insetBottom: measure(probe, "env(safe-area-inset-bottom, 0px)"),
    dpr: window.devicePixelRatio,
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    viewportFit: meta?.getAttribute("content")?.includes("viewport-fit=cover")
      ? "cover"
      : "auto (default)",
  };
}

export function ViewportDebug() {
  const probeRef = useRef<HTMLDivElement>(null);
  const maxScrollRef = useRef(0);
  const [readings, setReadings] = useState<Readings | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [cover, setCover] = useState(false);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;

    function sample() {
      if (!probe) return;
      const next = read(probe, maxScrollRef.current);
      maxScrollRef.current = next.maxScrollY;
      setReadings(next);
      return next;
    }

    const first = sample();
    // eslint-disable-next-line no-console
    console.log("[viewport-debug] initial", first);

    // Expose a manual dump for remote-debugging sessions.
    (window as unknown as Record<string, unknown>).__vp = () => {
      const snap = sample();
      // eslint-disable-next-line no-console
      console.log("[viewport-debug] snapshot", snap);
      return snap;
    };

    const onScroll = () => {
      const before = maxScrollRef.current;
      const next = sample();
      if (next && next.maxScrollY > before) {
        // eslint-disable-next-line no-console
        console.log("[viewport-debug] new max scrollY", next.maxScrollY, next);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sample);
    window.visualViewport?.addEventListener("resize", sample);
    window.visualViewport?.addEventListener("scroll", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sample);
      window.visualViewport?.removeEventListener("resize", sample);
      window.visualViewport?.removeEventListener("scroll", onScroll);
      delete (window as unknown as Record<string, unknown>).__vp;
    };
  }, []);

  // Toggle viewport-fit at runtime so the baseline reading stays uncontaminated.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      cover ? `${VIEWPORT_BASE}, viewport-fit=cover` : VIEWPORT_BASE,
    );
    const t = setTimeout(() => {
      const probe = probeRef.current;
      if (!probe) return;
      const next = read(probe, maxScrollRef.current);
      maxScrollRef.current = next.maxScrollY;
      setReadings(next);
      // eslint-disable-next-line no-console
      console.log(`[viewport-debug] viewport-fit=${cover ? "cover" : "auto"}`, next);
    }, 250);
    return () => clearTimeout(t);
  }, [cover]);

  const probe = (
    <div
      ref={probeRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 1,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    />
  );

  if (!readings) return probe;

  // Case (b): the document genuinely scrolls — 100vh overshoots the real viewport.
  // Case (a): nothing scrolls, so the row must be covered by system UI.
  const verdict =
    readings.maxScrollY > 0.5
      ? "B — document scrolls"
      : readings.overflow > 0.5
        ? "B — overflow exists (scroll to confirm)"
        : "A so far — no overflow";

  const rows: Array<[string, string]> = [
    ["MAX scrollY", `${readings.maxScrollY.toFixed(1)}  ← decisive`],
    ["scrollY now", readings.scrollY.toFixed(1)],
    ["overflow", readings.overflow.toFixed(1)],
    ["innerHeight", readings.innerHeight.toFixed(1)],
    ["client/doc h", readings.clientHeight.toFixed(1)],
    ["visualVP h", readings.visualHeight?.toFixed(1) ?? "n/a"],
    ["scrollHeight", readings.scrollHeight.toFixed(1)],
    ["100vh", readings.vh.toFixed(1)],
    ["100svh", readings.svh.toFixed(1)],
    ["100lvh", readings.lvh.toFixed(1)],
    ["100dvh", readings.dvh.toFixed(1)],
    ["inset top", readings.insetTop.toFixed(1)],
    ["inset bottom", readings.insetBottom.toFixed(1)],
    ["viewport-fit", readings.viewportFit],
    ["standalone", String(readings.standalone)],
    ["dpr", String(readings.dpr)],
  ];

  return (
    <>
      {probe}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          position: "fixed",
          top: 4,
          left: 4,
          zIndex: 100000,
          backgroundColor: "rgba(0,0,0,0.88)",
          border: `1px solid ${C.borderMid}`,
          color: C.text,
          fontFamily: font,
          fontSize: 13,
          lineHeight: 1.25,
          padding: collapsed ? "2px 6px" : "4px 8px",
          maxWidth: 210,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {collapsed ? (
          <div>VP ▸ {readings.maxScrollY.toFixed(0)}</div>
        ) : (
          <>
            <div style={{ color: C.cyan, marginBottom: 2 }}>
              VIEWPORT DEBUG ▾
            </div>
            {rows.map(([label, value]) => (
              <div
                key={label}
                style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
              >
                <span style={{ color: C.textMuted }}>{label}</span>
                <span>{value}</span>
              </div>
            ))}
            <div style={{ color: C.cyan, marginTop: 4 }}>{verdict}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCover((v) => !v);
              }}
              style={{
                marginTop: 4,
                width: "100%",
                fontFamily: font,
                fontSize: 13,
                backgroundColor: C.surface,
                color: C.text,
                border: `1px solid ${C.borderMid}`,
                padding: "3px 4px",
              }}
            >
              {cover ? "unset viewport-fit" : "try viewport-fit=cover"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
