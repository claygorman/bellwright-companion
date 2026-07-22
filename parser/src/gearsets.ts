// Extract assigned gear sets (the in-game gear-preset assignments) from
// MistTownHouseComponent entries: body.f2 = repeated { f1: NPC GUID (4xu32),
// f3*: { f1: slot, f2: { f1: item class } } }. Verified live 2026-07-21
// against a hand-maintained preset table (Marksman/Ftm-Spear kits matched,
// including already-applied upgrade tiers).
import { first, all } from './wire.ts';
import type { Payload } from './payload.ts';

export type GearSets = Record<string, string[]>; // npc guid (hex) -> item classes

export const extractGearSets = (p: Payload): GearSets => {
  const keyToGuid = new Map<string, string>();
  for (const region of p.actors) {
    const fs = p.fields(region);
    let guid: string | null = null;
    for (const x of fs ?? []) if (x.f === 1 && x.kind === 'len') guid = p.string(x.v);
    if (!guid) continue;
    const b = Buffer.from(guid, 'hex');
    if (b.length !== 16) continue;
    keyToGuid.set(
      [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)].join(','),
      guid,
    );
  }

  const sets: GearSets = {};
  for (const region of p.components) {
    const fs = p.fields(region);
    const f2 = first(fs, 2, 'len');
    if (!f2) continue;
    let cls: string | null = null, body: { off: number; len: number } | null = null;
    for (const x of p.fields(f2.v) ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 1 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 2 && y.kind === 'len') body = y.v;
        }
      }
    }
    if (cls !== 'MistTownHouseComponent' || !body) continue;
    const f2b = first(p.fields(body), 2, 'len');
    if (!f2b) continue;
    for (const entry of all(p.fields(f2b.v) ?? [], 1, 'len')) {
      const ef = p.fields(entry.v) ?? [];
      const gf = first(ef, 1, 'len');
      const u32s = (p.fields(gf?.v) ?? []).filter(y => y.kind === 'v').map(y => y.v);
      const guid = keyToGuid.get(u32s.join(','));
      if (!guid) continue;
      const items: string[] = [];
      for (const s of ef.filter(x => x.f === 3 && x.kind === 'len')) {
        const it = first(p.fields(first(p.fields(s.v), 2, 'len')?.v) ?? [], 1, 'v');
        if (it != null) {
          const n = p.baseName(it.v as number);
          if (n) items.push(n);
        }
      }
      if (items.length) sets[guid] = [...new Set([...(sets[guid] ?? []), ...items])];
    }
  }
  return sets;
};
