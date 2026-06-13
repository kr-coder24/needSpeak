import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/needspeak-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — NeedSpeak" },
      {
        name: "description",
        content: "Sign in to NeedSpeak to save your carts and preferences.",
      },
    ],
  }),
  component: LoginPage,
});

/* ═══════════════════════════════════════════════════════════════════════════
 *  Password strength engine
 * ═══════════════════════════════════════════════════════════════════════════ */
type PasswordStrength = {
  score: number; // 0-4
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
};

function analyzePassword(pw: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", passed: pw.length >= 8 },
    { label: "Uppercase letter", passed: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", passed: /[a-z]/.test(pw) },
    { label: "Number", passed: /\d/.test(pw) },
    { label: "Special character", passed: /[^A-Za-z0-9]/.test(pw) },
  ];

  const score = checks.filter((c) => c.passed).length;

  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  const colors = [
    "bg-destructive",
    "bg-destructive/70",
    "bg-yellow-500",
    "bg-success",
    "bg-success",
  ];

  return {
    score: Math.max(0, score - 1), // 0-4
    label: labels[Math.max(0, score - 1)] ?? "Very weak",
    color: colors[Math.max(0, score - 1)] ?? "bg-destructive",
    checks,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Auth helpers (localStorage session)
 * ═══════════════════════════════════════════════════════════════════════════ */
const AUTH_KEY = "needspeak-auth";

export function getStoredAuth(): { token: string; user: any } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: any) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Google Auth (using Google Identity Services)
 * ═══════════════════════════════════════════════════════════════════════════ */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main Component
 * ═══════════════════════════════════════════════════════════════════════════ */
function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailChecked, setEmailChecked] = useState<boolean | null>(null);
  const [shakeError, setShakeError] = useState(false);

  // Password strength (only for signup)
  const passwordStrength = useMemo(() => analyzePassword(password), [password]);

  // If already logged in, redirect
  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.token) {
      navigate({ to: "/chat" });
    }
  }, [navigate]);

  // Debounced email check
  useEffect(() => {
    if (mode !== "signup" || !email || email.length < 5 || !email.includes("@")) {
      setEmailChecked(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setEmailChecked(data.exists);
      } catch {
        setEmailChecked(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email, mode]);

  // Load Google Identity Services script
  useEffect(() => {
    if (document.getElementById("google-gsi-script")) return;
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Render Google button when script is loaded
  useEffect(() => {
    const interval = setInterval(() => {
      const container = document.getElementById("google-signin-btn");
      if (window.google && container) {
        clearInterval(interval);
        window.google.accounts.id.initialize({
          client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: "100%",
          text: mode === "login" ? "signin_with" : "signup_with",
          shape: "rectangular",
          logo_alignment: "center",
        });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [mode]);

  const handleGoogleResponse = async (response: any) => {
    setLoading(true);
    setError("");
    try {
      // Decode JWT to get user info
      const payload = JSON.parse(atob(response.credential.split(".")[1]));

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          name: payload.name,
          avatar_url: payload.picture || "",
          google_id: payload.sub,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Google sign-in failed");

      storeAuth(data.token, data.user);
      setSuccess("Signed in with Google!");
      setTimeout(() => navigate({ to: "/chat" }), 800);
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!email || !password) {
      triggerShake("Please fill in all fields.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        triggerShake("Please enter your name.");
        return;
      }
      if (password.length < 8) {
        triggerShake("Password must be at least 8 characters.");
        return;
      }
      if (passwordStrength.score < 2) {
        triggerShake("Password is too weak. Add uppercase, numbers, or symbols.");
        return;
      }
      if (emailChecked === true) {
        triggerShake("This email is already registered. Try signing in.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, name };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.detail?.message || "Something went wrong");
      }

      storeAuth(data.token, data.user);
      setSuccess(data.message || "Welcome!");
      setTimeout(() => navigate({ to: "/chat" }), 800);
    } catch (e: any) {
      triggerShake(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = (msg: string) => {
    setError(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setSuccess("");
    setPassword("");
    setEmailChecked(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-surface/50 border-r border-border p-12">
        <div className="flex-1 flex flex-col justify-center space-y-12">
          <div className="space-y-6">
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="font-display text-6xl font-bold tracking-tight uppercase">
                NEEDSPEAK
              </span>
            </Link>

            <h2 className="font-display text-4xl font-semibold tracking-tight leading-tight">
              Context becomes cart.
              <br />
              <span className="text-brand">Instantly.</span>
            </h2>
          </div>

          <div className="space-y-5">
            {[
              {
                icon: Sparkles,
                title: "AI-Powered Shopping",
                desc: "Paste text, URLs, or recipes — get an instant cart.",
              },
              {
                icon: ShieldCheck,
                title: "Your Preferences, Respected",
                desc: "Dietary, brand, and budget preferences saved to your profile.",
              },
              {
                icon: User,
                title: "Collaborative Carts",
                desc: "Share carts with friends and split expenses effortlessly.",
              },
            ].map((feat) => (
              <div key={feat.title} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 rounded-lg bg-brand/10 p-2">
                  <feat.icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <div className="text-sm font-medium">{feat.title}</div>
                  <div className="text-xs text-muted-foreground">{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © 2026 NeedSpeak — Amazon HackOn
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-5xl font-bold tracking-tight uppercase">NEEDSPEAK</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to access your carts and preferences."
                : "Start shopping smarter with NeedSpeak."}
            </p>
          </div>

          {/* Google Sign-In */}
          <div className="flex justify-center">
            <div id="google-signin-btn" className="w-full" />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-muted-foreground/50"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`h-11 w-full rounded-xl border bg-card pl-10 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/50 ${
                    emailChecked === true
                      ? "border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-brand focus:ring-2 focus:ring-brand/20"
                  }`}
                  autoComplete="email"
                />
                {/* Email status icon */}
                {mode === "signup" && emailChecked !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailChecked ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <Check className="h-4 w-4 text-success" />
                    )}
                  </div>
                )}
              </div>
              {mode === "signup" && emailChecked === true && (
                <p className="text-xs text-destructive">
                  This email is already registered.{" "}
                  <button type="button" onClick={switchMode} className="underline text-brand">
                    Sign in instead?
                  </button>
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                {mode === "login" && (
                  <button type="button" className="text-xs text-brand hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min 8 characters" : "Enter your password"}
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-muted-foreground/50"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password strength meter (signup only) */}
              {mode === "signup" && password.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {/* Strength bar */}
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= passwordStrength.score
                            ? passwordStrength.color
                            : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Strength: <span className="font-medium text-foreground">{passwordStrength.label}</span>
                    </span>
                  </div>

                  {/* Check list */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {passwordStrength.checks.map((check) => (
                      <div
                        key={check.label}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {check.passed ? (
                          <Check className="h-3 w-3 text-success shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        )}
                        <span
                          className={
                            check.passed
                              ? "text-muted-foreground"
                              : "text-muted-foreground/50"
                          }
                        >
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div
                className={`flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive ${
                  shakeError ? "animate-shake" : ""
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                <Check className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="relative h-11 w-full rounded-xl bg-foreground font-medium text-background text-sm transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                  <span>{mode === "login" ? "Signing in…" : "Creating account…"}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>{mode === "login" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-medium text-brand hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-medium text-brand hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Terms */}
          <p className="text-center text-[11px] text-muted-foreground/70 leading-relaxed">
            By continuing, you agree to our{" "}
            <span className="underline cursor-pointer">Terms of Service</span> and{" "}
            <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
