import { useState, useEffect, type JSX } from "react";

export default function ExampleTimed(): JSX.Element {
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState("Select amount");
  const [lang, setLang] = useState("English");

  // Timer logic (The "Silent" Anxiety)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="font-sans text-slate-900 bg-slate-50 min-h-screen pb-20">
      {/* ===== HEADER: Looks official, but the logo is just an image without alt text ===== */}
      <header className="bg-red-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-red-700 font-bold text-xs">
            SG
          </div>
          <h1 className="font-bold text-lg tracking-tight">RedeemSG</h1>
        </div>
        {/* A "Settings" button that is keyboard inaccessible */}
        <div className="cursor-pointer hover:bg-red-600 p-2 rounded">
          Settings ⚙️
        </div>
      </header>

      {/* ===== BANNER: Important info hidden in a generic div ===== */}
      <div className="bg-yellow-100 border-b border-yellow-200 p-3 text-sm text-yellow-900 text-center">
        <span className="font-bold">ALERT:</span> System maintenance scheduled
        for 12:00 AM.
      </div>

      <main className="max-w-md mx-auto mt-8 p-4">
        {/* ===== THE TIMER TRAP ===== 
            Visually urgent, audibly silent. No role="timer" or aria-live. 
        */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Verify Identity
            </h2>
            <p className="text-slate-500 text-sm">
              Please complete verification to claim vouchers.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-slate-500 font-semibold tracking-wider">
              Time Remaining
            </div>
            <div className="text-2xl font-mono font-bold text-red-600">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* ===== THE TABS TRAP ===== 
              Visual tabs using standard divs. Screen reader reads them as plain text line-by-line.
              No knowledge of which is "Selected".
          */}
          <div className="flex border-b border-slate-100 bg-slate-50">
            {["English", "中文", "தமிழ்", "Melayu"].map((l) => (
              <div
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 text-center py-3 text-sm font-medium cursor-pointer ${
                  lang === l
                    ? "text-red-700 border-b-2 border-red-700 bg-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l}
              </div>
            ))}
          </div>

          <div className="p-6 space-y-6">
            {/* ===== FORM: Bad Labelling ===== */}

            {/* 1. The "Tamil" Label Test (Language Attribute) */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700">
                <span>Name</span> (Name as per NRIC)
              </label>
              <input
                type="text"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="e.g. Tan Ah Kow"
              />
            </div>

            {/* 2. The "Placeholder Label" Trap */}
            <div className="space-y-1">
              {/* No visible label, relies on placeholder. Screen reader might read value but not name. */}
              <input
                type="text"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="Mobile Number (8 digits)"
              />
              <p className="text-xs text-slate-400">
                We will send an OTP to this number.
              </p>
            </div>

            {/* 3. The "Custom Dropdown" Trap 
               This is a classic. It's just divs. 
               - Enter/Space won't open it (unless you coded that specific click handler).
               - Arrow keys won't navigate it.
               - It doesn't announce "Expanded" or "Collapsed".
            */}
            <div className="space-y-1 relative">
              <div className="block text-sm font-semibold text-slate-700">
                Voucher Denomination
              </div>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full h-10 px-3 flex items-center justify-between rounded-lg border border-slate-300 bg-white cursor-pointer"
              >
                <span>{selectedVoucher}</span>
                <span className="text-slate-400">▼</span>
              </div>

              {dropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {["$100 Pack", "$200 Pack", "$300 Pack"].map((opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setSelectedVoucher(opt);
                        setDropdownOpen(false);
                      }}
                      className="px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. The "Fake Checkbox" (From your original, it's a classic) */}
            <div className="flex items-start gap-3 pt-2">
              <div
                onClick={(e) => e.currentTarget.classList.toggle("checked")}
                className="fake-checkbox mt-0.5 flex-shrink-0 w-5 h-5 rounded border border-slate-300 bg-white cursor-pointer transition-all"
              />
              <span className="text-sm text-slate-600 leading-tight">
                I declare that the information provided is true and I am not a
                robot.
              </span>
            </div>

            {/* 5. The "Div Button" 
               Visually looks disabled until form is filled (not really logic wise, but implies it).
               Keyboard focus skips this entirely.
            */}
            <div
              className="mt-4 w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-lg text-center cursor-pointer shadow-lg transform transition active:scale-95"
              onClick={() => alert("Verification Failed: Session Timeout")}
            >
              Verify & Redeem
            </div>

            <div className="text-center">
              <a href="#" className="text-xs text-slate-400 hover:underline">
                Need help?
              </a>
            </div>
          </div>
        </div>

        {/* Scam Warning Image - Decorative image with BAD alt text */}
        <div className="mt-6 opacity-75">
          <img
            src="https://dam.mediacorp.sg/image/upload/s--2MP54hl5--/f_auto,q_auto/v1/mediacorp/cna/image/2025/02/14/scam_spf.png?itok=xTWaFySW"
            alt="image_2025_v4_final_crop.png" // <--- Horrible Alt Text
            className="w-full rounded-lg border border-slate-200 grayscale hover:grayscale-0 transition-all"
          />
        </div>
      </main>

      <style>{`
        .fake-checkbox.checked {
          background-color: #dc2626;
          border-color: #dc2626;
          background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
        }
      `}</style>
    </div>
  );
}
