import type { JSX } from "react";
import Example from "./components/Example";
import ExampleFixed from "./components/ExampleFixed";
import ExampleTimed from "./components/ExampleTimed";
import { ScreenReaderHUD } from "./components/ScreenReaderHUD";

// =============================
// Demo (optional)
// =============================

interface DemoProps {
  example: "broken" | "fixed" | "timed";
}

export default function Demo({ example }: DemoProps): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <ScreenReaderHUD />
      {example === "broken" && <Example />}
      {example === "fixed" && <ExampleFixed />}
      {example === "timed" && <ExampleTimed />}
    </div>
  );
}
