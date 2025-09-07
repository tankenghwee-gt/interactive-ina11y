// useScreenReaderSimulator.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collectAccTree,
  type AccNode,
  speak,
} from "../utils/utils";

export function useScreenReaderSimulator(options: { lang?: string } = {}) {
  const { lang } = options;

  const [nodes, setNodes] = useState<AccNode[]>([]);
  const [index, setIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechUnlocked, setSpeechUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  // Load voices properly
  useEffect(() => {
    console.log("speechSynthesis" in window);
    if (!("speechSynthesis" in window)) return;
    const update = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  const preferredVoice = useMemo(() => {
    if (!lang || !voices.length) return null;
    return (
      voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) =>
        v.lang?.toLowerCase().startsWith(lang.split("-")[0].toLowerCase())
      ) ||
      null
    );
  }, [voices, lang]);

  // Initial build of tree
  useEffect(() => {
    setNodes(collectAccTree());
  }, []);

  const announce = useCallback(
    (node: AccNode, i: number): string => {
      const parts: string[] = [];
      if (node.name) parts.push(node.name);

      // Skip internal "statictext"
      if (node.role && node.role !== "statictext") parts.push(node.role);

      if (node.value) parts.push(node.value);
      if (node.states.length) parts.push(node.states.join(", "));
      if (node.pos) parts.push(`${node.pos.pos} of ${node.pos.size}`);
      if (node.coords) parts.push(`row ${node.coords.row}, column ${node.coords.col}`);
      parts.push(`${i + 1} of ${nodes.length}`);
      return parts.join(", ");
    },
    [nodes.length]
  );

  const focusAt = useCallback(
    (i: number) => {
      if (!nodes.length) return;
      const clamped = Math.max(0, Math.min(nodes.length - 1, i));
      setIndex(clamped);
      const node = nodes[clamped];
      if (!node) return;
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      node.el.classList.add("srs-focus-ring");
      node.el.scrollIntoView({ block: "center", behavior: "smooth" });
      const text = announce(node, clamped);

      if (speechUnlocked && !muted) {
        speak(text, { voice: preferredVoice || undefined, interrupt: true });
      }
    },
    [nodes, announce, speechUnlocked, preferredVoice, muted]
  );

  const focusNext = useCallback(() => focusAt(index + 1), [focusAt, index]);
  const focusPrev = useCallback(() => focusAt(index - 1), [focusAt, index]);

  // Key bindings
  useEffect(() => {
    const isEditable = (el: HTMLElement | null, role?: string) =>
      !!el &&
      (el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        role === "textbox" ||
        role === "combobox");

    const restoreRing = () => {
      const node = nodes[index];
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      if (node) node.el.classList.add("srs-focus-ring");
    };

    const activateOrFocus = () => {
      const node = nodes[index];
      if (!node) return;
      const el = node.el;
      if (isEditable(el, node.role)) el.focus?.();
      else (el as HTMLElement).click?.();
    };

    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const activeIsEditable = isEditable(active);

      // Unlock speech on first user gesture
      if (
        !speechUnlocked &&
        ["ArrowRight", "ArrowLeft", "h", "H", "Enter", " "].includes(e.key)
      ) {
        setSpeechUnlocked(true);
        if (!muted) {
          speak("Screen reader ready", { voice: preferredVoice || undefined });
        }
      }

      // Always handle Escape, even inside text fields
      if (e.key === "Escape") {
        e.preventDefault();
        window.speechSynthesis?.cancel();
        if (activeIsEditable) {
          active?.blur();
          restoreRing();
        } else {
          document
            .querySelectorAll(".srs-focus-ring")
            .forEach((el) => el.classList.remove("srs-focus-ring"));
        }
        return;
      }

      if (activeIsEditable) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          focusNext();
          return;
        case "ArrowLeft":
          e.preventDefault();
          focusPrev();
          return;
        case "h":
        case "H": {
          e.preventDefault();
          if (e.shiftKey) {
            for (let i = index - 1; i >= 0; i--) {
              if (nodes[i]?.role === "heading") {
                focusAt(i);
                return;
              }
            }
          } else {
            for (let i = index + 1; i < nodes.length; i++) {
              if (nodes[i]?.role === "heading") {
                focusAt(i);
                return;
              }
            }
          }
          return;
        }
        case " ":
        case "Spacebar":
        case "Enter":
          e.preventDefault();
          activateOrFocus();
          return;
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [nodes, index, focusAt, focusNext, focusPrev, speechUnlocked, preferredVoice, muted]);

  return {
    state: { nodes, index, muted },
    actions: { focusAt, focusNext, focusPrev, setMuted },
  };
}
