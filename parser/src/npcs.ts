// Extract TownNpcs: names, skills (level/xp/cap), gender, position, faction,
// template, injuries, equipment (via MistEquipmentComponent owner match).
import { fieldsOf, first, all } from './wire.ts';
import { SKILLS, EQUIP_SLOTS, Payload } from './payload.ts';
import type { Injury, Npc, NpcArchetype, Region, Skill } from './types.ts';

const guidToU32BE = (g: string): string => {
  const b = Buffer.from(g, 'hex');
  return [b.readUInt32BE(0), b.readUInt32BE(4), b.readUInt32BE(8), b.readUInt32BE(12)].join(',');
};

/** Classify an NPC from its template name + components (verified against a
 *  real save 2026-07-21 — templates encode archetype & profession). */
const classify = (template: string | null, faction: string | null, hasTrader: boolean): { archetype: NpcArchetype; profession: string | null; tier: string | null } => {
  const t = template ?? '';
  if (hasTrader || /Merchant|Mechant|Trader/i.test(t)) return { archetype: 'vendor', profession: null, tier: null };
  const m = t.match(/^(?:\w*?)(Novice|Apprentice|Expert|Unique)([A-Z][a-z]+(?:[A-Z][a-z]+)*?)(?:Npc|NPC)Template/);
  if (m) return { archetype: 'recruitable', profession: m[2], tier: m[1] };
  const idle = t.match(/^(Low|Medium|High)(?:NoTraits)?(?:VillagerIdle|Beggar)/) ?? t.match(/^(Low)Beggar/);
  if (idle) return { archetype: 'villager', profession: null, tier: idle[1] };
  if (/^T\d_/.test(t) || /Bandit|Brigand|Robber|Militia/i.test(faction ?? '')) {
    return { archetype: 'combatant', profession: null, tier: t.match(/^T(\d)_/)?.[1] ?? null };
  }
  return { archetype: 'unique', profession: null, tier: null };
};

export function extractNpcs(p: Payload): Npc[] {
  const { buf } = p;

  // Pass 1 — index components by owner (4xu32 big-endian of the actor GUID).
  const equipByOwner = new Map<string, Record<string, string>>();      // owner -> equipment slots
  const happinessByOwner = new Map<string, number>();  // owner -> morale number
  const traderOwners = new Set<string>();      // owners with MistTraderComponent (vendors)
  const housedKeys = new Set<string>();        // NPC guids listed as occupants of any MistTownHouseComponent
  for (const region of p.components) {
    const fs = p.fields(region);
    const f2 = first(fs, 2, 'len'); if (!f2) continue;
    const inner = p.fields(f2.v);
    let cls: number | null = null, body: Region | null = null, owner: string | null = null;
    for (const x of inner ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 1 && y.kind === 'v') cls = y.v;
          if (y.f === 2 && y.kind === 'len') body = y.v;
        }
      } else if (x.f === 3 && x.kind === 'len') {
        owner = (p.fields(x.v) ?? []).filter(y => y.kind === 'v').map(y => y.v).join(',');
      }
    }
    if (cls == null || owner == null || !body) continue;
    const name = p.baseName(cls);
    if (name === 'MistEquipmentComponent') {
      const slots: Record<string, string> = {};
      const b = p.fields(body);
      const f2b = first(b, 2, 'len');
      for (const s of all(p.fields(f2b?.v) ?? [], 1, 'len')) {
        const sf = p.fields(s.v);
        const slot = first(sf, 1, 'v')?.v ?? 1;
        const item = first(p.fields(first(sf, 2, 'len')?.v) ?? [], 1, 'v')?.v;
        if (item != null) slots[EQUIP_SLOTS[slot] ?? `slot_${slot}`] = p.baseName(item) ?? String(item);
      }
      equipByOwner.set(owner, slots);
    } else if (name === 'MistTraderComponent') {
      traderOwners.add(owner);
    } else if (name === 'MistTownHouseComponent') {
      // body.f2 = repeated {f1: NPC GUID (4 varints), f3: slot->item entries}.
      // NOT bed occupancy: live check 2026-07-21 matched the COMBAT SQUAD
      // (gear-preset/armory roster), not the in-game housed list — so this
      // feeds `housed` as a PROVISIONAL "has house-linked assignment" bit.
      // True bed occupancy is still undecoded; do not surface as "Unhoused".
      const b = p.fields(body);
      const f2b = first(b, 2, 'len');
      for (const occ of all(p.fields(f2b?.v) ?? [], 1, 'len')) {
        const gf = first(p.fields(occ.v) ?? [], 1, 'len');
        const u32s = (p.fields(gf?.v) ?? []).filter(y => y.kind === 'v').map(y => y.v);
        if (u32s.length === 4) housedKeys.add(u32s.join(','));
      }
    } else if (name === 'MistNpcHappinessComponent') {
      const b = p.fields(body);
      const f2b = first(b, 2, 'len');
      const v = first(p.fields(f2b?.v) ?? [], 3);
      if (v && typeof v.v === 'number') happinessByOwner.set(owner, v.v);
    }
  }

  // Pass 2 — walk TownNpc actors.
  const npcs: Npc[] = [];
  for (const region of p.actors) {
    const fs = p.fields(region);
    let guid: string | null = null, cls: string | null = null, pos: number[] | null = null;
    const comps: Record<string, Region | undefined> = {};
    for (const x of fs ?? []) {
      if (x.f === 1 && x.kind === 'len') guid = p.string(x.v);
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 4 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 5 && y.kind === 'len') {
            const t = p.fields(y.v);
            const posF = first(t, 2, 'len');
            const xyz = (p.fields(posF?.v) ?? []).filter(z => z.kind === 'f').map(z => z.v);
            if (xyz.length >= 3) pos = xyz.slice(0, 3);
          }
          if (y.f === 2 && y.kind === 'len') {
            let cid = null, body = null;
            for (const z of p.fields(y.v) ?? []) {
              if (z.f === 1 && z.kind === 'v') cid = z.v;
              if (z.f === 2 && z.kind === 'len') body = z.v;
            }
            if (cid != null) comps[p.baseName(cid) ?? String(cid)] = body;
          }
        }
      }
    }
    if (cls !== 'TownNpc_C' || !comps.MistHuman) continue;

    // skills + gender + injuries from MistHuman
    const skills: Record<string, Skill> = {}; let gender: string | null = null; const injuries: Injury[] = [];
    const appearance: Npc['appearance'] = { skin: null, hair: null, beard: null, mustache: null, face: null };
    const hf = p.fields(comps.MistHuman);
    const hBody = first(hf, 2, 'len');
    for (const x of p.fields(hBody?.v) ?? []) {
      if (x.f === 2 && x.kind === 'len') {
        const rec = Object.fromEntries((p.fields(x.v) ?? [])
          .filter(y => y.kind === 'v').map(y => [y.f, y.v]));
        const sid = rec[1];
        if (sid >= 1 && sid <= 14) {
          skills[SKILLS[sid - 1]] = { level: rec[2] ?? 0, xp: rec[3] ?? 0, cap: rec[4] ?? 0 };
        }
      } else if (x.f === 3 && x.kind === 'len') { // injury: {f1: asset id, f2: game-time sustained}
        const injFields = p.fields(x.v) ?? [];
        const inj = first(injFields, 1, 'v');
        if (inj) {
          const n = p.baseName(inj.v);
          const since = injFields.find(y => y.f === 2 && (y.kind === 'f' || y.kind === 'd'))?.v ?? null;
          if (n) injuries.push({ type: n, since });
        }
      } else if (x.f === 5 && x.kind === 'len') { // appearance k/v strings
        const kv = p.fields(x.v);
        const k = first(kv, 1, 'len'), v = first(kv, 2, 'len');
        if (k && v) {
          const key = p.string(k.v), val = p.string(v.v);
          if (key === 'Gender') gender = val;
          else if (key === 'SkinType') appearance.skin = val;
          else if (key === 'Hair Types') appearance.hair = val;
          else if (key === 'Beard Types') appearance.beard = val;
          else if (key === 'Mustache Types') appearance.mustache = val;
          else if (key === 'Face_Preset') appearance.face = val;
        }
      }
    }

    // names + faction + template + job priorities from MistTownNpc
    let firstName: string | null = null, lastName: string | null = null, faction: string | null = null, template: string | null = null;
    const jobPriorities: Record<string, number> = {};
    if (comps.MistTownNpc) {
      const t = comps.MistTownNpc;
      const raw = buf.toString('latin1', t.off, t.off + t.len);
      const gn = [...raw.matchAll(/([0-9A-F]{32})\x00/g)]
        .map(m => p.guidNames.get(m[1])).filter((x): x is string => Boolean(x));
      if (gn.length) firstName = gn[0];
      if (gn.length > 1) lastName = gn[1];
      const tb = first(p.fields(t), 2, 'len');
      for (const x of p.fields(tb?.v) ?? []) {
        if (x.f === 6 && x.kind === 'v') template = p.baseName(x.v);
        if (x.f === 7 && x.kind === 'v') faction = p.baseName(x.v);
        // f34: repeated {f1: job id, f2: priority} — the Population screen's
        // per-NPC job priorities (default 5; absent = untouched; empty map =
        // non-worker/combat NPC). Job ids 8..14 track the work-skill enum;
        // low ids (1,2,6,7) are non-skill jobs (construction/delivery/etc).
        if (x.f === 34 && x.kind === 'len') {
          const rec = Object.fromEntries((p.fields(x.v) ?? [])
            .filter(y => y.kind === 'v').map(y => [y.f, y.v]));
          if (rec[1] != null) {
            const JOB: Record<number, string> = { 8: 'harvest', 9: 'farm', 10: 'animal', 11: 'cook',
                          12: 'craft', 13: 'research', 14: 'labour' };
            jobPriorities[JOB[rec[1]] ?? `job_${rec[1]}`] = rec[2] ?? 0;
          }
        }
      }
    }

    const ownerKey = guid ? guidToU32BE(guid) : null;
    const { archetype, profession, tier } = classify(
      template, faction, ownerKey != null && traderOwners.has(ownerKey));
    // faction strings name the home village directly (e.g. PadstowVillagers)
    const village = faction?.endsWith('Villagers')
      ? faction.replace(/Villagers$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
      : null;
    npcs.push({
      guid, first_name: firstName, last_name: lastName, gender,
      template, faction, is_player_npc: faction === 'Player',
      archetype, profession, tier, village,
      job_priorities: jobPriorities,
      position: pos, skills, injuries,
      morale: ownerKey != null ? happinessByOwner.get(ownerKey) ?? null : null,
      equipment: ownerKey != null ? equipByOwner.get(ownerKey) ?? {} : {},
      housed: null, // real bed occupancy undecoded — see MistTownHouseComponent note
      appearance,
    });
  }
  return npcs;
}
