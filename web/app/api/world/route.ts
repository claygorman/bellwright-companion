// GET /api/world — latest parsed world state (newest snapshot in SQLite)
import { desc } from 'drizzle-orm';
import { db, snapshots } from '@/db';

export const GET = async () => {
  const latest = db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1).get();
  if (!latest) {
    return Response.json(
      { error: 'no world ingested yet — POST a .sav to /api/ingest' },
      { status: 404 },
    );
  }
  return Response.json({ snapshot_id: latest.id, ...latest.world });
};
