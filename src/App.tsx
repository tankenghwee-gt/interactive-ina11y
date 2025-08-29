import { useEffect, useState } from "react";

// ⚠️ Simplified demo of an inaccessible form
// Uses arrow keys for navigation with non‑semantic elements.
// Adds a **Screen Reader Dialog** that *simulates* announcements
// (not a real SR) so you can demo what would be read out.

export default function InaccessibleFormSimple() {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState({ name: "", email: "" });

  // --- Screen Reader Dialog (simulated) ---
  const [srOpen, setSrOpen] = useState(false);
  const [srLog, setSrLog] = useState<string[]>([]);
  const [srLive, setSrLive] = useState(""); // feeds aria-live

  const fields = ["name", "email", "submit"] as const;

  const announce = (msg: string) => {
    setSrLog((logs) => [msg, ...logs]);
    // update aria-live region (replace text so it re-announces)
    setSrLive("");
    // small microtask to ensure DOM text change is caught
    queueMicrotask(() => setSrLive(msg));
  };

  useEffect(() => {
    // Announce focus movement
    const label =
      focusIndex === 0
        ? "Name, edit text"
        : focusIndex === 1
        ? "Email, edit text"
        : "Submit, button";
    announce(label);
  }, [focusIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % fields.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => (i - 1 + fields.length) % fields.length);
    } else if (e.key === "Enter") {
      if (fields[focusIndex] === "submit") {
        announce("Submitting form");
        alert("Submitted: " + JSON.stringify(values));
        announce("Form submitted");
      }
    } else if (e.key.toLowerCase() === "s") {
      // toggle SR dialog with the 's' key
      setSrOpen((o) => !o);
      announce(srOpen ? "Closed screen reader dialog" : "Opened screen reader dialog");
    }
  };

  return (
    <div className="relative">
      {/* Floating control to open SR dialog */}
      <button
        className="fixed top-3 right-3 px-3 py-1.5 rounded-lg border bg-white shadow text-xs"
        onClick={() => setSrOpen(true)}
      >
        Screen Reader (demo)
      </button>

      <div
        className="p-8 max-w-md mx-auto border rounded-xl mt-12"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <h1 className="text-xl font-semibold mb-4">Sign Up Form</h1>

        {/* Name field without label */}
        <div className={`p-2 border mb-2 ${focusIndex === 0 ? "bg-yellow-100" : ""}`} tabIndex={-1}>
          <input
            type="text"
            placeholder="Name"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            className="w-full outline-none"
          />
        </div>

        {/* Email field with placeholder-only */}
        <div className={`p-2 border mb-2 ${focusIndex === 1 ? "bg-yellow-100" : ""}`} tabIndex={-1}>
          <input
            type="email"
            placeholder="Email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            className="w-full outline-none"
          />
        </div>

        {/* Fake submit button as div */}
        <div
          className={`p-2 text-center border cursor-pointer ${focusIndex === 2 ? "bg-yellow-200" : "bg-gray-100"}`}
          tabIndex={-1}
          onClick={() => {
            announce("Submitting form");
            alert("Submitted: " + JSON.stringify(values));
            announce("Form submitted");
          }}
        >
          Submit
        </div>

        <p className="mt-4 text-gray-500 text-sm">
          Use ↑ and ↓ to move focus, Enter to activate Submit. Press <kbd>S</kbd> to toggle the Screen Reader dialog.
        </p>
      </div>

      {/* Screen Reader Dialog (simulated) */}
      {srOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sr-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 id="sr-title" className="text-sm font-semibold">Screen Reader (demo)</h2>
              <button className="text-xs px-2 py-1 rounded border" onClick={() => setSrOpen(false)}>
                Close
              </button>
            </div>

            {/* Live region shows the most recent announcement */}
            <div className="sr-only" aria-live="assertive">{srLive}</div>

            <div className="text-xs text-gray-600 mb-2">
              This window shows <em>simulated</em> announcements as you use the arrow keys / Enter.
            </div>

            <div className="h-48 overflow-auto border rounded p-2 text-sm bg-gray-50">
              {srLog.length === 0 ? (
                <div className="text-gray-400">No announcements yet…</div>
              ) : (
                <ul className="space-y-1">
                  {srLog.map((line, i) => (
                    <li key={i} className="font-mono">• {line}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="text-xs px-2 py-1 rounded border"
                onClick={() => setSrLog([])}
              >
                Clear log
              </button>
              <button
                className="text-xs px-2 py-1 rounded border"
                onClick={() => announce("Example announcement")}
              >
                Test announce
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
