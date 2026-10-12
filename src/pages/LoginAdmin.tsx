import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

export const LoginAdmin = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const {
    user,
    profile,
    login,
    register,
    sessionExpired,
    clearSessionExpired,
  } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (!lockoutTime) {
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);

      if (remaining <= 0) {
        setLockoutTime(null);
        setFailedAttempts(0);
        setTimeRemaining(0);
        setError("");
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockoutTime]);

  useEffect(() => {
    if (sessionExpired) {
      setError("You have been logged out due to inactivity.");
      clearSessionExpired();
    }
  }, [sessionExpired, clearSessionExpired]);

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    if (profile.status === "Active") {
      navigate("/");
    } else if (profile.status === "Pending") {
      setError("Your account is awaiting admin approval.");
    } else if (profile.status === "Rejected") {
      setError("Your account registration has been rejected.");
    }
  }, [user, profile, navigate]);

  const passwordRequirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_\-+=<>?/\[\]{}|\\:;"',.~`]/.test(password),
  };

  const validatePassword = () => {
    const requirements = passwordRequirements;

    if (!requirements.length) {
      return "Password must contain at least 12 characters.";
    }

    if (!requirements.uppercase) {
      return "Password must contain an uppercase letter.";
    }

    if (!requirements.lowercase) {
      return "Password must contain a lowercase letter.";
    }

    if (!requirements.number) {
      return "Password must contain a number.";
    }

    if (!requirements.special) {
      return "Password must contain a special character.";
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (lockoutTime) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        const validation = validatePassword();

        if (validation) {
          throw new Error(validation);
        }

        const username = email.trim().split("@")[0];

        await register(username, email.trim(), password);

        setPassword("");
        setEmail("");
        setError(
          "Registration successful! Your account is awaiting admin approval."
        );
      } else {
        await login(email.trim(), password);
        setFailedAttempts(0);
        navigate("/");
      }
    } catch (caughtError: unknown) {
      console.error("Auth Error:", caughtError);

      const authError =
        caughtError instanceof Error
          ? (caughtError as Error & { code?: string })
          : null;

      if (!isRegistering) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 5) {
          const unlockAt = Date.now() + 30000;

          setLockoutTime(unlockAt);
          setTimeRemaining(30);
          setError(
            "Security Breach Protection: Too many failed attempts. Locked for 30 seconds."
          );
          setLoading(false);
          return;
        }
      }

      let friendlyMessage =
        authError?.message ?? "Authentication failed. Please try again.";

      const errorCode =
        authError?.code ??
        (authError?.message.includes("auth/")
          ? authError.message.match(/auth\/[a-z0-9-]+/)?.[0]
          : null);

      if (errorCode === "auth/email-already-in-use") {
        friendlyMessage =
          "This account already exists. Please sign in instead.";
      } else if (errorCode === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (errorCode === "auth/weak-password") {
        friendlyMessage =
          "The password is too weak. Please use at least 12 characters.";
      } else if (
        errorCode === "auth/user-not-found" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/invalid-credential"
      ) {
        friendlyMessage =
          "Invalid credentials. Please check your username/email and password.";
      } else if (errorCode === "auth/too-many-requests") {
        friendlyMessage =
          "Too many failed attempts. Please try again later.";
      }

      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const isSuccessMessage =
    error.includes("successful") || error.includes("awaiting");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001871] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#009BDF]/20 rounded-full blur-[120px]" />

        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#0064DC]/30 rounded-full blur-[100px]" />

        <div className="absolute top-[10%] right-[5%] w-[40%] h-[40%] bg-[#7ED3F1]/10 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-2" />

          <div className="flex justify-center">
            <p className="text-xs font-black text-cd-cyan tracking-[0.4em] uppercase">
              Bridge Contract Status Portal
            </p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-4xl shadow-2xl shadow-slate-200/60 border border-slate-100 transition-all">
          {error && (
            <div
              role="alert"
              className={cn(
                "mb-6 p-4 border-2 rounded-2xl flex items-center gap-3 text-sm font-bold",
                isSuccessMessage
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                  : "bg-rose-50 border-rose-100 text-rose-700"
              )}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  !isRegistering
                    ? "bg-white text-cd-blue shadow"
                    : "text-slate-400"
                )}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  isRegistering
                    ? "bg-white text-cd-blue shadow"
                    : "text-slate-400"
                )}
              >
                Register
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-email"
                className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1"
              >
                ADMIN USERNAME
              </label>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />

                <input
                  id="admin-email"
                  type="text"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/10 focus:border-cd-blue outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder="username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-password"
                className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1"
              >
                PASSWORD
              </label>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />

                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-12 pr-20 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-cd-blue/10 focus:border-cd-blue outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                  placeholder="••••••••"
                  autoComplete={
                    isRegistering ? "new-password" : "current-password"
                  }
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-cd-blue hover:text-cd-blue/70"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>

              {isRegistering && (
                <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Password Requirements
                  </p>

                  <div className="space-y-2 text-xs font-bold">
                    <div
                      className={
                        passwordRequirements.length
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {passwordRequirements.length ? "✓" : "○"} At least 12
                      characters
                    </div>

                    <div
                      className={
                        passwordRequirements.uppercase
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {passwordRequirements.uppercase ? "✓" : "○"} One uppercase
                      letter (A-Z)
                    </div>

                    <div
                      className={
                        passwordRequirements.lowercase
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {passwordRequirements.lowercase ? "✓" : "○"} One lowercase
                      letter (a-z)
                    </div>

                    <div
                      className={
                        passwordRequirements.number
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {passwordRequirements.number ? "✓" : "○"} One number (0-9)
                    </div>

                    <div
                      className={
                        passwordRequirements.special
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      {passwordRequirements.special ? "✓" : "○"} One special
                      character
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                Boolean(lockoutTime) ||
                (isRegistering && Boolean(validatePassword()))
              }
              className={cn(
                "w-full py-5 text-white font-black rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl",
                lockoutTime
                  ? "bg-slate-400 shadow-none cursor-not-allowed"
                  : "bg-cd-blue hover:bg-cd-blue/90 shadow-cd-blue/30"
              )}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : lockoutTime ? (
                `LOCKED (${timeRemaining}s)`
              ) : isRegistering ? (
                "CREATE ADMIN ACCOUNT"
              ) : (
                "ADMIN SIGN IN"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};