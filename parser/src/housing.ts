// Extract the player's villager housing capacity ("livable quarters").
// Housing buildings are actors of the House_ family (villager sleeping quarters,
// NOT the player's personal Cottage/Cabin). Each type's bed count is a template
// constant from the Modkit (MaxWorkforce on the MistTownHouseComponent, verified
// in-game: Housing Tent 2, House 4, Big House 7). We filter to Player-faction
// actors (faction lives in the structure component, same path as storage) so
// other villages' houses don't inflate the count.
//
// This yields an AGGREGATE quarters total, not per-villager assignment — the
// save doesn't cleanly say who is homeless, but quarters vs. population does.
import type { Payload } from './payload.ts';
import type { Housing } from './types.ts';
import {
  ACTOR, ACTOR_DATA, COMPONENT_ENTRY, STRUCT_WRAP, STRUCT_DATA,
} from './fields.ts';

// villager sleeping quarters (beds per building) — Modkit MaxWorkforce
const HOUSE_CAP: Record<string, { label: string; cap: number }> = {
  HousingTent_C: { label: 'Housing Tent', cap: 2 },
  House_C: { label: 'House', cap: 4 },
  BigHouse_C: { label: 'Big House', cap: 7 },
};

export const extractHousing = (p: Payload): Housing => {
  const counts: Record<string, number> = {};
  for (const region of p.actors) {
    let cls: string | null = null, faction: string | null = null;
    for (const x of p.fields(region) ?? []) {
      if (x.f !== ACTOR.DATA || x.kind !== 'len') continue;
      for (const y of p.fields(x.v) ?? []) {
        if (y.f === ACTOR_DATA.CLASS && y.kind === 'v') cls = p.baseName(y.v);
        if (y.f === ACTOR_DATA.COMPONENT && y.kind === 'len') {
          for (const z of p.fields(y.v) ?? []) {
            if (z.f !== COMPONENT_ENTRY.BODY || z.kind !== 'len') continue;
            for (const w of p.fields(z.v) ?? []) {
              if (w.f !== STRUCT_WRAP.DATA || w.kind !== 'len') continue;
              for (const b of p.fields(w.v) ?? []) {
                if (b.f === STRUCT_DATA.FACTION && b.kind === 'v') faction = p.baseName(b.v) ?? faction;
              }
            }
          }
        }
      }
    }
    if (cls && faction === 'Player' && HOUSE_CAP[cls]) counts[cls] = (counts[cls] ?? 0) + 1;
  }

  const byType = Object.entries(counts)
    .map(([cls, count]) => ({ cls, label: HOUSE_CAP[cls].label, cap: HOUSE_CAP[cls].cap, count, beds: HOUSE_CAP[cls].cap * count }))
    .sort((a, b) => b.beds - a.beds);
  return {
    quarters: byType.reduce((s, t) => s + t.beds, 0),
    houses: byType.reduce((s, t) => s + t.count, 0),
    byType,
  };
};
