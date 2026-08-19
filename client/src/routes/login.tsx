import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, ArrowRight, Eye, EyeOff, AlertTriangle, Copy, Check, Wifi, WifiOff, Smartphone, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { classroomStore, type User } from "@/lib/classroomStore";
import { loginUser, forgotPassword, resetPassword } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

interface AppEnvInfo {
  version: string;
  isCapacitor: boolean;
  androidVersion: string;
  webViewVersion: string;
  isOnline: boolean;
  apiEndpoint: string;
}

interface DiagnosticDetail {
  isNetworkError: boolean;
  title: string;
  probableReasons: { title: string; desc: string; fix: string }[];
}

function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState<DiagnosticDetail | null>(null);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [step, setStep] = useState<"login" | "forgot" | "reset">("login");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [envInfo, setEnvInfo] = useState<AppEnvInfo>({
    version: "v1.0.10",
    isCapacitor: false,
    androidVersion: "",
    webViewVersion: "",
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    apiEndpoint: "https://api1.axonmedacademy.com/api/v1",
  });

  useEffect(() => {
    const detect = async () => {
      let ver = "v1.0.10";
      let isCap = false;

      if (typeof window !== "undefined" && (window as any).Capacitor) {
        isCap = true;
        try {
          const { App } = await import("@capacitor/app");
          const info = await App.getInfo();
          if (info && info.version) {
            ver = `v${info.version}${info.build ? `.${info.build}` : ""}`;
          }
        } catch {
          ver = "v1.0.10";
        }
      }

      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      let android = "";
      const androidMatch = ua.match(/Android\s([0-9.]+)/i);
      if (androidMatch) android = `Android ${androidMatch[1]}`;

      let webview = "";
      const chromeMatch = ua.match(/Chrome\/([0-9.]+)/i);
      if (chromeMatch) webview = `Chrome/WebView ${chromeMatch[1]}`;

      setEnvInfo({
        version: ver,
        isCapacitor: isCap,
        androidVersion: android || (isCap ? "Android" : "Web Device"),
        webViewVersion: webview || (isCap ? "System WebView" : "Web Browser"),
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        apiEndpoint: "https://api1.axonmedacademy.com/api/v1",
      });
    };

    detect();

    const handleOnline = () => setEnvInfo(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setEnvInfo(prev => ({ ...prev, isOnline: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const analyzeError = (err: unknown): DiagnosticDetail | null => {
    const msg = err instanceof Error ? err.message : String(err);
    const isFetchFailure =
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("networkerror") ||
      msg.toLowerCase().includes("load failed") ||
      msg.toLowerCase().includes("network request failed") ||
      !navigator.onLine;

    if (!isFetchFailure) return null;

    const reasons: { title: string; desc: string; fix: string }[] = [];

    if (!navigator.onLine) {
      reasons.push({
        title: "No Internet Connection (Offline)",
        desc: "Your phone is currently disconnected from the internet.",
        fix: "Check your Wi-Fi or Mobile Data connection.",
      });
    }

    if (envInfo.isCapacitor) {
      reasons.push({
        title: "1. Outdated Android System WebView (Most Common)",
        desc: "Older WebView engines fail modern SSL security certificates with the API server.",
        fix: "Open Google Play Store ➔ Search 'Android System WebView' and 'Google Chrome' ➔ Tap Update.",
      });
      reasons.push({
        title: "2. Phone Date & Time Out of Sync",
        desc: "Incorrect time on the phone blocks secure HTTPS verification.",
        fix: "Phone Settings ➔ Date & Time ➔ Turn ON 'Set Time Automatically'.",
      });
      reasons.push({
        title: "3. Mobile Network (ISP) DNS or VPN Block",
        desc: "Your mobile network (Jio/Airtel/Vi) or private DNS/VPN may be blocking the API subdomain.",
        fix: "Try switching between Wi-Fi and Mobile Data, or set Private DNS to 'Off' / 'dns.google'.",
      });
    } else {
      reasons.push({
        title: "Browser or Network Firewall Block",
        desc: "The browser or local Wi-Fi router is blocking requests to api1.axonmedacademy.com.",
        fix: "Disable AdBlockers/VPN or try using Google Chrome in Incognito mode.",
      });
    }

    return {
      isNetworkError: true,
      title: "Connection Failed (Failed to fetch)",
      probableReasons: reasons,
    };
  };

  const copyDiagnosticInfo = () => {
    const text = `--- AXON ACADEMY DIAGNOSTIC REPORT ---
Error: ${error || "Failed to fetch"}
App Version: ${envInfo.version} (${envInfo.isCapacitor ? "Android APK" : "Web"})
Internet Status: ${envInfo.isOnline ? "Online (Connected)" : "Offline (No Connection)"}
Device: ${envInfo.androidVersion || "Unknown"}
Engine: ${envInfo.webViewVersion || "Unknown"}
Target API: ${envInfo.apiEndpoint}
User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
Timestamp: ${new Date().toLocaleString()}
--------------------------------------`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedDiag(true);
      toast.success("Diagnostic info copied to clipboard!");
      setTimeout(() => setCopiedDiag(false), 3000);
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDiagnostic(null);
    setIsSubmitting(true);

    try {
      const payload = await loginUser(userId, password);
      const backendUser = payload.user;
      const accessToken = payload.accessToken || null;
      const role = backendUser.role === "student" ? "student" : backendUser.role;
      const currentUser: User = {
        id: backendUser._id,
        name: backendUser.fullName || backendUser.email,
        email: backendUser.email,
        phone: backendUser.phone,
        role,
        userId: backendUser.userId || "",
      };

      classroomStore.setState(() => ({ currentUser, accessToken }));
      navigate({ to: role === "student" ? "/student/dashboard" : "/admin/dashboard" });
    } catch (err) {
      const diag = analyzeError(err);
      setDiagnostic(diag);
      setError(err instanceof Error ? err.message : "Invalid Credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError("Please enter your User ID or Email.");
      return;
    }
    setError("");
    setDiagnostic(null);
    setIsSubmitting(true);
    try {
      const res = await forgotPassword(userId.trim());
      toast.success(res.message || "Verification code sent successfully.");
      setStep("reset");
    } catch (err) {
      setDiagnostic(analyzeError(err));
      setError(err instanceof Error ? err.message : "Failed to send reset code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !otp.trim() || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setDiagnostic(null);
    setIsSubmitting(true);
    try {
      const res = await resetPassword(userId.trim(), otp.trim(), newPassword);
      toast.success(res.message || "Password reset successfully!");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("login");
    } catch (err) {
      setDiagnostic(analyzeError(err));
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual */}
      <div className="hidden lg:flex w-1/2 relative bg-navy text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-30" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sky/20 blur-3xl" />

        <Link to="/" className="relative inline-flex items-center gap-2 w-fit">
          <img src="/logo.jpeg" className="h-18 w-18 rounded-full object-cover" />
          <span className="font-display text-lg font-extrabold">Axon Med Academy</span>
        </Link>

        <div className="relative">
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-[-0.02em]">
            Welcome back, dream PG seat and your <br />
            Your <span className="bg-gold text-navy px-2 rounded"> MRB-AMO </span> government order are waiting to be claimed.
          </h1>
          <p className="mt-5 text-white/80 max-w-md"></p>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/50">
          <span>© {new Date().getFullYear()} Axon Med Academy</span>
          <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded text-gold">
            {envInfo.isCapacitor ? `📱 APK ${envInfo.version}` : `🌐 Web ${envInfo.version}`}
          </span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 grid place-items-center p-4 sm:p-6 lg:p-12 bg-light-gray">
        <div className="w-full max-w-md">
          {/* Top Version & Connection Badge */}
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-gold">
                <Stethoscope className="h-4 w-4" />
              </span>
              <span className="font-display font-extrabold text-navy text-sm">Axon.Academy</span>
            </Link>

            <div className="flex items-center gap-1.5 font-mono text-[10px] bg-white border border-gray-200 shadow-sm px-2.5 py-1 rounded-full text-navy font-bold">
              {envInfo.isCapacitor ? (
                <Smartphone className="w-3 h-3 text-sky" />
              ) : (
                <Globe className="w-3 h-3 text-sky" />
              )}
              <span>{envInfo.isCapacitor ? `APK ${envInfo.version}` : `Web ${envInfo.version}`}</span>
              <span className="mx-0.5 text-gray-300">•</span>
              {envInfo.isOnline ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline
                </span>
              )}
            </div>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
            {step === "login" && "Sign in"}
            {step === "forgot" && "Forgot password"}
            {step === "reset" && "Reset password"}
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
            {step === "login" && "Enter your credentials to access your portal."}
            {step === "forgot" && "Enter your registered User ID or Email to receive a verification code."}
            {step === "reset" && "Enter the verification code sent to your email and your new password."}
          </p>

          {/* Diagnostic Error Overlay */}
          {diagnostic && diagnostic.isNetworkError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs shadow-sm space-y-3">
              <div className="flex items-start gap-2.5 text-red-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-extrabold text-red-900">{diagnostic.title}</p>
                  <p className="text-[11px] font-normal text-red-700 mt-0.5">
                    Your device cannot communicate with the Axon server ({envInfo.apiEndpoint.replace('/api/v1', '')}).
                  </p>
                </div>
              </div>

              <div className="bg-white/80 border border-red-100 rounded-lg p-2.5 space-y-2 text-slate-800">
                <p className="font-bold text-[11px] text-red-900 uppercase tracking-wider">Troubleshooting Steps:</p>
                {diagnostic.probableReasons.map((r, i) => (
                  <div key={i} className="text-[11px] leading-relaxed border-b border-red-50 last:border-0 pb-1.5 last:pb-0">
                    <p className="font-bold text-slate-900">{r.title}</p>
                    <p className="text-slate-600 text-[10px]">{r.desc}</p>
                    <p className="text-navy font-semibold text-[10px] mt-0.5 bg-gold/20 px-1.5 py-0.5 rounded w-fit">
                      👉 Fix: {r.fix}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 text-slate-300 font-mono text-[10px] p-2 rounded-md space-y-0.5">
                <div><strong>App:</strong> {envInfo.isCapacitor ? "Android APK" : "Web"} ({envInfo.version})</div>
                <div><strong>Device:</strong> {envInfo.androidVersion || "N/A"} • {envInfo.webViewVersion || "N/A"}</div>
                <div><strong>Network:</strong> {envInfo.isOnline ? "Connected (Online)" : "Disconnected (Offline)"}</div>
              </div>

              <button
                type="button"
                onClick={copyDiagnosticInfo}
                className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95 shadow-sm"
              >
                {copiedDiag ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedDiag ? "Copied to Clipboard!" : "Copy Diagnostic Info for Support"}
              </button>
            </div>
          )}

          {error && !diagnostic && (
            <div className="mt-4 text-red-600 text-xs font-semibold p-3 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          {step === "login" && (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID / Email</label>
                <input
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  type="text"
                  placeholder="e.g. student@gmail.com or Admin"
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-navy">Password</label>
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault();
                      setError("");
                      setDiagnostic(null);
                      setStep("forgot");
                    }}
                    className="text-xs text-sky font-semibold hover:underline"
                  >
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-gray-200 bg-white pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID / Email</label>
                <input
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  type="text"
                  placeholder="e.g. student@gmail.com or Admin"
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Sending code..." : "Send code"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID / Email</label>
                <input
                  value={userId}
                  disabled
                  className="w-full rounded-full border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-500 focus:outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">Verification Code (OTP)</label>
                <input
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  type="text"
                  placeholder="e.g. 123456"
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">New Password</label>
                <input
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">Confirm Password</label>
                <input
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Resetting..." : "Reset password"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === "login" && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
                <div className="h-px flex-1 bg-gray-200" /> or <div className="h-px flex-1 bg-gray-200" />
              </div>

              <p className="mt-6 text-center text-sm text-gray-500">
                New to Axon? <Link to="/courses" className="font-bold text-navy">Browse courses →</Link>
              </p>
            </>
          )}

          {step !== "login" && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setDiagnostic(null);
                  setStep("login");
                }}
                className="font-bold text-navy hover:underline focus:outline-none"
              >
                Sign in →
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
