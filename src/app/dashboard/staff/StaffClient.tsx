"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import styles from "./staff.module.css";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "owner" | "staff" | "customer" | "rider";
  isActive: boolean;
}

export default function StaffClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "owner" | "rider">("rider");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add team member");
        return;
      }
      setStaff((prev) => [...prev, data]);
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole("rider");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Staff &amp; Delivery Riders</h1>
        <p className={styles.subtitle}>
          Create logins for delivery riders, kitchen staff, and managers. Riders log in at{" "}
          <code>/auth/login</code> to view their allotted delivery orders, navigate via maps, mark
          &ldquo;Reached&rdquo;, and record COD cash collection.
        </p>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Team &amp; Riders ({staff.length})</h2>
          {staff.length === 0 ? (
            <p className={styles.empty}>No team accounts found.</p>
          ) : (
            <div className={styles.list}>
              {staff.map((m) => (
                <div key={m.id} className={styles.row}>
                  <div>
                    <p className={styles.memberName}>
                      {m.role === "rider" ? "🛵 " : m.role === "owner" ? "👑 " : "👨‍🍳 "}
                      {m.name}
                    </p>
                    <p className={styles.memberEmail}>
                      {m.email}
                      {m.phone ? ` · 📞 ${m.phone}` : ""}
                    </p>
                  </div>
                  <span className={styles.roleBadge}>{m.role}</span>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: 10,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              fontSize: "0.8rem",
              color: "#92400E",
            }}
          >
            <strong>🛵 Default Rider Login Ready:</strong> <code>rider@mughaldarbaar.in</code> /{" "}
            <code>Rider@1234</code>
          </div>
        </section>

        <form onSubmit={handleAddStaff} className={styles.card}>
          <h2 className={styles.sectionTitle}>Add Rider or Staff Member</h2>
          <label className="form-label" htmlFor="st-name">Full Name *</label>
          <input
            id="st-name"
            className="form-input"
            required
            minLength={2}
            placeholder="Imran Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="form-label" htmlFor="st-email">Email Address (Login ID) *</label>
          <input
            id="st-email"
            type="email"
            className="form-input"
            required
            placeholder="rider2@mughaldarbaar.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="form-label" htmlFor="st-phone">Mobile Number (for customer/rider call)</label>
          <input
            id="st-phone"
            type="tel"
            className="form-input"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <label className="form-label" htmlFor="st-pwd">Password (min 8 chars) *</label>
          <input
            id="st-pwd"
            type="password"
            className="form-input"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="form-label" htmlFor="st-role">Role</label>
          <select
            id="st-role"
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value as "staff" | "owner" | "rider")}
          >
            <option value="rider">🛵 Delivery Rider (Navigation, Reached &amp; COD Collection)</option>
            <option value="staff">👨‍🍳 Staff / Chef (Orders, Menu, Offers &amp; Tables)</option>
            <option value="owner">👑 Owner (Full Access + Settings)</option>
          </select>

          {error && <p className={styles.errorText} role="alert">{error}</p>}

          <button type="submit" disabled={saving} className="btn btn--primary btn--full">
            <UserPlus size={16} /> {saving ? "Creating…" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
