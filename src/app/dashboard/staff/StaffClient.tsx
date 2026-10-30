"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
  Save,
  UserCog,
} from "lucide-react";
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
    color: "#93C5FD",
    bg: "rgba(96, 165, 250, 0.10)",
    border: "#93C5FD",
    phoneRequired: false,
    placeholderName: "Aamir Baig",
    placeholderEmail: "staff2@mughaldarbaar.in",
    properties: [
      "Manage Live Orders (Today's Orders & Past Week tabs across Online & Dine-In)",
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
    color: "#FBBF24",
    bg: "rgba(251, 191, 36, 0.10)",
    border: "#FCD34D",
    phoneRequired: false,
    placeholderName: "Ustad Karim",
    placeholderEmail: "chef2@mughaldarbaar.in",
    properties: [
      "Logs directly into Kitchen Live Order Board (/dashboard/orders)",
      "Systematic Today's Orders (New, Pending, Completed) & Past Week tabs",
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
    color: "#34D399",
    bg: "rgba(52, 211, 153, 0.10)",
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
    bg: "rgba(167, 139, 250, 0.10)",
    border: "#C4B5FD",
    phoneRequired: false,
    placeholderName: "Mughal Darbaar Owner",
    placeholderEmail: "owner2@mughaldarbaar.in",
    properties: [
      "Full access to all dashboard sections, reports, GST & Razorpay settings",
      "Can delete or hide past orders (Today's orders stay protected)",
      "Can add, edit & delete Staff, Chef, Rider, and Owner accounts",
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

  // Inline / Modal Edit State for Existing Team Members
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<CreatableRole>("staff");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [directoryFeedback, setDirectoryFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedConfig = ROLE_PROPERTIES[role];

  function startEditing(member: StaffMember) {
    setDirectoryFeedback(null);
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditPhone(member.phone ?? "");
    setEditRole(
      member.role === "customer" ? "staff" : (member.role as CreatableRole)
    );
    setEditPassword("");
  }

  function cancelEditing() {
    setEditingMemberId(null);
    setEditPassword("");
  }

  async function handleSaveEdit(memberId: string) {
    setDirectoryFeedback(null);
    if (editName.trim().length < 2) {
      setDirectoryFeedback({ type: "error", text: "Name must be at least 2 characters." });
      return;
    }
    if (!editEmail.includes("@")) {
      setDirectoryFeedback({ type: "error", text: "Please enter a valid email / Gmail address." });
      return;
    }
    if (editPassword.trim().length > 0 && editPassword.trim().length < 8) {
      setDirectoryFeedback({
        type: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }

    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        role: editRole,
      };
      if (editPassword.trim().length >= 8) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/dashboard/staff/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setDirectoryFeedback({
          type: "error",
          text: data.error ?? "Failed to update team member details.",
        });
        return;
      }

      setStaff((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role,
              }
            : m
        )
      );
      setEditingMemberId(null);
      setEditPassword("");
      setDirectoryFeedback({
        type: "success",
        text: `✓ Updated ${data.name} (${data.email})${
          payload.password ? " and changed password" : ""
        }.`,
      });
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteMember(member: StaffMember) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.name} (${member.role.toUpperCase()} — ${member.email})?`
    );
    if (!confirmed) return;

    setDirectoryFeedback(null);
    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/dashboard/staff/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setDirectoryFeedback({
          type: "error",
          text: data.error ?? "Failed to delete team member.",
        });
        return;
      }
      setStaff((prev) => prev.filter((m) => m.id !== member.id));
      if (editingMemberId === member.id) {
        setEditingMemberId(null);
      }
      setDirectoryFeedback({
        type: "success",
        text: `🗑️ Removed ${member.name} (${member.email}) from team directory.`,
      });
    } finally {
      setDeletingId(null);
    }
  }

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
        return { label: "🛵 RIDER", bg: "rgba(52, 211, 153, 0.10)", color: "#34D399" };
      case "chef":
        return { label: "👨‍🍳 CHEF", bg: "rgba(251, 191, 36, 0.10)", color: "#FBBF24" };
      case "staff":
        return { label: "🧑‍💼 STAFF", bg: "rgba(96, 165, 250, 0.10)", color: "#93C5FD" };
      case "owner":
        return { label: "👑 OWNER", bg: "rgba(167, 139, 250, 0.10)", color: "#7C3AED" };
      default:
        return { label: r.toUpperCase(), bg: "rgba(255, 255, 255, 0.06)", color: "#D1D5DB" };
    }
  };

  return (
    <div className={styles.page}>
      <div
        className={styles.header}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className={styles.title}>Staff, Chefs &amp; Delivery Riders</h1>
          <p className={styles.subtitle}>
            Add, edit, or delete <strong>Staff</strong>, <strong>Chefs</strong>, and{" "}
            <strong>Delivery Riders</strong>. You can update anyone&apos;s Name, Email/Gmail,
            Phone Number, Role, or Password below — and every team member can also edit their own
            details in <strong>My Account</strong>.
          </p>
        </div>
        <Link
          href="/dashboard/account"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            padding: "0.55rem 0.95rem",
            borderRadius: 10,
            background: "var(--color-surface)",
            border: "1.5px solid var(--color-border)",
            color: "var(--color-text)",
            fontSize: "0.8rem",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <UserCog size={16} /> Edit My Own Account
        </Link>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Existing Team Members with Edit & Delete */}
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
                  { key: "owner", label: "👑 Owners" },
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

          {directoryFeedback && (
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: 10,
                marginBottom: "0.85rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                background:
                  directoryFeedback.type === "success" ? "rgba(52, 211, 153, 0.10)" : "rgba(248, 113, 113, 0.10)",
                color: directoryFeedback.type === "success" ? "#34D399" : "#DC2626",
                border:
                  directoryFeedback.type === "success"
                    ? "1px solid #6EE7B7"
                    : "1px solid rgba(248, 113, 113, 0.35)",
              }}
            >
              {directoryFeedback.text}
            </div>
          )}

          {filteredStaff.length === 0 ? (
            <p className={styles.empty}>No team accounts in this category.</p>
          ) : (
            <div className={styles.list}>
              {filteredStaff.map((m) => {
                const badge = getRoleBadgeStyle(m.role);
                const isEditing = editingMemberId === m.id;
                const isDeleting = deletingId === m.id;

                return (
                  <div
                    key={m.id}
                    className={styles.row}
                    style={{
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "0.65rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
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
                          {m.phone ? ` · 📞 ${m.phone}` : " · No phone set"}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className={styles.roleBadge}
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            fontWeight: 800,
                            padding: "0.26rem 0.6rem",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                          }}
                        >
                          {badge.label}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? cancelEditing() : startEditing(m)
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.28rem 0.55rem",
                            borderRadius: 7,
                            border: "1px solid var(--color-border)",
                            background: isEditing ? "rgba(251, 191, 36, 0.16)" : "#FFFFFF",
                            color: "#E5E7EB",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Edit Name, Email/Gmail, Phone, Role or Password"
                        >
                          {isEditing ? <X size={13} /> : <Pencil size={13} />}
                          {isEditing ? "Cancel" : "Edit"}
                        </button>

                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteMember(m)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.28rem 0.55rem",
                            borderRadius: 7,
                            border: "1px solid rgba(248, 113, 113, 0.35)",
                            background: "rgba(248, 113, 113, 0.10)",
                            color: "#DC2626",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Delete Account"
                        >
                          <Trash2 size={13} />
                          {isDeleting ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    {/* Inline Editor Panel */}
                    {isEditing && (
                      <div
                        style={{
                          padding: "0.85rem",
                          borderRadius: 10,
                          background: "var(--color-surface-alt)",
                          border: "1.5px solid var(--color-primary)",
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "0.6rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--color-text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Full Name
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ marginBottom: 0, padding: "0.42rem 0.6rem", fontSize: "0.8rem" }}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--color-text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Email / Gmail (Login ID)
                          </label>
                          <input
                            type="email"
                            className="form-input"
                            style={{ marginBottom: 0, padding: "0.42rem 0.6rem", fontSize: "0.8rem" }}
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--color-text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            className="form-input"
                            placeholder="9876543210"
                            style={{ marginBottom: 0, padding: "0.42rem 0.6rem", fontSize: "0.8rem" }}
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--color-text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            Role
                          </label>
                          <select
                            className="form-input"
                            style={{ marginBottom: 0, padding: "0.42rem 0.6rem", fontSize: "0.8rem" }}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as CreatableRole)}
                          >
                            <option value="staff">🧑‍💼 Counter Staff</option>
                            <option value="chef">👨‍🍳 Kitchen Chef</option>
                            <option value="rider">🛵 Delivery Rider</option>
                            <option value="owner">👑 Owner / Admin</option>
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--color-text-muted)",
                              marginBottom: 3,
                            }}
                          >
                            New Password (Optional — leave blank to keep current password)
                          </label>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <input
                              type="password"
                              className="form-input"
                              placeholder="Enter new password (min 8 chars) to reset…"
                              style={{
                                flex: 1,
                                marginBottom: 0,
                                padding: "0.42rem 0.6rem",
                                fontSize: "0.8rem",
                              }}
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={editSaving}
                              onClick={() => handleSaveEdit(m.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                padding: "0.45rem 0.9rem",
                                borderRadius: 8,
                                border: "none",
                                background: "#059669",
                                color: "#FFFFFF",
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              <Save size={14} />
                              {editSaving ? "Saving…" : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
              background: "rgba(251, 191, 36, 0.10)",
              border: "1px solid rgba(251, 191, 36, 0.35)",
              fontSize: "0.78rem",
              color: "#FCD34D",
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

          {/* Interactive Role Selector: Staff vs Chef vs Rider vs Owner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.45rem",
              marginBottom: "0.95rem",
            }}
          >
            {(["staff", "chef", "rider", "owner"] as const).map((rKey) => {
              const cfg = ROLE_PROPERTIES[rKey];
              const active = role === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => setRole(rKey)}
                  style={{
                    padding: "0.65rem 0.4rem",
                    borderRadius: 12,
                    border: active ? `2px solid ${cfg.color}` : "1.5px solid var(--color-border)",
                    background: active ? cfg.bg : "var(--color-surface)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.22rem",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "1.35rem" }}>{cfg.emoji}</span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: active ? cfg.color : "var(--color-text)",
                    }}
                  >
                    {rKey === "staff"
                      ? "Staff"
                      : rKey === "chef"
                      ? "Chef"
                      : rKey === "rider"
                      ? "Rider"
                      : "Owner"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.64rem",
                      color: "var(--color-text-muted)",
                      lineHeight: 1.2,
                    }}
                  >
                    {rKey === "staff"
                      ? "Counter & Billing"
                      : rKey === "chef"
                      ? "Kitchen & Prep"
                      : rKey === "rider"
                      ? "Delivery & Maps"
                      : "Full Admin"}
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
                  background: "rgba(0,0,0,0.35)",
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
                color: "#E5E7EB",
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
            Email / Gmail Address (Login ID) *
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
                background: "rgba(52, 211, 153, 0.10)",
                color: "#34D399",
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
