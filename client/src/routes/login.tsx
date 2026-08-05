import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { classroomStore, type User } from "@/lib/classroomStore";
import { loginUser, forgotPassword, resetPassword } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [step, setStep] = useState<"login" | "forgot" | "reset">("login");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
        userId: backendUser.userId || ""
      };

      classroomStore.setState(() => ({ currentUser, accessToken }));
      navigate({ to: role === "student" ? "/student/dashboard" : "/admin/dashboard" });
    } catch (err) {
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
    setIsSubmitting(true);
    try {
      const res = await forgotPassword(userId.trim());
      toast.success(res.message || "Verification code sent successfully.");
      setStep("reset");
    } catch (err) {
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
    setIsSubmitting(true);
    try {
      const res = await resetPassword(userId.trim(), otp.trim(), newPassword);
      toast.success(res.message || "Password reset successfully!");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("login");
    } catch (err) {
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
          Welcome back,dream PG seat and your <br />
            Your <span className="bg-gold text-navy px-2 rounded"> MRB-AMO  </span>   government order are waiting to be claimed.
          </h1>
          <p className="mt-5 text-white/80 max-w-md">
         
          </p>
        </div>

        <div className="relative text-xs text-white/50">© {new Date().getFullYear()} Axon Med Academy</div>
      </div>

      {/* Right form */}
      <div className="flex-1 grid place-items-center p-6 lg:p-12 bg-light-gray">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-gold">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="font-display font-extrabold text-navy">Axon.Academy</span>
          </Link>

          <h2 className="font-display text-3xl font-extrabold text-navy">
            {step === "login" && "Sign in"}
            {step === "forgot" && "Forgot password"}
            {step === "reset" && "Reset password"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {step === "login" && "Enter your credentials to access your portal."}
            {step === "forgot" && "Enter your registered User ID or Email to receive a verification code."}
            {step === "reset" && "Enter the verification code sent to your email and your new password."}
          </p>

          {step === "login" && (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              {error && <div className="text-red-500 text-sm font-semibold p-3 bg-red-50 rounded-lg">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID/Email</label>
                <input value={userId} onChange={e => setUserId(e.target.value)} type="text" placeholder="e.g. example@gmail.com or Admin" className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" required />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-navy">Password</label>
                  <a href="#" onClick={(e) => { e.preventDefault(); setError(""); setStep("forgot"); }} className="text-xs text-sky font-semibold hover:underline">Forgot?</a>
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

              <button type="submit" disabled={isSubmitting} className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? "Signing in..." : "Sign in"} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="mt-8 space-y-4">
              {error && <div className="text-red-500 text-sm font-semibold p-3 bg-red-50 rounded-lg">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID/Email</label>
                <input value={userId} onChange={e => setUserId(e.target.value)} type="text" placeholder="e.g. example@gmail.com or Admin" className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" required />
              </div>

              <button type="submit" disabled={isSubmitting} className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? "Sending code..." : "Send code"} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleResetPassword} className="mt-8 space-y-4">
              {error && <div className="text-red-500 text-sm font-semibold p-3 bg-red-50 rounded-lg">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">User ID/Email</label>
                <input value={userId} disabled className="w-full rounded-full border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-500 focus:outline-none cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">Verification Code (OTP)</label>
                <input value={otp} onChange={e => setOtp(e.target.value)} type="text" placeholder="e.g. 123456" className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">New Password</label>
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">Confirm Password</label>
                <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy" required />
              </div>

              <button type="submit" disabled={isSubmitting} className="group w-full inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? "Resetting..." : "Reset password"} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
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
              Remember your password? <button type="button" onClick={() => { setError(""); setStep("login"); }} className="font-bold text-navy hover:underline focus:outline-none">Sign in →</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
