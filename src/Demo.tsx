import { useState, type JSX } from "react";
import { ScreenReaderHUD } from "./components/ScreenReaderHUD";
import Examples from "./components/Example";
import ExamplesFixed from "./components/ExampleFixed";

// =============================
// Demo (optional)
// =============================

interface DemoProps {
  example: "broken" | "fixed";
}

export default function Demo({ example }: DemoProps): JSX.Element {
  const [hideContent, setHideContent] = useState<boolean>(true);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <button
        onClick={() => setHideContent(!hideContent)}
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          padding: "10px 16px",
          background: "#7c3aed",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,.15)",
          zIndex: 9999,
        }}
        name={`Turn ${hideContent ? "off" : "on"} simulation`}
      >
        {`Turn ${hideContent ? "off" : "on"} simulation`}
      </button>
      {hideContent ? (
        <div
          style={{
            position: "absolute",
            height: "200vh",
            width: "100vw",
            backgroundColor: "black",
            zIndex: 9,
          }}
        />
      ) : (
        <></>
      )}
      {example === "broken" ? (
        <>
          <ScreenReaderHUD />
          <Examples />
        </>
      ) : (
        <>
          <ScreenReaderHUD />
          <ExamplesFixed />
        </>
      )}
    </div>
  );
}
