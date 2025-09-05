import type { JSX } from "react";

/**
 * Demo form intentionally containing accessibility issues.
 *
 * Showcased WCAG failures:
 * 1) Name, Role, Value (A) — icon-only button without accessible name; custom toggle without ARIA state; unlabeled inputs.
 * 2) Keyboard (A) — clickable "button" built with <div> and onClick only (no keyboard support).
 * 3) Contrast (AA) — “Ghost” buttons and helper text with insufficient contrast.
 * 4) Info and Relationships (A) — visual grouping without semantic grouping/associations; placeholder-as-label pattern.
 * 5) Non-text Content (A) — decorative/meaningful icons lacking alt text/labels.
 */
export default function A11yIssuesFormDemo(): JSX.Element {
  return (
    <>
      <div
        style={{
          position: "relative",
          padding: 24,
          maxWidth: 860,
          margin: "24px auto",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Inter, 'Helvetica Neue', Arial, sans-serif",
          color: "#111827",
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Demo: Modern Form (with intentional a11y issues)
          </h1>
          <p style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
            Use this to demonstrate how “pretty UI” can still be inaccessible.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 16,
          }}
        >
          {/* ===== Left: The form card (looks polished, but broken) ===== */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {/* (5) Non-text Content: Icon-only “logo” without alt/label */}
              {/* ❌ Non-text Content (A): No alt or aria-label */}
              <img
                src="https://via.placeholder.com/28x28"
                // Intentionally missing alt/aria-label
                style={{ borderRadius: 6 }}
              />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Account Details
              </h2>

              {/* (1) Name, Role, Value: Icon-only action without accessible name */}
              {/* ❌ Name, Role, Value (A): No accessible name; screen readers announce nothing useful */}
              <button
                // prettier: icon-only, but we omit aria-label on purpose
                style={{
                  marginLeft: "auto",
                  border: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "#7c3aed",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 18,
                }}
                title="" // intentionally empty
              >
                ☆
              </button>
            </div>

            {/* (4) Info & Relationships: Visual “group” with heading, but labels aren’t semantically tied */}
            {/* ❌ Placeholder-as-label — inputs lack proper <label for=> or aria-labelledby */}
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Name</div>
                {/* ❌ No <label htmlFor>, relies on placeholder only */}
                <input
                  id="name-input-missing-label"
                  placeholder="Full name"
                  style={inputStyle}
                />
                {/* (3) Contrast: help text too low contrast */}
                {/* ❌ Contrast (AA): ~#9CA3AF on white is borderline; intentionally lighter for demo */}
                <div style={{ marginTop: 6, fontSize: 12, color: "#b6bcc7" }}>
                  Your legal name as shown on ID
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>
                  Email address
                </div>
                {/* ❌ No <label>, again placeholder is used */}
                <input placeholder="name@example.com" style={inputStyle} />
              </div>

              {/* (1) Name/Role/Value: A custom switch without role/aria-checked */}
              {/* ❌ Screen readers won’t understand its state */}
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>
                  Marketing emails
                </div>
                <div
                  // Looks like a switch, but has no role or state
                  // ❌ Name, Role, Value (A): missing role="switch" and aria-checked
                  onClick={(e) => {
                    const el = e.currentTarget;
                    // purely visual on/off toggle
                    el.classList.toggle("on");
                  }}
                  style={switchStyle}
                >
                  <div className="knob" />
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#374151" }}>
                    Subscribe to updates
                  </span>
                </div>
              </div>

              {/* (2) Keyboard: A div that behaves like a button but is mouse-only */}
              {/* ❌ Keyboard (A): No role, no tabindex, no keyboard handlers */}
              <div
                onClick={() => alert("This only works with a mouse click.")}
                style={ghostBtn}
              >
                Mouse-only action
              </div>

              {/* Action row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* (3) Contrast: low-contrast “ghost” button on white */}
                {/* ❌ Contrast (AA): insufficient contrast between text/border and background */}
                <button style={lowContrastBtn}>Save as draft</button>
                <button style={primaryBtn}>Submit</button>

                {/* Live status (works; you can trigger changes from elsewhere) */}
                <div
                  id="status"
                  aria-live="polite"
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {/* Live region text updates go here (intentionally empty by default) */}
                </div>
              </div>
            </div>
          </section>

          {/* ===== Right: “Looks like” related info, but not programmatically related ===== */}
          {/* ❌ Info & Relationships (A): Visually paired, but not referenced with aria-describedby/fieldset/legend */}
          <aside
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              padding: 16,
              display: "grid",
              gap: 12,
              alignSelf: "start",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* (5) Non-text Content: decorative image lacking alt */}
              {/* ❌ No alt → screen readers may announce file name or nothing useful */}
              <img
                src="https://via.placeholder.com/20x20"
                style={{ borderRadius: 4 }}
              />
              <strong>Helpful tips</strong>
            </div>
            <p style={{ margin: 0, color: "#374151", lineHeight: 1.5 }}>
              Keep your details up to date. This panel looks associated with the
              form but isn’t programmatically connected to any field.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
              <li>Names should match your official documents.</li>
              <li>Use a reachable email you check often.</li>
            </ul>
          </aside>
        </div>
      </div>

      {/* Styles kept alongside for easy copy-paste; mirrors the HUD aesthetic */}
      <style>{`
        .on {
          background: #7c3aed !important;
          border-color: #7c3aed !important;
        }
        .on .knob {
          transform: translateX(20px) !important;
          background: #fff !important;
        }
      `}</style>
    </>
  );
}

/* ---------- tiny style helpers (inline) ---------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  outline: "none",
  background: "#fff",
  fontSize: 14,
};

const switchStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  cursor: "pointer",
  userSelect: "none",
  padding: 4,
  border: "1px solid #e5e7eb",
  borderRadius: 100,
  width: 52,
  height: 28,
  background: "#f9fafb",
  position: "relative",
} as const;

const ghostBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  textAlign: "center",
  border: "1px dashed #e5e7eb",
  background: "#fafafa",
  color: "#6b7280",
  fontSize: 14,
  cursor: "pointer", // mouse only (intentionally missing role+tabindex)
};

const lowContrastBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 14px",
  background: "#ffffff",
  border: "1px solid #ebedf0",
  color: "#9aa3ad", // intentionally too light
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 14px",
  background: "#7c3aed",
  border: "1px solid #7c3aed",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

