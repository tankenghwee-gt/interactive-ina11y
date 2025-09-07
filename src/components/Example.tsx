import type { JSX } from "react";

export default function Example(): JSX.Element {
  return (
    <>
      <div
        style={{
          position: "relative",
          paddingTop: 100,
          maxWidth: 400,
          margin: "auto auto",
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
            Fill in your information to redeem your CDC vouchers
          </h1>
        </header>

        <div
          style={{
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              padding: 16,
            }}
          >
            {/* ===== Form fields — “pretty” but broken semantics ===== */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* (4) Info & Relationships (A): placeholder-as-label; no <label> association */}
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Name</div>
                <input
                  id="name-input-missing-label" // id not used by any <label htmlFor>
                  style={inputStyle}
                />
              </div>

              {/* Another unlabeled input to make failure obvious */}
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>
                  Email address
                </div>
                <input style={inputStyle} />
              </div>

              <div className="psa">
                <p>
                  Please be aware of scam websites that falsely claim to offer
                  CDC vouchers.
                </p>
                <p>
                  Refer to the infographic below for examples of fake vs real
                  pages.
                </p>
              </div>
              <img
                src="https://dam.mediacorp.sg/image/upload/s--2MP54hl5--/f_auto,q_auto/v1/mediacorp/cna/image/2025/02/14/scam_spf.png?itok=xTWaFySW"
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              {/* (1) Name/Role/Value (A): “custom toggle” with no role or state */}
              {/* (1) Name/Role/Value (A): visually styled checkbox without accessible name/role */}
              <div className="flex items-center gap-2">
                <div
                  // ❌ Fake checkbox: no <input>, no role, no aria-checked
                  onClick={(e) => e.currentTarget.classList.toggle("checked")}
                  className="fake-checkbox w-5 h-5 border border-gray-400 bg-white cursor-pointer"
                />
                <span className="text-sm text-gray-800">
                  I agree to receive updates for future CDC Vouchers through
                  email
                </span>
              </div>
              {/* (2) Keyboard (A): mouse-only control — not reachable or activatable by keyboard */}
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Try activating the button below with keyboard.
              </p>
              <div
                onClick={() =>
                  alert("Congratulations, you have submitted the form!")
                }
                style={ghostBtn}
                className={"srs-btn--muted"}
              >
                Submit
              </div>

              {/* Actions */}
            </div>
          </section>
        </div>
      </div>

      {/* Tiny demo-only styles */}
      <style>{`
        .on {
          background: #7c3aed !important;
          border-color: #7c3aed !important;
        }
        .on .knob {
          transform: translateX(20px) !important;
          background: #fff !important;
        }
        .fake-checkbox.checked {
          background: #7c3aed !important;
          border-color: #7c3aed !important;
          position: relative;
        }
        .fake-checkbox.checked::after {
          content: "✓";
          color: white;
          font-size: 0.8rem;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
          .psa p {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
  margin-bottom: 1em; /* adds blank line */
}

.psa p:last-child {
  margin-bottom: 0; /* avoid extra space at the end */
}
      `}</style>
    </>
  );
}

/* ---------- inline style helpers ---------- */

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

const ghostBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  textAlign: "center",
  border: "1px dashed #e5e7eb",
  background: "#60f5e3ff",
  color: "#ffffff",
  fontSize: 14,
  cursor: "pointer", // mouse only (intentionally missing role+tabindex+key handlers)
};
