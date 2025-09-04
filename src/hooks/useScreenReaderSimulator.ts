
// =============================
// Hook
// =============================

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { type ScreenReaderSimulatorOptions, type NodeKind, collectNavigables, speak, stateOf, tableCoords, type NavNode, roleOf, headingLevel, getText } from "../utils/utils";


// eslint-disable-next-line react-refresh/only-export-components
export function useScreenReaderSimulator(options: ScreenReaderSimulatorOptions = {}) {
  const { curtain = false, lang, initialFilter = "all" } = options;

  const [nav, setNav] = useState<NavNode[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [filter, setFilter] = useState<NodeKind | "all">(initialFilter);
  const [hudOpen, setHudOpen] = useState<boolean>(true);
  const [curtainOn, setCurtainOn] = useState<boolean>(curtain);
  const [reading, setReading] = useState<boolean>(false); // Read All state
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const liveObsRef = useRef<MutationObserver | null>(null);
  const contRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const filtered = useMemo<NavNode[]>(() => (filter === "all" ? nav : nav.filter((n) => n.kind === filter)), [nav, filter]);

  // Voices
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

  const rescan = useCallback((): void => {
    const list = collectNavigables();
    setNav(list); setIndex(0);
    speak("Simulator ready. Press J and K to move.", { voice: preferredVoice });
  }, [preferredVoice]);

  // Build announcement text closer to SRs
  const announce = useCallback((node: NavNode, posText: string): string => {
    const role = roleOf(node.el);
    const state = stateOf(node.el);
    const parts: string[] = [];
    if (node.kind === "heading") {
      const lvl = (node.meta?.level as number) || headingLevel(node.el) || 2;
      parts.push(`heading level ${lvl}`);
      parts.push(node.label || "");
      if (posText) parts.push(posText);
      return parts.filter(Boolean).join(", ");
    }
    if (node.kind === "table") {
      const rows = (node.el as HTMLTableElement).rows?.length || 0;
      parts.push("table");
      if (node.label) parts.push(node.label);
      if (rows) parts.push(`${rows} rows`);
      if (posText) parts.push(posText);
      return parts.filter(Boolean).join(", ");
    }
    if (node.kind === "graphic") {
      parts.push("graphic");
      if (node.label) parts.push(node.label);
      if (posText) parts.push(posText);
      return parts.filter(Boolean).join(", ");
    }
    if (node.kind === "link") {
      parts.push("link");
      parts.push(node.label || (node.el.getAttribute("href") || ""));
      if (posText) parts.push(posText);
      return parts.filter(Boolean).join(", ");
    }
    if (node.kind === "region") {
      parts.push("landmark region");
      if (node.label) parts.push(node.label);
      if (posText) parts.push(posText);
      return parts.filter(Boolean).join(", ");
    }
    // controls and others
    parts.push(role);
    if (node.label) parts.push(node.label);
    if (state) parts.push(state);
    if (posText) parts.push(posText);
    // Table coordinates for focusable cells
    const coords = tableCoords(node.el);
    if (coords) parts.push(`row ${coords.row}, column ${coords.col}`);
    return parts.filter(Boolean).join(", ");
  }, []);

  const positionText = useCallback((i: number, list: NavNode[]) => `${i + 1} of ${list.length}`, []);

  const focusAt = useCallback((i: number, interrupt = true): void => {
    if (!filtered.length) return;
    const clamped = Math.max(0, Math.min(filtered.length - 1, i));
    setIndex(clamped);
    const node = filtered[clamped];
    if (!node) return;

    document.querySelectorAll(".srs-focus-ring").forEach((e) => e.classList.remove("srs-focus-ring"));
    node.el.classList.add("srs-focus-ring");
    node.el.scrollIntoView({ block: "center", behavior: "smooth" });

    const text = announce(node, positionText(clamped, filtered));
    speak(text, { voice: preferredVoice, interrupt });
  }, [filtered, preferredVoice, announce, positionText]);

  // Read All (continuous)
  const readAllFrom = useCallback((start: number): void => {
    if (!filtered.length) return;
    contRef.current.cancelled = false;
    setReading(true);
    const step = (i: number) => {
      if (contRef.current.cancelled) { setReading(false); return; }
      if (i >= filtered.length) { setReading(false); return; }
      setIndex(i);
      const node = filtered[i];
      document.querySelectorAll(".srs-focus-ring").forEach((e) => e.classList.remove("srs-focus-ring"));
      node.el.classList.add("srs-focus-ring");
      node.el.scrollIntoView({ block: "center", behavior: "smooth" });
      const text = announce(node, positionText(i, filtered));
      speak(text, { voice: preferredVoice, interrupt: true, onend: () => step(i + 1) });
    };
    step(start);
  }, [filtered, preferredVoice, announce, positionText]);

  const stopReading = useCallback(() => {
    contRef.current.cancelled = true;
    setReading(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Keyboard shortcuts (single-key like SR conventions, no meta keys)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return; // don't interfere with typing
      const k = e.key.toLowerCase();

      if (k === "k") { e.preventDefault(); focusAt(index + 1); return; } // next
      if (k === "j") { e.preventDefault(); focusAt(index - 1); return; } // previous

      // Read all / stop / pause-resume
      if (k === ";") { e.preventDefault(); readAllFrom(index); return; } // start from here
      if (k === "s") { e.preventDefault(); stopReading(); return; } // stop

      // Buckets similar to rotor filters
      if (k === "h") { setFilter("heading"); speak("Headings"); return; }
      if (k === "r") { setFilter("region"); speak("Landmarks"); return; }
      if (k === "l") { setFilter("link"); speak("Links"); return; }
      if (k === "f") { setFilter("control"); speak("Form fields"); return; }
      if (k === "t") { setFilter("table"); speak("Tables"); return; }
      if (k === "g") { setFilter("graphic"); speak("Graphics"); return; }
      if (k === "a") { setFilter("all"); speak("All"); return; }

      // Heading level jumps 1–6
      if (k >= "1" && k <= "6") {
        const target = Number(k);
        const idx = filtered.findIndex((n, i) => i > index && n.kind === "heading" && (n.meta?.level as number) === target);
        if (idx !== -1) { e.preventDefault(); focusAt(idx); }
        return;
      }

      // Focus mode toggle (basic)
      if (k === "enter") {
        setFocusMode((v) => !v);
        speak(`Focus mode ${!focusMode ? "on" : "off"}`);
        e.preventDefault();
        return;
      }

      // Activate current control in focus mode
      if (focusMode && (k === " " || k === "return")) {
        const node = filtered[index];
        if (node && (node.kind === "control" || node.kind === "link")) {
          (node.el as HTMLElement).click();
          speak("activated");
          e.preventDefault();
        }
        return;
      }

      // Curtain toggle
      if (k === "c") { setCurtainOn((v) => !v); e.preventDefault(); return; }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [focusAt, index, readAllFrom, stopReading, filtered, focusMode]);

  // Live regions
  useEffect(() => {
    if (liveObsRef.current) liveObsRef.current.disconnect();
    const obs = new MutationObserver((muts: MutationRecord[]) => {
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
  useEffect(() => { rescan(); }, [rescan]);

  return {
    state: { nav, filtered, index, filter, hudOpen, curtainOn, reading, focusMode },
    actions: { rescan, setFilter, setHudOpen, setCurtainOn, focusAt, readAllFrom, stopReading, setFocusMode },
  } as const;
}

