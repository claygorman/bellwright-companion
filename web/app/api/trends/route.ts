// GET /api/trends — time series + session deltas computed from snapshot
// history. Powers the Trends tab: storage runway, morale/XP movement, and
// per-item production rates the game itself never shows.
import { asc } from 'drizzle-orm';
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
  const rows = db.select().from(snapshots).orderBy(asc(snapshots.id)).all();
  if (rows.length === 0) return Response.json({ points: [], deltas: null });

  // pick top items by the LATEST snapshot's storage totals
  const latest = rows[rows.length - 1].world;
  const latestTotals: Record<string, number> = latest.storage?.totals ?? {};
  const topItems = Object.entries(latestTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ITEMS)
    .map(([k]) => k);

  const stride = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const sampled = rows.filter((_, i) => i % stride === 0 || i === rows.length - 1);

  const points: Point[] = sampled.map(r => {
    const w = r.world;
    const mine = (w.npcs ?? []).filter(n => n.is_player_npc);
    const morales = mine.map(n => n.morale).filter((m): m is number => m != null);
    let xp = 0;
    for (const n of mine) for (const s of Object.values(n.skills ?? {})) xp += s.xp ?? 0;
    const items: Record<string, number> = {};
    for (const k of topItems) items[k] = w.storage?.totals?.[k] ?? 0;
    return {
      snapshot_id: r.id,
      ingested_at: r.ingestedAt,
      playtime: r.playtimeSeconds ?? 0,
      avg_morale: morales.length ? morales.reduce((a, m) => a + m, 0) / morales.length : null,
      injured: mine.filter(n => n.injuries?.length > 0).length,
      villagers: mine.length,
      items,
      skill_xp_total: xp,
    };
  });

  // session deltas: last snapshot vs the previous DIFFERENT playtime day-ish
  // (compare newest against the oldest snapshot within the trailing session,
  // approximated as the first snapshot of the latest contiguous play block)
  const first = rows[0], last = rows[rows.length - 1];
  const hours = ((last.playtimeSeconds ?? 0) - (first.playtimeSeconds ?? 0)) / 3600;

  const wf = first.world, wl = last.world;
  const itemDelta: Record<string, { from: number; to: number; delta: number; perHour: number | null }> = {};
  const keys = new Set([...Object.keys(wf.storage?.totals ?? {}), ...Object.keys(wl.storage?.totals ?? {})]);
  for (const k of keys) {
    const from = wf.storage?.totals?.[k] ?? 0;
    const to = wl.storage?.totals?.[k] ?? 0;
    if (from === to) continue;
    itemDelta[k] = {
      from, to, delta: to - from,
      perHour: hours >= RATE_MIN_HOURS ? (to - from) / hours : null,
    };
  }

  // per-villager XP movement (by guid)
  const xpByGuid = (w: typeof wf) => {
    const m = new Map<string, { name: string; xp: number }>();
    for (const n of (w.npcs ?? []).filter(n => n.is_player_npc)) {
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
    deltas: {
      from_snapshot: first.id,
      to_snapshot: last.id,
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
