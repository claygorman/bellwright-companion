// Extract Army-tab squads: MistCombatGroup actors hold member NPC GUIDs
// (repeated 4xu32-BE groups) and the squad's display name as UE-style
// key/value strings ("<X>SquadName" ... "<display name>") in the raw bytes.
// Verified live 2026-07-21: 5 groups matching the in-game Army tab exactly
// (Reservists 19, Common 15, Newcomers 33, Helpers, Elites).
import { first } from './wire.ts';
import type { Payload } from './payload.ts';
import type { Group } from './types.ts';

const GUID_U32_COUNT = 4;

export const extractGroups = (p: Payload): Group[] => {
  // known TownNpc guids: 4xu32-BE key -> hex guid
  const npcKeyToGuid = new Map<string, string>();
  for (const region of p.actors) {
    const fs = p.fields(region);
    let guid: string | null = null, isTownNpc = false;
    for (const x of fs ?? []) {
      if (x.f === 1 && x.kind === 'len') guid = p.string(x.v);
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 4 && y.kind === 'v' && p.baseName(y.v) === 'TownNpc_C') isTownNpc = true;
        }
      }
    }
    if (!isTownNpc || !guid) continue;
    const b = Buffer.from(guid, 'hex');
    if (b.length !== 16) continue;
    npcKeyToGuid.set(
      [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)].join(','),
      guid,
    );
  }

  const groups: Group[] = [];
  for (const region of p.actors) {
    const fs = p.fields(region);
    let guid: string | null = null, cls: string | null = null;
    for (const x of fs ?? []) {
      if (x.f === 1 && x.kind === 'len') guid = p.string(x.v);
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 4 && y.kind === 'v') cls = p.baseName(y.v);
        }
      }
    }
    if (cls !== 'MistCombatGroup') continue;

    // display name — two encodings observed:
    //  default squads:  "<Key>SquadName" marker followed by the display string
    //  custom squads:   a bare printable name near the GUID (like building renames)
    const raw = p.buf.toString('latin1', region.off, region.off + region.len);
    const nameMatch = raw.match(/([\x20-\x7e]{1,32})SquadName[^\x20-\x7e]+([\x20-\x7e]{1,32})/);
    let name = nameMatch?.[2]?.replace(/\0+$/, '') ?? null;
    if (!name) {
      for (const m of raw.matchAll(/[\x20-\x7e]{2,40}/g)) {
        const s = m[0].trim();
        if (/^[0-9A-F]{32}$/.test(s) || /^\d+$/.test(s) || !/[A-Za-z]{2}/.test(s)) continue;
        name = s;
        break;
      }
    }

    // members: every 4-consecutive-varint run matching a known NPC guid
    const members = new Set<string>();
    const walk = (r: { off: number; len: number }, depth: number) => {
      const fsr = p.fields(r);
      if (!fsr) return;
      const vs = fsr.filter(f => f.kind === 'v').map(f => f.v as number);
      for (let i = 0; i + GUID_U32_COUNT <= vs.length; i++) {
        const g = npcKeyToGuid.get(vs.slice(i, i + GUID_U32_COUNT).join(','));
        if (g) members.add(g);
      }
      if (depth < 8) for (const f of fsr) if (f.kind === 'len') walk(f.v, depth + 1);
    };
    walk(region, 0);

    if (guid) groups.push({ guid, name, members: [...members] });
  }
  return groups.sort((a, b) => b.members.length - a.members.length);
};
