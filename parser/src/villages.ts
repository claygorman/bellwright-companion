// Per-village state from MistNeutralVillageComponent (one per village capital).
// Decoded 2026-07-22 via the game binary's embedded protobuf descriptors
// (NeutralVillage message) + field correlation against known in-game ranks:
//   inner f11 = current Trust value      inner f12 = Trust level enum
//   inner f25 = Prosperity (liberated)   inner f5  = liberated bit
// Trust levels (EMistVillageTrustLevelEnum): 0 Stranger / 1 Associate /
// 2 Friend / 3 Protector / 4 Leader(=liberated). Village identity is matched
// by the owner actor's map position to the villager-faction centroids.
import { first } from './wire.ts';
import type { Payload } from './payload.ts';
import type { Npc } from './types.ts';

export type VillageState = {
  name: string;
  trust: number;       // current trust points
  trust_level: number; // 0 Stranger .. 4 Leader
  prosperity: number;  // 0 unless liberated
  liberated: boolean;
};

const TRUST_RANKS = ['Stranger', 'Associate', 'Friend', 'Protector', 'Leader'];
export const trustRankName = (level: number): string => TRUST_RANKS[level] ?? 'Stranger';

const ownerHex = (ints: number[]): string =>
  Buffer.concat(ints.map(v => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(v >>> 0);
    return b;
  })).toString('hex').toUpperCase();

export const extractVillages = (p: Payload, npcs: Npc[]): VillageState[] => {
  // villager-faction centroids (from NPCs that carry a home village)
  const cent: Record<string, { x: number; y: number; n: number }> = {};
  for (const v of npcs) {
    if (!v.village || !v.position) continue;
    const c = (cent[v.village] ??= { x: 0, y: 0, n: 0 });
    c.x += v.position[0]; c.y += v.position[1]; c.n++;
  }
  const centroids = Object.entries(cent).map(([name, c]) => ({ name, x: c.x / c.n, y: c.y / c.n }));

  // actor position by guid (settlement actors own the village components)
  const posByGuid = new Map<string, number[]>();
  for (const region of p.actors) {
    let guid: string | null = null, pos: number[] | null = null;
    for (const x of p.fields(region) ?? []) {
      if (x.f === 1 && x.kind === 'len') guid = p.string(x.v);
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 5 && y.kind === 'len') {
            const t = first(p.fields(y.v), 2, 'len');
            const xyz = (p.fields(t?.v) ?? []).filter(z => z.kind === 'f').map(z => z.v);
            if (xyz.length >= 2) pos = xyz;
          }
        }
      }
    }
    if (guid && pos) posByGuid.set(guid, pos);
  }

  const out: VillageState[] = [];
  for (const region of p.components) {
    const f2 = first(p.fields(region), 2, 'len');
    if (!f2) continue;
    let cls: string | null = null, body: import('./types.ts').Region | null = null, owner: number[] = [];
    for (const x of p.fields(f2.v) ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 1 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 2 && y.kind === 'len') body = y.v;
        }
      } else if (x.f === 3 && x.kind === 'len') {
        owner = (p.fields(x.v) ?? []).filter(z => z.kind === 'v').map(z => z.v);
      }
    }
    if (cls !== 'MistNeutralVillageComponent' || !body) continue;
    const inner = (p.fields(body) ?? []).find(f => f.kind === 'len');
    const num = (fn: number): number => {
      const f = (p.fields(inner?.v) ?? []).find(x => x.f === fn);
      return f ? (typeof f.v === 'number' ? f.v : 0) : 0;
    };
    const pos = posByGuid.get(ownerHex(owner));
    let name = '?';
    if (pos) {
      let best = Infinity;
      for (const c of centroids) {
        const d = (c.x - pos[0]) ** 2 + (c.y - pos[1]) ** 2;
        if (d < best) { best = d; name = c.name; }
      }
    }
    const level = num(12);
    out.push({
      name, trust: num(11), trust_level: level, prosperity: Math.round(num(25)), liberated: level >= 4 || num(5) === 1,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
};
