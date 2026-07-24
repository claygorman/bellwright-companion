// GET /api/trends — time series + session deltas computed from snapshot
// history. Powers the Trends tab: storage runway, morale/XP movement, and
// per-item production rates the game itself never shows.
//
// PERF: the snapshot `world` JSON is large (~600 NPCs each) and history can be
// ~1000 rows, so we DON'T load every world. We first read lightweight metadata
// (id/playtime — no world), sample down to MAX_POINTS, then hydrate the full
// world ONLY for the sampled rows (+ first/last for deltas).
import { asc, inArray } from 'drizzle-orm';
import { db, snapshots } from '@/db';

const MAX_POINTS = 120;           // chart resolution cap
const TOP_ITEMS = 8;              // most-stocked items to chart
const RATE_MIN_HOURS = 0.25;      // need at least this much playtime to rate

type Point = {
  snapshot_id: number;
  ingested_at: string;
  playtime: number;
  avg_morale: number | null;
  injured: number;
  villagers: number;
  items: Record<string, number>;  // top-item totals
  skill_xp_total: number;         // sum of xp across player NPCs (progress proxy)
};

export const GET = async () => {
  // 1) metadata only — no `world` column, so this stays cheap as history grows
  const meta = db.select({
    id: snapshots.id,
    playtime: snapshots.playtimeSeconds,
    ingestedAt: snapshots.ingestedAt,
  }).from(snapshots).orderBy(asc(snapshots.id)).all();
  if (meta.length === 0) return Response.json({ points: [], deltas: null });

  // 2) sample, then hydrate full worlds ONLY for the rows we chart + endpoints
  const stride = Math.max(1, Math.ceil(meta.length / MAX_POINTS));
  const sampledMeta = meta.filter((_, i) => i % stride === 0 || i === meta.length - 1);
  const firstId = meta[0].id, lastId = meta[meta.length - 1].id;
  const wantIds = [...new Set([...sampledMeta.map(m => m.id), firstId, lastId])];
  const full = db.select().from(snapshots).where(inArray(snapshots.id, wantIds)).all();
  const worldById = new Map(full.map(r => [r.id, r.world]));

  // pick top items by the LATEST snapshot's storage totals
  const latest = worldById.get(lastId);
  const latestTotals: Record<string, number> = latest?.storage?.totals ?? {};
  const topItems = Object.entries(latestTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ITEMS)
    .map(([k]) => k);

  // items for the "item over time" picker: union over the loaded (sampled)
  // worlds — free (already parsed) and plenty for a chooser
  const allItemsSet = new Set<string>();
  for (const w of worldById.values()) for (const k of Object.keys(w.storage?.totals ?? {})) allItemsSet.add(k);
  const all_items = [...allItemsSet].sort();

  const points: Point[] = sampledMeta.map(m => {
    const w = worldById.get(m.id);
    const mine = (w?.npcs ?? []).filter(n => n.is_player_npc);
    const morales = mine.map(n => n.morale).filter((m): m is number => m != null);
    let xp = 0;
    for (const n of mine) for (const s of Object.values(n.skills ?? {})) xp += s.xp ?? 0;
    const items: Record<string, number> = {};
    for (const k of topItems) items[k] = w?.storage?.totals?.[k] ?? 0;
    return {
      snapshot_id: m.id,
      ingested_at: m.ingestedAt,
      playtime: m.playtime ?? 0,
      avg_morale: morales.length ? morales.reduce((a, x) => a + x, 0) / morales.length : null,
      injured: mine.filter(n => n.injuries?.length > 0).length,
      villagers: mine.length,
      items,
      skill_xp_total: xp,
    };
  });

  // session deltas: newest vs oldest tracked snapshot
  const hours = ((meta[meta.length - 1].playtime ?? 0) - (meta[0].playtime ?? 0)) / 3600;
  const wf = worldById.get(firstId), wl = worldById.get(lastId);
  const itemDelta: Record<string, { from: number; to: number; delta: number; perHour: number | null }> = {};
  const keys = new Set([...Object.keys(wf?.storage?.totals ?? {}), ...Object.keys(wl?.storage?.totals ?? {})]);
  for (const k of keys) {
    const from = wf?.storage?.totals?.[k] ?? 0;
    const to = wl?.storage?.totals?.[k] ?? 0;
    if (from === to) continue;
    itemDelta[k] = {
      from, to, delta: to - from,
      perHour: hours >= RATE_MIN_HOURS ? (to - from) / hours : null,
    };
  }

  // per-villager XP movement (by guid)
  const xpByGuid = (w: typeof wf) => {
    const m = new Map<string, { name: string; xp: number }>();
    for (const n of (w?.npcs ?? []).filter(n => n.is_player_npc)) {
      let xp = 0;
      for (const s of Object.values(n.skills ?? {})) xp += s.xp ?? 0;
      m.set(n.guid ?? `${n.first_name} ${n.last_name}`, {
        name: [n.first_name, n.last_name].filter(Boolean).join(' '), xp,
      });
    }
    return m;
  };
  const a = xpByGuid(wf), b = xpByGuid(wl);
  const movers = [...b.entries()]
    .map(([g, v]) => ({ name: v.name, gained: v.xp - (a.get(g)?.xp ?? v.xp) }))
    .filter(x => x.gained > 0)
    .sort((x, y) => y.gained - x.gained);

  return Response.json({
    points,
    top_items: topItems,
    all_items,
    deltas: {
      from_snapshot: firstId,
      to_snapshot: lastId,
      hours_played: hours,
      items: Object.fromEntries(Object.entries(itemDelta)
        .sort((x, y) => Math.abs(y[1].delta) - Math.abs(x[1].delta)).slice(0, 20)),
      xp_movers: movers.slice(0, 12),
      idle_villagers: [...b.entries()]
        .filter(([g, v]) => (v.xp - (a.get(g)?.xp ?? v.xp)) === 0 && a.has(g))
        .map(([, v]) => v.name),
    },
  }, { headers: { 'cache-control': 'no-store' } });
};
