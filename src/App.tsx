import type { JSX } from "react";
import { ScreenReaderHUD } from "./components/ScreenReaderHUD";
import Examples from "./components/Example";


// =============================
// Demo (optional)
// =============================

export default function DemoPage(): JSX.Element {
  return (
    <div style={{ padding: 24 }}>
      <ScreenReaderHUD />
      <Examples />
    </div>
  );
}
