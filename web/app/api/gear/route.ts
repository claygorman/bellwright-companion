// GET /api/gear — kit coverage from custom gear presets + armory assignments,
// equipped items, storage counts, and optional flat reserve targets
// (DATA_DIR/kits.json):
//   { "reserves": { "RoundShield_C": 4, "NomadHelm_C": 2, ... } }
//
// Craft targets use each preset's best tier-unlocked item per slot (highest
// rank that's in storage or equipped by 2+ villagers), so the list tracks the
// tier the player actually produces — a lone quest gift or loot drop doesn't
// set the squad's target, and upgrades surface once a tier reaches storage.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { desc } from 'drizzle-orm';
import { db, snapshots } from '@/db';
import type { GearPreset, Npc } from '@/lib/types';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
const KITS_FILE = process.env.KITS_FILE ?? path.join(DATA_DIR, 'kits.json');

// gear slots that count toward kit planning (consumables food/meds excluded)
const GEAR_SLOTS = ['weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'backpack'];
// preset slot -> worn-equipment slot (shield sits in the offhand)
const WORN_SLOT: Record<string, string> = Object.fromEntries(
  GEAR_SLOTS.map(s => [s, s === 'shield' ? 'offhand' : s]),
);

export const GET = async () => {
  const latest = db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1).get();
  if (!latest) return Response.json({ error: 'no world ingested yet' }, { status: 404 });
  const w = latest.world;

  let reserves: Record<string, number> = {};
  try {
    reserves = JSON.parse(await readFile(KITS_FILE, 'utf8')).reserves ?? {};
  } catch { /* no kits.json — reserves default to 0 */ }

  const mine: Npc[] = (w.npcs ?? []).filter(n => n.is_player_npc);
  const presets: GearPreset[] = w.gear_presets ?? [];
  const presetByKey = new Map(presets.map(p => [p.key, p]));
  const armory = w.gear_sets ?? {}; // npc guid -> item classes (built-in preset users)
  const stored: Record<string, number> = w.storage?.totals ?? {};

  const equipped: Record<string, number> = {};
  for (const n of mine) {
    for (const cls of Object.values(n.equipment ?? {})) equipped[cls] = (equipped[cls] ?? 0) + 1;
  }
  // an item is part of the player's fielded tier only when it's in storage
  // or equipped by 2+ villagers — a single equipped copy is usually a quest
  // gift or loot one-off, and shouldn't set the craft target for the squad
  const tierUnlocked = (cls: string) => (stored[cls] ?? 0) > 0 || (equipped[cls] ?? 0) >= 2;

  // preset-level effective pick per slot: best-ranked tier-unlocked item;
  // falls back to the top-ranked (ideal) item when none qualify
  const picksOf = (p: GearPreset): Record<string, string> => {
    const picks: Record<string, string> = {};
    for (const slot of GEAR_SLOTS) {
      const ranked = p.slots[slot];
      if (!ranked?.length) continue;
      picks[slot] = (ranked.find(r => tierUnlocked(r.item)) ?? ranked[0]).item;
    }
    return picks;
  };
  const presetPicks = new Map(presets.map(p => [p.key, picksOf(p)]));

  // demand per item: custom-preset NPCs want their preset's picks; everyone
  // else falls back to their armory assignment entries. A worn item that
  // isn't in the preset's ranked list at all is a manual override (players
  // hand-equip gear above their preset tiers) — that slot is covered, skip it.
  const need: Record<string, number> = {};
  const npcName = (n: Npc) => [n.first_name, n.last_name].filter(Boolean).join(' ');
  const members = new Map<string, { guid: string | null; name: string }[]>();
  const overridden = (preset: GearPreset, slot: string, worn: string | null) =>
    worn != null && !(preset.slots[slot] ?? []).some(r => r.item === worn);
  const rankOf = (preset: GearPreset, slot: string, cls: string | null) =>
    (preset.slots[slot] ?? []).find(r => r.item === cls)?.rank ?? -1;
  // slot already satisfied: worn item ranks at or above the effective pick
  // (covers the quest-gift case — one NPC wearing above the fielded tier)
  const satisfied = (preset: GearPreset, slot: string, worn: string | null, pick: string) =>
    worn != null && rankOf(preset, slot, worn) >= rankOf(preset, slot, pick);
  for (const n of mine) {
    const preset = n.gear_preset ? presetByKey.get(n.gear_preset) : undefined;
    if (preset) {
      members.set(preset.key, [...(members.get(preset.key) ?? []), { guid: n.guid, name: npcName(n) }]);
      for (const [slot, cls] of Object.entries(presetPicks.get(preset.key) ?? {})) {
        const worn = n.equipment?.[WORN_SLOT[slot]] ?? null;
        if (overridden(preset, slot, worn) || satisfied(preset, slot, worn, cls)) continue;
        need[cls] = (need[cls] ?? 0) + 1;
      }
    } else {
      for (const cls of armory[n.guid ?? ''] ?? []) need[cls] = (need[cls] ?? 0) + 1;
    }
  }

  // item table: target = max(need, equipped) + reserve; have = equipped + stored
  const itemCls = new Set([...Object.keys(need), ...Object.keys(reserves), ...Object.keys(equipped)]);
  const items = [...itemCls]
    .map(cls => {
      const e = equipped[cls] ?? 0;
      const target = Math.max(need[cls] ?? 0, e) + (reserves[cls] ?? 0);
      const have = e + (stored[cls] ?? 0);
      return {
        item: cls, need: need[cls] ?? 0, equipped: e, stored: stored[cls] ?? 0,
        reserve: reserves[cls] ?? 0, target, have, deficit: target - have,
      };
    })
    .filter(x => x.target > 0)
    .sort((a, b) => b.deficit - a.deficit || b.target - a.target);
  const craft = items.filter(x => x.deficit > 0);

  // re-equip: the preset's pick is sitting in storage but the NPC wears
  // something else in that slot
  const reequip: { name: string; slot: string; worn: string | null; pick: string }[] = [];
  for (const n of mine) {
    const preset = n.gear_preset ? presetByKey.get(n.gear_preset) : undefined;
    const picks = preset ? presetPicks.get(preset.key) : undefined;
    if (!preset || !picks) continue;
    for (const [slot, pick] of Object.entries(picks)) {
      const worn = n.equipment?.[WORN_SLOT[slot]] ?? null;
      if (overridden(preset, slot, worn) || satisfied(preset, slot, worn, pick)) continue;
      if (worn !== pick && (stored[pick] ?? 0) > 0) {
        reequip.push({ name: npcName(n), slot, worn, pick });
      }
    }
  }

  return Response.json(
    {
      presets: presets.map(p => ({
        key: p.key, name: p.name,
        members: members.get(p.key) ?? [],
        picks: presetPicks.get(p.key) ?? {},
        slots: p.slots,
      })),
      craft,
      items,
      reequip,
      has_reserves: Object.keys(reserves).length > 0,
      kits_file: KITS_FILE,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
};
