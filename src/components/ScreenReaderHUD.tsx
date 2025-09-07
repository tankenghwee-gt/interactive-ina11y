// =============================
// Silktide-style Minimal HUD (AX-tree version)
// =============================

import type { JSX } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useScreenReaderSimulator } from "../hooks/useScreenReaderSimulator";

export function ScreenReaderHUD(): JSX.Element | null {
  const {
    state: { nodes, index, muted },
    actions: { focusNext, focusPrev, setMuted },
  } = useScreenReaderSimulator({ lang: "en-US" });

  // Local HUD-only state
  const [hudOpen, setHudOpen] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  // Build a compact, SR-like announcement for the current node (HUD narration)
  const currentAnnouncement = useMemo(() => {
    const node = nodes[index];
    if (!node) return "";

    const parts: string[] = [];
    if (node.name) parts.push(`"${node.name}"`);
    if (node.role) {
      // Heading level if present
      if (node.role === "heading") {
        // try aria-level; fallback to native hN if available
        const levelAttr = node.el.getAttribute("aria-level");
        let level: number | undefined;
        if (levelAttr) {
          const n = parseInt(levelAttr, 10);
          if (Number.isFinite(n)) level = n;
        } else {
          const t = node.el.tagName.toLowerCase();
          if (/^h[1-6]$/.test(t)) level = parseInt(t[1]!, 10);
        }
        parts.push(`Heading${level ? ` level ${level}` : ""}`);
      } else {
        parts.push(cap(node.role));
      }
    }
    if (node.value) parts.push(`- ${node.value}`);
    if (node.states.length) parts.push(`- ${node.states.join(", ")}`);
    if (node.coords) parts.push(`- row ${node.coords.row}, col ${node.coords.col}`);
    if (node.pos) parts.push(`- ${node.pos.pos} of ${node.pos.size}`);

    return parts.join(" ");
  }, [nodes, index]);

  // Append to narration feed whenever index changes (unless muted)
  useEffect(() => {
    if (!hudOpen || !currentAnnouncement) return;
    //setLog((prev) => [currentAnnouncement, ...prev].slice(0, 50));
    setLog(() => [currentAnnouncement]);
  }, [currentAnnouncement, hudOpen, muted]);

  // Actions
  const onPrev = useCallback(() => focusPrev(), [focusPrev]);
  const onNext = useCallback(() => focusNext(), [focusNext]);

  const onSelect = useCallback(() => {
    const node = nodes[index];
    if (!node) return;
    const el = node.el as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const role = node.role;

    // Focus text-editable; otherwise activate
    const editable =
      tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable || role === "textbox";
    if (editable) {
      el.focus?.();
      if (!muted) setLog((prev) => [`Edit field${node.name ? ` - ${node.name}` : ""}`, ...prev].slice(0, 50));
    } else {
      el.click?.();
      if (!muted) setLog((prev) => [`Activated${node.name ? ` - ${node.name}` : ""}`, ...prev].slice(0, 50));
    }
  }, [nodes, index, muted]);

  const onEscape = useCallback(() => {
    window.speechSynthesis?.cancel();
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
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); /* tree mirrors DOM; no separate rescan needed */ }}
              style={{ color: "#6b7280", textDecoration: "none" }}
            >
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
          <ControlButton label="Escape" sub="Esc" onClick={onEscape} mutedLook />
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
            onClick={() => {
                if (!muted) {
                  window.speechSynthesis.cancel();
                }
                setMuted((m) => !m)
              }
            }
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

function Bubble({ children, kind = "user" }: { children: React.ReactNode; kind?: "system" | "user" }) {
  const light = kind !== "system";
  return <div className={`srs-bubble ${light ? "srs-bubble--light" : ""}`}>{children}</div>;
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
