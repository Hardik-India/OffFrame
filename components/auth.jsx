"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Check,
} from "lucide-react";
import { BrandHeader, Reels, Footer } from "./brand";
export async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.error || "Something went wrong. Please try again.",
    );
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
export function PasswordField() {
  const [show, setShow] = useState(false);
  return (
    <label>
      Password
      <div className="password-wrap">
        <input
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={8}
          maxLength={72}
          placeholder="At least 8 characters"
          autoComplete="current-password"
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
    </label>
  );
}
export default function Auth({ mode }) {
  const register = mode === "register",
    admin = mode === "admin";
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (
      register &&
      new URLSearchParams(window.location.search).get("reason") ===
        "register-first"
    )
      setError("Please register first to create your participant account.");
  }, [register]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMissing(false);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (register && step === 1) {
        await api("auth/eligibility", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setEmail(body.email.trim().toLowerCase());
        setStep(2);
      } else {
        await api(
          admin ? "auth/admin" : register ? "auth/register" : "auth/login",
          {
            method: "POST",
            body: JSON.stringify(register ? { ...body, email } : body),
          },
        );
        window.location.assign(admin ? "/admin?view=dashboard" : "/dashboard");
      }
    } catch (err) {
      setError(err.message);
      if (err.code === "REGISTER_FIRST") {
        setMissing(true);
        router.replace("/register?reason=register-first");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <BrandHeader />
      <Reels />
      <main className="auth-main">
        <Link className="back-link" href="/">
          <ArrowLeft size={16} />
          Back to OffFrame
        </Link>
        <section className="auth-card">
          <div className="section-icon">
            {admin ? <ShieldCheck /> : <Mail />}
          </div>
          <p className="eyebrow">
            {admin
              ? "ORGANIZER ACCESS"
              : register
                ? "JOIN THE EXPERIENCE"
                : "YOUR NEXT GREAT FRAME"}
          </p>
          <h1>
            {admin
              ? "Admin portal"
              : register
                ? step === 1
                  ? "Your story starts here."
                  : "Make it yours."
                : "Welcome back."}
          </h1>
          <p className="muted">
            {admin
              ? "Sign in to manage the event and explore every submission."
              : register
                ? step === 1
                  ? "Use the email address you provided when registering for the event."
                  : "Complete your participant profile to enter OffFrame."
                : "Sign in to your OffFrame participant space."}
          </p>
          {register && (
            <div className="steps">
              <span className="active">
                {step > 1 ? <Check size={14} /> : "01"} Check email
              </span>
              <i />
              <span className={step === 2 ? "active" : ""}>
                02 Your profile
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
              {missing && (
                <Link href="/register">
                  Register first <ArrowRight size={15} />
                </Link>
              )}
            </div>
          )}
          <form onSubmit={submit}>
            {admin ? (
              <label>
                Username
                <input
                  name="username"
                  required
                  autoComplete="username"
                  placeholder="Admin username"
                />
              </label>
            ) : register && step === 2 ? (
              <div className="verified-email">
                <Check size={16} />
                {email}
                <button type="button" onClick={() => setStep(1)}>
                  Change
                </button>
              </div>
            ) : (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@college.edu"
                />
              </label>
            )}
            {register && step === 2 && (
              <>
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your name, as it should appear on your ID"
                  />
                </label>
                <label>
                  College name
                  <input
                    name="college"
                    required
                    maxLength={140}
                    placeholder="Your college or university"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Year
                    <select name="year" required defaultValue="">
                      <option value="" disabled>
                        Select year
                      </option>
                      {[
                        "1st Year",
                        "2nd Year",
                        "3rd Year",
                        "4th Year",
                        "Other",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Branch
                    <input
                      name="branch"
                      required
                      maxLength={60}
                      placeholder="e.g. CSE"
                    />
                  </label>
                </div>
              </>
            )}
            {(!register || step === 2) && <PasswordField />}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? step === 1
                    ? "Check eligibility"
                    : "Create my account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {admin ? (
              <Link href="/login">Looking for student login?</Link>
            ) : register ? (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            ) : (
              <>
                New to OffFrame?{" "}
                <Link href="/register">Register as Student</Link>
              </>
            )}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
