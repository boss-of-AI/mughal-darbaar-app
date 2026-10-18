"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed cart shared by /menu and /checkout.
 * Prices here are DISPLAY ONLY — the server recomputes everything in POST /api/orders.
 */

export interface CartLine {
  key: string; // itemId + variantId
  itemId: string;
  name: string;
  isVegetarian: boolean;
  variantId: string | null;
  variantName: string | null;
  unitPricePaise: number;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  tableToken: string | null; // set when the customer scanned a table QR
}

const KEY = "restaurant-cart-v1";
const EMPTY: CartState = { lines: [], tableToken: null };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as CartState;
      if (Array.isArray(p.lines)) state = { lines: p.lines, tableToken: p.tableToken ?? null };
    }
  } catch {
    /* corrupt storage — start empty */
  }
}

function commit(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / private mode */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      state = EMPTY;
      load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): CartState {
  load();
  return state;
}

export const cartKey = (itemId: string, variantId: string | null) => `${itemId}:${variantId ?? "-"}`;

export const cartActions = {
  add(line: Omit<CartLine, "key" | "quantity">) {
    const key = cartKey(line.itemId, line.variantId);
    const existing = state.lines.find((l) => l.key === key);
    const lines = existing
      ? state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
      : [...state.lines, { ...line, key, quantity: 1 }];
    commit({ ...state, lines });
  },
  remove(key: string) {
    const lines = state.lines
      .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
      .filter((l) => l.quantity > 0);
    commit({ ...state, lines });
  },
  setTableToken(tableToken: string | null) {
    commit({ ...state, tableToken });
  },
  clear() {
    commit({ lines: [], tableToken: state.tableToken });
  },
};

export function useCart() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const count = s.lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalPaise = s.lines.reduce((n, l) => n + l.unitPricePaise * l.quantity, 0);
  return { ...s, count, subtotalPaise, ...cartActions };
}
