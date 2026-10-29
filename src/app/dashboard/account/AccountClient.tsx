"use client";

import { useState } from "react";
import { UserCog, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";

interface AccountProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export default function AccountClient({ initial }: { initial: AccountProps }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleBadgeLabel =
    initial.role === "owner"
      ? "👑 Restaurant Owner (Admin)"
      : initial.role === "chef"
      ? "👨‍🍳 Kitchen Chef"
      : initial.role === "rider"
      ? "🛵 Delivery Rider"
      : "🧑‍💼 Counter Staff";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password && password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/staff/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          ...(password ? { password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update account details");
        return;
      }
      setPassword("");
      setSuccess(
        "✓ Your profile, email/Gmail, phone number, and password settings have been saved!"
      );
    } catch {
      setError("Network error while saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: 680 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.28rem 0.75rem",
            borderRadius: 999,
            background: "rgba(200, 146, 42, 0.14)",
            border: "1px solid rgba(200, 146, 42, 0.35)",
            fontSize: "0.76rem",
            fontWeight: 800,
            color: "var(--color-primary)",
            marginBottom: "0.5rem",
          }}
        >
          {roleBadgeLabel}
        </div>
        <h1 style={{ fontSize: "1.65rem", fontWeight: 800, margin: "0 0 0.35rem" }}>
          My Account &amp; Login Details
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
          Update your name, email / Gmail login ID, mobile phone number, or change your password.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 16,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>
          <label className="form-label" htmlFor="acc-name">
            <User size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Full Name *
          </label>
          <input
            id="acc-name"
            className="form-input"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="acc-email">
            <Mail size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Email / Gmail Address (Login ID) *
          </label>
          <input
            id="acc-email"
            type="email"
            className="form-input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="yourname@gmail.com"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="acc-phone">
            <Phone size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Mobile Phone Number {initial.role === "rider" ? "* (Shown to Customers & Staff)" : ""}
          </label>
          <input
            id="acc-phone"
            type="tel"
            className="form-input"
            required={initial.role === "rider"}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="acc-pwd">
            <Lock size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            New Password (leave blank to keep current password)
          </label>
          <input
            id="acc-pwd"
            type="password"
            className="form-input"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password (min 8 chars) to change…"
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              color: "#B91C1C",
              fontSize: "0.84rem",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: "#ECFDF5",
              border: "1px solid #6EE7B7",
              color: "#047857",
              fontSize: "0.84rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn--primary btn--full">
          <UserCog size={16} />
          {saving ? "Saving Changes…" : "Save Profile & Credentials"}
        </button>
      </form>
    </div>
  );
}
