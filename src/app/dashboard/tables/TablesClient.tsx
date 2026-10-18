"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Plus, Printer, RefreshCw, Users, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import styles from "./tables.module.css";

export interface TableRow {
  id: string;
  name: string;
  capacity: number;
  qrToken: string;
  isActive: boolean;
  hasOpenSession: boolean;
}

export default function TablesClient({
  initialTables,
  restaurantName,
  baseUrl,
}: {
  initialTables: TableRow[];
  restaurantName: string;
  baseUrl: string;
}) {
  const [tables, setTables] = useState<TableRow[]>(initialTables);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCap, setNewCap] = useState("4");
  const [creating, setCreating] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : baseUrl;

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/dashboard/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          capacity: Number(newCap) || 4,
          sortOrder: tables.length + 1,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTables((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            capacity: created.capacity,
            qrToken: created.qrToken ?? "",
            isActive: created.isActive,
            hasOpenSession: false,
          },
        ]);
        setNewName("");
        setNewCap("4");
        setShowAdd(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function patchTable(
    tableId: string,
    payload: { isActive?: boolean; regenerateToken?: boolean; closeSession?: boolean }
  ) {
    setBusyId(tableId);
    try {
      const res = await fetch(`/api/dashboard/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setTables((prev) =>
          prev.map((t) =>
            t.id === tableId
              ? {
                  ...t,
                  isActive: updated.isActive,
                  qrToken: updated.qrToken ?? t.qrToken,
                  hasOpenSession: payload.closeSession ? false : t.hasOpenSession,
                }
              : t
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tables &amp; QR Codes</h1>
          <p className={styles.subtitle}>
            Customers scan their table&apos;s QR code to order dine-in and pay at the counter.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn--secondary btn--sm"
          >
            <Printer size={16} /> Print QR Sheet
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn btn--primary btn--sm"
          >
            <Plus size={16} /> Add Table
          </button>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No tables configured yet</p>
          <p className={styles.emptySub}>
            Click &ldquo;Add Table&rdquo; above or run <code>npm run db:seed</code> to generate 10 tables.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {tables.map((t) => {
            const qrUrl = `${origin}/t/${t.qrToken}`;
            const busy = busyId === t.id;
            return (
              <div
                key={t.id}
                className={`${styles.card} ${!t.isActive ? styles.cardInactive : ""}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.tableName}>{t.name}</h2>
                    <span className={styles.capacity}>
                      <Users size={13} /> {t.capacity} seats
                    </span>
                  </div>
                  <span
                    className={`${styles.badge} ${
                      t.hasOpenSession
                        ? styles.badgeOccupied
                        : t.isActive
                        ? styles.badgeActive
                        : styles.badgeDisabled
                    }`}
                  >
                    {t.hasOpenSession ? "Occupied" : t.isActive ? "Active" : "Disabled"}
                  </span>
                </div>

                <div className={styles.qrBox}>
                  <div className={styles.qrInner}>
                    {t.qrToken ? (
                      <QRCode value={qrUrl} size={148} />
                    ) : (
                      <p className={styles.noToken}>No token</p>
                    )}
                  </div>
                  <p className={styles.printBrand}>{restaurantName}</p>
                  <p className={styles.printHint}>Scan to view menu &amp; order</p>
                </div>

                <div className={styles.cardActions}>
                  <a
                    href={`/t/${t.qrToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.actionBtn}
                    title="Test table QR link"
                  >
                    <ExternalLink size={14} /> Test Link
                  </a>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchTable(t.id, { regenerateToken: true })}
                    className={styles.actionBtn}
                    title="Generate a new QR token (invalidates old printed QR)"
                  >
                    <RefreshCw size={14} /> Rotate QR
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchTable(t.id, { isActive: !t.isActive })}
                    className={styles.actionBtn}
                  >
                    {t.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    {t.isActive ? "Disable" : "Enable"}
                  </button>
                </div>

                {t.hasOpenSession && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patchTable(t.id, { closeSession: true })}
                    className={styles.clearSessionBtn}
                  >
                    Close Table Session (Mark Paid at Counter)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Add Table">
          <form onSubmit={handleCreateTable} className={styles.modal}>
            <h2 className={styles.modalTitle}>Add New Table</h2>
            <label className="form-label" htmlFor="tbl-name">Table Name *</label>
            <input
              id="tbl-name"
              className="form-input"
              required
              placeholder="e.g. Table 11 or Family Booth"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <label className="form-label" htmlFor="tbl-cap">Seating Capacity *</label>
            <input
              id="tbl-cap"
              type="number"
              min={1}
              max={50}
              required
              className="form-input"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
            />
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn btn--primary btn--sm">
                {creating ? "Creating…" : "Create Table"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
