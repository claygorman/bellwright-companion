// POST /api/ingest — raw .sav body → Oodle-decompress (tools/dump) → parse → snapshot in SQLite
// e.g.  curl -X POST --data-binary @YourChar_auto.sav http://localhost:8710/api/ingest
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { Payload } from 'bellwright-parse/payload';
import { extractNpcs } from 'bellwright-parse/npcs';
import { extractStorage } from 'bellwright-parse/storage';
import { extractGroups } from 'bellwright-parse/groups';
import { extractGearSets } from 'bellwright-parse/gearsets';
import { extractGearPresets } from 'bellwright-parse/gearpresets';
import { db, snapshots, npcHistory, pruneSnapshots, type World } from '@/db';
import { eq } from 'drizzle-orm';

const run = promisify(execFile);
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
const DUMP_BIN =
  process.env.DUMP_BIN ??
  path.join(process.cwd(), '..', 'tools', 'dump', 'target', 'release', 'dump');
const SAVE_MAGIC = 'VSWB';
const MIN_SAVE_BYTES = 0x800;
// optional retention: keep only the newest N snapshots (unset = keep all)
const SNAPSHOT_KEEP = Number(process.env.SNAPSHOT_KEEP) || null;

export const POST = async (req: Request) => {
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length < MIN_SAVE_BYTES || body.toString('latin1', 0, 4) !== SAVE_MAGIC) {
    return Response.json({ error: 'not a Bellwright save (VSWB magic missing)' }, { status: 400 });
  }
  await mkdir(DATA_DIR, { recursive: true });
  const savPath = path.join(DATA_DIR, 'latest.sav');
  const payloadPath = path.join(DATA_DIR, 'payload.bin');
  await writeFile(savPath, body);
  try {
    await run(DUMP_BIN, [savPath, payloadPath]);
  } catch (e) {
    const msg = e instanceof Error ? ((e as { stderr?: string }).stderr ?? e.message) : String(e);
    return Response.json({ error: `decompress failed: ${msg}` }, { status: 500 });
  }
  const p = new Payload(await readFile(payloadPath));
  const npcs = extractNpcs(p);
  const world: World = {
    ingested_at: new Date().toISOString(),
    meta: p.meta,
    npcs,
    storage: extractStorage(p),
    groups: extractGroups(p),
    gear_sets: extractGearSets(p),
    gear_presets: extractGearPresets(p),
  };
  const mine = npcs.filter(n => n.is_player_npc);

  const snapshotId = db.transaction(tx => {
    const row = tx
      .insert(snapshots)
      .values({
        ingestedAt: world.ingested_at,
        saveName: p.meta.saveName,
        savedBuild: p.meta.savedBuild,
        region: p.meta.region,
        playtimeSeconds: p.meta.playtimeSeconds,
        npcCount: npcs.length,
        mineCount: mine.length,
        world,
      })
      // identical save+playtime re-pushed → refresh in place instead of duplicating
      .onConflictDoUpdate({
        target: [snapshots.saveName, snapshots.playtimeSeconds],
        set: { ingestedAt: world.ingested_at, world, npcCount: npcs.length, mineCount: mine.length },
      })
      .returning({ id: snapshots.id })
      .get();
    tx.delete(npcHistory).where(eq(npcHistory.snapshotId, row.id)).run();
    if (mine.length > 0) {
      tx.insert(npcHistory)
        .values(
          mine.map(n => ({
            snapshotId: row.id,
            guid: n.guid ?? `${n.first_name} ${n.last_name}`,
            name: [n.first_name, n.last_name].filter(Boolean).join(' '),
            morale: n.morale,
            injuries: n.injuries,
            skills: n.skills,
            equipment: n.equipment,
            jobPriorities: n.job_priorities,
          })),
        )
        .run();
    }
    return row.id;
  });

  if (SNAPSHOT_KEEP != null) pruneSnapshots(SNAPSHOT_KEEP);

  return Response.json({
    ok: true,
    snapshot_id: snapshotId,
    save: p.meta.saveName,
    build: p.meta.savedBuild,
    npcs: npcs.length,
    mine: mine.length,
  });
};
