import { C, font } from "~/utils/win95";

export function meta() {
  return [{ title: "L₇ — 404 Not Found" }];
}

export default function NotFound() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        backgroundColor: C.bg,
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16, color: "#cc4444" }}>
        404 NOT FOUND
      </div>
      <div style={{ fontSize: 20, color: C.textMuted, textAlign: "center" }}>
        The requested page could not be found.
      </div>
      <a
        href="/"
        style={{
          marginTop: 32,
          color: C.cyan,
          fontSize: 20,
          textDecoration: "underline",
          fontFamily: font,
        }}
      >
        [ RETURN HOME ]
      </a>
    </div>
  );
}
