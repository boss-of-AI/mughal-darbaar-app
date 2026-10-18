"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import styles from "./staff.module.css";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "staff" | "customer";
  isActive: boolean;
}

export default function StaffClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
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
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add staff member");
        return;
      }
      setStaff((prev) => [...prev, data]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("staff");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Staff Accounts</h1>
        <p className={styles.subtitle}>
          Create logins for kitchen staff and managers. Staff can manage live orders, tables, and menu items.
        </p>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Team Members ({staff.length})</h2>
          {staff.length === 0 ? (
            <p className={styles.empty}>No staff accounts found.</p>
          ) : (
            <div className={styles.list}>
              {staff.map((m) => (
                <div key={m.id} className={styles.row}>
                  <div>
                    <p className={styles.memberName}>{m.name}</p>
                    <p className={styles.memberEmail}>{m.email}</p>
                  </div>
                  <span className={styles.roleBadge}>{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={handleAddStaff} className={styles.card}>
          <h2 className={styles.sectionTitle}>Add Staff Member</h2>
          <label className="form-label" htmlFor="st-name">Full Name *</label>
          <input
            id="st-name"
            className="form-input"
            required
            minLength={2}
            placeholder="Salim Khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="form-label" htmlFor="st-email">Email Address *</label>
          <input
            id="st-email"
            type="email"
            className="form-input"
            required
            placeholder="kitchen@mughaldarbaar.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setRole(e.target.value as "staff" | "owner")}
          >
            <option value="staff">Staff (Orders, Menu &amp; Tables)</option>
            <option value="owner">Owner (Full Access + Settings)</option>
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
