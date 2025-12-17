// src/utils/a11y-engine.ts
import { getRole } from "dom-accessibility-api";

// Helper: Determine if an element is hidden from AT
export function isHidden(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;

  // Fast path: check inline styles before computing
  if (el.style.display === "none" || el.style.visibility === "hidden")
    return true;

  // Fallback to computed style (expensive, use sparingly)
  const style = window.getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden";
}

// Helper: Calculate Hierarchy (Level, Set Size, Position)
export function computeHierarchy(el: HTMLElement) {
  const ariaPos = el.getAttribute("aria-posinset");
  const ariaSet = el.getAttribute("aria-setsize");
  if (ariaPos && ariaSet) {
    return { pos: { pos: Number(ariaPos), size: Number(ariaSet) } };
  }

  const role = getRole(el);
  if (role === "listitem" || role === "option" || role === "menuitem") {
    const parent = el.parentElement;
    if (parent) {
      const parentRole = getRole(parent);
      if (["list", "listbox", "menu", "menubar"].includes(parentRole || "")) {
        const children = Array.from(parent.children) as HTMLElement[];
        const siblings = children.filter((c) => getRole(c) === role);
        const index = siblings.indexOf(el);
        if (index !== -1) {
          return { pos: { pos: index + 1, size: siblings.length } };
        }
      }
    }
  }
  return { pos: undefined };
}

// Helper: Compute ARIA States & Properties
export function computeStates(el: HTMLElement): string[] {
  const states: string[] = [];
  const attr = (n: string) => el.getAttribute(n);
  const role = getRole(el);

  // --- 1. Global States ---

  // Disabled
  if (attr("aria-disabled") === "true" || (el as HTMLInputElement).disabled) {
    states.push("disabled");
  }

  // Checked / Selected / Pressed
  const checked =
    attr("aria-checked") || (el as HTMLInputElement).checked?.toString();
  if (checked === "true") states.push("checked");
  else if (checked === "false" && (role === "checkbox" || role === "radio"))
    states.push("unchecked");
  else if (checked === "mixed") states.push("partially checked");

  if (attr("aria-pressed") === "true") states.push("pressed");
  if (attr("aria-selected") === "true") states.push("selected");

  // Expanded
  if (attr("aria-expanded") === "true") states.push("expanded");
  if (attr("aria-expanded") === "false") states.push("collapsed");

  // Invalid
  if (
    attr("aria-invalid") === "true" ||
    ((el as HTMLInputElement).willValidate &&
      !(el as HTMLInputElement).checkValidity())
  ) {
    states.push("invalid");
  }

  // --- 2. Semantic Properties (The "Gap" Fix) ---

  // Level (Headings, Tree Items, Grid Rows)
  if (role === "heading" || role === "treeitem" || role === "row") {
    const level = attr("aria-level");
    if (level) {
      states.push(`level ${level}`);
    } else if (role === "heading") {
      // Implicit Heading Level (H1-H6)
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        states.push(`level ${tag[1]}`);
      }
    }
  }

  // Orientation (Sliders, Scrollbars, Separators, Tabs)
  if (
    ["slider", "scrollbar", "separator", "tablist", "toolbar"].includes(
      role || ""
    )
  ) {
    const orientation = attr("aria-orientation");
    if (orientation) {
      states.push(orientation); // "horizontal" or "vertical"
    } else if (role === "slider" || role === "scrollbar") {
      // Default is often implicit, but explicit announcement helps
    }
  }

  // Sort (Grid Headers)
  if (role === "columnheader" || role === "rowheader") {
    const sort = attr("aria-sort");
    if (sort && sort !== "none") {
      states.push(`sort ${sort}`); // "ascending", "descending"
    }
  }

  // Required
  if (attr("aria-required") === "true" || (el as HTMLInputElement).required) {
    states.push("required");
  }

  // Read Only
  if (attr("aria-readonly") === "true" || (el as HTMLInputElement).readOnly) {
    states.push("read only");
  }

  return states;
}

// Helper: Compute Value (e.g. "50%")
export function computeValue(el: HTMLElement): string | undefined {
  const valText = el.getAttribute("aria-valuetext");
  if (valText) return valText;

  const valNow = el.getAttribute("aria-valuenow");
  if (valNow) {
    const role = getRole(el);
    if (role === "progressbar" || role === "slider" || role === "spinbutton") {
      const min = Number(el.getAttribute("aria-valuemin")) || 0;
      const max = Number(el.getAttribute("aria-valuemax")) || 100;
      const now = Number(valNow);
      if (role === "progressbar" && max > min) {
        const pct = Math.round(((now - min) / (max - min)) * 100);
        return `${pct}%`;
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
    return el.value;
  }

  return undefined;
}

// Helper: Table Coordinates
export function computeTableCoords(el: HTMLElement) {
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
}
