import { useRef, type JSX } from "react";

export default function ExampleFixed(): JSX.Element {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    // Force native validation
    if (!form.checkValidity()) {
      // Find first invalid element
      const firstInvalid = form.querySelector<HTMLElement>(
        "input:invalid, select:invalid, textarea:invalid, [aria-invalid='true']"
      );

      if (firstInvalid) {
        // Focus it natively (so browser shows message / outline)
        firstInvalid.focus();
      }
      return;
    }

    alert("Form submitted successfully!");
  };

  return (
    <main
      style={{
        position: "relative",
        paddingTop: 100,
        maxWidth: 400,
        margin: "auto",
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

      <form
        style={{
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        ref={formRef}
        onSubmit={handleSubmit}
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
          <div style={{ display: "grid", gap: 16 }}>
            {/* Name */}
            <div>
              <label
                htmlFor="full-name"
                style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
              >
                Name
              </label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                placeholder="John Tan"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                style={inputStyle}
              />
            </div>

            {/* PSA */}
            <aside className="psa" aria-label="">
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  marginBottom: 16,
                }}
              >
                Scam Advisory
              </h2>
              <p>
                Please be aware of scam websites that falsely claim to offer CDC
                vouchers.
              </p>
              <p>
                Refer to the infographic below for examples of fake vs real
                pages.
              </p>
            </aside>

            <img
              src="https://dam.mediacorp.sg/image/upload/s--2MP54hl5--/f_auto,q_auto/v1/mediacorp/cna/image/2025/02/14/scam_spf.png?itok=xTWaFySW"
              alt="Fake vs real CDC voucher websites. 
                    The fake page claims residents can get $2000 assistance and asks for full name and Telegram number.
                    The real RedeemSG page shows available vouchers without asking for personal details."
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />

            {/* Consent checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="updates-consent"
                name="updates-consent"
                style={{ marginRight: 8 }}
              />
              <label htmlFor="updates-consent" style={{ fontSize: 14 }}>
                I agree to receive updates for future CDC Vouchers through email
              </label>
            </div>

            {/* Buttons */}
            <button type="submit" style={primaryBtn}>
              Submit
            </button>
          </div>
        </section>
      </form>

      <style>{`
        .psa p {
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
          margin-bottom: 1em;
        }
        .psa p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </main>
  );
}

/* ---------- inline style helpers ---------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 10,
  border: "1px solid #6b7280", // darker border for contrast
  padding: "0 12px",
  outline: "none",
  background: "#fff",
  fontSize: 14,
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
