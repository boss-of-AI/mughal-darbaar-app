"use client";

import { useState } from "react";
import { UserPlus, CheckCircle2 } from "lucide-react";
import styles from "./staff.module.css";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "owner" | "staff" | "chef" | "customer" | "rider";
  isActive: boolean;
}

type CreatableRole = "staff" | "chef" | "rider" | "owner";

const ROLE_PROPERTIES: Record<
  CreatableRole,
  {
    emoji: string;
    title: string;
    subtitle: string;
    portalPath: string;
    color: string;
    bg: string;
    border: string;
    phoneRequired: boolean;
    placeholderName: string;
    placeholderEmail: string;
    properties: string[];
  }
> = {
  staff: {
    emoji: "🧑‍💼",
    title: "Counter Staff / Manager",
    subtitle: "Full Counter Billing, Order Dispatch & Offers",
    portalPath: "/dashboard/orders",
    color: "#1D4ED8",
    bg: "#EFF6FF",
    border: "#93C5FD",
    phoneRequired: false,
    placeholderName: "Aamir Baig",
    placeholderEmail: "staff2@mughaldarbaar.in",
    properties: [
      "Manage Live Orders (Online Delivery & Dine-In QR Table Sections)",
      "Allot multiple delivery orders to Delivery Riders",
      "Generate & settle Dine-In Final Total Bills (Mark Paid at Counter)",
      "Add/Edit Menu Dishes, Dish Photos & Category Offers/Coupons",
    ],
  },
  chef: {
    emoji: "👨‍🍳",
    title: "Kitchen Chef",
    subtitle: "Kitchen Order Preparation & Dish Stock Control",
    portalPath: "/dashboard/orders (Kitchen View)",
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#FCD34D",
    phoneRequired: false,
    placeholderName: "Ustad Karim",
    placeholderEmail: "chef2@mughaldarbaar.in",
    properties: [
      "Logs directly into Kitchen Live Order Board (/dashboard/orders)",
      "Sees incoming Online & Dine-In dishes, quantities, variants & cooking notes",
      "Marks orders Accepted / Preparing / Order Is Ready for serving or dispatch",
      "Can toggle dishes In Stock / Sold Out in Menu Manager (/dashboard/menu)",
      "Counter billing & rider allotment hidden to keep screen focused on kitchen",
    ],
  },
  rider: {
    emoji: "🛵",
    title: "Delivery Rider",
    subtitle: "Rider Navigation, Customer Reached Alert & COD Collection",
    portalPath: "/dashboard/rider",
    color: "#047857",
    bg: "#ECFDF5",
    border: "#6EE7B7",
    phoneRequired: true,
    placeholderName: "Imran Khan",
    placeholderEmail: "rider2@mughaldarbaar.in",
    properties: [
      "Logs directly into Delivery Rider Portal (/dashboard/rider)",
      "Appears in Staff/Admin 'Allot Rider' dropdown (supports multiple orders at once)",
      "Sees customer Name, Phone (1-click Call), Address, Dishes & COD Cash to Collect",
      "Built-in Cost-Free Maps Navigation + 'Reached Customer Location' live alert",
      "1-click 'Cash Collected & Mark Delivered' syncs payment status to everyone",
    ],
  },
  owner: {
    emoji: "👑",
    title: "Restaurant Owner / Admin",
    subtitle: "Full System Access + Settings & Revenue Reports",
    portalPath: "/dashboard",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#C4B5FD",
    phoneRequired: false,
    placeholderName: "Mughal Darbaar Owner",
    placeholderEmail: "owner2@mughaldarbaar.in",
    properties: [
      "Full access to all dashboard sections, reports, GST & Razorpay settings",
      "Can create & manage Staff, Chef, Rider, and Owner accounts",
    ],
  },
};

export default function StaffClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [roleFilter, setRoleFilter] = useState<"all" | "staff" | "chef" | "rider" | "owner">("all");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableRole>("staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedConfig = ROLE_PROPERTIES[role];

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (selectedConfig.phoneRequired && phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number for the Delivery Rider.");
      return;
    }

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
      setSuccessMsg(
        `${selectedConfig.emoji} ${data.name} created as ${selectedConfig.title} (${data.email})`
      );
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
    } finally {
      setSaving(false);
    }
  }

  const filteredStaff =
    roleFilter === "all" ? staff : staff.filter((m) => m.role === roleFilter);

  const getRoleBadgeStyle = (r: StaffMember["role"]) => {
    switch (r) {
      case "rider":
        return { label: "🛵 RIDER", bg: "#ECFDF5", color: "#047857" };
      case "chef":
        return { label: "👨‍🍳 CHEF", bg: "#FFFBEB", color: "#B45309" };
      case "staff":
        return { label: "🧑‍💼 STAFF", bg: "#EFF6FF", color: "#1D4ED8" };
      case "owner":
        return { label: "👑 OWNER", bg: "#F5F3FF", color: "#7C3AED" };
      default:
        return { label: r.toUpperCase(), bg: "#F3F4F6", color: "#374151" };
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Staff, Chefs &amp; Delivery Riders</h1>
        <p className={styles.subtitle}>
          Select whether you are adding a <strong>Staff</strong> member, a{" "}
          <strong>Chef</strong>, or a <strong>Delivery Rider</strong>. Each role automatically
          receives its own portal, permissions, and workflow properties upon login at{" "}
          <code>/auth/login</code>.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Existing Team Members */}
        <section className={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.85rem",
            }}
          >
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
              Team Directory ({filteredStaff.length})
            </h2>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              {(
                [
                  { key: "all", label: "All" },
                  { key: "staff", label: "🧑‍💼 Staff" },
                  { key: "chef", label: "👨‍🍳 Chefs" },
                  { key: "rider", label: "🛵 Riders" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleFilter(tab.key)}
                  style={{
                    padding: "0.28rem 0.6rem",
                    borderRadius: 999,
                    border:
                      roleFilter === tab.key
                        ? "1.5px solid var(--color-primary)"
                        : "1px solid var(--color-border)",
                    background:
                      roleFilter === tab.key ? "rgba(200,146,42,0.14)" : "transparent",
                    fontSize: "0.73rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <p className={styles.empty}>No team accounts in this category.</p>
          ) : (
            <div className={styles.list}>
              {filteredStaff.map((m) => {
                const badge = getRoleBadgeStyle(m.role);
                return (
                  <div key={m.id} className={styles.row}>
                    <div>
                      <p className={styles.memberName}>
                        {m.role === "rider"
                          ? "🛵 "
                          : m.role === "chef"
                          ? "👨‍🍳 "
                          : m.role === "owner"
                          ? "👑 "
                          : "🧑‍💼 "}
                        {m.name}
                      </p>
                      <p className={styles.memberEmail}>
                        {m.email}
                        {m.phone ? ` · 📞 ${m.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className={styles.roleBadge}
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        fontWeight: 800,
                        padding: "0.28rem 0.65rem",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Ready-to-Use Credentials Box */}
          <div
            style={{
              marginTop: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: 10,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              fontSize: "0.78rem",
              color: "#92400E",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <strong style={{ fontSize: "0.82rem" }}>
              🔑 Default Role Logins Ready at <code>/auth/login</code>:
            </strong>
            <div>
              • <strong>🧑‍💼 Staff:</strong> <code>staff@mughaldarbaar.in</code> /{" "}
              <code>Staff@1234</code>
            </div>
            <div>
              • <strong>👨‍🍳 Chef:</strong> <code>chef@mughaldarbaar.in</code> /{" "}
              <code>Chef@1234</code>
            </div>
            <div>
              • <strong>🛵 Rider:</strong> <code>rider@mughaldarbaar.in</code> /{" "}
              <code>Rider@1234</code>
            </div>
          </div>
        </section>

        {/* Right Column: Add Staff / Chef / Rider Form with Role Properties */}
        <form onSubmit={handleAddStaff} className={styles.card}>
          <h2 className={styles.sectionTitle}>1. Select Role to Add</h2>

          {/* Interactive 3-Card Role Selector: Staff vs Chef vs Rider */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.55rem",
              marginBottom: "0.95rem",
            }}
          >
            {(["staff", "chef", "rider"] as const).map((rKey) => {
              const cfg = ROLE_PROPERTIES[rKey];
              const active = role === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => setRole(rKey)}
                  style={{
                    padding: "0.7rem 0.5rem",
                    borderRadius: 12,
                    border: active ? `2px solid ${cfg.color}` : "1.5px solid var(--color-border)",
                    background: active ? cfg.bg : "var(--color-surface)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "1.45rem" }}>{cfg.emoji}</span>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: active ? cfg.color : "var(--color-text)",
                    }}
                  >
                    {rKey === "staff" ? "Staff" : rKey === "chef" ? "Chef" : "Rider"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.66rem",
                      color: "var(--color-text-muted)",
                      lineHeight: 1.2,
                    }}
                  >
                    {rKey === "staff"
                      ? "Counter & Billing"
                      : rKey === "chef"
                      ? "Kitchen & Prep"
                      : "Delivery & Maps"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Applied Role Properties Preview Box */}
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: 12,
              background: selectedConfig.bg,
              border: `1.5px solid ${selectedConfig.border}`,
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.4rem",
              }}
            >
              <strong style={{ fontSize: "0.84rem", color: selectedConfig.color }}>
                {selectedConfig.emoji} {selectedConfig.title} Properties Applied:
              </strong>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.18rem 0.5rem",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.8)",
                  color: selectedConfig.color,
                }}
              >
                Portal: {selectedConfig.portalPath}
              </span>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.1rem",
                fontSize: "0.75rem",
                color: "#1F2937",
                display: "flex",
                flexDirection: "column",
                gap: "0.22rem",
              }}
            >
              {selectedConfig.properties.map((prop, idx) => (
                <li key={idx}>{prop}</li>
              ))}
            </ul>
          </div>

          <h3
            style={{
              fontSize: "0.88rem",
              fontWeight: 800,
              margin: "0 0 0.65rem",
              color: "var(--color-text)",
            }}
          >
            2. Enter {selectedConfig.title} Account Details
          </h3>

          <label className="form-label" htmlFor="st-name">
            Full Name *
          </label>
          <input
            id="st-name"
            className="form-input"
            required
            minLength={2}
            placeholder={selectedConfig.placeholderName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="form-label" htmlFor="st-email">
            Email Address (Login ID) *
          </label>
          <input
            id="st-email"
            type="email"
            className="form-input"
            required
            placeholder={selectedConfig.placeholderEmail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="form-label" htmlFor="st-phone">
            Mobile Number {selectedConfig.phoneRequired ? "* (Required for Rider)" : "(Optional)"}
          </label>
          <input
            id="st-phone"
            type="tel"
            className="form-input"
            required={selectedConfig.phoneRequired}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <label className="form-label" htmlFor="st-pwd">
            Password (min 8 chars) *
          </label>
          <input
            id="st-pwd"
            type="password"
            className="form-input"
            required
            minLength={8}
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}
          {successMsg && (
            <p
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                background: "#ECFDF5",
                color: "#047857",
                fontSize: "0.8rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                margin: "0.5rem 0",
              }}
            >
              <CheckCircle2 size={15} /> {successMsg}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn btn--primary btn--full">
            <UserPlus size={16} />{" "}
            {saving ? "Creating…" : `Create ${selectedConfig.title} Account`}
          </button>
        </form>
      </div>
    </div>
  );
}
