import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ── Connection Pool ───────────────────────────────────────────
// Works with Railway PostgreSQL, Supabase (with ?pgbouncer=true), or any pg-compatible DB.

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Add it to your Railway/Vercel environment variables."
  );
}

// In development, use a fallback so the dev server can start without a DB
const resolvedUrl = connectionString || "postgresql://postgres:password@localhost:5432/restaurant_dev";

// Use a singleton pool in development to avoid connection exhaustion from hot reload
const globalForPg = globalThis as unknown as { pgPool?: Pool };

const isLocalOrInternalDb =
  resolvedUrl.includes("localhost") ||
  resolvedUrl.includes("127.0.0.1") ||
  resolvedUrl.includes(".railway.internal");

const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: resolvedUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    ssl: isLocalOrInternalDb ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export const db = drizzle(pool, { schema });

export type DB = typeof db;
