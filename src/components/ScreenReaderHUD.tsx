import React, { useState, type JSX } from "react";
import { useScreenReaderCore } from "../hooks/useScreenReaderSimulator";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { speak } from "../utils/utils";

export function ScreenReaderHUD(): JSX.Element | null {
  const [hudOpen, setHudOpen] = useState(true);

  const {
    state: { muted, log },
    actions: { focusPrev, focusNext, activateOrFocus, escapeAction, setMuted },
  } = useScreenReaderCore({ lang: "en-US", enabled: hudOpen });

  if (!hudOpen) {
    return (
      <>
        <button
          onClick={() => setHudOpen(true)}
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            padding: "10px 16px",
            background: "#7c3aed",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
            zIndex: 9999,
          }}
          type="button"
          aria-hidden
        >
          Open Screen Reader
        </button>
      </>
    );
  }

  return (
    <div style={containerStyle} aria-hidden>
      {/* Header */}
      <div style={headerStyle}>
        <strong style={{ fontWeight: 600 }}>Screen reader</strong>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setHudOpen(false)}
            aria-label="Close"
            style={iconBtn}
            type="button"
          >
            X
          </button>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: 12,
        }}
      >
        <ControlButton label="Previous" sub="Left" onClick={focusPrev} />
        <ControlButton label="Next" sub="Right" onClick={focusNext} />
        <ControlButton
          label="Select/Edit"
          sub="Space"
          onClick={activateOrFocus}
        />
        <ControlButton
          label="Stop Edit/Narration"
          sub="Esc"
          onClick={escapeAction}
        />
      </div>

      <div style={{ padding: "0 12px 8px 12px", color: "#6b7280" }}>
        <small>
          Tip: Press <kbd className="srs-kbd">H</kbd> to jump between headings
        </small>
      </div>

      {/* Narration */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          borderTop: "1px solid #eef2f7",
        }}
      >
        <strong style={{ fontWeight: 600 }}>Narration</strong>
        <button
          onClick={() => {
            if (!muted) {
              window.speechSynthesis?.cancel();
            } else {
              speak("Unmuted");
            }
            setMuted(!muted);
          }}
          aria-pressed={muted}
          className={`srs-mute-btn ${muted ? "is-muted" : ""}`}
        >
          {muted ? <HiSpeakerXMark size={22} /> : <HiSpeakerWave size={22} />}
          <span className="srs-mute-label">
            {muted ? "Click to unmute" : "Click to mute"}
          </span>
        </button>
      </div>

      <div
        style={{
          padding: "8px 12px 12px 12px",
          maxHeight: 280,
          overflow: "auto",
          display: "grid",
          gap: 8,
        }}
      >
        {log.length > 0 ? (
          <Bubble kind="user">{log[0]}</Bubble>
        ) : (
          <Bubble kind="user">Narration logs will appear here</Bubble>
        )}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
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
  overflow: "scroll",
  border: "1px solid #e5e7eb",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
};

const iconBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#6b7280",
  cursor: "pointer",
};

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
    <button
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      type="button"
    >
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
  return (
    <div className={`srs-bubble ${light ? "srs-bubble--light" : ""}`}>
      {children}
    </div>
  );
}
