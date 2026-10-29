"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import styles from "./login.module.css";
import { restaurantConfig } from "@/config/restaurant.config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      let target = "/dashboard";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const cb = params.get("callbackUrl");
        if (cb && cb.startsWith("/")) {
          target = cb;
        }
      }
      router.push(target);
      router.refresh();
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>
            <span>م</span>
          </div>
          <h1 className={styles.logoName}>{restaurantConfig.name}</h1>
          <p className={styles.logoSub}>Restaurant Dashboard</p>
        </div>

        <h2 className={styles.heading}>Staff, Chef &amp; Rider Login</h2>
        <p className={styles.subheading}>
          Sign in with your Owner, Counter Staff, Kitchen Chef, or Delivery Rider credentials.
        </p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email Address</label>
            <div className={styles.inputWrap}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                id="login-email"
                type="email"
                className={`form-input ${styles.inputPadded}`}
                placeholder="owner@mughaldarbaar.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <div className={styles.inputWrap}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                id="login-password"
                type={showPwd ? "text" : "password"}
                className={`form-input ${styles.inputPadded} ${styles.inputPaddedRight}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className={styles.pwdToggle}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full btn--lg"
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? (
              <span className={`animate-spin ${styles.spinner}`}>⟳</span>
            ) : (
              "Sign In to Dashboard"
            )}
          </button>
        </form>

        <p className={styles.note}>
          This login is for restaurant staff only. To place an order,{" "}
          <a href="/menu">visit the menu</a>.
        </p>
      </div>
    </div>
  );
}
