// hooks/useScreenReaderSimulator.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collectAccTree,
  type AccNode,
  speak,
  computeStates, // <-- NEW
  computeValue, // <-- NEW
} from "../utils/utils";

type CoreOptions = {
  lang?: string;
  onNarrate?: (line: string) => void;
  keyboard?: boolean;
  enabled?: boolean; // turn screen reader on/off
};

export function useScreenReaderCore({
  lang,
  onNarrate,
  keyboard = true,
  enabled = true,
}: CoreOptions = {}) {
  // ---- Core state
  const [nodes, setNodes] = useState<AccNode[]>([]);
  const [index, setIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechUnlocked, setSpeechUnlocked] = useState(true);
  const [muted, setMuted] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // ---- Voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update);
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

  // ---- Collect accessible nodes
  useEffect(() => {
    if (!enabled) {
      // Cleanup when disabled
      setNodes([]);
      setLog([]);
      setIndex(0);
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      return;
    }
    setNodes(collectAccTree());
  }, [enabled]);

  // ---- Format announcement (VO-ish)
  const formatAnnouncement = useCallback((node: AccNode): string => {
    const parts: string[] = [];
    // For checkable roles, surface state early
    if (["checkbox", "radio button", "switch"].includes(node.role)) {
      const checkState = node.states.find((s) =>
        /checked|unchecked|selected/.test(s)
      );
      if (checkState) parts.push(checkState);
    }

    // Name
    if (node.name) parts.push(`"${node.name}"`);

    // Role
    if (node.role && node.role !== "statictext") {
      if (node.role === "heading") {
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
        const roleLabel =
          node.role === "radio button"
            ? "Radio button"
            : node.role === "checkbox"
            ? "Checkbox"
            : node.role === "switch"
            ? "Switch"
            : node.role.charAt(0).toUpperCase() + node.role.slice(1);
        parts.push(roleLabel);
      }
    }

    // Text inputs: value or placeholder + "Edit text"
    if (node.role === "textbox" || node.role === "combobox") {
      const el = node.el as HTMLInputElement | HTMLTextAreaElement;
      const val = el.value?.trim();
      if (val) {
        parts.push(`Value: ${val}`);
      } else if (el.placeholder) {
        parts.push(el.placeholder);
      }
    }

    // Other states (required/invalid/etc.)
    const otherStates = node.states.filter(
      (s) => !/checked|unchecked|selected/.test(s)
    );
    if (otherStates.length) parts.push(otherStates.join(", "));

    // Table coords
    if (node.coords)
      parts.push(`row ${node.coords.row}, col ${node.coords.col}`);

    return parts.join(", ");
  }, []);

  // ---- Narrate (speak + log)
  const narrate = useCallback(
    (line: string) => {
      if (!enabled) return;
      setLog((prev) => [line, ...prev].slice(0, 50));
      onNarrate?.(line);
      if (speechUnlocked && !muted) {
        speak(line, { voice: preferredVoice || undefined, interrupt: true });
      }
    },
    [enabled, onNarrate, speechUnlocked, muted, preferredVoice]
  );

  // ---- Focus helpers
  const focusAt = useCallback(
    (i: number) => {
      if (!enabled || !nodes.length) return;
      const clamped = Math.max(0, Math.min(nodes.length - 1, i));
      setIndex(clamped);
      const node = nodes[clamped];
      if (!node) return;

      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      node.el.classList.add("srs-focus-ring");
      node.el.scrollIntoView({ block: "center", behavior: "smooth" });
      console.log(node);
      // Use LIVE states/value so required/invalid/checked reflect current reality
      const live: AccNode = {
        ...node,
        states: computeStates(node.el),
        value: computeValue(node.el),
      };
      narrate(formatAnnouncement(live));
    },
    [enabled, nodes, narrate, formatAnnouncement]
  );

  const focusNext = useCallback(() => focusAt(index + 1), [focusAt, index]);
  const focusPrev = useCallback(() => focusAt(index - 1), [focusAt, index]);

  // ---- Activation (VO-like: only for activatable roles)
  const activateOrFocus = useCallback(() => {
    const activatableRoles = new Set([
      "button",
      "link",
      "checkbox",
      "radio button",
      "switch",
      "option",
      "menuitem",
      "tab",
      "treeitem",
    ]);

    if (!enabled) return;
    const node = nodes[index];
    if (!node) return;

    const el = node.el;
    const editable =
      el.isContentEditable ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      (el instanceof HTMLInputElement &&
        !["checkbox", "radio", "button", "submit"].includes(el.type)) ||
      node.role === "textbox" ||
      node.role === "combobox";

    if (editable) {
      el.focus?.();
      narrate(`Edit field${node.name ? ` - ${node.name}` : ""}`);
      return;
    }

    // 🚨 PATCH: Special case for submit buttons
    if (el instanceof HTMLInputElement && el.type === "submit") {
      // Let the browser handle form submission + validity UI
      el.form?.requestSubmit?.(el); // native form submission
      return;
    }
    if (el instanceof HTMLButtonElement && el.type === "submit") {
      el.form?.requestSubmit?.(el);
      return;
    }

    if (activatableRoles.has(node.role)) {
      el.click();

      // Refresh + re-announce so new state (checked/invalid/etc.) is spoken
      queueMicrotask(() => {
        const newNodes = collectAccTree();
        setNodes(newNodes);
        const cur = newNodes[index];
        if (cur) {
          const live: AccNode = {
            ...cur,
            states: computeStates(cur.el),
            value: computeValue(cur.el),
          };
          narrate(formatAnnouncement(live));
        }
      });
    }
  }, [enabled, nodes, index, narrate, formatAnnouncement]);

  // ---- Escape
  const escapeAction = useCallback(() => {
    if (!enabled) return;
    const active = document.activeElement as HTMLElement | null;
    const activeEditable =
      !!active &&
      (active.isContentEditable ||
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT");

    window.speechSynthesis?.cancel();
    if (activeEditable) {
      active?.blur();
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      nodes[index]?.el.classList.add("srs-focus-ring");
    } else {
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
    }
  }, [enabled, nodes, index]);

  // ---- Keyboard bindings
  useEffect(() => {
    if (!keyboard || !enabled) return;

    const isEditable = (el: HTMLElement | null, role?: string) =>
      !!el &&
      (el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        (el instanceof HTMLInputElement &&
          !["checkbox", "radio", "button", "submit"].includes(el.type)) ||
        role === "textbox" ||
        role === "combobox");

    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const activeIsEditable = isEditable(active);
      if (
        !speechUnlocked &&
        ["ArrowRight", "ArrowLeft", "h", "H", "Enter", " "].includes(e.key)
      ) {
        setSpeechUnlocked(true);
        if (!muted)
          speak("Screen reader ready", { voice: preferredVoice || undefined });
      }

      if (e.key === "Escape") {
        e.preventDefault();
        escapeAction();
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
            narrate("No previous heading");
          } else {
            for (let i = index + 1; i < nodes.length; i++) {
              if (nodes[i]?.role === "heading") {
                focusAt(i);
                return;
              }
            }
            narrate("No next heading");
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
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    keyboard,
    enabled,
    nodes,
    index,
    focusAt,
    focusNext,
    focusPrev,
    activateOrFocus,
    escapeAction,
    narrate,
    muted,
    speechUnlocked,
    preferredVoice,
  ]);

  // ---- NEW: sync with native browser focus (e.g., after checkValidity())
  useEffect(() => {
    if (!enabled) return;

    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // If the focused element is one of our nodes, announce it with LIVE states/value
      const i = nodes.findIndex((n) => n.el === target);
      if (i >= 0) {
        setIndex(i);
        const live: AccNode = {
          ...nodes[i]!,
          states: computeStates(target),
          value: computeValue(target),
        };
        // Update ring to match the browser's focus
        document
          .querySelectorAll(".srs-focus-ring")
          .forEach((el) => el.classList.remove("srs-focus-ring"));
        target.classList.add("srs-focus-ring");
        const validationMessage = (target as HTMLInputElement)
          .validationMessage;
        if (validationMessage) {
          narrate(validationMessage);
          return;
        }
        narrate(formatAnnouncement(live));
      }
    };

    window.addEventListener("focus", onFocus, true);
    return () => window.removeEventListener("focus", onFocus, true);
  }, [enabled, nodes, narrate, formatAnnouncement]);

  return {
    state: {
      nodes,
      index,
      muted,
      log,
      current: nodes[index] || null,
      currentAnnouncement: nodes[index]
        ? formatAnnouncement({
            ...nodes[index]!,
            states: computeStates(nodes[index]!.el), // ensure current
            value: computeValue(nodes[index]!.el),
          })
        : "",
    },
    actions: {
      focusAt,
      focusNext,
      focusPrev,
      activateOrFocus,
      escapeAction,
      setMuted,
      clearLog: () => setLog([]),
    },
  };
}
