// src/utils/roleMap.ts

export const ROLE_MAP: Record<string, string> = {
  // --- Interactive ---
  button: "button",
  link: "link",
  textbox: "textbox", // NVDA says "edit", VoiceOver "text field"
  searchbox: "search edit",
  checkbox: "checkbox",
  radio: "radio button",
  switch: "toggle button",
  combobox: "combo box",
  listbox: "list box",
  slider: "slider",
  spinbutton: "spin button",

  // --- Structure ---
  heading: "heading", // Usually combined: "Heading Level X"
  list: "list",
  listitem: "list item",
  table: "table",
  row: "row",
  columnheader: "column header",
  rowheader: "row header",
  cell: "cell",
  grid: "grid",

  // --- Content ---
  img: "image",
  image: "image",
  figure: "figure",
  separator: "separator",

  // --- Landmarks ---
  banner: "banner landmark",
  navigation: "navigation landmark",
  main: "main landmark",
  contentinfo: "content info landmark",
  form: "form",
  region: "region",
  section: "region",
};
