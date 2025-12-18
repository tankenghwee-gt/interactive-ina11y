// src/utils/utils.ts
import {
  computeAccessibleName,
  computeAccessibleDescription,
  getRole as getSafeRole,
} from "dom-accessibility-api";

// =============================
// 1. Speech & Types
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
// 2. DOM Query Helpers
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

/**
 * Determines if an element is hidden from the accessibility tree.
 */
const isHidden = (el: HTMLElement): boolean => {
  // 1. Critical: aria-hidden hides the subtree, regardless of CSS.
  if (el.closest("[aria-hidden='true']")) return true;

  // 2. Native CSS check (modern & fast)
  if (el.checkVisibility) {
    return !el.checkVisibility({
      checkOpacity: false, // SRs read transparent elements usually
      checkVisibilityCSS: true, // respects display:none/visibility:hidden
    });
  }

  // 3. Fallback for older environments
  if (el.hidden) return true;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return true;

  // 4. Inert check (not interactive, often hidden from AT)
  if (el.closest("[inert]")) return true;

  return false;
};

const isFocusable = (el: HTMLElement): boolean => {
  if (el.tabIndex >= 0) return true;
  const t = el.tagName.toLowerCase();
  if (["button", "input", "select", "textarea"].includes(t)) {
    if (isDisableable(el) && el.disabled) return false;
    return true;
  }
  if (t === "a" && (el as HTMLAnchorElement).href) return true;
  return false;
};

const getDirectText = (el: HTMLElement): string => {
  let text = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
  });
  return text.trim().replace(/\s+/g, " ");
};

/**
 * Robust role computation that handles "Generic" containers with text.
 */
const computeEffectiveRole = (el: HTMLElement): string => {
  const role = getSafeRole(el);
  if (!role || role === "generic" || role === "presentation") {
    if (hasDirectText(el)) return "statictext";
    return "generic";
  }
  return role;
};

const hasDirectText = (el: HTMLElement): boolean => {
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent?.trim().length ?? 0) > 0
    ) {
      return true;
    }
  }
  return false;
};

// =============================
// 3. Attribute Computation
// =============================

export const computeStates = (el: HTMLElement, role: string): string[] => {
  const states: string[] = [];
  const attr = (n: string) => el.getAttribute(n);

  // --- Disabled ---
  if (attr("aria-disabled") === "true") {
    states.push("disabled");
  } else if (isDisableable(el) && el.disabled) {
    states.push("disabled");
  }

  // --- Checked / Selected ---
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

  // --- Invalid ---
  if (attr("aria-invalid") === "true") {
    states.push("invalid");
  } else if (
    el instanceof HTMLInputElement &&
    el.willValidate &&
    !el.checkValidity()
  ) {
    states.push("invalid");
  }

  if (["columnheader", "rowheader"].includes(role)) {
    const sort = attr("aria-sort");
    if (sort && sort !== "none") states.push(`sort ${sort}`);
  }

  // Orientation
  if (
    ["slider", "scrollbar", "separator", "tablist", "toolbar"].includes(role)
  ) {
    const orientation = attr("aria-orientation");
    if (orientation) states.push(orientation);
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
    if (["checkbox", "radio"].includes(el.type)) return undefined;
    return el.value;
  }

  return undefined;
};

export const computeHierarchy = (
  el: HTMLElement,
  role: string
): { pos: number; size: number } | undefined => {
  const ariaPos = el.getAttribute("aria-posinset");
  const ariaSet = el.getAttribute("aria-setsize");
  if (ariaPos && ariaSet) {
    return { pos: Number(ariaPos), size: Number(ariaSet) };
  }

  if (["listitem", "option", "menuitem", "radio"].includes(role)) {
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => {
        if (role === "listitem" && c.tagName === "LI") return true;
        if (role === "option" && c.tagName === "OPTION") return true;
        return getSafeRole(c as HTMLElement) === role;
      });
      const index = siblings.indexOf(el);
      if (index !== -1) {
        return { pos: index + 1, size: siblings.length };
      }
    }
  }
  return undefined;
};

export const computeTableCoords = (
  el: HTMLElement
): { row: number; col: number } | undefined => {
  const cell = el.closest("td,th") as HTMLElement | null;
  if (!cell) return undefined;

  const rowEl = cell.parentElement as HTMLTableRowElement;
  const tableEl = rowEl?.closest("table");
  if (tableEl && rowEl) {
    const rowIndex = Array.from(tableEl.rows).indexOf(rowEl) + 1;
    const colIndex = Array.from(rowEl.children).indexOf(cell) + 1;
    return { row: rowIndex, col: colIndex };
  }
  return undefined;
};

// =============================
// 4. Tree Traversal & De-duplication
// =============================

const createAccWalker = (root: Node) => {
  return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (isHidden(node as HTMLElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
};

/**
 * NEW: Consolidates the accessibility tree to mimic Screen Reader "Group" behavior.
 * Specifically, it removes static text nodes that are actually labels for
 * a subsequent interactive element, preventing double readout ("Name" ... "Name, edit").
 */
const consolidateTree = (nodes: AccNode[]): AccNode[] => {
  // 1. Identify all interactive nodes to see who is labelled
  const interactiveNodes = new Set(nodes.map((n) => n.el));

  // 2. Filter loop
  return nodes.filter((node) => {
    const el = node.el;

    // Check if this node is a LABEL element
    if (el.tagName === "LABEL") {
      // Case A: <label for="id">
      const forId = el.getAttribute("for");
      if (forId) {
        const target = document.getElementById(forId);
        if (target && interactiveNodes.has(target)) {
          // The target is in our tree. The SR will read the target's name (which comes from this label).
          // We should hide this label node to prevent redundancy.
          return false;
        }
      }

      // Case B: <label><input /></label> (Implicit wrapping)
      // If the label contains an interactive element that is ALSO in our list,
      // we generally want to skip the label wrapper in favor of the input inside it.
      // (The input will have the label text as its accessible name).
      const implicitTarget = el.querySelector(
        "input, select, textarea, button"
      );
      if (
        implicitTarget &&
        interactiveNodes.has(implicitTarget as HTMLElement)
      ) {
        return false;
      }
    }

    // Determine if this is a "Label" via aria-labelledby (Reverse lookup is expensive, skipping for simulator v1)

    return true;
  });
};

const collectNodesRecursively = (root: Node, nodes: AccNode[]): void => {
  const walker = createAccWalker(root);

  let currentNode = walker.nextNode();
  while (currentNode) {
    const el = currentNode as HTMLElement;

    // 1. Identification
    const role = computeEffectiveRole(el);

    // 2. Filter: Skip layout noise
    const isGeneric =
      role === "generic" || role === "presentation" || role === "none";
    const focusable = isFocusable(el);
    const isText =
      role === "statictext" || role === "paragraph" || role === "heading";
    const isSelfContained =
      role === "img" ||
      role === "image" ||
      role === "figure" ||
      role === "separator" ||
      role === "hr";

    if (!isGeneric || focusable || isSelfContained) {
      // 3. Computation
      let name = computeAccessibleName(el);

      // Fallback: If no label, read the content (critical for divs with text)
      if (!name && (isText || role === "statictext")) {
        name = getDirectText(el);
      }

      const description = computeAccessibleDescription(el);
      const states = computeStates(el, role);
      const value = computeValue(el, role);
      const hierarchy = computeHierarchy(el, role);
      const coords = computeTableCoords(el);

      console.log({
        el,
        role,
        name,
        description,
        states,
        value,
        pos: hierarchy,
        coords,
      });

      if (
        name ||
        value ||
        focusable ||
        states.length > 0 ||
        isSelfContained ||
        hierarchy
      ) {
        nodes.push({
          el,
          role,
          name,
          description,
          states,
          value,
          pos: hierarchy,
          coords,
        });
      }
    }

    // 5. Shadow DOM Recursion
    if (el.shadowRoot) {
      collectNodesRecursively(el.shadowRoot, nodes);
    }

    currentNode = walker.nextNode();
  }
};

export const collectAccTree = (): AccNode[] => {
  const nodes: AccNode[] = [];
  collectNodesRecursively(document, nodes);
  // Apply the de-duplication logic
  return consolidateTree(nodes);
};
