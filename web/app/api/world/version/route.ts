// GET /api/world/version — cheap poll target for live refresh: just the
// latest snapshot's identity, no world blob.
import { desc } from 'drizzle-orm';
import { db, snapshots } from '@/db';

export const GET = async () => {
  const latest = db
    .select({ id: snapshots.id, ingested_at: snapshots.ingestedAt })
    .from(snapshots)
    .orderBy(desc(snapshots.id))
    .limit(1)
    .get();
  return Response.json(
    latest ? { snapshot_id: latest.id, ingested_at: latest.ingested_at } : { snapshot_id: null },
    { headers: { 'cache-control': 'no-store' } },
  );
};
