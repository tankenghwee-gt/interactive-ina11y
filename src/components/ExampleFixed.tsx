import { type JSX, useRef } from "react";

export default function ExampleFixed(): JSX.Element {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector<HTMLElement>(
        "input:invalid, select:invalid, textarea:invalid, [aria-invalid='true']"
      );
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    alert("Form submitted successfully!");
  };

  return (
    <main
      // UPDATED: Converted inline styles to Tailwind
      // sm:px-0 adds padding only on larger screens; mobile is full width
      className="relative pt-10 pb-48 w-full sm:max-w-[400px] mx-auto text-gray-900 font-sans"
    >
      <header style={{ marginBottom: 16 }}>
        <h1 className="text-xl font-bold tracking-tight mb-4 px-4 sm:px-0">
          Fill in your information to redeem your CDC vouchers
        </h1>
      </header>

      <form
        className="flex flex-col gap-4 w-full"
        ref={formRef}
        onSubmit={handleSubmit}
      >
        {/* UPDATED CONTAINER: 
                - Mobile: No border, no radius, full width 
                - Desktop (sm): Border, rounded corners, shadow 
            */}
        <section className="bg-white p-4 sm:border sm:border-gray-200 sm:rounded-xl sm:shadow-lg">
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

            <aside className="psa">
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
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="updates-consent"
                name="updates-consent"
                style={{ width: 20, height: 20 }}
              />
              <label htmlFor="updates-consent" style={{ fontSize: 14 }}>
                I agree to receive updates for future CDC Vouchers through email
              </label>
            </div>

            <button type="submit" style={primaryBtn}>
              Submit
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1.5px solid #6b7280",
  padding: "0 12px",
  outline: "none",
  background: "#fff",
  fontSize: 16,
};

const primaryBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "14px 14px",
  background: "#7c3aed",
  border: "1px solid #7c3aed",
  color: "#fff",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};
