// Extract the player pawn (actor class Player_C — exactly one per save):
// skills from its MistHuman component, equipment + carried inventory from
// owner-matched components. Coins are physical OldCoin_C items, counted
// from the carried inventory. Renown lives in the opaque top-level f3
// player-state blob (base64-wrapped UE archive) — not decoded yet.
import { first, all } from './wire.ts';
import { SKILLS, EQUIP_SLOTS, Payload } from './payload.ts';
import type { Region, Skill } from './types.ts';

export type PlayerState = {
  guid: string | null;
  position: number[] | null;
  skills: Record<string, Skill>;
  equipment: Record<string, string>;
  carried: { item: string; qty: number }[];
  coins: number; // carried OldCoin_C count
  appearance: Record<string, string>;
};

const guidToU32 = (g: string): string | null => {
  const b = Buffer.from(g, 'hex');
  if (b.length !== 16) return null;
  return [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)].join(',');
};

export const extractPlayer = (p: Payload): PlayerState | null => {
  let guid: string | null = null, pos: number[] | null = null, human: Region | null = null;
  for (const region of p.actors) {
    const fs = p.fields(region) ?? [];
    let g: string | null = null, cls: string | null = null, hb: Region | null = null, xyz: number[] | null = null;
    for (const x of fs) {
      if (x.f === 1 && x.kind === 'len') g = p.string(x.v);
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 4 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 5 && y.kind === 'len') {
            const posF = first(p.fields(y.v), 2, 'len');
            const v = (p.fields(posF?.v) ?? []).filter(z => z.kind === 'f').map(z => z.v);
            if (v.length >= 3) xyz = v.slice(0, 3);
          }
          if (y.f === 2 && y.kind === 'len') {
            let cid: number | null = null, body: Region | null = null;
            for (const z of p.fields(y.v) ?? []) {
              if (z.f === 1 && z.kind === 'v') cid = z.v as number;
              if (z.f === 2 && z.kind === 'len') body = z.v;
            }
            if (cid != null && p.baseName(cid) === 'MistHuman') hb = body;
          }
        }
      }
    }
    if (cls === 'Player_C' && g) { guid = g; pos = xyz; human = hb; break; }
  }
  if (!guid) return null;

  const skills: Record<string, Skill> = {};
  const appearance: Record<string, string> = {};
  const hBody = first(p.fields(human) ?? [], 2, 'len');
  for (const x of p.fields(hBody?.v) ?? []) {
    if (x.f === 2 && x.kind === 'len') {
      const rec = Object.fromEntries((p.fields(x.v) ?? [])
        .filter(y => y.kind === 'v').map(y => [y.f, y.v]));
      const sid = rec[1] as number;
      if (sid >= 1 && sid <= 14) {
        skills[SKILLS[sid - 1]] = { level: (rec[2] as number) ?? 0, xp: (rec[3] as number) ?? 0, cap: (rec[4] as number) ?? 0 };
      }
    } else if (x.f === 5 && x.kind === 'len') {
      const kv = p.fields(x.v);
      const k = first(kv, 1, 'len'), v = first(kv, 2, 'len');
      if (k && v) appearance[p.string(k.v)] = p.string(v.v);
    }
  }

  // owner-matched components: equipment + carried containers
  const ownerKey = guidToU32(guid);
  const equipment: Record<string, string> = {};
  const carriedMap: Record<string, number> = {};
  for (const region of p.components) {
    const fs = p.fields(region) ?? [];
    const f2 = first(fs, 2, 'len'); if (!f2) continue;
    let cls: string | null = null, body: Region | null = null, owner: string | null = null;
    for (const x of p.fields(f2.v) ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 1 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 2 && y.kind === 'len') body = y.v;
        }
      } else if (x.f === 3 && x.kind === 'len') {
        owner = (p.fields(x.v) ?? []).filter(y => y.kind === 'v').map(y => y.v).join(',');
      }
    }
    if (owner !== ownerKey || !body) continue;
    if (cls === 'MistEquipmentComponent') {
      const f2b = first(p.fields(body), 2, 'len');
      for (const s of all(p.fields(f2b?.v) ?? [], 1, 'len')) {
        const sf = p.fields(s.v);
        const slot = (first(sf, 1, 'v')?.v as number) ?? 1;
        const item = first(p.fields(first(sf, 2, 'len')?.v) ?? [], 1, 'v')?.v;
        if (item != null) equipment[EQUIP_SLOTS[slot] ?? `slot_${slot}`] = p.baseName(item as number) ?? String(item);
      }
    } else if (cls === 'MistContainerComponent') {
      const inv = first(p.fields(body), 2, 'len');
      for (const s of all(p.fields(inv?.v) ?? [], 2, 'len')) {
        const sf = p.fields(s.v) ?? [];
        const count = (first(sf, 2, 'v')?.v as number) ?? 0;
        const it = first(p.fields(first(sf, 3, 'len')?.v) ?? [], 1, 'v');
        const item = it != null ? p.baseName(it.v as number) : null;
        if (item && count) carriedMap[item] = (carriedMap[item] ?? 0) + count;
      }
    }
  }
  const carried = Object.entries(carriedMap)
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => b.qty - a.qty);
  return {
    guid, position: pos, skills, equipment, carried,
    coins: carriedMap['OldCoin_C'] ?? 0, appearance,
  };
};

/** Per-NPC carried inventory: player-faction TownNpc guid (hex) -> items. */
export const extractCarried = (p: Payload): Record<string, { item: string; qty: number }[]> => {
  // hex guid by owner key for every actor
  const hexByKey = new Map<string, string>();
  for (const region of p.actors) {
    const fs = p.fields(region) ?? [];
    for (const x of fs) {
      if (x.f === 1 && x.kind === 'len') {
        const g = p.string(x.v);
        const k = g.length === 32 ? guidToU32(g) : null;
        if (k) hexByKey.set(k, g);
      }
    }
  }
  const out: Record<string, Record<string, number>> = {};
  for (const region of p.components) {
    const fs = p.fields(region) ?? [];
    const f2 = first(fs, 2, 'len'); if (!f2) continue;
    let cls: string | null = null, body: Region | null = null, owner: string | null = null;
    for (const x of p.fields(f2.v) ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 1 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 2 && y.kind === 'len') body = y.v;
        }
      } else if (x.f === 3 && x.kind === 'len') {
        owner = (p.fields(x.v) ?? []).filter(y => y.kind === 'v').map(y => y.v).join(',');
      }
    }
    if (cls !== 'MistContainerComponent' || !body || !owner) continue;
    const hex = hexByKey.get(owner);
    if (!hex) continue;
    const inv = first(p.fields(body), 2, 'len');
    for (const s of all(p.fields(inv?.v) ?? [], 2, 'len')) {
      const sf = p.fields(s.v) ?? [];
      const count = (first(sf, 2, 'v')?.v as number) ?? 0;
      const it = first(p.fields(first(sf, 3, 'len')?.v) ?? [], 1, 'v');
      const item = it != null ? p.baseName(it.v as number) : null;
      if (item && count) {
        (out[hex] ??= {})[item] = (out[hex][item] ?? 0) + count;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([g, m]) => [
      g,
      Object.entries(m).map(([item, qty]) => ({ item, qty })).sort((a, b) => b.qty - a.qty),
    ]),
  );
};
