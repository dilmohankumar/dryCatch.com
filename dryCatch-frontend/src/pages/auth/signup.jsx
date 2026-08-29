import { useState, useCallback, useEffect } from "react";
import { authAPI } from "../../utils/api.js";

// ── Icons ──────────────────────────────────────────────────────────────────
const EyeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const EyeOffIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>);
const MailIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>);
const LockIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>);
const UserIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const PhoneIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>);
const CheckCircleIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const AlertIcon = () => (<svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>);

// ── Validation ──
const validate = {
  firstName: v => !v.trim() ? "First name is required" : v.trim().length < 2 ? "At least 2 characters" : !/^[a-zA-Z'-]+$/.test(v) ? "Letters only" : null,
  lastName: v => !v.trim() ? "Last name is required" : v.trim().length < 2 ? "At least 2 characters" : !/^[a-zA-Z'-]+$/.test(v) ? "Letters only" : null,
  email: v => !v.trim() ? "Email is required" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email" : null,
  phone: v => !v.trim() ? "Phone is required" : !/^[6-9]\d{9}$/.test(v.replace(/\s/g, "")) ? "Valid 10-digit Indian number" : null,
  password: v => !v ? "Password is required" : v.length < 8 ? "Min 8 characters" : !/[A-Z]/.test(v) ? "Include one uppercase letter" : !/[0-9]/.test(v) ? "Include one number" : null,
  confirmPassword: (v, pw) => !v ? "Confirm your password" : v !== pw ? "Passwords do not match" : null,
  otp: v => !v.trim() ? "OTP is required" : !/^\d{6}$/.test(v) ? "Enter the 6-digit OTP" : null,
};

function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: "Weak", color: "bg-red-400" };
  if (s <= 2) return { score: s, label: "Fair", color: "bg-orange-400" };
  if (s <= 3) return { score: s, label: "Good", color: "bg-yellow-400" };
  if (s <= 4) return { score: s, label: "Strong", color: "bg-green-400" };
  return { score: s, label: "Very Strong", color: "bg-green-600" };
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({ label, icon, error, touched, suffix, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className={`relative flex items-center border rounded-xl transition-all duration-200
        ${error && touched ? "border-red-400 bg-red-50"
          : touched && !error ? "border-green-400 bg-green-50/30"
            : "border-gray-200 bg-gray-50 focus-within:border-[#1A3A5C] focus-within:bg-white"}`}>
        <span className={`absolute left-3.5 ${error && touched ? "text-red-400" : touched && !error ? "text-green-500" : "text-gray-400"}`}>{icon}</span>
        {children}
        {touched && !error && !suffix && <span className="absolute right-3.5 text-green-500 pointer-events-none"><CheckCircleIcon /></span>}
        {suffix && <span className="absolute right-3.5">{suffix}</span>}
      </div>
      {error && touched && <p className="flex items-center gap-1 text-xs text-red-500 font-medium"><AlertIcon />{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ── OTP Input ──────────────────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);
  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      onChange(value.slice(0, i) + value.slice(i + 1));
      if (i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
      return;
    }
    if (!/\d/.test(e.key)) return;
    const next = value.slice(0, i) + e.key + value.slice(i + 1);
    onChange(next.slice(0, 6));
    if (i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };
  const handlePaste = (e) => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(p);
    document.getElementById(`otp-${Math.min(p.length, 5)}`)?.focus();
  };
  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {digits.map((d, i) => (
        <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1}
          value={d} onChange={() => { }} onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
          className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold border-2 rounded-xl transition-all focus:outline-none focus:border-[#1A3A5C] focus:bg-white
            ${d ? "border-[#1A3A5C] bg-[#EAF1FA] text-[#1A3A5C]" : "border-gray-200 bg-gray-50 text-gray-800"}`} />
      ))}
    </div>
  );
}

function Steps({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${i < current ? "bg-green-500 text-white" : i === current ? "bg-[#1A3A5C] text-white" : "bg-gray-200 text-gray-400"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && <div className={`w-8 h-0.5 rounded-full ${i < current ? "bg-green-400" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Signup ─────────────────────────────────────────────────────────────────
export default function Signup({ onSignupSuccess, onGoToLogin }) {
  const [step, setStep] = useState(0); // 0=details, 1=otp, 2=done
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", otp: "", agree: false });
  const [touched, setTouched] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [status, setStatus] = useState("idle");
  const [serverError, setServerError] = useState("");
  const [timer, setTimer] = useState(0);
  const [resends, setResends] = useState(0);
  // Phase 24 — a referral code arrives as `?ref=CODE` on the shared signup
  // link; captured once on mount (not re-read per render) and threaded
  // through both the initial signup call and the resend-OTP retry.
  const [referralCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");

  const strength = getStrength(form.password);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const set = f => e => { setForm(p => ({ ...p, [f]: e.target.type === "checkbox" ? e.target.checked : e.target.value })); setServerError(""); };
  const blur = f => () => setTouched(t => ({ ...t, [f]: true }));

  const step0Errors = {
    firstName: validate.firstName(form.firstName), lastName: validate.lastName(form.lastName),
    email: validate.email(form.email),
    phone: validate.phone(form.phone), password: validate.password(form.password),
    confirmPassword: validate.confirmPassword(form.confirmPassword, form.password),
    agree: form.agree ? null : "You must accept the terms",
  };
  const step0Valid = Object.values(step0Errors).every(e => !e);
  const otpErr = validate.otp(form.otp);

  // ── Step 0: Signup + Send OTP ────────────────────────────────────────────
  const handleSubmitDetails = useCallback(async (e) => {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, email: true, phone: true, password: true, confirmPassword: true, agree: true });
    if (!step0Valid) return;

    setStatus("loading");
    setServerError("");
    try {
      // POST /api/v1/auth/signup (OTP is sent automatically by backend)
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        ...(referralCode ? { referralCode } : {}),
      };
      console.log("📤 Signup request:", { ...payload, password: "***", confirmPassword: "***" });
      await authAPI.signup(payload);

      setStatus("idle");
      setStep(1);
      setTimer(60);
    } catch (err) {
      console.error("❌ Signup error:", err);
      setStatus("error");
      setServerError(err.message || "Signup failed. Please try again.");
      setTimeout(() => setStatus("idle"), 100);
    }
  }, [form, step0Valid, referralCode]);

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (timer > 0 || resends >= 3) return;
    setResends(r => r + 1);
    setTimer(60);
    setForm(f => ({ ...f, otp: "" }));
    try {
      // Resend OTP by calling signup again (backend will detect user exists and send OTP)
      await authAPI.signup({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        ...(referralCode ? { referralCode } : {}),
      });
    } catch (err) {
      setServerError(err.message || "Failed to resend OTP");
    }
  };

  // ── Step 1: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOTP = useCallback(async (e) => {
    e.preventDefault();
    setTouched(t => ({ ...t, otp: true }));
    if (otpErr) return;

    setStatus("loading");
    setServerError("");
    try {
      // POST /api/auth/verify-otp  → { email, otp }
      // Tokens are set by the server as httpOnly cookies — nothing to store here.
      const data = await authAPI.verifyOtp({ email: form.email, otp: form.otp });

      setStatus("success");
      setStep(2);
      setTimeout(() => onSignupSuccess(data.user || { firstName: form.firstName, lastName: form.lastName, email: form.email }), 1500);
    } catch (err) {
      setStatus("error");
      setServerError(err.message || "Invalid OTP. Please try again.");
      setTimeout(() => setStatus("idle"), 100);
    }
  }, [form, otpErr, onSignupSuccess]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EAF1FA] via-white to-[#FFF4E6] flex items-center justify-center px-4 py-8 font-sans">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-3xl font-black tracking-tight">
            <span className="text-[#1A3A5C]">dry</span><span className="text-[#E07B39]">catch</span><span className="text-[#1A3A5C]">.co</span>
          </span>
          <p className="text-gray-500 text-sm mt-1.5">
            {step === 0 ? "Create your account" : step === 1 ? "Verify your email" : "You're all set!"}
          </p>
        </div>

        <Steps current={step} total={3} />

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

          {/* ── Step 0: Details ── */}
          {step === 0 && (
            <form onSubmit={handleSubmitDetails} noValidate className="p-6 sm:p-8 flex flex-col gap-4">

              {referralCode && (
                <div className="bg-[#FFF4E6] border border-[#E07B39]/30 rounded-xl px-4 py-2.5 text-sm text-[#1A3A5C] font-medium text-center">
                  🎁 You were referred with code <span className="font-bold">{referralCode}</span>
                </div>
              )}

              <button type="button" onClick={() => alert("Configure Google OAuth")}
                className="flex items-center justify-center gap-3 w-full border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98]">
                <GoogleIcon /> Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or sign up with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" icon={<UserIcon />} error={step0Errors.firstName} touched={touched.firstName}>
                  <input type="text" value={form.firstName} onChange={set("firstName")} onBlur={blur("firstName")}
                    placeholder="John" autoComplete="given-name"
                    className="w-full pl-11 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
                </Field>
                <Field label="Last Name" icon={<UserIcon />} error={step0Errors.lastName} touched={touched.lastName}>
                  <input type="text" value={form.lastName} onChange={set("lastName")} onBlur={blur("lastName")}
                    placeholder="Doe" autoComplete="family-name"
                    className="w-full pl-11 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
                </Field>
              </div>

              <Field label="Email Address" icon={<MailIcon />} error={step0Errors.email} touched={touched.email}>
                <input type="email" value={form.email} onChange={set("email")} onBlur={blur("email")}
                  placeholder="you@example.com" autoComplete="email"
                  className="w-full pl-11 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              </Field>

              <Field label="Mobile Number" icon={<PhoneIcon />} error={step0Errors.phone} touched={touched.phone}>
                <span className="absolute left-11 text-gray-500 text-sm font-medium pointer-events-none">+91</span>
                <input type="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")}
                  placeholder="98765 43210" autoComplete="tel" maxLength={10}
                  className="w-full pl-20 pr-10 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              </Field>

              {/* Password + strength */}
              <div className="flex flex-col gap-1.5">
                <Field label="Password" icon={<LockIcon />} error={step0Errors.password} touched={touched.password}
                  suffix={<button type="button" onClick={() => setShowPw(s => !s)} className="text-gray-400 hover:text-gray-600">{showPw ? <EyeOffIcon /> : <EyeIcon />}</button>}>
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} onBlur={blur("password")}
                    placeholder="Min 8 chars, 1 uppercase, 1 number" autoComplete="new-password"
                    className="w-full pl-11 pr-12 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
                </Field>
                {form.password && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-semibold ${strength.score <= 2 ? "text-red-500" : strength.score <= 3 ? "text-yellow-600" : "text-green-600"}`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <Field label="Confirm Password" icon={<LockIcon />} error={step0Errors.confirmPassword} touched={touched.confirmPassword}
                suffix={<button type="button" onClick={() => setShowCPw(s => !s)} className="text-gray-400 hover:text-gray-600">{showCPw ? <EyeOffIcon /> : <EyeIcon />}</button>}>
                <input type={showCPw ? "text" : "password"} value={form.confirmPassword} onChange={set("confirmPassword")} onBlur={blur("confirmPassword")}
                  placeholder="Re-enter your password" autoComplete="new-password"
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none" />
              </Field>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.agree} onChange={set("agree")} className="mt-0.5 w-4 h-4 rounded accent-[#1A3A5C] flex-shrink-0 cursor-pointer" />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I agree to the <button type="button" className="text-[#1A3A5C] font-semibold hover:underline">Terms of Service</button> and <button type="button" className="text-[#1A3A5C] font-semibold hover:underline">Privacy Policy</button>
                </span>
              </label>
              {step0Errors.agree && touched.agree && (
                <p className="flex items-center gap-1 text-xs text-red-500 font-medium -mt-2"><AlertIcon />{step0Errors.agree}</p>
              )}

              {serverError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
                  <AlertIcon />{serverError}
                </div>
              )}

              <button type="submit" disabled={status === "loading"}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-[0.98] shadow-md
                  ${status === "loading" ? "bg-[#1A3A5C]/70 text-white cursor-not-allowed" : "bg-[#1A3A5C] text-white hover:bg-[#142d47]"}`}>
                {status === "loading"
                  ? <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating account…</>
                  : "Continue →"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <button type="button" onClick={onGoToLogin} className="text-[#E07B39] font-bold hover:underline">Sign in</button>
              </p>
            </form>
          )}

          {/* ── Step 1: OTP ── */}
          {step === 1 && (
            <form onSubmit={handleVerifyOTP} noValidate className="p-6 sm:p-8 flex flex-col gap-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#EAF1FA] rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MailIcon />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We sent a 6-digit OTP to<br />
                  <span className="font-bold text-gray-900">{form.email}</span>
                </p>
                <button type="button" onClick={() => { setStep(0); setServerError(""); }}
                  className="text-xs text-[#1A3A5C] font-semibold hover:underline mt-1">
                  Change email
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">Enter OTP</p>
                <OTPInput value={form.otp} onChange={v => setForm(f => ({ ...f, otp: v }))} />
                {otpErr && touched.otp && (
                  <p className="flex items-center justify-center gap-1 text-xs text-red-500 font-medium mt-2"><AlertIcon />{otpErr}</p>
                )}
              </div>

              {/* Resend */}
              <div className="text-center">
                {timer > 0
                  ? <p className="text-xs text-gray-400">Resend OTP in <span className="font-bold text-[#1A3A5C]">{timer}s</span></p>
                  : resends >= 3
                    ? <p className="text-xs text-gray-400">Max resend attempts reached. Please try again later.</p>
                    : <button type="button" onClick={handleResend} className="text-xs text-[#E07B39] font-semibold hover:underline">Resend OTP</button>
                }
              </div>

              {serverError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
                  <AlertIcon />{serverError}
                </div>
              )}

              <button type="submit" disabled={status === "loading" || form.otp.length < 6}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-md
                  ${status === "loading" ? "bg-[#1A3A5C]/70 text-white cursor-not-allowed"
                    : form.otp.length < 6 ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#1A3A5C] text-white hover:bg-[#142d47]"}`}>
                {status === "loading"
                  ? <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Verifying…</>
                  : "Verify & Create Account"}
              </button>
            </form>
          )}

          {/* ── Step 2: Success ── */}
          {step === 2 && (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Welcome, {form.firstName}! 🎉</h2>
                <p className="text-sm text-gray-500 mt-1">Your account has been created successfully.</p>
              </div>
              <div className="bg-[#EAF1FA] rounded-xl px-5 py-3 text-sm text-[#1A3A5C] font-medium">
                🐟 Get 20% off on your first order!
              </div>
              <p className="text-xs text-gray-400 animate-pulse">Redirecting you to the store…</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400 flex-wrap">
          <span>🔒 SSL Secured</span><span>·</span><span>🛡️ FSSAI Certified</span><span>·</span><span>🚚 Free Delivery ₹500+</span>
        </div>
      </div>
    </div>
  );
}