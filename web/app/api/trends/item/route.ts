// GET /api/trends/item?name=Wheat — full stored-quantity history for ONE item
// across all snapshots (the top-8 chart in /api/trends can't cover everything).
import { asc } from 'drizzle-orm';
import { db, snapshots } from '@/db';

const MAX_POINTS = 240;

export const GET = async (req: Request) => {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return Response.json({ error: 'name query param required' }, { status: 400 });

  const rows = db.select().from(snapshots).orderBy(asc(snapshots.id)).all();
  const stride = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const points = rows
    .filter((_, i) => i % stride === 0 || i === rows.length - 1)
    .map(r => ({
      playtime: r.playtimeSeconds ?? 0,
      ingested_at: r.ingestedAt,
      qty: r.world.storage?.totals?.[name] ?? 0,
    }));

  return Response.json({ name, points }, { headers: { 'cache-control': 'no-store' } });
};
