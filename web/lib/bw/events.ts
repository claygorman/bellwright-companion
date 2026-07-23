// System event log: strict-validated webhook ingest + bounded storage.
// The endpoint is oauth-exempt (the reader daemon posts headlessly), so the
// payload is validated hard with Zod — whitelisted enums, slug/length caps,
// unknown keys rejected — and rendered as PLAIN TEXT in the UI (React escapes)
// so a hostile post can neither blow storage nor inject script.
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db, events } from '@/db';

export const EVENT_CAP = 500; // ring-buffer size

export const eventInput = z
  .object({
    source: z.enum(['reader', 'companion', 'publisher']),
    level: z.enum(['info', 'warn', 'error']),
    event: z.string().regex(/^[a-z0-9_]{1,64}$/, 'lowercase slug, ≤64'),
    message: z.string().min(1).max(500),
    // meta: flat map of primitives only, bounded key/value sizes
    meta: z
      .record(z.string().max(48), z.union([z.string().max(200), z.number(), z.boolean()]))
      .refine(m => Object.keys(m).length <= 20, 'meta ≤ 20 keys')
      .optional(),
    ts: z.number().int().nonnegative().optional(),
  })
  .strict();

export type EventInput = z.infer<typeof eventInput>;
export type EventRow = {
  id: number; ts: number; received_at: number;
  source: string; level: string; event: string; message: string;
  meta: Record<string, string | number | boolean> | null;
};

export const insertEvent = (e: EventInput): void => {
  const now = Date.now();
  db.insert(events)
    .values({
      ts: e.ts ?? now, receivedAt: now,
      source: e.source, level: e.level, event: e.event, message: e.message,
      meta: e.meta ?? null,
    })
    .run();
  // prune to the newest EVENT_CAP rows
  db.run(sql`DELETE FROM events WHERE id NOT IN (
    SELECT id FROM events ORDER BY id DESC LIMIT ${EVENT_CAP})`);
};

export const listEvents = (limit = 200): EventRow[] => {
  const rows = db
    .select()
    .from(events)
    .orderBy(sql`${events.receivedAt} DESC, ${events.id} DESC`)
    .limit(Math.min(Math.max(1, limit), EVENT_CAP))
    .all();
  return rows.map(r => ({
    id: r.id, ts: r.ts, received_at: r.receivedAt,
    source: r.source, level: r.level, event: r.event, message: r.message,
    meta: (r.meta as EventRow['meta']) ?? null,
  }));
};
