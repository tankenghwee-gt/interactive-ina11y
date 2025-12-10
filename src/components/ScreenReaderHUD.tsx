import React, { useState, type JSX } from "react";
import { useScreenReaderCore } from "../hooks/useScreenReaderSimulator";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2"; // Install react-icons if needed or use text '?'
import { speak } from "../utils/utils";

export function ScreenReaderHUD(): JSX.Element | null {
  const [hudOpen, setHudOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false); // <--- NEW: Toggle for shortcuts

  const {
    state: { muted, log, activeRect },
    actions: { focusPrev, focusNext, activateOrFocus, escapeAction, setMuted },
  } = useScreenReaderCore({ lang: "en-US", enabled: hudOpen });

  if (!hudOpen) {
    return (
      <button
        onClick={() => setHudOpen(true)}
        style={floatingTriggerBtn}
        type="button"
        aria-hidden
      >
        Open Screen Reader
      </button>
    );
  }

  return (
    <div style={containerStyle} aria-hidden>
      {activeRect && (
        <div
          style={{
            position: "fixed",
            top: activeRect.top,
            left: activeRect.left,
            width: activeRect.width,
            height: activeRect.height,
            outline: "4px solid #7c3aed",
            outlineOffset: "2px",
            pointerEvents: "none",
            zIndex: 99999,
            transition: "all 0.15s ease-out",
          }}
        />
      )}
      {/* Header */}
      <div style={headerStyle}>
        <strong style={{ fontWeight: 600 }}>Screen Reader</strong>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* HELP TOGGLE */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={iconBtn}
            title="Keyboard Shortcuts"
            aria-expanded={showHelp}
          >
            <span style={{ fontSize: 18, fontWeight: "bold" }}>?</span>
          </button>

          <button
            onClick={() => setHudOpen(false)}
            aria-label="Close"
            style={iconBtn}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      {/* --- NEW: SHORTCUTS PANEL --- */}
      {showHelp && (
        <div style={helpPanelStyle}>
          <div style={helpGrid}>
            <KeyRow k="H" label="Headings" />
            <KeyRow k="1-6" label="Heading Levels" />
            <KeyRow k="B" label="Buttons" />
            <KeyRow k="L" label="Links" />
            <KeyRow k="F" label="Forms" />
            <KeyRow k="T" label="Tables" />
            <KeyRow k="G" label="Graphics" />
            <KeyRow k="D" label="Landmarks" />
            <KeyRow k="Space" label="Activate / Toggle" />
            <KeyRow k="Esc" label="Exit Focus Mode" />
          </div>
          <small style={{ display: "block", marginTop: 8, color: "#666" }}>
            Hold <strong>Shift</strong> to move backwards.
          </small>
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: 12,
        }}
      >
        <ControlButton label="Previous" sub="Left Arrow" onClick={focusPrev} />
        <ControlButton label="Next" sub="Right Arrow" onClick={focusNext} />
        <ControlButton
          label="Select"
          sub="Enter/Space"
          onClick={activateOrFocus}
          highlight
        />
        <ControlButton label="Stop/Esc" sub="Esc" onClick={escapeAction} />
      </div>

      {/* Narration Toggle */}
      <div style={narrationBarStyle}>
        <strong style={{ fontWeight: 600, fontSize: 13 }}>Speech Output</strong>
        <button
          onClick={() => {
            if (!muted) window.speechSynthesis?.cancel();
            else speak("Unmuted");
            setMuted(!muted);
          }}
          aria-pressed={muted}
          className={`srs-mute-btn ${muted ? "is-muted" : ""}`}
        >
          {muted ? <HiSpeakerXMark size={18} /> : <HiSpeakerWave size={18} />}
          <span className="srs-mute-label">
            {muted ? "Click to unmute" : "Click to mute"}
          </span>{" "}
        </button>
      </div>

      {/* Logs */}
      <div style={logContainerStyle}>
        {log.length > 0 ? (
          <Bubble kind="user">{log[0]}</Bubble>
        ) : (
          <Bubble kind="user">Narration logs will appear here</Bubble>
        )}
      </div>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function KeyRow({ k, label }: { k: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <kbd className="srs-kbd" style={{ fontSize: 12 }}>
        {k}
      </kbd>
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

function ControlButton({
  label,
  sub,
  onClick,
  disabled,
  highlight,
}: ControlButtonProps) {
  const cls = `srs-btn ${highlight ? "srs-btn--primary" : ""} ${
    disabled ? "srs-btn--disabled" : ""
  }`;
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type="button">
      <div>{label}</div>
      <div className="srs-sub" style={{ opacity: 0.7 }}>
        {sub}
      </div>
    </button>
  );
}

function Bubble({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "system" | "user";
}) {
  const light = kind !== "system";
  return (
    <div className={`srs-bubble ${light ? "srs-bubble--light" : ""}`}>
      {children}
    </div>
  );
}

// --- STYLES ---

const containerStyle: React.CSSProperties = {
  position: "fixed",
  right: 20,
  top: 20,
  width: 340,
  maxHeight: "85vh",
  zIndex: 2147483647,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 50px rgba(0,0,0,.3), 0 0 0 1px rgba(0,0,0,.05)",
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden", // Important for internal scrolling
};

const helpPanelStyle: React.CSSProperties = {
  background: "#f9fafb",
  padding: "12px 16px",
  borderBottom: "1px solid #e5e7eb",
};

const helpGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px 24px",
};

const floatingTriggerBtn: React.CSSProperties = {
  position: "fixed",
  right: 20,
  top: 20,
  padding: "12px 20px",
  background: "#2563eb",
  color: "#fff",
  border: 0,
  borderRadius: 50,
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: "0 4px 20px rgba(37, 99, 235, 0.4)",
  zIndex: 9999,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid #f3f4f6",
  background: "#fff",
};

const iconBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#6b7280",
  cursor: "pointer",
  padding: 4,
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const narrationBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  borderTop: "1px solid #f3f4f6",
  background: "#fff",
};

const logContainerStyle: React.CSSProperties = {
  padding: "12px",
  overflowY: "auto",
  flex: 1, // Takes remaining height
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#f9fafb",
  borderTop: "1px solid #e5e7eb",
};
