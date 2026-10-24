import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ── Connection Pool ───────────────────────────────────────────
// Works with Railway PostgreSQL, Supabase (with ?pgbouncer=true), or any pg-compatible DB.

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  "postgresql://postgres:riOKDMDImGEviFVDERSCdwCLenpcCbrT@trolley.proxy.rlwy.net:22812/railway";

const resolvedUrl = connectionString;

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
