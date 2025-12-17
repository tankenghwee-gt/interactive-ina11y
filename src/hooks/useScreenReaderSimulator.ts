// src/hooks/useScreenReaderSimulator.ts
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collectAccTree,
  type AccNode,
  speak,
  computeStates,
  computeValue,
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

  // REMOVED: activeRect state

  const typingDebounceRef = useRef<number | null>(null);
  const lastEditableElRef = useRef<HTMLElement | null>(null);

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
    const normalizedLang = lang.toLowerCase();
    const voicePreferences = [
      { name: "Google US English", lang: "en-US" },
      {
        name: "Microsoft Aria Online (Natural) - English (United States)",
        lang: "en-US",
      },
      { name: "Samantha", lang: "en-US" }, // Apple voice
      { name: "English United States", lang: "en-US" },
    ];

    for (const pref of voicePreferences) {
      const v = voices.find(
        (x) =>
          x.name === pref.name &&
          x.lang?.toLowerCase() === pref.lang.toLowerCase()
      );
      if (v) return v;
    }

    return (
      voices.find((v) => v.lang?.toLowerCase() === normalizedLang) ||
      voices.find((v) =>
        v.lang?.toLowerCase().startsWith(normalizedLang.split("-")[0])
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

    // Description (New from utils refactor)
    if (node.description) {
      parts.push(node.description);
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

  const announceEditableValueSoon = useCallback(
    (target: HTMLElement) => {
      // Clear previous timer
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }

      // Debounce to wait for DOM value to settle (covers keydown->value update & IME)
      typingDebounceRef.current = window.setTimeout(() => {
        const el = target as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLElement;
        const isPassword =
          el instanceof HTMLInputElement && el.type === "password";

        if (isPassword) {
          narrate("Password field, value hidden");
          return;
        }

        const val =
          (el as HTMLInputElement | HTMLTextAreaElement).value ??
          el.textContent ??
          "";

        narrate(`Value: ${val?.toString().trim() || "blank"}`);
      }, 1000);
    },
    [narrate]
  );

  // ---- Focus helpers
  const focusAt = useCallback(
    (i: number) => {
      if (!enabled || !nodes.length) return;
      const clamped = Math.max(0, Math.min(nodes.length - 1, i));
      setIndex(clamped);
      const node = nodes[clamped];
      if (!node) return;

      // 1. Clear old ring
      document
        .querySelectorAll(".srs-focus-ring")
        .forEach((e) => e.classList.remove("srs-focus-ring"));

      // 2. Add new ring
      node.el.classList.add("srs-focus-ring");
      node.el.scrollIntoView({ block: "center", behavior: "smooth" });

      console.log(node);

      // Use LIVE states/value so required/invalid/checked reflect current reality
      // Updated: Passing node.role to compute functions as per new utils signature
      const live: AccNode = {
        ...node,
        states: computeStates(node.el, node.role),
        value: computeValue(node.el, node.role),
      };
      narrate(formatAnnouncement(live));
    },
    [enabled, nodes, narrate, formatAnnouncement]
  );

  const seek = useCallback(
    (
      forward: boolean,
      typeLabel: string,
      predicate: (node: AccNode) => boolean
    ) => {
      if (!nodes.length) return;

      // Determine start point and direction
      const step = forward ? 1 : -1;
      let i = index + step;

      // Loop until we hit the bounds
      while (i >= 0 && i < nodes.length) {
        if (nodes[i] && predicate(nodes[i]!)) {
          focusAt(i);
          return;
        }
        i += step;
      }

      // If loop finishes without finding anything:
      narrate(`No ${forward ? "next" : "previous"} ${typeLabel}`);
    },
    [nodes, index, focusAt, narrate]
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
      el.form?.requestSubmit?.(el);
      return;
    }
    if (el instanceof HTMLButtonElement && el.type === "submit") {
      el.form?.requestSubmit?.(el);
      return;
    }

    if (activatableRoles.has(node.role)) {
      el.click();

      // Refresh + re-announce
      queueMicrotask(() => {
        const newNodes = collectAccTree();
        setNodes(newNodes);
        const cur = newNodes[index];
        if (cur) {
          const live: AccNode = {
            ...cur,
            states: computeStates(cur.el, cur.role),
            value: computeValue(cur.el, cur.role),
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

    // Clear all rings
    document
      .querySelectorAll(".srs-focus-ring")
      .forEach((e) => e.classList.remove("srs-focus-ring"));

    if (activeEditable) {
      active?.blur();
      // Restore ring to current SR node
      nodes[index]?.el.classList.add("srs-focus-ring");
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

      // 1. Unmute logic
      if (
        !speechUnlocked &&
        ["ArrowRight", "ArrowLeft", "h", "H", "Enter", " "].includes(e.key)
      ) {
        setSpeechUnlocked(true);
        if (!muted)
          speak("Screen reader ready", { voice: preferredVoice || undefined });
      }

      // 2. Escape logic
      if (e.key === "Escape") {
        e.preventDefault();
        escapeAction();
        return;
      }

      // 3. Typing Mode
      if (activeIsEditable) {
        const el = active as HTMLInputElement | HTMLTextAreaElement;

        if (active) lastEditableElRef.current = active;

        const printable =
          e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

        if (printable) {
          narrate(e.key === " " ? "space" : e.key);
          announceEditableValueSoon(active!);
        } else {
          switch (e.key) {
            case "Backspace":
              if (el.selectionStart) {
                narrate(el.value[el.selectionStart - 1]);
              }
              break;
            case "Delete":
              if (el.selectionStart) {
                narrate(el.value[el.selectionStart]);
              }
              break;
            case "ArrowLeft":
              if (el.selectionStart && el.selectionStart < el.value.length) {
                narrate(el.value[el.selectionStart - 1]);
              }
              break;
            case "ArrowRight":
              if (el.selectionStart && el.selectionStart < el.value.length) {
                narrate(el.value[el.selectionStart]);
              }
              break;
          }
        }
        return;
      }

      // 4. SHORTCUTS
      const forward = !e.shiftKey;

      switch (e.key.toLowerCase()) {
        case "arrowright":
          e.preventDefault();
          focusNext();
          break;
        case "arrowleft":
          e.preventDefault();
          focusPrev();
          break;
        case " ":
        case "enter":
          e.preventDefault();
          activateOrFocus();
          break;
        case "h":
          e.preventDefault();
          seek(forward, "heading", (n) => n.role === "heading");
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6": {
          e.preventDefault();
          const level = parseInt(e.key);
          seek(forward, `heading level ${level}`, (n) => {
            if (n.role !== "heading") return false;
            // Simplified check against states string "level X"
            return n.states.includes(`level ${level}`);
          });
          break;
        }
        case "b":
          e.preventDefault();
          seek(forward, "button", (n) => n.role === "button");
          break;
        case "l":
          e.preventDefault();
          seek(forward, "link", (n) => n.role === "link");
          break;
        case "t":
          e.preventDefault();
          seek(
            forward,
            "table",
            (n) => n.role === "table" || n.role === "grid"
          );
          break;
        case "g":
          e.preventDefault();
          seek(
            forward,
            "graphic",
            (n) => n.role === "img" || n.role === "image"
          );
          break;
        case "f":
          e.preventDefault();
          seek(
            forward,
            "form field",
            (n) =>
              [
                "textbox",
                "combobox",
                "listbox",
                "checkbox",
                "radio button",
                "switch",
                "slider",
                "spinbutton",
              ].includes(n.role) ||
              (n.el.tagName === "INPUT" && n.role !== "button")
          );
          break;
        case "i":
          e.preventDefault();
          seek(
            forward,
            "list item",
            (n) => n.role === "listitem" || n.role === "option"
          );
          break;
        case "d":
          e.preventDefault();
          seek(forward, "landmark", (n) =>
            [
              "banner",
              "main",
              "navigation",
              "contentinfo",
              "complementary",
              "search",
              "region",
            ].includes(n.role)
          );
          break;
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
    announceEditableValueSoon,
    seek,
  ]);

  // ---- Sync with native browser focus
  useEffect(() => {
    if (!enabled) return;

    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const i = nodes.findIndex((n) => n.el === target);
      if (i >= 0) {
        setIndex(i);
        const live: AccNode = {
          ...nodes[i]!,
          states: computeStates(target, nodes[i]!.role),
          value: computeValue(target, nodes[i]!.role),
        };
        // Update ring
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

  // ---- Live Regions and Tree Updates
  useEffect(() => {
    if (!enabled) return;

    let updateTimeout: number;

    const observer = new MutationObserver((mutations) => {
      let shouldRebuildTree = false;

      mutations.forEach((m) => {
        let target = m.target as HTMLElement;

        if (m.target.nodeType === Node.TEXT_NODE && m.target.parentElement) {
          target = m.target.parentElement;
        }

        if (!(target instanceof Element)) return;

        // 1. Live Region Updates
        const liveRegion = target.closest("[aria-live]");
        if (liveRegion && liveRegion instanceof HTMLElement) {
          const liveType = liveRegion.getAttribute("aria-live");
          if (liveType !== "off") {
            setTimeout(() => {
              const text = liveRegion.textContent?.trim();
              if (text && document.activeElement !== liveRegion) {
                narrate(`Alert: ${text}`);
              }
            }, 100);
          }
        }

        // 2. Flag for tree rebuild
        if (
          m.type === "childList" ||
          (m.type === "attributes" &&
            ["hidden", "style", "class"].includes(m.attributeName || ""))
        ) {
          shouldRebuildTree = true;
        }
      });

      if (shouldRebuildTree) {
        clearTimeout(updateTimeout);
        updateTimeout = window.setTimeout(() => {
          setNodes(collectAccTree());
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [enabled, narrate]);

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
            states: computeStates(nodes[index]!.el, nodes[index]!.role),
            value: computeValue(nodes[index]!.el, nodes[index]!.role),
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
