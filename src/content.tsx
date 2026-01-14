// src/content.tsx

import { Analytics } from "@vercel/analytics/next";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ScreenReaderHUD } from "./components/ScreenReaderHUD";
import styleText from "./index.css?inline"; // Vite will inject CSS as string

const HOST_ID = "srs-simulator-host";

if (!document.getElementById(HOST_ID)) {
  // 1. Create the Host Container
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  // 2. Create Shadow DOM (CSS Firewall)
  const shadow = host.attachShadow({ mode: "open" });

  // 3. Inject Styles inside Shadow DOM
  const style = document.createElement("style");
  style.textContent = styleText;
  shadow.appendChild(style);

  // 4. Mount React
  const root = document.createElement("div");
  shadow.appendChild(root);

  createRoot(root).render(
    <StrictMode>
      <ScreenReaderHUD />
      <Analytics />
    </StrictMode>
  );
}
