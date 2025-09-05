// =============================
// Silktide-style Minimal HUD
// =============================

import type { JSX } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useScreenReaderSimulator } from "../hooks/useScreenReaderSimulator";
import { roleOf, stateOf, headingLevel, tableCoords } from "../utils/utils";

export function ScreenReaderHUD(): JSX.Element | null {
  const {
    state: { nav, index, hudOpen },
    actions: { rescan, focusAt, setHudOpen },
  } = useScreenReaderSimulator({ lang: "en-US" });

  // Local HUD-only state
  const [muted, setMuted] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // Build a compact, SR-like announcement for the current node (for HUD narration only)
  const currentAnnouncement = useMemo(() => {
    const node = nav[index];
    if (!node) return "";
    const parts: string[] = [];

    if (node.kind === "heading") {
      const lvl = (node.meta?.level as number) || headingLevel(node.el) || 2;
      if (node.label) parts.push(`"${node.label}"`);
      parts.push(`Heading level ${lvl}`);
    } else if (node.kind === "link") {
      parts.push("Link");
      if (node.label) parts.push(`- ${node.label}`);
    } else if (node.kind === "table") {
      const rows = (node.el as HTMLTableElement).rows?.length || 0;
      parts.push("Table");
      if (node.label) parts.push(`- ${node.label}`);
      if (rows) parts.push(`- ${rows} rows`);
    } else if (node.kind === "graphic") {
      parts.push("Graphic");
      if (node.label) parts.push(`- ${node.label}`);
    } else if (node.kind === "region") {
      parts.push("Landmark region");
      if (node.label) parts.push(`- ${node.label}`);
    } else {
      // controls / others
      const role = roleOf(node.el);
      const st = stateOf(node.el);
      parts.push(role ? role[0].toUpperCase() + role.slice(1) : "Control");
      if (node.label) parts.push(`- ${node.label}`);
      if (st) parts.push(`- ${st}`);
      const coords = tableCoords(node.el);
      if (coords) parts.push(`- row ${coords.row}, col ${coords.col}`);
    }

    return parts.join(" ");
  }, [nav, index]);

  // Append to narration feed whenever index changes (unless muted)
  useEffect(() => {
    if (!hudOpen) return;
    if (!currentAnnouncement) return;
    if (muted) return;
    setLog((prev) => [currentAnnouncement, ...prev].slice(0, 50));
  }, [currentAnnouncement, hudOpen, muted]);

  // Actions
  const onPrev = useCallback(() => {
    focusAt(index - 1);
  }, [focusAt, index]);

  const onNext = useCallback(() => {
    focusAt(index + 1);
  }, [focusAt, index]);

  const onSelect = useCallback(() => {
    const node = nav[index];
    if (!node) return;
    // Best-effort activation (like “Select”)
    (node.el as HTMLElement).click?.();
    if (!muted) setLog((prev) => [`Activated${node.label ? ` - ${node.label}` : ""}`, ...prev].slice(0, 50));
  }, [nav, index, muted]);

  const onEscape = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    document.querySelectorAll(".srs-focus-ring").forEach((el) => el.classList.remove("srs-focus-ring"));
    if (!muted) setLog((prev) => ["Stopped / cleared highlight", ...prev].slice(0, 50));
  }, [muted]);

  if (!hudOpen) return null;

  return (
    <>
      {/* HUD Container */}
      <div
        role="dialog"
        aria-label="Screen reader"
        style={{
          position: "fixed",
          right: 16,
          top: 16,
          width: 320,
          zIndex: 2147483647,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.2)",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          fontSize: 14,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #eef2f7" }}>
          <strong style={{ fontWeight: 600 }}>Screen reader</strong>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); rescan(); }} style={{ color: "#6b7280", textDecoration: "none" }}>
              How to use a screen reader
            </a>
            <button
              aria-label="Settings"
              onClick={() => alert("Settings placeholder")}
              style={{ border: 0, background: "transparent", color: "#6b7280", cursor: "pointer" }}
            >
              ⚙️
            </button>
            <button onClick={() => setHudOpen(false)} aria-label="Close" style={{ border: 0, background: "transparent", color: "#6b7280", cursor: "pointer" }}>
              ✕
            </button>
          </div>
        </div>

        {/* Controls row (Previous • Next • Select • Escape) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12 }}>
          <ControlButton label="Previous" sub="Left" onClick={onPrev} />
          <ControlButton label="Next" sub="Right" onClick={onNext} />
          <ControlButton label="Select" sub="Space" onClick={onSelect} highlight />
          <ControlButton label="Escape" sub="Esc" onClick={onEscape} disabled={false} mutedLook />
        </div>

        {/* Sub-help row for H shortcut */}
        <div style={{ padding: "0 12px 8px 12px", color: "#6b7280" }}>
          <small>
            Tip: Press <kbd className="srs-kbd">H</kbd> to jump between headings
          </small>
        </div>

        {/* Narration header */}
        <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderTop: "1px solid #eef2f7" }}>
          <strong style={{ fontWeight: 600, fontSize: 13 }}>Narration</strong>
          <button
            onClick={() => setMuted((m) => !m)}
            style={{
              marginLeft: "auto",
              border: 0,
              background: "transparent",
              color: "#6b7280",
              cursor: "pointer",
              fontWeight: 500,
            }}
            aria-pressed={muted}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>

        {/* Narration feed */}
        <div style={{ padding: "8px 12px 12px 12px", maxHeight: 280, overflow: "auto", display: "grid", gap: 8 }}>
          {log.length === 0 && <Bubble kind="system">Page load</Bubble>}
          {log.map((msg, i) => (
            <Bubble key={i}>{msg}</Bubble>
          ))}
        </div>
      </div>

      {/* Minimal styles */}
      <style>{`
        .srs-focus-ring { outline: 3px solid #5b9aff; outline-offset: 2px !important; }
        .srs-kbd { background:#f3f4f6; padding:2px 6px; border-radius:4px; border:1px solid #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .srs-btn {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:6px; border:0; border-radius:10px; padding:12px; cursor:pointer;
          background:#ede9fe; color:#1f2937; font-weight:600;
        }
        .srs-btn:hover { filter: brightness(0.98); }
        .srs-btn--primary { background:#7c3aed; color:#fff; }
        .srs-btn--muted { background:#f3f4f6; color:#9ca3af; }
        .srs-btn--disabled { opacity:.5; cursor:not-allowed; }
        .srs-sub { font-size:12px; font-weight:500; opacity:.85; }
        .srs-bubble {
          max-width: 100%;
          background:#0f766e; color:#fff; padding:10px 12px; border-radius:10px;
          box-shadow: 0 2px 10px rgba(0,0,0,.06);
        }
        .srs-bubble--light {
          background:#fff; color:#111827; border:1px solid #e5e7eb;
        }
        .srs-bubble small { opacity:.9; }
      `}</style>
    </>
  );
}

/* ============================
 * Little UI atoms
 * ============================
 */
function ControlButton({
  label,
  sub,
  onClick,
  disabled,
  highlight,
  mutedLook,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  mutedLook?: boolean;
}) {
  const cls = [
    "srs-btn",
    highlight ? "srs-btn--primary" : "",
    mutedLook ? "srs-btn--muted" : "",
    disabled ? "srs-btn--disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} onClick={onClick} disabled={disabled} aria-disabled={disabled}>
      <div>{label}</div>
      <div className="srs-sub">
        <kbd className="srs-kbd">{sub}</kbd>
      </div>
    </button>
  );
}

function Bubble({
  children,
  kind = "user",
}: {
  children: React.ReactNode;
  kind?: "system" | "user";
}) {
  const light = kind !== "system";
  return <div className={`srs-bubble ${light ? "srs-bubble--light" : ""}`}>{children}</div>;
}
