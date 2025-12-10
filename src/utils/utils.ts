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
  value?: string;
  states: string[];
  pos?: { pos: number; size: number };
  coords?: { row: number; col: number };
}

// =============================
// Helpers
// =============================
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const isExposed = (el: HTMLElement): boolean => {
  if (el.checkVisibility) {
    return el.checkVisibility({
      checkOpacity: false, // Screen readers usually read opacity: 0 elements
      checkVisibilityCSS: true, // Respects visibility: hidden / display: none
    });
  }

  // 2. Fallback (for older environments)
  // offsetParent is null if the element (or any parent) is display: none
  if (el.offsetParent === null && el.style.position !== "fixed") {
    return false;
  }
  const style = getComputedStyle(el);
  if (el.hidden) return false;
  if (el.closest("[hidden],[inert],[aria-hidden='true']")) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
};

const byIdText = (id: string): string =>
  document.getElementById(id)?.textContent?.trim() || "";

function hasLabelsProp(
  el: Element
): el is
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLMeterElement
  | HTMLProgressElement
  | HTMLOutputElement {
  return "labels" in el;
}

const isFocusable = (el: HTMLElement): boolean => {
  if ((el as HTMLElement).tabIndex >= 0) return true;
  const t = el.tagName.toLowerCase();
  if (t === "a" && (el as HTMLAnchorElement).href) return true;
  if (["button", "input", "select", "textarea"].includes(t)) return true;
  return false;
};

// Direct text only (no descendants)
const getSafeText = (el: HTMLElement): string => {
  let s = "";
  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      s += (child.textContent || "").replace(/\s+/g, " ");
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const elem = child as HTMLElement;

      // 1. IGNORE tags that should never be read
      // This fixes the CSS reading bug
      const tagName = elem.tagName.toUpperCase();
      if (
        tagName === "SCRIPT" ||
        tagName === "STYLE" ||
        tagName === "NOSCRIPT"
      ) {
        return;
      }

      // 2. IGNORE hidden elements (standard check)
      if (elem.hidden || elem.getAttribute("aria-hidden") === "true") {
        return;
      }

      // If the child is a CANDIDATE itself (like a button or link), skip it.
      // It will be its own node in the tree, so we don't want to double-read it.
      // If it is NOT a candidate (like a <span>), recurse and grab its text.
      if (!elem.matches(CANDIDATE_SELECTOR)) {
        s += getSafeText(elem);
      }
    }
  });
  return s.trim();
};

// Roles whose accessible name comes from content (HTML-AAM, simplified)
const NAME_FROM_CONTENT_ROLES = new Set<string>([
  "button",
  "link",
  "heading",
  "tab",
  "menuitem",
  "option",
  "treeitem",
  "listitem",
  "cell",
  "gridcell",
  "columnheader",
  "rowheader",
  "tooltip",
  "switch",
  "checkbox",
  "radio button",
  "dialog",
  "alert",
  "alertdialog",
  "status",
  "progressbar",
  "meter",
  "image",
  "statictext",
]);

// NEW: Helper to extract text + alt text recursively
const getSubtreeName = (el: HTMLElement): string => {
  let text = "";
  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || "";
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const e = child as HTMLElement;
      // If it's an image, use Alt Text
      if (e.tagName === "IMG") {
        text += (e as HTMLImageElement).alt || "";
      } else {
        // Recurse
        text += getSubtreeName(e);
      }
    }
  });
  return text;
};

export const computeAccName = (el: HTMLElement): string => {
  // 1) aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // 2) aria-labelledby
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    return collapse(labelledby.split(/\s+/).map(byIdText).join(" "));
  }

  // 3) role-specific / native fallbacks
  if (el instanceof HTMLImageElement && el.alt) return el.alt.trim();

  if (hasLabelsProp(el) && el.labels && el.labels.length) {
    return collapse(
      Array.from(el.labels)
        .map((l) => l.textContent || "")
        .join(" ")
    );
  }

  // 4) role-based content names
  const role = computeRole(el);

  // Static text: Use the new Safe Text aggregator
  if (role === "statictext") {
    // CHANGED: Use getSafeText instead of getOwnText
    const own = getSafeText(el);
    if (own) return own.length > 140 ? `${own.slice(0, 140)}…` : own;
  }

  if (
    NAME_FROM_CONTENT_ROLES.has(role) ||
    role === "textbox" ||
    role === "combobox"
  ) {
    const t = collapse(getSubtreeName(el));
    if (t) return t.length > 140 ? `${t.slice(0, 140)}…` : t;
  }

  return "";
};

export const computeRole = (el: HTMLElement): string => {
  const explicit = el.getAttribute("role")?.toLowerCase();

  // HANDLE PRESENTATION / NONE
  if (explicit === "presentation" || explicit === "none") {
    // Conflict Resolution: If it's focusable, ignore role="presentation"
    if (isFocusable(el)) {
      // Fall through to calculate the NATIVE role (e.g. <button>)
    } else {
      // It is truly presentational. Treat as having NO role.
      return "";
    }
  } else if (explicit) {
    // Valid explicit role
    return explicit;
  }

  const tag = el.tagName.toLowerCase();
  if (tag === "a" && (el as HTMLAnchorElement).href) return "link";
  if (tag === "button") return "button";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "img" || tag === "svg") return "image";

  if (tag === "input") {
    const t = (el as HTMLInputElement).type;
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio button";
    if (t === "range") return "slider";
    if (t === "number") return "spinbutton";
    return "textbox";
  }

  if (tag === "textarea") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "table") return "table";

  // Landmarks (native)
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "header") return "banner";
  if (tag === "footer") return "contentinfo";
  if (tag === "aside") return "complementary";
  if (tag === "form") return "form";

  // Status/info widgets
  if (tag === "progress") return "progressbar";
  if (tag === "meter") return "meter";
  if (tag === "dialog") return "dialog";

  // Inline emphasis → StaticText-ish
  if (
    tag === "strong" ||
    tag === "b" ||
    tag === "em" ||
    tag === "mark" ||
    tag === "small"
  ) {
    return "statictext";
  }

  // Fallback: non-focusable containers with own text → statictext
  if (!isFocusable(el)) {
    const own = getSafeText(el);
    if (own) return "statictext";
  }

  return "";
};

type DisableableElement =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLOptGroupElement
  | HTMLOptionElement
  | HTMLFieldSetElement;

function isDisableable(el: Element): el is DisableableElement {
  return (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLOptGroupElement ||
    el instanceof HTMLOptionElement ||
    el instanceof HTMLFieldSetElement
  );
}

export const computeStates = (el: HTMLElement): string[] => {
  const states: string[] = [];
  const attr = (n: string) => el.getAttribute(n);

  // Disabled (ARIA or native)
  if (
    attr("aria-disabled") === "true" ||
    (isDisableable(el) && (el as DisableableElement).disabled)
  ) {
    states.push("disabled");
  }

  // Checked/selected (prefer ARIA, fallback to native)
  if (attr("aria-checked") !== null) {
    states.push(attr("aria-checked") === "true" ? "checked" : "unchecked");
  } else if (
    el instanceof HTMLInputElement &&
    (el.type === "checkbox" || el.type === "radio")
  ) {
    states.push(el.checked ? "checked" : "unchecked");
  } else if (el instanceof HTMLOptionElement) {
    if (el.selected) states.push("selected");
  }

  // Pressed / expanded (ARIA)
  if (attr("aria-pressed") !== null) {
    states.push(attr("aria-pressed") === "true" ? "pressed" : "not pressed");
  }
  if (attr("aria-expanded") !== null) {
    states.push(attr("aria-expanded") === "true" ? "expanded" : "collapsed");
  }

  // Required (ARIA or native required)
  if (
    attr("aria-required") === "true" ||
    (el instanceof HTMLInputElement && el.required) ||
    (el instanceof HTMLTextAreaElement && el.required) ||
    (el instanceof HTMLSelectElement && el.required)
  ) {
    states.push("required");
  }

  // Readonly (ARIA or native)
  if (
    attr("aria-readonly") === "true" ||
    (el instanceof HTMLInputElement && el.readOnly) ||
    (el instanceof HTMLTextAreaElement && el.readOnly)
  ) {
    states.push("readonly");
  }

  return states;
};

export const computeValue = (el: HTMLElement): string | undefined => {
  const now = el.getAttribute("aria-valuenow");
  const min = el.getAttribute("aria-valuemin");
  const max = el.getAttribute("aria-valuemax");

  if (now !== null) {
    if (min !== null && max !== null) return `${now}, range ${min} to ${max}`;
    if (max !== null) return `${now} of ${max}`;
    return now || undefined;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value || undefined;
  }

  if (el instanceof HTMLProgressElement) {
    const pct = (Number(el.value) / Number(el.max || 1)) * 100;
    return `${Math.round(pct)}%`;
  }

  return undefined;
};

export const computePosInSet = (
  el: HTMLElement
): { pos: number; size: number } | undefined => {
  const pos = Number(el.getAttribute("aria-posinset"));
  const size = Number(el.getAttribute("aria-setsize"));
  if (Number.isFinite(pos) && Number.isFinite(size) && pos > 0 && size > 0)
    return { pos, size };
  return undefined;
};

export const computeTableCoords = (
  el: HTMLElement
): { row: number; col: number } | undefined => {
  const cell = el.closest("td,th") as HTMLElement | null;
  if (!cell) return;
  const rowEl = cell.parentElement as HTMLTableRowElement | null;
  if (!rowEl) return;
  const table = rowEl.closest("table,[role='grid']") as HTMLTableElement | null;
  if (!table) return;
  const row = Array.from(table.rows).indexOf(rowEl) + 1;
  const col = Array.from(rowEl.children).indexOf(cell) + 1;
  return { row, col };
};

// =============================
// Collector
// =============================
const CANDIDATE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]:not([tabindex='-1'])",
  "h1,h2,h3,h4,h5,h6",
  "[role]",
  "table,th,td",
  "img,svg",
  "nav,main,header,footer,aside,form,section[aria-label],section[aria-labelledby]",
  "progress,meter,output,dialog,[aria-live]",
  // ADDED: article, figure, address, blockquote
  "p,div,article,figure,address,blockquote,pre",
].join(",");

// src/utils/utils.ts

// ... keep your existing helpers ...

// NEW: Helper to get all elements including those inside Shadow DOM
const getDeepElements = (root: ParentNode = document): HTMLElement[] => {
  const elements: HTMLElement[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.checkVisibility && !el.checkVisibility()) {
        return;
      }

      // Optimization: Skip hidden trees early
      // Note: getComputedStyle is expensive, rely on attributes first for speed
      if (el.hidden || el.getAttribute("aria-hidden") === "true") return;

      // 2. OPTIMIZATION: Only collecting if it matches our interest list
      // This restores the efficiency of your original selector!
      if (el.matches(CANDIDATE_SELECTOR)) {
        elements.push(el);
      }

      // MAGIC: Dive into Shadow DOM
      if (el.shadowRoot) {
        Array.from(el.shadowRoot.children).forEach((child) => walk(child));
      }
    }
    // Walk children
    node.childNodes.forEach((child) => walk(child));
  };

  walk(root);
  console.log(elements);
  return elements;
};

// src/utils/utils.ts

export const computeHierarchy = (el: HTMLElement) => {
  // 1. Explicit ARIA (Fastest)
  const ariaPos = el.getAttribute("aria-posinset");
  const ariaSet = el.getAttribute("aria-setsize");
  if (ariaPos && ariaSet) {
    return { pos: { pos: Number(ariaPos), size: Number(ariaSet) } };
  }

  // 2. Native List Calculation
  // We look for list items within list containers
  const listRoles = ["list", "listbox", "menu", "tree", "grid"];
  const itemRoles = ["listitem", "option", "menuitem", "treeitem", "row"];

  const role = computeRole(el);
  if (!itemRoles.includes(role)) return { pos: undefined };

  // Find parent container
  // Note: This is simplified. Real calculation handles nested groups (ul > li > ul).
  const parent = el.parentElement;
  if (!parent) return { pos: undefined };

  const parentRole = computeRole(parent);
  if (
    listRoles.includes(parentRole) ||
    parent.tagName === "UL" ||
    parent.tagName === "OL"
  ) {
    // Count accessible siblings
    const siblings = Array.from(parent.children).filter((child) => {
      const r = computeRole(child as HTMLElement);
      return itemRoles.includes(r) || child.tagName === "LI";
    });

    const index = siblings.indexOf(el) + 1;
    return { pos: { pos: index, size: siblings.length } };
  }

  return { pos: undefined };
};

// REPLACED: The main collector
export const collectAccTree = (): AccNode[] => {
  const nodes: AccNode[] = [];

  // 1. Get ALL elements (Light DOM + Shadow DOM)
  const allElements = getDeepElements(document);

  // 2. Filter and Map
  allElements.forEach((el) => {
    // Re-use your existing exposure check (expensive but necessary)
    if (!isExposed(el)) return;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;

    const role = computeRole(el);

    if (role === "presentation") {
      return;
    }

    // Filter out static text inside interactive controls (button/link)
    // Note: 'closest' doesn't cross Shadow Boundaries, so this is a 'light' check.
    // For full extension support, we'd need a 'composedClosest' polyfill.
    if (
      (role === "statictext" || role === "image") &&
      el.closest("a[href],button,[role='link'],[role='button']")
    ) {
      return;
    }

    const name = computeAccName(el);
    const states = computeStates(el);
    const value = computeValue(el);
    // New Hierarchy Calculation (See Section 2 below)
    const hierarchy = computeHierarchy(el);

    // Only add if it has semantic meaning
    if (role || name || states.length || value) {
      nodes.push({
        el,
        role,
        name,
        states,
        value,
        // Merge hierarchy into your existing props or add new ones
        pos: hierarchy.pos,
        // You can extend AccNode interface to include 'level'
      });
    }
  });

  return nodes;
};
