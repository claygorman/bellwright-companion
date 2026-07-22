// Extract CUSTOM gear-preset definitions (the presets players create in the
// gear screen). Each lives in a top-level field-11 record: descend through
// f2 wrappers to a node holding f10 (preset GUID, 4 varints) + f16
// ({name, owner steam id, guid} — only present on custom presets; built-in
// presets like Marksman are referenced by GUID but have no definition in
// the save). Slot fields hold ranked item preferences: f1 entries are
// category weights, f2 entries are specific items {f1: item class,
// f2: rank} — higher rank = preferred. Verified live 2026-07-21 against
// in-game presets (Footman Sturdy / StCut / Spear / Basic).
import { first } from './wire.ts';
import type { Payload } from './payload.ts';
import type { Region } from './types.ts';

export type GearPreset = {
  key: string; // preset guid as '4xu32' join — matches Npc.gear_preset
  name: string;
  slots: Record<string, { item: string; rank: number }[]>;
};

const SLOT_FIELDS: Record<number, string> = {
  2: 'weapon', 3: 'shield', 4: 'head', 5: 'chest', 6: 'gloves', 7: 'legs',
  8: 'boots', 12: 'backpack', 13: 'cloak', 14: 'food', 15: 'meds',
};

export const extractGearPresets = (p: Payload): GearPreset[] => {
  const presets: GearPreset[] = [];

  const tryParse = (region: Region): boolean => {
    const fs = p.fields(region) ?? [];
    const f10 = fs.find(x => x.f === 10 && x.kind === 'len' && x.v.len === 24);
    const f16 = first(fs, 16, 'len');
    if (!f10 || f10.kind !== 'len' || !f16) return false;
    const gv = (p.fields(f10.v) ?? []).filter(x => x.kind === 'v').map(x => x.v);
    if (gv.length !== 4) return false;

    // name: f16.f1.f1 = 13-byte header (u32le strlen at offset 9) + cstring
    const n1 = first(p.fields(f16.v) ?? [], 1, 'len');
    const inner = n1 && first(p.fields(n1.v) ?? [], 1, 'len');
    if (!inner) return false;
    const raw = p.buf.subarray(inner.v.off, inner.v.off + inner.v.len);
    if (raw.length < 14) return false;
    const strlen = raw.readUInt32LE(9);
    const name = raw.subarray(13, 13 + strlen - 1).toString('utf8');
    if (!name) return false;

    const slots: GearPreset['slots'] = {};
    for (const x of fs) {
      const slot = SLOT_FIELDS[x.f];
      if (!slot || x.kind !== 'len') continue;
      const ranked: { item: string; rank: number }[] = [];
      for (const g of p.fields(x.v) ?? []) {
        if (g.f !== 2 || g.kind !== 'len') continue; // f1 = category weights, skip
        const gf = p.fields(g.v) ?? [];
        const iv = first(gf, 1, 'v');
        if (iv == null) continue;
        const item = p.baseName(iv.v as number);
        if (item) ranked.push({ item, rank: (first(gf, 2, 'v')?.v as number) ?? 0 });
      }
      if (ranked.length) slots[slot] = ranked.sort((a, b) => b.rank - a.rank);
    }
    presets.push({ key: gv.join(','), name, slots });
    return true;
  };

  const top = p.fields({ off: 0, len: p.buf.length }) ?? [];
  for (const rec of top) {
    if (rec.f !== 11 || rec.kind !== 'len') continue;
    // descend single-f2 wrappers looking for the preset node (depth-bounded)
    let cur: Region | null = rec.v;
    for (let d = 0; d < 6 && cur; d++) {
      if (tryParse(cur)) break;
      cur = first(p.fields(cur) ?? [], 2, 'len')?.v ?? null;
    }
  }
  return presets;
};
