import type { JSX } from "react";

export default function Example(): JSX.Element {
  return (
    <>
      <div
        // FIXED: Removed 'lg:' prefix from max-w.
        // Now it never exceeds 420px, preventing stretching on wide screens.
        className="relative pt-10 pb-48 w-full max-w-[420px] mx-auto text-gray-900 font-sans"
      >
        <h1 className="text-xl font-bold tracking-tight mb-4 px-4 sm:px-0">
          Fill in your information to redeem your CDC vouchers
        </h1>

        <div className="flex flex-col gap-4 w-full">
          <form>
            {/* FIXED: Removed 'lg:' prefix. Border/Radius now applies only if there's room (sm+), 
                but width is always constrained by parent. */}
            <section className="bg-white p-4 sm:border sm:border-gray-200 sm:rounded-xl sm:shadow-lg">
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>Name</div>
                  <input id="name" style={inputStyle} />
                </div>

                <div>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>
                    Email address
                  </div>
                  <input id="email" style={inputStyle} />
                </div>

                <div className="psa">
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
                    Please be aware of scam websites that falsely claim to offer
                    CDC vouchers.
                  </p>
                </div>
                {/* Image will now fit within the 420px container */}
                <img
                  src="https://dam.mediacorp.sg/image/upload/s--2MP54hl5--/f_auto,q_auto/v1/mediacorp/cna/image/2025/02/14/scam_spf.png?itok=xTWaFySW"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />

                <div className="flex items-center gap-2">
                  <div
                    onClick={(e) => e.currentTarget.classList.toggle("checked")}
                    className="fake-checkbox w-6 h-6 border border-gray-400 bg-white cursor-pointer shrink-0"
                  />
                  <span className="text-sm text-gray-800">
                    I agree to receive updates for future CDC Vouchers through
                    email
                  </span>
                </div>

                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  Try activating the button below.
                </p>
                <div
                  onClick={(event) => {
                    event?.preventDefault();
                    alert("You did it! Good job!");
                  }}
                  style={ghostBtn}
                  className={"srs-btn--muted"}
                >
                  Submit
                </div>
              </div>
            </section>
          </form>
        </div>
      </div>

      <style>{`
        .fake-checkbox.checked {
          background: #7c3aed !important;
          border-color: #7c3aed !important;
          position: relative;
        }
        .fake-checkbox.checked::after {
          content: "✓";
          color: white;
          font-size: 0.9rem;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .psa p {
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
          margin-bottom: 1em;
        }
      `}</style>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  outline: "none",
  background: "#fff",
  fontSize: 16,
};

const ghostBtn: React.CSSProperties = {
  borderRadius: 10,
  padding: "14px 12px",
  textAlign: "center",
  border: "1px dashed #e5e7eb",
  background: "#60f5e3ff",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
