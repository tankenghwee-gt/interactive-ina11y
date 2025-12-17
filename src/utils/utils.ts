// src/utils/utils.ts
import {
  computeAccessibleName,
  computeAccessibleDescription,
  getRole as getSafeRole,
} from "dom-accessibility-api";

// =============================
// Speech engine
// =============================
export const speak = (
  text: string,
  opts?: {
    interrupt?: boolean;
    rate?: number;
    pitch?: number;
    voice?: SpeechSynthesisVoice | null;
    onend?: () => void;
  }
): void => {
  if (!("speechSynthesis" in window)) return;
  const {
    interrupt = true,
    rate = 1.0,
    pitch = 1.0,
    voice = null,
    onend,
  } = opts || {};
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = pitch;
  if (voice) u.voice = voice;
  if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
};

// =============================
// Types
// =============================
export interface AccNode {
  el: HTMLElement;
  role: string;
  name: string;
  description?: string;
  value?: string;
  states: string[];
  pos?: { pos: number; size: number };
  coords?: { row: number; col: number };
}

// =============================
// Type Guards
// =============================

type DisableableElement =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLOptGroupElement
  | HTMLOptionElement
  | HTMLFieldSetElement;

const isDisableable = (el: HTMLElement): el is DisableableElement => {
  return (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLOptGroupElement ||
    el instanceof HTMLOptionElement ||
    el instanceof HTMLFieldSetElement
  );
};

const isCheckable = (el: HTMLElement): el is HTMLInputElement => {
  return el instanceof HTMLInputElement;
};

// =============================
// Accessibility Helpers
// =============================

/**
 * Determines if an element is hidden from the accessibility tree.
 */
const isHidden = (el: HTMLElement): boolean => {
  if (el.checkVisibility) {
    return !el.checkVisibility({
      checkOpacity: false,
      checkVisibilityCSS: true,
    });
  }
  // Fallback
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return true;
  const style = window.getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden";
};

/**
 * Checks if an element is natively focusable or made focusable.
 */
const isFocusable = (el: HTMLElement): boolean => {
  if (el.tabIndex >= 0) return true;
  const t = el.tagName.toLowerCase();

  // Native interactive elements (unless disabled)
  if (["button", "input", "select", "textarea"].includes(t)) {
    if (isDisableable(el) && el.disabled) return false;
    return true;
  }

  if (t === "a" && (el as HTMLAnchorElement).href) return true;
  return false;
};

/**
 * Gets the direct text content of an element, ignoring child elements.
 */
const getDirectText = (el: HTMLElement): string => {
  let text = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    }
  }
  return text.trim().replace(/\s+/g, " ");
};

/**
 * Computes the effective role.
 * Downgrades "generic" to "statictext" if it contains text.
 */
const computeEffectiveRole = (el: HTMLElement): string => {
  const role = getSafeRole(el); // Standard lookup

  // If role is generic (or null), but it has text, it's NOT just a wrapper.
  if (!role || role === "generic" || role === "presentation") {
    if (hasDirectText(el)) {
      return "statictext";
    }
    return "generic"; // Truly empty wrapper
  }

  return role;
};

/**
 * Checks if an element has non-empty direct text nodes.
 * This is crucial for identifying "generic" containers that actually hold content.
 */
const hasDirectText = (el: HTMLElement): boolean => {
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (
      node.nodeType === Node.TEXT_NODE &&
      node.textContent?.trim().length &&
      node.textContent?.trim().length > 0
    ) {
      return true;
    }
  }
  return false;
};

// =============================
// State & Property Computations
// =============================

export const computeStates = (el: HTMLElement, role: string): string[] => {
  const states: string[] = [];
  const attr = (n: string) => el.getAttribute(n);

  // --- Global States ---
  if (attr("aria-disabled") === "true") {
    states.push("disabled");
  } else if (isDisableable(el) && el.disabled) {
    states.push("disabled");
  }

  // Checked / Selected / Pressed
  const ariaChecked = attr("aria-checked");
  const nativeChecked = isCheckable(el) ? el.checked : null;

  if (ariaChecked === "true" || nativeChecked === true) {
    states.push("checked");
  } else if (
    (ariaChecked === "false" || nativeChecked === false) &&
    ["checkbox", "radio", "switch"].includes(role)
  ) {
    states.push("unchecked");
  } else if (ariaChecked === "mixed") {
    states.push("partially checked");
  }

  if (attr("aria-pressed") === "true") states.push("pressed");
  if (attr("aria-selected") === "true") states.push("selected");
  if (attr("aria-expanded") === "true") states.push("expanded");
  if (attr("aria-expanded") === "false") states.push("collapsed");

  // Invalid
  if (attr("aria-invalid") === "true") {
    states.push("invalid");
  } else if (
    el instanceof HTMLInputElement &&
    el.willValidate &&
    !el.checkValidity()
  ) {
    states.push("invalid");
  }

  // --- Role Specific ---
  if (role === "heading") {
    const level = attr("aria-level") || el.tagName.substring(1);
    if (/^[1-6]$/.test(level)) states.push(`level ${level}`);
  }

  if (["columnheader", "rowheader"].includes(role)) {
    const sort = attr("aria-sort");
    if (sort && sort !== "none") states.push(`sort ${sort}`);
  }

  if (
    attr("aria-required") === "true" ||
    (el instanceof HTMLInputElement && el.required)
  ) {
    states.push("required");
  }
  if (
    attr("aria-readonly") === "true" ||
    (el instanceof HTMLInputElement && el.readOnly)
  ) {
    states.push("readonly");
  }

  return states;
};

export const computeValue = (
  el: HTMLElement,
  role: string
): string | undefined => {
  const valText = el.getAttribute("aria-valuetext");
  if (valText) return valText;

  const valNow = el.getAttribute("aria-valuenow");
  if (valNow) {
    if (role === "progressbar" || role === "slider" || role === "spinbutton") {
      const min = Number(el.getAttribute("aria-valuemin")) || 0;
      const max = Number(el.getAttribute("aria-valuemax")) || 100;
      const now = Number(valNow);
      if (role === "progressbar" && max > min) {
        return `${Math.round(((now - min) / (max - min)) * 100)}%`;
      }
      return valNow;
    }
  }

  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    if (el.type === "password") return "••••••";
    // Checkbox/Radio value is usually not read, just state.
    if (["checkbox", "radio"].includes(el.type)) return undefined;
    return el.value;
  }

  return undefined;
};

// =============================
// Tree Traversal (TreeWalker)
// =============================

const createAccWalker = (root: Node) => {
  return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (isHidden(node as HTMLElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
};

const collectNodesRecursively = (root: Node, nodes: AccNode[]): void => {
  const walker = createAccWalker(root);

  let currentNode = walker.nextNode();
  while (currentNode) {
    const el = currentNode as HTMLElement;

    // 1. Analyze role
    const role = computeEffectiveRole(el);

    // 2. Filter out pure layout wrappers
    // We keep it if it has a semantic role, OR it's focusable, OR it's static text
    const isGeneric =
      role === "generic" || role === "presentation" || role === "none";
    const focusable = isFocusable(el);
    const isText =
      role === "statictext" || role === "paragraph" || role === "heading";

    // 3. Special roles that must be included even if "empty" (no text/name)
    //    (e.g. an image with missing alt text is a bug, but it exists in the tree as "img")
    const isSelfContained =
      role === "img" ||
      role === "image" ||
      role === "figure" ||
      role === "separator" ||
      role === "hr";

    if (!isGeneric || focusable || isSelfContained) {
      let name = computeAccessibleName(el);

      // Fallback for static content where name computation returns empty
      if (!name && (isText || role === "statictext")) {
        name = getDirectText(el);
      }

      const description = computeAccessibleDescription(el);
      const states = computeStates(el, role);
      const value = computeValue(el, role);

      // Final Check:
      // It must be interactive, OR have content (name/value), OR be a self-contained semantic element
      if (name || value || focusable || states.length > 0 || isSelfContained) {
        nodes.push({
          el,
          role,
          name,
          description,
          states,
          value,
        });
      }
    }

    // 4. Dive into Shadow DOM
    if (el.shadowRoot) {
      collectNodesRecursively(el.shadowRoot, nodes);
    }

    currentNode = walker.nextNode();
  }
};

export const collectAccTree = (): AccNode[] => {
  const nodes: AccNode[] = [];
  collectNodesRecursively(document, nodes);
  return nodes;
};
