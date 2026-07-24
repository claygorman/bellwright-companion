// GET /api/trends/item?name=Wheat — full stored-quantity history for ONE item
// across all snapshots (the top-8 chart in /api/trends can't cover everything).
//
// PERF: uses SQLite json_extract to pull ONLY that item's number out of each
// row's `world` JSON in C — it never deserializes the ~600-NPC world into JS,
// so switching items stays fast even with ~1000 snapshots.
import { sql } from 'drizzle-orm';
import { db } from '@/db';

const MAX_POINTS = 240;

export const GET = async (req: Request) => {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return Response.json({ error: 'name query param required' }, { status: 400 });

  // build a safe JSON path: $.storage.totals."<item>" (item ids are alnum;
  // strip quotes/backslashes defensively). Path is bound as a parameter.
  const jsonPath = `$.storage.totals."${name.replace(/["\\]/g, '')}"`;
  const rows = db.all(sql`
    SELECT id,
           playtime_seconds AS playtime,
           ingested_at AS ingested_at,
           json_extract(world, ${jsonPath}) AS qty
    FROM snapshots
    ORDER BY id ASC
  `) as { id: number; playtime: number | null; ingested_at: string; qty: number | null }[];

  const stride = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const points = rows
    .filter((_, i) => i % stride === 0 || i === rows.length - 1)
    .map(r => ({ playtime: r.playtime ?? 0, ingested_at: r.ingested_at, qty: r.qty ?? 0 }));

  return Response.json({ name, points }, { headers: { 'cache-control': 'no-store' } });
};
