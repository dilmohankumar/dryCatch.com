import { useState, useCallback } from "react";
import { authAPI } from "../../utils/api.js";

// ── Icons ──────────────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);
const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const AlertIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── Validation ─────────────────────────────────────────────────────────────
const validate = {
  email:    v => !v.trim() ? "Email is required" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email" : null,
  phone:    v => !v.trim() ? "Phone is required" : !/^[6-9]\d{9}$/.test(v.replace(/\s/g,"")) ? "Enter a valid 10-digit mobile number" : null,
  password: v => !v ? "Password is required" : v.length < 6 ? "At least 6 characters" : null,
};

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, icon, error, touched, suffix, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className={`relative flex items-center border rounded-xl transition-all duration-200
        ${error && touched ? "border-red-400 bg-red-50"
          : touched && !error ? "border-green-400 bg-green-50/30"
          : "border-gray-200 bg-gray-50 focus-within:border-[#1A3A5C] focus-within:bg-white"}`}>
        <span className={`absolute left-3.5 ${error && touched ? "text-red-400" : touched && !error ? "text-green-500" : "text-gray-400"}`}>{icon}</span>
        {children}
        {touched && !error && !suffix && <span className="absolute right-3.5 text-green-500"><CheckCircleIcon /></span>}
        {suffix && <span className="absolute right-3.5">{suffix}</span>}
      </div>
      {error && touched && <p className="flex items-center gap-1 text-xs text-red-500 font-medium"><AlertIcon />{error}</p>}
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────
export default function Login({ onLoginSuccess, onGoToSignup }) {
  const [tab, setTab]               = useState("email"); // "email" | "phone"
  const [form, setForm]             = useState({ email: "", phone: "", password: "" });
  const [touched, setTouched]       = useState({});
  const [showPw, setShowPw]         = useState(false);
  const [status, setStatus]         = useState("idle"); // idle | loading | success | error
  const [serverError, setServerError] = useState("");
  const [forgotState, setForgotState] = useState("idle"); // idle | sending | sent | error

  const set   = field => e => { setForm(f => ({ ...f, [field]: e.target.value })); setServerError(""); };
  const blur  = field => () => setTouched(t => ({ ...t, [field]: true }));

  const errors = {
    ...(tab === "email" ? { email: validate.email(form.email) } : { phone: validate.phone(form.phone) }),
    password: validate.password(form.password),
  };
  const isValid = Object.values(errors).every(e => !e);

  // ── Submit login ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setTouched(tab === "email" ? { email: true, password: true } : { phone: true, password: true });
    if (!isValid) return;

    setStatus("loading");
    setServerError("");
    try {
      const payload = {
        ...(tab === "email" ? { email: form.email } : { phone: form.phone }),
        password: form.password,
      };
      console.log("📤 Login request:", { ...payload, password: "***" });
      
      // Tokens are set by the server as httpOnly cookies — nothing to store here.
      const data = await authAPI.login(payload);
      console.log("✅ Login success:", data);
      setStatus("success");
      setTimeout(() => onLoginSuccess(data.user || { email: form.email }), 700);
    } catch (err) {
      console.error("❌ Login error:", err.message);
      setStatus("error");
      setServerError(err.message || "Invalid credentials. Please try again.");
      setTimeout(() => setStatus("idle"), 100);
    }
  }, [form, isValid, tab, onLoginSuccess]);

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (validate.email(form.email)) { setTouched(t => ({ ...t, email: true })); return; }
    setForgotState("sending");
    try {
      await authAPI.requestPasswordReset({ email: form.email });
      setForgotState("sent");
    } catch (err) {
      setForgotState("error");
      setServerError(err.message || "Could not send reset email. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EAF1FA] via-white to-[#FFF4E6] flex items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-black tracking-tight">
            <span className="text-[#1A3A5C]">dry</span>
            <span className="text-[#E07B39]">catch</span>
            <span className="text-[#1A3A5C]">.co</span>
          </span>
          <p className="text-gray-500 text-sm mt-2">Welcome back! Sign in to continue</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {[["email", "Email", <MailIcon />], ["phone", "Phone", <PhoneIcon />]].map(([m, label, icon]) => (
              <button key={m} onClick={() => { setTab(m); setTouched({}); setServerError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all
                  ${tab === m ? "border-b-2 border-[#1A3A5C] text-[#1A3A5C] bg-[#EAF1FA]/40" : "text-gray-400 hover:text-gray-600"}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 flex flex-col gap-5">

            {/* Google */}
            <button type="button" onClick={() => alert("Configure Google OAuth")}
              className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98]">
              <GoogleIcon /> Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or sign in with {tab}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email or Phone */}
            {tab === "email" ? (
              <Field label="Email Address" icon={<MailIcon />} error={errors.email} touched={touched.email}>
                <input type="email" value={form.email} onChange={set("email")} onBlur={blur("email")}
                  placeholder="you@example.com" autoComplete="email"
                  className="w-full pl-11 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              </Field>
            ) : (
              <Field label="Mobile Number" icon={<PhoneIcon />} error={errors.phone} touched={touched.phone}>
                <span className="absolute left-11 text-gray-500 text-sm font-medium pointer-events-none">+91</span>
                <input type="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")}
                  placeholder="98765 43210" autoComplete="tel" maxLength={10}
                  className="w-full pl-20 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              </Field>
            )}

            {/* Password */}
            <Field label="Password" icon={<LockIcon />} error={errors.password} touched={touched.password}
              suffix={
                <button type="button" onClick={() => setShowPw(s => !s)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }>
              <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} onBlur={blur("password")}
                placeholder="Enter your password" autoComplete="current-password"
                className="w-full pl-11 pr-12 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
            </Field>

            {/* Forgot password */}
            {tab === "email" && (
              <div className="flex justify-end -mt-2">
                {forgotState === "sent" ? (
                  <p className="text-xs text-green-600 font-medium">✓ Reset link sent to {form.email}</p>
                ) : forgotState === "sending" ? (
                  <p className="text-xs text-gray-400">Sending…</p>
                ) : (
                  <button type="button" onClick={handleForgot} className="text-xs text-[#1A3A5C] font-semibold hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {/* Server error */}
            {serverError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
                <AlertIcon /> {serverError}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={status === "loading" || status === "success"}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-[0.98] shadow-md
                ${status === "success" ? "bg-green-500 text-white"
                  : status === "loading" ? "bg-[#1A3A5C]/70 text-white cursor-not-allowed"
                  : "bg-[#1A3A5C] text-white hover:bg-[#142d47]"}`}>
              {status === "loading" ? (
                <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
              ) : status === "success" ? "✓ Signed In!" : "Sign In"}
            </button>

            <p className="text-center text-sm text-gray-500">
              New to drycatch?{" "}
              <button type="button" onClick={onGoToSignup} className="text-[#E07B39] font-bold hover:underline">Create account</button>
            </p>
          </form>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400">
          <span>🔒 SSL Secured</span><span>·</span><span>🛡️ FSSAI Certified</span><span>·</span><span>🚚 Free Delivery</span>
        </div>
      </div>
    </div>
  );
}