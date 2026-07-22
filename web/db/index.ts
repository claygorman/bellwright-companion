// SQLite connection (better-sqlite3) + Drizzle instance.
// The DB lives next to the other ingest artifacts in DATA_DIR.
// Migrations under web/drizzle/ are applied idempotently on first open.
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema.ts';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
// DATABASE_URL selects the backend: file:<path> = sqlite (current),
// postgres://… = planned second dialect.
const DATABASE_URL = process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, 'bellwright.db')}`;
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), 'drizzle');

const open = () => {
  if (!DATABASE_URL.startsWith('file:')) {
    throw new Error(
      `unsupported DATABASE_URL "${DATABASE_URL}" — only sqlite (file:…) is wired up; postgres dialect is planned`,
    );
  }
  const dbFile = path.resolve(DATABASE_URL.slice('file:'.length));
  mkdirSync(path.dirname(dbFile), { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(dbFile);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON'); // npc_history cascades on snapshot delete
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
};

/** Keep only the newest `keep` snapshots (npc_history rows cascade). */
export const pruneSnapshots = (keep: number): number => {
  if (!Number.isFinite(keep) || keep < 1) return 0;
  const result = db.run(sql`
    DELETE FROM snapshots WHERE id NOT IN (
      SELECT id FROM snapshots ORDER BY id DESC LIMIT ${keep}
    )`);
  return result.changes;
};

// Lazy open on first use (a build-time import must not touch the database),
// reused across Next.js hot reloads / route module instances.
type Db = ReturnType<typeof open>;
const globalForDb = globalThis as unknown as { __bellwrightDb?: Db };
export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    const real = (globalForDb.__bellwrightDb ??= open());
    const value = Reflect.get(real, prop) as unknown;
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export * from './schema.ts';
