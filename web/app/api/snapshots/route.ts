// GET /api/snapshots — ingest history (metadata only, no world blobs)
import { desc } from 'drizzle-orm';
import { db, snapshots } from '@/db';

const DEFAULT_LIMIT = 50;

export const GET = async (req: Request) => {
  const limit = Number(new URL(req.url).searchParams.get('limit')) || DEFAULT_LIMIT;
  const rows = db
    .select({
      id: snapshots.id,
      ingested_at: snapshots.ingestedAt,
      save_name: snapshots.saveName,
      saved_build: snapshots.savedBuild,
      region: snapshots.region,
      playtime_seconds: snapshots.playtimeSeconds,
      npc_count: snapshots.npcCount,
      mine_count: snapshots.mineCount,
    })
    .from(snapshots)
    .orderBy(desc(snapshots.id))
    .limit(limit)
    .all();
  return Response.json({ snapshots: rows });
};
