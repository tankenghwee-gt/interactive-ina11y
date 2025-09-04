// =============================
// Speech engine
// =============================

const speak = (
  text: string,
  opts?: { interrupt?: boolean; rate?: number; pitch?: number; voice?: SpeechSynthesisVoice | null; onend?: () => void }
): void => {
  console.log('hi');
  if (!("speechSynthesis" in window)) {
    console.log("no speechSynthesis");
    return;
  }
  const { interrupt = true, rate = 1.0, pitch = 1.0, voice = null, onend } = opts || {};
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate; u.pitch = pitch; if (voice) u.voice = voice; if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
};

/**
 * ScreenReaderSimulator.silktide.tsx
 *
 * A stricter, more SR-like simulator you can drop into any React app.
 * Goals (closer to Silktide + common SR paradigms):
 *  - Virtual cursor in DOM order ("browse mode").
 *  - Rotor with buckets: Headings (by level), Landmarks, Links, Form fields, Tables, Graphics.
 *  - Speech phrases more like SR output: role → name → state → position (n of m), heading levels, table coords.
 *  - Read All from here (continuous), pause/resume, stop.
 *  - Simple Focus Mode toggle (activate controls with Enter/Space when on a control).
 *  - Blackout curtain to simulate no-vision usage.
 *
 * Educational only. Always verify with real NVDA/VoiceOver/TalkBack.
 */

// =============================
// Types & Utilities
// =============================

type NodeKind = "heading" | "region" | "link" | "control" | "table" | "graphic";

interface NavNode {
  el: HTMLElement;
  kind: NodeKind;
  label: string;
  meta?: Record<string, string | number | boolean>;
}

const $$ = (sel: string, root: ParentNode = document): HTMLElement[] => Array.from(root.querySelectorAll(sel)) as HTMLElement[];
const getText = (el: HTMLElement): string => (el.innerText || el.textContent || "").trim();
const byIdText = (id: string): string => (document.getElementById(id)?.innerText || "").trim();

const isExposed = (el: HTMLElement): boolean => {
  const style = getComputedStyle(el);
  if (el.hidden) return false;
  if (el.closest("[hidden],[inert],[aria-hidden='true']")) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
};

// Type guards
function hasLabels(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLMeterElement | HTMLProgressElement | HTMLOutputElement {
  return "labels" in el && (el as HTMLInputElement).labels !== undefined;
}
function isFormControl(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement;
}

const accName = (el: HTMLElement): string => {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const ariaLabelledby = el.getAttribute("aria-labelledby");
  if (ariaLabelledby) {
    const ids = ariaLabelledby.split(/\s+/).filter(Boolean);
    const fromIds = ids.map(byIdText).join(" ").trim();
    if (fromIds) return fromIds;
  }
  if (hasLabels(el)) {
    const list = el.labels ? Array.from(el.labels) : [];
    const s = list.map((l) => getText(l)).join(" ").trim();
    if (s) return s;
  }
  if (el instanceof HTMLImageElement && el.alt) return el.alt.trim();
  const txt = getText(el);
  if (txt) return txt;
  if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder.trim();
  if (el instanceof HTMLTextAreaElement && el.placeholder) return el.placeholder.trim();
  return "";
};

const headingLevel = (el: HTMLElement): number | null => {
  if (/^H[1-6]$/.test(el.tagName)) return parseInt(el.tagName[1] || "", 10) || 1;
  if (el.getAttribute("role") === "heading") {
    const lvl = parseInt(el.getAttribute("aria-level") || "", 10);
    return Number.isFinite(lvl) ? lvl : 2;
  }
  return null;
};

const roleOf = (el: HTMLElement): string => {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  if (el.matches("a")) return "link";
  if (el.matches("button")) return "button";
  if (el.matches("img")) return "graphic";
  if (el.matches("input[type='checkbox']")) return "checkbox";
  if (el.matches("input,select,textarea")) return "form field";
  if (el.matches("table")) return "table";
  if (el.matches("[type='submit']")) return "button";
  return el.tagName.toLowerCase();
};

const stateOf = (el: HTMLElement): string => {
  const attr = (n: string) => el.getAttribute(n);
  if (attr("aria-pressed") === "true") return "pressed";
  if (attr("aria-checked") === "true") return "checked";
  if (isFormControl(el)) {
    if (el instanceof HTMLInputElement && el.type === "checkbox" && el.checked) return "checked";
    if (el.disabled) return "disabled";
  }
  if (attr("aria-disabled") === "true") return "disabled";
  if (attr("aria-expanded") === "true") return "expanded";
  if (attr("aria-expanded") === "false") return "collapsed";
  return "";
};

const tableCoords = (el: HTMLElement): { row: number; col: number } | null => {
  const cell = el.closest("td,th") as HTMLElement | null;
  if (!cell) return null;
  const rowEl = cell.parentElement as HTMLTableRowElement | null;
  if (!rowEl) return null;
  const table = rowEl.closest("table") as HTMLTableElement | null;
  if (!table) return null;
  const row = Array.from(table.rows).indexOf(rowEl) + 1;
  const col = Array.from(rowEl.children).indexOf(cell) + 1;
  return { row, col };
};

const collectNavigables = (): NavNode[] => {
  const res: NavNode[] = [];

  // Regions/Landmarks
  $$("header,nav,main,aside,footer,[role='banner'],[role='navigation'],[role='main'],[role='complementary'],[role='contentinfo'],section[aria-label],section[aria-labelledby]")
    .filter(isExposed)
    .forEach((el) => res.push({ el, kind: "region", label: accName(el) || el.getAttribute("aria-label") || roleOf(el) }));

  // Headings
  $$("h1,h2,h3,h4,h5,h6,[role='heading']")
    .filter(isExposed)
    .forEach((el) => res.push({ el, kind: "heading", label: accName(el) || getText(el), meta: { level: headingLevel(el) || 2 } }));

  // Links
  $$("a[href], [role='link']").filter(isExposed).forEach((el) => res.push({ el, kind: "link", label: accName(el) || getText(el) || (el.getAttribute("href") || "(link)") }));

  // Controls (buttons + inputs)
  $$("button,input,select,textarea,[role='button']").filter(isExposed).forEach((el) => res.push({ el, kind: "control", label: accName(el) || getText(el) || (el.getAttribute("name") || el.id || "(control)") }));

  // Tables
  $$("table").filter(isExposed).forEach((el) => res.push({ el, kind: "table", label: accName(el) || el.getAttribute("summary") || "table" }));

  // Graphics
  $$("img,[role='img']").filter(isExposed).forEach((el) => res.push({ el, kind: "graphic", label: accName(el) || "graphic" }));

  // Keep DOM order
  res.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return res;
};


interface ScreenReaderSimulatorOptions {
  curtain?: boolean;
  lang?: string; // e.g. "en-GB"
  initialFilter?: NodeKind | "all";
}


export type {
    ScreenReaderSimulatorOptions,
    NavNode,
    NodeKind
}

export {
    stateOf,
    tableCoords,
    collectNavigables,
    hasLabels,
    isFormControl,
    accName,
    isExposed,
    getText,
    byIdText,
    speak,
    roleOf,
    headingLevel
};