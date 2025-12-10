import type { JSX } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Demo from "./Demo";

// =============================
// Demo (optional)
// =============================

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Demo example={"broken"} />} />
        <Route path="/fixed" element={<Demo example={"fixed"} />} />
        <Route path="/timed" element={<Demo example={"timed"} />} />
      </Routes>
    </BrowserRouter>
  );
}
