// =============================
// HUD
// =============================

import type { JSX } from "react";

import { useScreenReaderSimulator } from "../hooks/useScreenReaderSimulator";
import type { NodeKind } from "../utils/utils";

export function ScreenReaderHUD(): JSX.Element | null {
  const {
    state: { filtered, index, filter, hudOpen, curtainOn, reading, focusMode },
    actions: { rescan, setFilter, setHudOpen, setCurtainOn, focusAt, readAllFrom, stopReading, setFocusMode },
  } = useScreenReaderSimulator();

  if (!hudOpen) return null;

  const categories: Array<{ key: NodeKind | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "heading", label: "Headings" },
    { key: "region", label: "Landmarks" },
    { key: "link", label: "Links" },
    { key: "control", label: "Form fields" },
    { key: "table", label: "Tables" },
    { key: "graphic", label: "Graphics" },
  ];

  return (
    <>
      {/* Curtain */}
      <div style={{ position: "fixed", inset: 0, background: "#000", opacity: 0.98, zIndex: 2147483646, display: curtainOn ? "block" : "none" }} />

      {/* HUD */}
      <div role="dialog" aria-label="Screen Reader Simulator" style={{ position: "fixed", right: 16, top: 16, maxWidth: 420, zIndex: 2147483647, background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.2)", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontSize: 14, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontWeight: 600, fontSize: 14 }}>Screen Reader Simulator</strong>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => rescan()}>Rescan</button>
            <button onClick={() => setCurtainOn((v) => !v)}>{curtainOn ? "Uncurtain" : "Curtain"}</button>
            <button onClick={() => setHudOpen(false)}>Close</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button key={c.key} aria-pressed={filter === c.key} onClick={() => setFilter(c.key as NodeKind | "all")} style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: filter === c.key ? "#eef2ff" : "#fff" }}>
              {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => readAllFrom(index)} disabled={reading}>Read all</button>
          <button onClick={() => stopReading()} disabled={!reading}>Stop</button>
          <button onClick={() => setFocusMode((v) => !v)} aria-pressed={focusMode}>{focusMode ? "Focus mode: on" : "Focus mode: off"}</button>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "40vh", overflow: "auto" }}>
          {filtered.map((n, i) => (
            <li key={`${n.kind}-${i}`}>
              <button onClick={() => focusAt(i)} style={{ width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", background: i === index ? "#f1f5f9" : "#fff" }}>
                <span style={{ opacity: 0.7 }}>[{n.kind}]</span> {n.label || "(no name)"}
                {n.kind === "heading" && n.meta?.level ? <span style={{ opacity: 0.6 }}> — h{String(n.meta.level)}</span> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li style={{ opacity: 0.6 }}>No items found</li>}
        </ul>

        <div style={{ opacity: 0.8, marginTop: 8, lineHeight: 1.5 }}>
          Keys: J/K prev/next • ; read-all • S stop • H headings • R landmarks • L links • F forms • T tables • G graphics • A all • 1–6 jump to heading level • C curtain • Enter focus mode toggle
        </div>
      </div>

      <style>{`
        .srs-focus-ring{outline:3px solid #5b9aff; outline-offset:2px !important;}
        button { cursor: pointer; }
        kbd { background:#f3f4f6; padding:2px 4px; border-radius:4px; border:1px solid #e5e7eb; }
      `}</style>
    </>
  );
}