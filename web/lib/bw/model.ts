// View-model layer: turns real World data into the shapes the design renders.
// Pure functions — no React. Ported from the design prototype, with
// mock-only features removed (only save-backed data is surfaced).
import type { Npc, Skill, World } from '@/lib/types';
import { itemLabel, pctToNext, skillNumColor, tplLabel } from './format.ts';
import { normalizeInjuries } from './injuries.ts';

export type SkillDef = readonly [key: string, abbr: string, name: string];

export const COMBAT: SkillDef[] = [
  ['strength', 'STR', 'Strength'], ['agility', 'AGI', 'Agility'],
  ['one_handed', '1H', 'One-Handed'], ['two_handed', '2H', 'Two-Handed'],
  ['polearm', 'POL', 'Polearm'], ['block', 'BLK', 'Block'], ['archery', 'ARC', 'Archery'],
];
export const WORK: SkillDef[] = [
  ['harvest', 'HAR', 'Harvesting'], ['farm', 'FAR', 'Farming'],
  ['animal', 'ANI', 'Animal Care'], ['cook', 'COO', 'Cooking'],
  ['craft', 'CRA', 'Crafting'], ['research', 'RES', 'Research'], ['labour', 'LAB', 'Labour'],
];
export const ALL_SKILLS: SkillDef[] = [...COMBAT, ...WORK];

export const SKILL_ICON: Record<string, string> = {
  strength: 'strength', agility: 'agility', one_handed: 'sword', two_handed: 'sword',
  polearm: 'spear', block: 'shield', archery: 'bow', harvest: 'berry', farm: 'wheat',
  animal: 'paw', cook: 'pot', craft: 'anvil', research: 'scroll', labour: 'hammer',
};

export const PROF: Record<string, string> = {
  harvest: 'Forager', farm: 'Farmer', animal: 'Herder', cook: 'Cook',
  craft: 'Craftsman', research: 'Scholar', labour: 'Labourer',
};

// % progress at/above which a skill counts as "about to level"
export const CLOSE_TO_LEVEL_PCT = 90;
// combat-total floor for the "notable recruit" star
export const NOTABLE_COMBAT_TOTAL = 42;

export const npcName = (v: Npc): string =>
  [v.first_name, v.last_name].filter(Boolean).join(' ') || tplLabel(v.template) || 'Unknown';

export const combatTotal = (v: Npc): number =>
  COMBAT.reduce((a, [k]) => a + (v.skills[k]?.level ?? 0), 0);

// Recruit role classification by CAPS (potential): a recruit with high combat
// ceilings is a Fighter even if untrained today. Bands calibrated against a
// real 65-recruit population (combat/work cap ratios ran 0.71-1.22,
// median 0.87 — village recruits skew work-heavy).
const FIGHTER_RATIO = 1.0;
const WORKER_RATIO = 0.8;
export type RecruitRole = 'Fighter' | 'Worker' | 'Balanced';
export const classifyRole = (v: Npc): RecruitRole => {
  const capSum = (defs: SkillDef[]) => defs.reduce((a, [k]) => a + (v.skills[k]?.cap ?? 0), 0);
  const combat = capSum(COMBAT), work = capSum(WORK);
  if (work === 0) return 'Fighter';
  const r = combat / work;
  if (r >= FIGHTER_RATIO) return 'Fighter';
  if (r <= WORKER_RATIO) return 'Worker';
  return 'Balanced';
};
export const ROLE_COLORS: Record<RecruitRole, string> = {
  Fighter: '#C4776A', Worker: '#8FA05B', Balanced: '#9AB0C9',
};

// ---- skill cell ------------------------------------------------------------
export type CellVM = {
  disp: string; numColor: string; showBar: boolean; barPct: number;
  tip: string; atCap: boolean; close: boolean; level: number; cap: number; pct: number;
};

export const shapeCell = (name: string, s: Skill | undefined): CellVM => {
  const cap = s?.cap ?? 0, level = s?.level ?? 0;
  const trained = cap > 0;
  const atCap = trained && level >= cap;
  // NPCs spawn with xp parked exactly on a level boundary (reads as 100%);
  // display those as 99% and never treat them as "about to level".
  const rawPct = s ? (atCap ? 100 : pctToNext(s)) : 0;
  const parked = !atCap && rawPct >= 100;
  const pct = parked ? 99 : rawPct;
  const close = trained && !atCap && !parked && pct >= CLOSE_TO_LEVEL_PCT && level > 0;
  const disp = !trained ? '—' : `${level}/${cap}`;
  return {
    disp, numColor: skillNumColor(s), showBar: trained, barPct: trained ? pct : 0,
    tip: `${name}: ${!trained ? 'Untrained' : `${level}/${cap}${atCap ? ' · maxed' : ` · ${pct}% to ${level + 1}`}`}`,
    atCap, close, level, cap, pct,
  };
};

// ---- combat preset fit (skills + gear only; traits aren't in the save) -----
export const weaponClass = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (/Bow/.test(raw)) return 'bow';
  if (/Spear|Halberd|Poleaxe|Pike|Glaive|Pole/.test(raw)) return 'polearm';
  // NOTE: warhammers/maces are ONE-handed in Bellwright (they pair with shields)
  if (/Great|TwoHand|Maul|BattleAxe|LongAxe|Zweihander/.test(raw)) return 'two';
  return 'one';
};

export type PresetVM = {
  preset: string; combat: boolean; fit: boolean; reason: string; best?: string;
};

const PRESET_NAME: Record<string, string> = {
  one_handed: 'Sword & Shield', two_handed: 'Two-Handed', polearm: 'Polearm', archery: 'Marksman',
};
const PRESET_WANT: Record<string, string> = {
  one_handed: 'one', two_handed: 'two', polearm: 'polearm', archery: 'bow',
};
const WEAPON_LABEL: Record<string, string> = {
  one: 'one-handed weapon', two: 'two-handed weapon', polearm: 'polearm', bow: 'bow',
};
const MIN_PRESET_LEVEL = 4;

export const presetFor = (v: Npc): PresetVM => {
  let best: string | null = null, bl = -1;
  for (const k of ['one_handed', 'two_handed', 'polearm', 'archery']) {
    const s = v.skills[k];
    if (s && s.level > bl) { bl = s.level; best = k; }
  }
  if (!best || bl < MIN_PRESET_LEVEL) return { preset: 'Worker kit', combat: false, fit: true, reason: '' };
  const want = PRESET_WANT[best];
  const wantShield = best === 'one_handed';
  const wc = weaponClass(v.equipment.weapon);
  let fit = true, reason = '';
  if (!v.equipment.weapon) { fit = false; reason = `unarmed, needs a ${WEAPON_LABEL[want]}`; }
  else if (wc !== want) { fit = false; reason = `has a ${WEAPON_LABEL[wc ?? 'one']}, should use a ${WEAPON_LABEL[want]}`; }
  else if (wantShield && !v.equipment.offhand) { fit = false; reason = 'needs a shield'; }
  return { preset: PRESET_NAME[best], combat: true, fit, reason, best };
};

// Only the REAL designation from the recruit template (Innkeeper, Healer,
// Blacksmith, …). No skill-derived guessing — the game shows no label for
// plain villagers, so neither do we.
export const professionOf = (v: Npc): string | null => v.profession;

// ---- insights (only cards the save can actually answer)
export type InsightItem = { guid: string; npc: Npc; detail: string };
export type InsightCard = {
  severity: 'alert' | 'warn' | 'suggest' | 'tip';
  icon: string; title: string; desc: string; items: InsightItem[];
};

const LOW_MORALE = 35;
const DEFAULT_PRIORITY = 5;
const UNDERPRIORITISED_MIN_SKILL = 5;

export const insightsFor = (mine: Npc[]): InsightCard[] => {
  const cards: InsightCard[] = [];
  const add = (severity: InsightCard['severity'], icon: string, title: string, desc: string,
    list: Npc[], detail: (v: Npc) => string) => {
    if (list.length) cards.push({
      severity, icon, title, desc,
      items: list.map(v => ({ guid: v.guid ?? npcName(v), npc: v, detail: detail(v) })),
    });
  };

  add('alert', 'heart', 'Low morale', `Morale below ${LOW_MORALE} — at risk of debuffs or leaving.`,
    mine.filter(v => v.morale != null && v.morale < LOW_MORALE),
    v => `morale ${Math.round(v.morale ?? 0)}`);

  add('alert', 'cross', 'Injured', 'Currently injured and needs healing.',
    mine.filter(v => v.injuries.length > 0),
    v => normalizeInjuries(v.injuries).map(i => i.label).join(', '));

  add('warn', 'sword', 'Unarmed', 'No weapon equipped — cannot fight or defend.',
    mine.filter(v => !v.equipment.weapon),
    () => 'no weapon');

  add('suggest', 'shield', 'Wrong loadout for their class',
    "Their best combat skill doesn't match their gear — switch to the right preset (Two-Handed, Sword & Shield, Polearm, or Marksman).",
    mine.filter(v => { const p = presetFor(v); return p.combat && !p.fit; }),
    v => { const p = presetFor(v); return `${p.preset} — ${p.reason}`; });

  // "close" excludes xp parked exactly on a boundary (spawn quantisation)
  const closeSkill = (v: Npc) => ALL_SKILLS.find(([k]) => {
    const s = v.skills[k];
    if (!s || s.cap <= 0 || s.level >= s.cap) return false;
    const pct = pctToNext(s);
    return pct >= CLOSE_TO_LEVEL_PCT && pct < 100;
  });
  add('tip', 'up', 'Ready to level', `A skill is ${CLOSE_TO_LEVEL_PCT}%+ of the way to its next level.`,
    mine.filter(v => closeSkill(v) != null),
    v => {
      const hit = closeSkill(v);
      if (!hit) return '';
      const s = v.skills[hit[0]];
      return `${hit[2]} ${pctToNext(s)}% to ${s.level + 1}`;
    });

  const priMatch = (v: Npc) => WORK
    .filter(([k]) => {
      const s = v.skills[k];
      return s && (s.level > UNDERPRIORITISED_MIN_SKILL || s.cap > UNDERPRIORITISED_MIN_SKILL)
        && (v.job_priorities[k] ?? DEFAULT_PRIORITY) >= DEFAULT_PRIORITY
        && Object.keys(v.job_priorities).length > 0; // non-workers have no priorities at all
    })
    .sort((a, b) => (v.skills[b[0]]?.level ?? 0) - (v.skills[a[0]]?.level ?? 0));

  add('suggest', 'up', 'Under-prioritised skills',
    `Skilled above ${UNDERPRIORITISED_MIN_SKILL} but their priority is still ${DEFAULT_PRIORITY} (the default) or weaker — lower the number so they take that job first.`,
    mine.filter(v => priMatch(v).length > 0),
    v => {
      const hit = priMatch(v)[0];
      const s = v.skills[hit[0]];
      return `${hit[2]} ${s.level}/${s.cap} · priority ${v.job_priorities[hit[0]] ?? DEFAULT_PRIORITY}`;
    });

  return cards;
};

// ---- world helpers ---------------------------------------------------------
export const playerNpcs = (w: World): Npc[] => w.npcs.filter(n => n.is_player_npc);
export const recruitNpcs = (w: World): Npc[] =>
  w.npcs.filter(n => !n.is_player_npc && n.archetype === 'recruitable');
