import { useEffect, useState } from "react";
import { C, font, raisedBorder, sunkenBorder } from "~/utils/win95";
import { useWakeBackend } from "~/hooks/useWakeBackend";

/**
 * Shown by the root ErrorBoundary when a loader hit a sleeping (502/503/504)
 * Render free-tier backend. Drives a browser-side wake (useWakeBackend) and,
 * on success, revalidates so the real page replaces this screen.
 */
export function BackendWaking() {
  const { status, attempts, retry } = useWakeBackend();
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (status !== "waking") return;
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      400,
    );
    return () => clearInterval(id);
  }, [status]);

  const heading =
    status === "timeout"
      ? "STILL SLEEPING"
      : status === "recovered"
        ? "READY"
        : "WAKING SERVER";

  const message =
    status === "timeout"
      ? "The server is taking longer than usual to wake up."
      : status === "recovered"
        ? "Loading your ledger…"
        : "The server dozed off after some quiet time (free hosting). Booting it back up — this can take up to a minute.";

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
            color: status === "timeout" ? "#cc4444" : C.cyan,
          }}
        >
          {heading}
          {status === "waking" ? dots : ""}
        </div>

        <div
          style={{
            fontSize: 18,
            color: C.textMuted,
            lineHeight: 1.5,
            marginBottom: 22,
          }}
        >
          {message}
        </div>

        {status === "waking" && (
          <div
            style={{
              ...sunkenBorder,
              padding: "4px 8px",
              fontSize: 14,
              color: C.textMuted,
            }}
          >
            attempt {attempts} — please wait
          </div>
        )}

        {status === "timeout" && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={retry}
              style={{
                ...raisedBorder(false),
                backgroundColor: C.surface,
                color: C.text,
                fontFamily: font,
                fontSize: 18,
                letterSpacing: "0.06em",
                padding: "8px 24px",
                cursor: "pointer",
              }}
            >
              [ RETRY ]
            </button>
            <a
              href="/"
              style={{
                color: C.cyan,
                fontSize: 18,
                textDecoration: "underline",
                fontFamily: font,
                alignSelf: "center",
              }}
            >
              [ RETURN HOME ]
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
