// src/components/ScreenReaderHUD.tsx

import { type JSX, useState, useRef, useEffect, useCallback } from "react";
import { HiEye, HiQuestionMarkCircle } from "react-icons/hi";
import {
  HiEyeSlash,
  HiXMark,
  HiSpeakerXMark,
  HiSpeakerWave,
} from "react-icons/hi2";
import { useScreenReaderCore } from "../hooks/useScreenReaderSimulator";
import { speak } from "../utils/utils";

export function ScreenReaderHUD(): JSX.Element | null {
  const [hudOpen, setHudOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false); // Default closed on mobile
  const [curtainActive, setCurtainActive] = useState(true);

  // Ref for the fixed container
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    state: { muted, log },
    actions: { focusPrev, focusNext, activateOrFocus, escapeAction, setMuted },
  } = useScreenReaderCore({ lang: "en-US", enabled: hudOpen });
  const [width, setWidth] = useState<number>(window.innerWidth);

  const handleWindowSizeChange = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);
  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);
    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, [handleWindowSizeChange]);

  const isMobile = width <= 768;

  if (curtainActive) {
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
  } else {
    document.body.style.overflow = "auto";
  }

  // === BEST PRACTICE: Dynamic Body Padding ===
  // This ensures the page content is never hidden behind the fixed HUD.
  useEffect(() => {
    if (!hudOpen || !containerRef.current) {
      document.body.style.paddingBottom = "";
      return;
    }

    const updatePadding = () => {
      if (containerRef.current) {
        const height = containerRef.current.offsetHeight;
        // Add a little extra buffer (20px) for aesthetics
        document.body.style.paddingBottom = `${height + 20}px`;
      }
    };

    // 1. Initial measurement
    updatePadding();

    // 2. Watch for size changes (e.g. expanding help menu, logs wrapping)
    const observer = new ResizeObserver(() => updatePadding());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = ""; // Cleanup on unmount
    };
  }, [hudOpen]); // Re-run if visibility or content changes

  if (!hudOpen) {
    return (
      <button
        onClick={() => setHudOpen(true)}
        className="srs-mobile-trigger"
        type="button"
        aria-hidden="true"
      >
        Open Screen Reader
      </button>
    );
  }

  return (
    <>
      {curtainActive && (
        <div style={curtainStyle} aria-hidden="true">
          <div style={curtainContentStyle}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 24 }}>
              Screen Curtain Active
            </h2>
            <p style={{ margin: 0, opacity: 0.8 }}>
              Visual output is hidden to simulate screen reader usage without
              sight.
            </p>
            <br></br>
            <p style={{ margin: 0, opacity: 0.8 }}>
              Swipe here if you are using touch input.
            </p>
          </div>
        </div>
      )}

      {/* Attach ref here to measure height */}
      <div ref={containerRef} className="srs-hud-container" aria-hidden="true">
        {/* Header */}
        <div style={headerStyle}>
          <strong style={{ fontWeight: 600 }}>Screen Reader</strong>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button
              onClick={() => setCurtainActive(!curtainActive)}
              style={{
                ...iconBtn,
                color: curtainActive ? "#7c3aed" : "#6b7280",
              }}
              title="Toggle Screen Curtain"
            >
              {curtainActive ? <HiEyeSlash size={20} /> : <HiEye size={20} />}
            </button>

            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{ ...iconBtn, color: showHelp ? "#7c3aed" : "#6b7280" }}
              title="Keyboard Shortcuts"
            >
              <HiQuestionMarkCircle size={20} />
            </button>

            <button
              onClick={() => setHudOpen(false)}
              aria-label="Close"
              style={iconBtn}
              type="button"
            >
              <HiXMark size={20} />
            </button>
          </div>
        </div>

        {/* Shortcuts Panel */}
        {showHelp && (
          <div style={helpPanelStyle}>
            <div style={helpGrid}>
              <KeyRow k="H" label="Headings" />
              <KeyRow k="B" label="Buttons" />{" "}
              {/* <KeyRow k="T" label="Tables" />
              <KeyRow k="L" label="Links" /> */}
              <KeyRow k="F" label="Forms" />
              <KeyRow k="G" label="Graphics" />
              {/* <KeyRow k="D" label="Landmarks" /> */}
              <KeyRow k="Space" label="Activate" />
              <KeyRow k="Esc" label="Exit Focus" />
            </div>
            <small style={{ display: "block", marginTop: 8, color: "#666" }}>
              <strong>Shift</strong> + Key to move backwards.
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
          <ControlButton
            label="Previous"
            sub={isMobile ? "Swipe Left" : "Left Arrow"}
            onClick={focusPrev}
          />
          <ControlButton
            label="Next"
            sub={isMobile ? "Swipe Right" : "Right Arrow"}
            onClick={focusNext}
          />
          <ControlButton
            label="Select"
            sub={isMobile ? "Double Tap" : "Enter/Space"}
            onClick={activateOrFocus}
            highlight
          />
          <ControlButton
            label="Stop"
            sub={isMobile ? "Three Finger Tap" : "Esc"}
            onClick={escapeAction}
          />
        </div>

        {/* Narration Toggle */}
        <div style={narrationBarStyle}>
          <strong style={{ fontWeight: 600, fontSize: 13 }}>
            Speech Output
          </strong>
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
              {muted ? "Unmute" : "Mute"}
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
    </>
  );
}

// --- SUBCOMPONENTS & STYLES ---

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

const curtainStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "#000",
  color: "#f3f4f6",
  zIndex: 2147483646,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "auto",
};

const curtainContentStyle: React.CSSProperties = {
  position: "absolute",
  top: "25%",
  textAlign: "center",
  maxWidth: 400,
  padding: 20,
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
  padding: 8,
  borderRadius: 6,
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
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#f9fafb",
  borderTop: "1px solid #e5e7eb",
};
