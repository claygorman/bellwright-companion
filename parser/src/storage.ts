// Extract container contents: settlement/building storage totals + per-building
// breakdown. Container body: f2 = { f1: context/building class id, f2: repeated
// slots { f1: slot#, f2: count, f3: { f1: item class id, f2: durability/extra } } }.
// NPC pockets (owner actor = TownNpc_C) are separated from building storage.
// NOTE: totals currently span ALL world containers (incl. other villages' chests);
// filter by settlement affiliation is a future refinement — the per-building
// context class is usually enough to see "our" storage.
import { first } from './wire.ts';
import type { Payload } from './payload.ts';
import type { ContainerRec, Region, Storage } from './types.ts';
import {
  ACTOR, ACTOR_DATA, COMPONENT_ENTRY, TRANSFORM, STRUCT_WRAP, STRUCT_DATA,
  COMP_DATA, CONTAINER, INVENTORY, SLOT, SLOT_ITEM,
} from './fields.ts';

const guidKey = (g: string): string | null => {
  try {
    const b = Buffer.from(g, 'hex');
    if (b.length !== 16) return null;
    return [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)].join(',');
  } catch { return null; }
};

export const extractStorage = (p: Payload): Storage => {
  const { buf } = p;

  // actor GUID key -> {class, name, faction, pos}. Custom building names
  // ("Barn #1 Spoiled") + faction live in the structure component's body
  // (a nested blob containing a UE-ish printable name and the owner SteamID).
  type ActorInfo = { cls: string | null; name: string | null; faction: string | null; pos: number[] | null };
  const actorInfo = new Map<string, ActorInfo>();
  const isHex32 = (s: string) => /^[0-9A-F]{32}$/.test(s);
  const isDigits = (s: string) => /^\d+$/.test(s);
  for (const region of p.actors) {
    const fs = p.fields(region);
    let guid: string | null = null, cls: string | null = null, name: string | null = null, faction: string | null = null, pos: number[] | null = null;
    const scanForName = (r: Region) => {
      // the rename blob isn't clean protobuf — regex printable runs out of it
      const raw = buf.toString('latin1', r.off, r.off + r.len);
      for (const m of raw.matchAll(/[\x20-\x7e]{3,48}/g)) {
        const s = m[0];
        if (!isHex32(s) && !isDigits(s) && /[A-Za-z]{2}/.test(s)) { name = name ?? s; break; }
      }
    };
    for (const x of fs ?? []) {
      if (x.f === ACTOR.GUID && x.kind === 'len') guid = p.string(x.v);
      if (x.f === ACTOR.DATA && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === ACTOR_DATA.CLASS && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === ACTOR_DATA.TRANSFORM && y.kind === 'len') {
            const t = p.fields(y.v);
            const posF = t?.find(z => z.f === TRANSFORM.POSITION && z.kind === 'len');
            const xyz = (p.fields(posF?.v) ?? []).filter(z => z.kind === 'f').map(z => z.v);
            if (xyz.length >= 3) pos = xyz.slice(0, 3);
          }
          if (y.f === ACTOR_DATA.COMPONENT && y.kind === 'len') {
            // component entry {f1: class id, f2: body} — structure body carries
            // {f1: actor class, f3: faction, ..., f7: rename blob}
            // y.v = {f1: component class id, f2: body{f1:1, f2:{f1: actor class,
            // f3: faction, f7: rename blob}}}
            for (const z of p.fields(y.v) ?? []) {
              if (z.f === COMPONENT_ENTRY.BODY && z.kind === 'len') {
                for (const w of p.fields(z.v) ?? []) {
                  if (w.f === STRUCT_WRAP.DATA && w.kind === 'len') {
                    for (const b of p.fields(w.v) ?? []) {
                      if (b.f === STRUCT_DATA.FACTION && b.kind === 'v') faction = p.baseName(b.v) ?? faction;
                      if (b.f === STRUCT_DATA.RENAME && b.kind === 'len') scanForName(b.v);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    const k = guid && guidKey(guid);
    if (k && cls) actorInfo.set(k, { cls, name, faction, pos });
  }

  const totals: Record<string, number> = {};            // item -> count (building storage)
  const npcCarried: Record<string, number> = {};        // item -> count (NPC pockets)
  // owner actor GUID key -> container record; keying by actor keeps the many
  // default-named barns as separate 2000-cap containers instead of merging
  const containers = new Map<string, ContainerRec>();

  for (const region of p.components) {
    const fs = p.fields(region);
    const f2 = first(fs, 2, 'len'); if (!f2) continue;
    let cls: number | null = null, body: Region | null = null, owner: string | null = null;
    for (const x of p.fields(f2.v) ?? []) {
      if (x.f === COMP_DATA.CLASS_AND_BODY && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === COMPONENT_ENTRY.CLASS && y.kind === 'v') cls = y.v;
          if (y.f === COMPONENT_ENTRY.BODY && y.kind === 'len') body = y.v;
        }
      } else if (x.f === COMP_DATA.OWNER && x.kind === 'len') {
        owner = (p.fields(x.v) ?? []).filter(y => y.kind === 'v').map(y => y.v).join(',');
      }
    }
    if (cls == null || p.baseName(cls) !== 'MistContainerComponent' || !body) continue;
    const info = owner ? actorInfo.get(owner) ?? null : null;
    const ownerCls = info?.cls ?? null;
    const isNpc = ownerCls?.startsWith('TownNpc') ?? false;

    for (const fb of p.fields(body) ?? []) {
      if (fb.f !== CONTAINER.INVENTORY || fb.kind !== 'len') continue;
      let ctx: string | null = null;
      for (const s of p.fields(fb.v) ?? []) {
        if (s.f === INVENTORY.CONTEXT && s.kind === 'v') {
          const n = p.baseName(s.v);
          if (n?.endsWith('_C')) ctx = n;
        }
        if (s.f === INVENTORY.SLOT && s.kind === 'len') {
          let count: number | null = null, item: string | null = null;
          for (const y of p.fields(s.v) ?? []) {
            if (y.f === SLOT.COUNT && y.kind === 'v') count = y.v;
            if (y.f === SLOT.ITEM && y.kind === 'len') {
              const it = first(p.fields(y.v) ?? [], SLOT_ITEM.CLASS, 'v');
              if (it) item = p.baseName(it.v);
            }
          }
          if (!item || !count) continue;
          if (isNpc) {
            npcCarried[item] = (npcCarried[item] ?? 0) + count;
          } else {
            totals[item] = (totals[item] ?? 0) + count;
            // OWNER ACTOR CLASS is the true building; the embedded class id
            // (ctx) is a filter/config ref and MISLEADS (a barn showed as
            // "CauldronStews_C"). Custom rename (e.g. "Barn #1 Spoiled") wins.
            const key = owner ?? `ctx:${ctx ?? 'unknown'}`;
            let rec = containers.get(key);
            if (!rec) {
              rec = {
                id: key, name: info?.name ?? null, cls: ownerCls ?? ctx ?? null,
                faction: info?.faction ?? null, position: info?.pos ?? null, items: {},
              };
              containers.set(key, rec);
            }
            rec.items[item] = (rec.items[item] ?? 0) + count;
          }
        }
      }
    }
  }
  const sortObj = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  const qty = (o: Record<string, number>) => Object.values(o).reduce((s, x) => s + x, 0);
  return {
    totals: sortObj(totals),
    npc_carried: sortObj(npcCarried),
    containers: [...containers.values()]
      .sort((a, b) => qty(b.items) - qty(a.items))
      .map(c => ({ ...c, items: sortObj(c.items) })),
  };
};
