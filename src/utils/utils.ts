// utils.ts
// =============================
// Speech engine
// =============================

export const speak = (
  text: string,
  opts?: { interrupt?: boolean; rate?: number; pitch?: number; voice?: SpeechSynthesisVoice | null; onend?: () => void }
): void => {
  console.log('hi');
  if (!("speechSynthesis" in window)) return;
  const { interrupt = true, rate = 1.0, pitch = 1.0, voice = null, onend } = opts || {};
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate; u.pitch = pitch; if (voice) u.voice = voice; if (onend) u.onend = onend;
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
  "statictext", // inline emphasis text nodes like <strong>, <em>, etc.
]);

export const computeAccName = (el: HTMLElement): string => {
  // 1) aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // 2) aria-labelledby
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    return collapse(
      labelledby
        .split(/\s+/)
        .map(byIdText)
        .join(" ")
    );
  }

  // 3) role-specific / native fallbacks
  if (el instanceof HTMLImageElement && el.alt) return el.alt.trim();

  if (hasLabelsProp(el) && el.labels && el.labels.length) {
    return collapse(Array.from(el.labels).map(l => l.textContent || "").join(" "));
  }

  if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder.trim();
  if (el instanceof HTMLTextAreaElement && el.placeholder) return el.placeholder.trim();

  // 4) name from content only for roles that allow it
  const role = computeRole(el);
  if (NAME_FROM_CONTENT_ROLES.has(role) || role === "textbox" || role === "combobox") {
    const t = collapse(el.textContent || "");
    return t.length > 140 ? `${t.slice(0, 140)}…` : t;
  }

  // Containers generally have no name in the AX tree
  return "";
};

export const computeRole = (el: HTMLElement): string => {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit.toLowerCase();

  const tag = el.tagName.toLowerCase();
  if (tag === "a" && (el as HTMLAnchorElement).href) return "link";
  if (tag === "button") return "button";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "img") return "image";

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

  // Inline emphasis → StaticText nodes in AX tree
  if (tag === "strong" || tag === "b" || tag === "em" || tag === "mark" || tag === "small") {
    return "statictext";
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

  if (attr("aria-disabled") === "true" || (isDisableable(el) && el.disabled)) states.push("disabled");
  if (attr("aria-checked")) states.push(attr("aria-checked") === "true" ? "checked" : "not checked");
  if (attr("aria-pressed")) states.push(attr("aria-pressed") === "true" ? "pressed" : "not pressed");
  if (attr("aria-expanded")) states.push(attr("aria-expanded") === "true" ? "expanded" : "collapsed");
  if (attr("aria-selected") === "true") states.push("selected");
  if (attr("aria-required") === "true") states.push("required");
  if (attr("aria-invalid") === "true") states.push("invalid");
  if (attr("aria-readonly") === "true") states.push("readonly");

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

export const computePosInSet = (el: HTMLElement): { pos: number; size: number } | undefined => {
  const pos = Number(el.getAttribute("aria-posinset"));
  const size = Number(el.getAttribute("aria-setsize"));
  if (Number.isFinite(pos) && Number.isFinite(size) && pos > 0 && size > 0) return { pos, size };
  return undefined;
};

export const computeTableCoords = (el: HTMLElement): { row: number; col: number } | undefined => {
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

// Limit to elements that typically appear in the AX tree
const CANDIDATE_SELECTOR = [
  // interactive / focusable
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]:not([tabindex='-1'])",
  // structure
  "h1,h2,h3,h4,h5,h6",
  "[role]",
  "table,th,td",
  // media / graphics
  "img",
  // landmarks (native)
  "nav,main,header,footer,aside,form,section[aria-label],section[aria-labelledby]",
  // status/info
  "progress,meter,output,dialog,[aria-live]",
  // inline emphasis → static text nodes
  "strong,b,em,mark,small"
].join(",");

export const collectAccTree = (): AccNode[] => {
  const nodes: AccNode[] = [];
  document.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR).forEach((el) => {
    if (!isExposed(el)) return;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;

    const role = computeRole(el);
    const name = computeAccName(el);
    const states = computeStates(el);
    const value = computeValue(el);
    const pos = computePosInSet(el);
    const coords = computeTableCoords(el);

    // Include if it would surface in an accessibility tree
    if (role || name || states.length || value) {
      nodes.push({ el, role, name, states, value, pos, coords });
    }
  });
  return nodes;
};
