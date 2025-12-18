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
  }, [enabled, onAlert]); // <--- onAlert must be stable to prevent loops!

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

  // -- Composition --
  const { muted, setMuted, unlocked, setUnlocked, narrate } = useSpeech(lang);

  const handleLog = useCallback(
    (text: string) => {
      setLog((prev) => [text, ...prev].slice(0, 50));
      logCallback?.(text);
    },
    [logCallback]
  );

  // FIX: Stabilize the alert callback to prevent useLiveTree effect loops
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

      let shouldAnnounceValue = false;

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

  // -- Keyboard Listener --
  useEffect(() => {
    if (!keyboard || !enabled) return;

    const onKey = (e: KeyboardEvent) => {
      // 1. Unmute / Wake up
      if (
        !unlocked &&
        ["ArrowRight", "ArrowLeft", "h", "H", "Enter", " "].includes(e.key)
      ) {
        setUnlocked(true);
        if (!muted) speak("Screen reader ready", { interrupt: true });
      }

      // 2. Typing Mode
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

      // 3. Navigation Shortcuts
      const forward = !e.shiftKey;
      const k = e.key.toLowerCase();

      const actions: Record<string, () => void> = {
        arrowright: () => focusAt(index + 1),
        arrowleft: () => focusAt(index - 1),
        " ": activateOrFocus,
        enter: activateOrFocus,
        h: () => seek(forward, "heading", (n) => n.role === "heading"),
        b: () => seek(forward, "button", (n) => n.role === "button"),
        l: () => seek(forward, "link", (n) => n.role === "link"),
        t: () =>
          seek(
            forward,
            "table",
            (n) => n.role === "table" || n.role === "grid"
          ),
        g: () =>
          seek(
            forward,
            "graphic",
            (n) => n.role === "img" || n.role === "image"
          ),
        f: () =>
          seek(forward, "form field", (n) =>
            ["textbox", "combobox", "checkbox", "radio button"].includes(n.role)
          ),
        i: () => seek(forward, "list item", (n) => n.role === "listitem"),
        d: () => seek(forward, "landmark", (n) => n.role.includes("landmark")),
      };

      if (/[1-6]/.test(k)) {
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
