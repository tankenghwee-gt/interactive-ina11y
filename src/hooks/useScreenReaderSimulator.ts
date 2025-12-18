// src/hooks/useScreenReaderSimulator.ts
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collectAccTree,
  type AccNode,
  speak,
  computeStates,
  computeValue,
} from "../utils/utils";
import { ROLE_MAP } from "../utils/roleMap";

// =========================================
// 0. Configuration & Constants
// =========================================

type RotorOption = {
  label: string;
  predicate: ((n: AccNode) => boolean) | null;
};

const ROTOR_OPTIONS: RotorOption[] = [
  { label: "Default", predicate: null },
  { label: "Headings", predicate: (n) => n.role === "heading" },
  { label: "Buttons", predicate: (n) => n.role === "button" },
  { label: "Links", predicate: (n) => n.role === "link" },
  {
    label: "Form Fields",
    predicate: (n) =>
      [
        "textbox",
        "combobox",
        "checkbox",
        "radio button",
        "switch",
        "slider",
        "spinbutton",
      ].includes(n.role),
  },
  {
    label: "Tables",
    predicate: (n) => n.role === "table" || n.role === "grid",
  },
  {
    label: "Graphics",
    predicate: (n) => n.role === "img" || n.role === "image",
  },
  {
    label: "Landmarks",
    predicate: (n) =>
      [
        "banner",
        "main",
        "navigation",
        "contentinfo",
        "complementary",
        "search",
        "region",
        "form",
      ].includes(n.role),
  },
];

// =========================================
// 1. Pure Helpers (Formatting)
// =========================================

const formatAnnouncement = (node: AccNode): string => {
  const parts: string[] = [];

  // 1. State (Checkable)
  if (["checkbox", "radio button", "switch"].includes(node.role)) {
    const checkState = node.states.find((s) =>
      /checked|unchecked|selected/.test(s)
    );
    if (checkState) parts.push(checkState);
  }

  // 2. Name
  if (node.name) parts.push(`"${node.name}"`);

  // 3. Role
  if (node.role && node.role !== "statictext") {
    if (node.role === "heading") {
      const levelAttr = node.el.getAttribute("aria-level");
      const level = levelAttr
        ? parseInt(levelAttr, 10)
        : parseInt(node.el.tagName.substring(1), 10);
      parts.push(`Heading${!isNaN(level) ? ` level ${level}` : ""}`);
    } else {
      const mappedRole = ROLE_MAP[node.role] || node.role;
      parts.push(mappedRole.charAt(0).toUpperCase() + mappedRole.slice(1));
    }
  }

  // 4. Description
  if (node.description) parts.push(node.description);

  // 5. Value / Placeholder
  if (node.role === "textbox" || node.role === "combobox") {
    const el = node.el as HTMLInputElement | HTMLTextAreaElement;
    if (el.type === "password") {
      parts.push("Password field");
    } else if (el.value?.trim()) {
      parts.push(`Value: ${el.value.trim()}`);
    } else if (el.placeholder) {
      parts.push(el.placeholder);
    }
  }

  // 6. Validation Error Messages
  if (node.states.includes("invalid")) {
    const el = node.el as HTMLInputElement;
    if (el.validationMessage) {
      parts.push(`Error: ${el.validationMessage}`);
    } else {
      const errId = el.getAttribute("aria-errormessage");
      if (errId) {
        const errEl = document.getElementById(errId);
        if (errEl?.textContent) {
          parts.push(`Error: ${errEl.textContent.trim()}`);
        }
      }
    }
  }

  // 7. Other States
  const otherStates = node.states.filter(
    (s) => !/checked|unchecked|selected|invalid/.test(s)
  );
  if (otherStates.length) parts.push(otherStates.join(", "));

  // 8. Table Coords
  if (node.coords) {
    parts.push(`row ${node.coords.row}, col ${node.coords.col}`);
  }

  return parts.join(", ");
};

// =========================================
// 2. Sub-Hook: Speech Management
// =========================================

function useSpeech(lang?: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(true);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  const voice = useMemo(() => {
    if (!lang || !voices.length) return null;
    const target = lang.toLowerCase();

    const candidates = [
      (v: SpeechSynthesisVoice) => v.name === "Google US English",
      (v: SpeechSynthesisVoice) => v.name.includes("Microsoft Aria"),
      (v: SpeechSynthesisVoice) => v.name === "Samantha",
      (v: SpeechSynthesisVoice) => v.lang.toLowerCase() === target,
      (v: SpeechSynthesisVoice) =>
        v.lang.toLowerCase().startsWith(target.split("-")[0]),
    ];

    for (const check of candidates) {
      const found = voices.find(check);
      if (found) return found;
    }
    return null;
  }, [voices, lang]);

  const narrate = useCallback(
    (text: string, onLog?: (t: string) => void) => {
      onLog?.(text);
      if (unlocked && !muted) {
        speak(text, { voice: voice || undefined, interrupt: true });
      }
    },
    [unlocked, muted, voice]
  );

  return { muted, setMuted, unlocked, setUnlocked, narrate };
}

// =========================================
// 3. Sub-Hook: Tree & Live Regions
// =========================================

function useLiveTree(enabled: boolean, onAlert: (text: string) => void) {
  const [nodes, setNodes] = useState<AccNode[]>([]);

  const forceRefresh = useCallback(() => {
    const fresh = collectAccTree();
    setNodes(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNodes([]);
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
      return;
    }

    setNodes(collectAccTree());

    let timer: number;
    const observer = new MutationObserver((mutations) => {
      let shouldRebuild = false;

      mutations.forEach((m) => {
        const target =
          m.target.nodeType === Node.TEXT_NODE
            ? m.target.parentElement
            : (m.target as HTMLElement);

        if (!target) return;

        // Live Region Check
        const liveRegion = target.closest("[aria-live]");
        if (liveRegion && liveRegion instanceof HTMLElement) {
          if (liveRegion.getAttribute("aria-live") !== "off") {
            setTimeout(() => {
              const text = liveRegion.textContent?.trim();
              if (text && document.activeElement !== liveRegion) {
                onAlert(`Alert: ${text}`);
              }
            }, 100);
          }
        }

        // Tree Rebuild Check
        if (
          m.type === "childList" ||
          (m.type === "attributes" &&
            [
              "hidden",
              "style",
              "class",
              "aria-hidden",
              "aria-expanded",
              "aria-checked",
              "aria-invalid",
            ].includes(m.attributeName || ""))
        ) {
          shouldRebuild = true;
        }
      });

      if (shouldRebuild) {
        clearTimeout(timer);
        timer = window.setTimeout(() => setNodes(collectAccTree()), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [enabled, onAlert]);

  return { nodes, forceRefresh };
}

// =========================================
// 4. Main Orchestrator Hook
// =========================================

type CoreOptions = {
  lang?: string;
  onNarrate?: (line: string) => void;
  keyboard?: boolean;
  enabled?: boolean;
};

export function useScreenReaderCore({
  lang,
  onNarrate: logCallback,
  keyboard = true,
  enabled = true,
}: CoreOptions = {}) {
  const [index, setIndex] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [rotorIndex, setRotorIndex] = useState(0); // 0 = Default (Linear)

  // -- Composition --
  const { muted, setMuted, unlocked, setUnlocked, narrate } = useSpeech(lang);

  const handleLog = useCallback(
    (text: string) => {
      setLog((prev) => [text, ...prev].slice(0, 50));
      logCallback?.(text);
    },
    [logCallback]
  );

  const handleAlert = useCallback(
    (alert: string) => {
      narrate(alert, handleLog);
    },
    [narrate, handleLog]
  );

  const { nodes, forceRefresh } = useLiveTree(enabled, handleAlert);

  // -- Focus Logic --
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

      const liveNode: AccNode = {
        ...node,
        states: computeStates(node.el, node.role),
        value: computeValue(node.el, node.role),
      };

      narrate(formatAnnouncement(liveNode), handleLog);
    },
    [enabled, nodes, narrate, handleLog]
  );

  const seek = useCallback(
    (forward: boolean, label: string, predicate: (n: AccNode) => boolean) => {
      if (!nodes.length) return;
      const step = forward ? 1 : -1;
      let i = index + step;
      while (i >= 0 && i < nodes.length) {
        if (nodes[i] && predicate(nodes[i]!)) {
          focusAt(i);
          return;
        }
        i += step;
      }
      narrate(`No ${forward ? "next" : "previous"} ${label}`, handleLog);
    },
    [nodes, index, focusAt, narrate, handleLog]
  );

  // -- Action Logic --
  const activateOrFocus = useCallback(() => {
    if (!enabled || !nodes[index]) return;
    const { el, role, name } = nodes[index];

    const isInput =
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT";
    const isEditRole = role === "textbox" || role === "combobox";

    if (
      el.isContentEditable ||
      (isInput &&
        !["checkbox", "radio", "button", "submit"].includes(
          (el as HTMLInputElement).type
        )) ||
      isEditRole
    ) {
      el.focus();
      narrate(`Edit field${name ? ` - ${name}` : ""}`, handleLog);
      return;
    }

    if (el instanceof HTMLInputElement && el.type === "submit") {
      el.form?.requestSubmit?.(el);
    } else {
      el.click();
    }

    queueMicrotask(() => {
      const freshNodes = forceRefresh();
      const newNodeIndex = freshNodes.findIndex((n) => n.el === el);
      const targetNode =
        newNodeIndex >= 0 ? freshNodes[newNodeIndex] : freshNodes[index];

      if (targetNode) {
        if (newNodeIndex >= 0) setIndex(newNodeIndex);
        const liveNode: AccNode = {
          ...targetNode,
          states: computeStates(targetNode.el, targetNode.role),
          value: computeValue(targetNode.el, targetNode.role),
        };
        narrate(formatAnnouncement(liveNode), handleLog);
        document
          .querySelectorAll(".srs-focus-ring")
          .forEach((e) => e.classList.remove("srs-focus-ring"));
        targetNode.el.classList.add("srs-focus-ring");
      }
    });
  }, [enabled, nodes, index, narrate, handleLog, forceRefresh]);

  const escapeAction = useCallback(() => {
    if (!enabled) return;
    const active = document.activeElement as HTMLElement;
    window.speechSynthesis?.cancel();

    if (active && (active.tagName === "INPUT" || active.isContentEditable)) {
      active.blur();
      nodes[index]?.el.classList.add("srs-focus-ring");
    } else {
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));
    }
  }, [enabled, nodes, index]);

  // -- Input Typing Echo --
  const typingDebounce = useRef<number | null>(null);

  const handleTyping = useCallback(
    (e: KeyboardEvent, el: HTMLElement) => {
      // Determine input type
      const isInput =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      const isPassword =
        el instanceof HTMLInputElement && el.type === "password";

      let shouldAnnounceValue = false; // Only announce full value on changes

      // 1. Navigation & Deletion Feedback
      if (isInput) {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const idx = input.selectionStart ?? 0;
        const val = input.value;

        // Keys that look BEHIND (Backspace / Left)
        if (e.key === "Backspace") {
          if (idx > 0) {
            const char = val[idx - 1];
            narrate(isPassword ? "star" : char, handleLog);
          } else {
            narrate("Backspace", handleLog);
          }
          shouldAnnounceValue = true; // Content changed
        } else if (e.key === "ArrowLeft") {
          if (idx > 0) {
            const char = val[idx - 1];
            narrate(isPassword ? "star" : char, handleLog);
          }
          // Navigation only - do not announce full value
        }

        // Keys that look AHEAD (Delete / Right)
        else if (e.key === "Delete") {
          if (idx < val.length) {
            const char = val[idx];
            narrate(isPassword ? "star" : char, handleLog);
          } else {
            narrate("Delete", handleLog);
          }
          shouldAnnounceValue = true; // Content changed
        } else if (e.key === "ArrowRight") {
          if (idx < val.length) {
            const char = val[idx];
            narrate(isPassword ? "star" : char, handleLog);
          }
          // Navigation only - do not announce full value
        }
      }

      // 2. Typing Echo (Alphanumeric)
      const isPrintable =
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (isPrintable) {
        narrate(
          isPassword ? "star" : e.key === " " ? "space" : e.key,
          handleLog
        );
        shouldAnnounceValue = true;
      }

      // 3. Debounced Value Announcement
      if (shouldAnnounceValue) {
        if (typingDebounce.current) clearTimeout(typingDebounce.current);
        typingDebounce.current = window.setTimeout(() => {
          if (isPassword) {
            narrate("Password field, value hidden", handleLog);
          } else {
            const val = (el as HTMLInputElement).value || el.textContent || "";
            narrate(`Value: ${val}`, handleLog);
          }
        }, 1000);
      }
    },
    [narrate, handleLog]
  );

  // -- Mobile Gestures (Touch) --
  // Simulates VoiceOver Rotor:
  // - 2-Finger Tap: Cycle Rotor (Headings, Buttons, etc.)
  // - Swipe Up/Down: Navigate by Rotor Type
  // - Swipe Left/Right: Linear Navigation
  useEffect(() => {
    if (!enabled) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isTwoFinger = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isTwoFinger = true;
      } else {
        isTwoFinger = false;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // 1. Two-Finger Tap Detection (Cycle Rotor)
      // If we started with 2 fingers and ended with 0/1, treating as a "tap" interaction
      if (isTwoFinger && e.touches.length === 0) {
        // Simple heuristic: if it was a 2-finger start and now ends, cycle rotor.
        // In a real app we'd check duration and movement, but this suffices for simulator.
        setRotorIndex((prev) => {
          const next = (prev + 1) % ROTOR_OPTIONS.length;
          narrate(ROTOR_OPTIONS[next].label, handleLog);
          return next;
        });
        e.preventDefault();
        return;
      }

      if (e.changedTouches.length === 0) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      const minSwipeDistance = 50;
      const verticalThreshold = 50;

      // 2. Horizontal Swipe (Linear Nav)
      if (
        Math.abs(diffX) > minSwipeDistance &&
        Math.abs(diffY) < verticalThreshold
      ) {
        if (diffX > 0) {
          // Swipe Right -> Next
          focusAt(index + 1);
        } else {
          // Swipe Left -> Prev
          focusAt(index - 1);
        }
        return;
      }

      // 3. Vertical Swipe (Rotor Nav)
      if (
        Math.abs(diffY) > minSwipeDistance &&
        Math.abs(diffX) < verticalThreshold
      ) {
        // If Default (0), let browser scroll naturally
        if (rotorIndex === 0) return;

        // Otherwise, intercept for Rotor navigation
        e.preventDefault();
        const option = ROTOR_OPTIONS[rotorIndex];

        if (option && option.predicate) {
          if (diffY > 0) {
            // Swipe Down -> Next [Type]
            seek(true, option.label, option.predicate);
          } else {
            // Swipe Up -> Prev [Type]
            seek(false, option.label, option.predicate);
          }
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, index, rotorIndex, focusAt, seek, narrate, handleLog]);

  // -- Keyboard Listener --
  useEffect(() => {
    if (!keyboard || !enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (
        !unlocked &&
        ["ArrowRight", "ArrowLeft", "h", "H", "Enter", " "].includes(e.key)
      ) {
        setUnlocked(true);
        if (!muted) speak("Screen reader ready", { interrupt: true });
      }

      const active = document.activeElement as HTMLElement;
      const isEditable =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);

      if (isEditable && e.key !== "Escape") {
        handleTyping(e, active);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        escapeAction();
        return;
      }

      const forward = !e.shiftKey;
      const k = e.key.toLowerCase();

      // Keyboard shortcuts map to Rotor Predicates
      // This ensures keyboard 'h' behaves exactly like Rotor "Headings" -> Swipe Down
      const actions: Record<string, () => void> = {
        arrowright: () => focusAt(index + 1),
        arrowleft: () => focusAt(index - 1),
        " ": activateOrFocus,
        enter: activateOrFocus,
        h: () =>
          seek(
            forward,
            "heading",
            ROTOR_OPTIONS.find((o) => o.label === "Headings")!.predicate!
          ),
        b: () =>
          seek(
            forward,
            "button",
            ROTOR_OPTIONS.find((o) => o.label === "Buttons")!.predicate!
          ),
        l: () =>
          seek(
            forward,
            "link",
            ROTOR_OPTIONS.find((o) => o.label === "Links")!.predicate!
          ),
        t: () =>
          seek(
            forward,
            "table",
            ROTOR_OPTIONS.find((o) => o.label === "Tables")!.predicate!
          ),
        g: () =>
          seek(
            forward,
            "graphic",
            ROTOR_OPTIONS.find((o) => o.label === "Graphics")!.predicate!
          ),
        f: () =>
          seek(
            forward,
            "form field",
            ROTOR_OPTIONS.find((o) => o.label === "Form Fields")!.predicate!
          ),
        d: () =>
          seek(
            forward,
            "landmark",
            ROTOR_OPTIONS.find((o) => o.label === "Landmarks")!.predicate!
          ),
        // 'i' doesn't have a direct Rotor equivalent in my simplified list, defining inline
        i: () => seek(forward, "list item", (n) => n.role === "listitem"),
      };

      if (/^[1-6]$/.test(k)) {
        const level = parseInt(k);
        e.preventDefault();
        seek(
          forward,
          `heading level ${level}`,
          (n) => n.role === "heading" && n.states.includes(`level ${level}`)
        );
        return;
      }

      if (actions[k]) {
        e.preventDefault();
        actions[k]();
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    keyboard,
    enabled,
    index,
    nodes,
    unlocked,
    muted,
    focusAt,
    seek,
    activateOrFocus,
    escapeAction,
    handleTyping,
    setUnlocked,
  ]);

  // -- Native Focus Sync --
  useEffect(() => {
    if (!enabled) return;
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const i = nodes.findIndex((n) => n.el === target);
      if (i >= 0 && i !== index) {
        focusAt(i);
      }
    };
    window.addEventListener("focus", onFocus, true);
    return () => window.removeEventListener("focus", onFocus, true);
  }, [enabled, nodes, index, focusAt]);

  return {
    state: {
      nodes,
      index,
      muted,
      log,
      current: nodes[index] || null,
    },
    actions: {
      focusNext: () => focusAt(index + 1),
      focusPrev: () => focusAt(index - 1),
      focusAt,
      activateOrFocus,
      escapeAction,
      setMuted,
      clearLog: () => setLog([]),
    },
  };
}
