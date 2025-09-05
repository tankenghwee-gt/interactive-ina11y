// =============================
// Minimal Screen Reader Simulator Hook
// Keys: Left/Right, H (⇧H prev), Esc
// =============================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ScreenReaderSimulatorOptions,
  type NavNode,
  collectNavigables,
  speak,
  stateOf,
  tableCoords,
  roleOf,
  headingLevel,
  getText,
} from "../utils/utils";

// eslint-disable-next-line react-refresh/only-export-components
export function useScreenReaderSimulator(options: ScreenReaderSimulatorOptions = {}) {
  const { lang } = options;

  const [nav, setNav] = useState<NavNode[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [hudOpen, setHudOpen] = useState<boolean>(true);
  const liveObsRef = useRef<MutationObserver | null>(null);

  // Voice (keep simple, just pick preferred if present)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  const preferredVoice = useMemo<SpeechSynthesisVoice | null>(() => {
    if (!lang || !voices.length) return null;
    const exact = voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const p = lang.split("-")[0].toLowerCase();
    return voices.find((v) => v.lang?.toLowerCase().startsWith(p)) || null;
  }, [voices, lang]);

  // Position text helper
  const positionText = useCallback((i: number, list: NavNode[]) => `${i + 1} of ${list.length}`, []);

  // Build announcement text (kept compact but SR-like)
  const announce = useCallback((node: NavNode, posText: string): string => {
    const role = roleOf(node.el);
    const state = stateOf(node.el);
    const parts: string[] = [];

    if (node.kind === "heading") {
      const lvl = (node.meta?.level as number) || headingLevel(node.el) || 2;
      parts.push(`heading level ${lvl}`);
      if (node.label) parts.push(node.label);
      if (posText) parts.push(posText);
      return parts.join(", ");
    }

    if (node.kind === "table") {
      const rows = (node.el as HTMLTableElement).rows?.length || 0;
      parts.push("table");
      if (node.label) parts.push(node.label);
      if (rows) parts.push(`${rows} rows`);
      if (posText) parts.push(posText);
      return parts.join(", ");
    }

    if (node.kind === "graphic") {
      parts.push("graphic");
      if (node.label) parts.push(node.label);
      if (posText) parts.push(posText);
      return parts.join(", ");
    }

    if (node.kind === "link") {
      parts.push("link");
      parts.push(node.label || (node.el.getAttribute("href") || ""));
      if (posText) parts.push(posText);
      return parts.join(", ");
    }

    if (node.kind === "region") {
      parts.push("landmark region");
      if (node.label) parts.push(node.label);
      if (posText) parts.push(posText);
      return parts.join(", ");
    }

    // controls / others
    parts.push(role);
    if (node.label) parts.push(node.label);
    if (state) parts.push(state);
    if (posText) parts.push(posText);
    const coords = tableCoords(node.el);
    if (coords) parts.push(`row ${coords.row}, column ${coords.col}`);
    return parts.join(", ");
  }, []);

  const focusAt = useCallback((i: number, interrupt = true): void => {
    if (!nav.length) return;
    const clamped = Math.max(0, Math.min(nav.length - 1, i));
    setIndex(clamped);
    const node = nav[clamped];
    if (!node) return;

    document.querySelectorAll(".srs-focus-ring").forEach((e) => e.classList.remove("srs-focus-ring"));
    node.el.classList.add("srs-focus-ring");
    node.el.scrollIntoView({ block: "center", behavior: "smooth" });

    const text = announce(node, positionText(clamped, nav));
    speak(text, { voice: preferredVoice, interrupt });
  }, [nav, preferredVoice, announce, positionText]);

  const focusNext = useCallback(() => focusAt(index + 1), [focusAt, index]);
  const focusPrev = useCallback(() => focusAt(index - 1), [focusAt, index]);

  const findNextHeadingIndex = useCallback(() => {
    for (let i = index + 1; i < nav.length; i++) {
      if (nav[i].kind === "heading") return i;
    }
    return -1;
  }, [index, nav]);

  const findPrevHeadingIndex = useCallback(() => {
    for (let i = index - 1; i >= 0; i--) {
      if (nav[i].kind === "heading") return i;
    }
    return -1;
  }, [index, nav]);

  // Keyboard: Left/Right/H/Esc only
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return; // don’t hijack typing

      // Left/Right arrows
      if (e.key === "ArrowRight") { e.preventDefault(); focusNext(); return; }
      if (e.key === "ArrowLeft")  { e.preventDefault(); focusPrev(); return; }

      // H (next heading), Shift+H (previous heading)
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        const idx = e.shiftKey ? findPrevHeadingIndex() : findNextHeadingIndex();
        if (idx !== -1) {
          focusAt(idx);
        } else {
          speak(e.shiftKey ? "No previous heading" : "No next heading", { voice: preferredVoice });
        }
        return;
      }

      // Escape: stop speech & clear highlight (and gently hide HUD if any)
      if (e.key === "Escape") {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        document.querySelectorAll(".srs-focus-ring").forEach((el) => el.classList.remove("srs-focus-ring"));
        setHudOpen(false);
        return;
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [focusNext, focusPrev, findNextHeadingIndex, findPrevHeadingIndex, focusAt, preferredVoice]);

  // Live regions (kept minimal)
  useEffect(() => {
    if (liveObsRef.current) liveObsRef.current.disconnect();
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target as HTMLElement;
        const live = el.getAttribute("aria-live");
        if (!live) continue;
        const txt = getText(el);
        if (!txt) continue;
        speak(txt, { interrupt: live === "assertive", voice: preferredVoice });
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    liveObsRef.current = obs;
    return () => obs.disconnect();
  }, [preferredVoice]);

  // Initial scan
  const rescan = useCallback(() => {
    const list = collectNavigables();
    setNav(list);
    setIndex(0);
    speak("Simulator ready. Use Left and Right arrows. Press H for next heading, Shift H for previous. Press Escape to stop.", { voice: preferredVoice });
  }, [preferredVoice]);

  useEffect(() => { rescan(); }, [rescan]);

  return {
    state: { nav, index, hudOpen },
    actions: { rescan, focusAt, setHudOpen },
  } as const;
}
