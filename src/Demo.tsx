import { type JSX } from "react";
import { ScreenReaderHUD } from "./components/ScreenReaderHUD";
import Example from "./components/Example";
import ExampleFixed from "./components/ExampleFixed";
import ExampleTimed from "./components/ExampleTimed";

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
        padding: "0 16px",
      }}
    >
      {example === "broken" && (
        <>
          <ScreenReaderHUD />
          <Example />
        </>
      )}
      {example === "fixed" && (
        <>
          <ScreenReaderHUD />
          <ExampleFixed />
        </>
      )}
      {example === "timed" && (
        <>
          <ScreenReaderHUD />
          <ExampleTimed />
        </>
      )}
    </div>
  );
}
