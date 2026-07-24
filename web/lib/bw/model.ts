// View-model layer: turns real World data into the shapes the design renders.
// Pure functions — no React. Ported from the design prototype, with
// mock-only features removed (only save-backed data is surfaced).
import type { Npc, Skill, VillageState, World } from '@/lib/types';
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

// Player-facing job categories (EMistJobCategory) — the Population job-priority
// list. Keys match the parser's job_priorities keys. This is a SUPERSET of the
// work skills (jobs like Hunting/Woodcutting/Smelting have no matching skill).
export const JOBS: { key: string; label: string; icon: string }[] = [
  { key: 'harvesting', label: 'Harvesting', icon: 'berry' },
  { key: 'woodcutting', label: 'Woodcutting', icon: 'leaf' },
  { key: 'hunting', label: 'Hunting', icon: 'bow' },
  { key: 'farming', label: 'Farming', icon: 'wheat' },
  { key: 'animal', label: 'Animal Handling', icon: 'paw' },
  { key: 'cooking', label: 'Cooking', icon: 'pot' },
  { key: 'smelting', label: 'Smelting', icon: 'anvil' },
  { key: 'crafting', label: 'Crafting', icon: 'anvil' },
  { key: 'construction', label: 'Construction', icon: 'home' },
  { key: 'research', label: 'Research', icon: 'scroll' },
  { key: 'delivery', label: 'Labour', icon: 'hammer' },
];
// work-skill key -> its job-priority key (for skill-driven insights)
export const SKILL_TO_JOB: Record<string, string> = {
  harvest: 'harvesting', farm: 'farming', animal: 'animal', cook: 'cooking',
  craft: 'crafting', research: 'research', labour: 'delivery',
};

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

// Recruit role by CAPS (potential), absolute not relative: someone good at
// both is Balanced even if one side is technically higher — Worker/Fighter
// only when the OTHER side is straight-up bad ("bad" = average cap below
// BAD_AVG_CAP; calibrated on a real 152-recruit pool where side averages run
// ~1.4 (beggars) to ~7+, natural break around 3.5 → 6 Fighters / 11 Workers /
// 135 Balanced). Both sides bad (beggars, low commoners) = Balanced too:
// nothing to suggest either way.
const BAD_AVG_CAP = 3.5;
export type RecruitRole = 'Fighter' | 'Worker' | 'Balanced';
export const classifyRole = (v: Npc): RecruitRole => {
  const capAvg = (defs: SkillDef[]) =>
    defs.reduce((a, [k]) => a + (v.skills[k]?.cap ?? 0), 0) / defs.length;
  const combatBad = capAvg(COMBAT) < BAD_AVG_CAP, workBad = capAvg(WORK) < BAD_AVG_CAP;
  if (combatBad && !workBad) return 'Worker';
  if (workBad && !combatBad) return 'Fighter';
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
// plain villagers, so neither do we. The game assets misspell "Inkeeper";
// fix it for display only.
const PROF_FIX: Record<string, string> = { Inkeeper: 'Innkeeper' };
export const professionOf = (v: Npc): string | null =>
  v.profession ? (PROF_FIX[v.profession] ?? v.profession) : null;

// Specialty for filtering/labeling: profession templates keep their game
// designation; generic villagers group as Commoner (or Beggar).
export const specialtyOf = (v: Npc): string | null =>
  professionOf(v) ??
  (v.archetype === 'villager' ? (/Beggar/i.test(v.template ?? '') ? 'Beggar' : 'Commoner') : null);

// Archetype cell label: "Novice Engineer" / "Expert Blacksmith" for
// profession templates (the game's own tiers), "Commoner (High)" for generic
// villagers where Low/Medium/High is the template's skill-cap quality.
// (villager quality tier is rendered as a separate badge, not a suffix)
export const archetypeLabel = (v: Npc): string => {
  const s = specialtyOf(v);
  if (v.archetype === 'villager') return s ?? '—';
  if (v.tier && s) return `${v.tier} ${s}`;
  if (v.archetype === 'unique') return 'Unique';
  return s ?? tplLabel(v.template);
};

// Exact hire gates from the game's NPC template assets (official Modkit
// export — web/lib/bw/hire-gates.json): required village Trust rank,
// whether the village must be liberated, and the renown hiring cost.
// Diamonds = trust rank index (Stranger 0 … Leader 4), matching the
// in-game Villagers-for-Hire badge.
import HIRE_GATES from './hire-gates.json';
export type HireGate = { trust: string; diamonds: number; liberation: boolean; renown: number };
export const hireGateOf = (v: Npc): HireGate | null =>
  (HIRE_GATES as Record<string, HireGate>)[v.template ?? ''] ?? null;

// ---- upgrade suggestions --------------------------------------------------
// "Who in my population could I replace with a better recruit?" Only
// NON-SPECIALIZED villagers are replacement targets (profession villagers
// are research unlocks — never suggest dropping them). A candidate must
// dominate on BOTH cap sides (no sideways trades) with a meaningful total
// gain. Specialists count as candidates. Trained levels shown as the cost
// of switching. NOTE: innate traits aren't in save data — only acquired
// statuses (Slacker etc.) can be flagged.
const UPGRADE_MIN_DELTA = 8;
// spotlight the single weakest villager — replace them and the next
// weakest surfaces on the following save ingest
const UPGRADE_MAX_ROWS = 1;
const UPGRADE_MAX_CANDIDATES = 5;
// negative acquired traits cost real output (Slacker ≈ −10%); score them as
// −10% of cap total each, so trait-free sideways swaps count as upgrades and
// Slacker candidates must be substantially better on paper to rank
const TRAIT_PENALTY_PCT = 0.10;
// a trait-hobbled villager loosens the per-side dominance requirement —
// shedding the trait is worth a small caps step-down on one side
const TRAIT_SIDE_SLACK = 4;
export type UpgradeSuggestion = {
  villager: Npc;
  trainedLevels: number;
  vCombat: number; vWork: number;
  vPenalized: boolean;
  candidates: { npc: Npc; combat: number; work: number; delta: number }[];
};
export const upgradeSuggestions = (mine: Npc[], recruits: Npc[], villages?: VillageState[]): UpgradeSuggestion[] => {
  // hireability filter using EXACT per-village trust: a recruit is hireable
  // when its home village's current trust level meets the gate's rank
  // (diamonds = required rank index; liberation = Leader/level 4). Villages
  // with no home (unique/quest NPCs) are left unfiltered.
  const trustLevel = new Map((villages ?? []).map(v => [v.name, v.trust_level]));
  const hireable = (r: Npc) => {
    const g = hireGateOf(r);
    if (!g) return true;
    if (r.village == null) return true;
    const lv = trustLevel.get(r.village) ?? 0;
    if (g.liberation) return lv >= 4;
    return lv >= g.diamonds;
  };
  recruits = villages ? recruits.filter(hireable) : recruits;
  const capSum = (v: Npc, defs: SkillDef[]) => defs.reduce((a, [k]) => a + (v.skills[k]?.cap ?? 0), 0);
  const lvlSum = (v: Npc) => ALL_SKILLS.reduce((a, [k]) => a + (v.skills[k]?.level ?? 0), 0);
  const negCount = (v: Npc) => (v.traits ?? []).filter(t => NEGATIVE_TRAITS.has(t)).length;
  const eff = (total: number, v: Npc) => total - Math.round(total * TRAIT_PENALTY_PCT) * negCount(v);
  const rc = recruits.map(r => {
    const combat = capSum(r, COMBAT), work = capSum(r, WORK);
    return { npc: r, combat, work, eff: eff(combat + work, r) };
  });
  const out: UpgradeSuggestion[] = [];
  for (const v of mine) {
    if (v.profession) continue; // specialists are research unlocks — keep them
    const vCombat = capSum(v, COMBAT), vWork = capSum(v, WORK);
    const vEff = eff(vCombat + vWork, v);
    const slack = negCount(v) > 0 ? TRAIT_SIDE_SLACK : 0;
    const candidates = rc
      .filter(r => r.combat >= vCombat - slack && r.work >= vWork - slack
        && r.eff - vEff >= UPGRADE_MIN_DELTA)
      .map(r => ({ npc: r.npc, combat: r.combat, work: r.work, delta: r.eff - vEff }))
      .sort((a, b) => b.delta - a.delta);
    if (candidates.length) out.push({ villager: v, trainedLevels: lvlSum(v), vCombat, vWork, vPenalized: negCount(v) > 0, candidates });
  }
  // weakest ceilings first — most worth replacing; then assign each recruit
  // to at most ONE row (you can only hire a person once)
  const rows = out.sort((a, b) => (a.vCombat + a.vWork) - (b.vCombat + b.vWork)).slice(0, UPGRADE_MAX_ROWS);
  const used = new Set<string>();
  for (const row of rows) {
    row.candidates = row.candidates
      .filter(c => !used.has(c.npc.guid ?? npcName(c.npc)))
      .slice(0, UPGRADE_MAX_CANDIDATES);
    for (const c of row.candidates) used.add(c.npc.guid ?? npcName(c.npc));
  }
  return rows.filter(r => r.candidates.length > 0);
};

// "SlackerTrait" -> "Slacker"
export const traitLabel = (t: string): string => t.replace(/Trait$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
// acquired statuses that hurt (warn-styled); others (ExemplarySoldier,
// Marathoner) are buffs
export const NEGATIVE_TRAITS = new Set(['SlackerTrait', 'BlindTrait', 'WeakGripTrait', 'OnearmedTrait']);

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

  const jobPri = (v: Npc, skillKey: string) => v.job_priorities[SKILL_TO_JOB[skillKey] ?? skillKey] ?? DEFAULT_PRIORITY;
  const priMatch = (v: Npc) => WORK
    .filter(([k]) => {
      const s = v.skills[k];
      return s && (s.level > UNDERPRIORITISED_MIN_SKILL || s.cap > UNDERPRIORITISED_MIN_SKILL)
        && jobPri(v, k) >= DEFAULT_PRIORITY
        && Object.keys(v.job_priorities).length > 0; // non-workers have no priorities at all
    })
    .sort((a, b) => (v.skills[b[0]]?.level ?? 0) - (v.skills[a[0]]?.level ?? 0));

  add('suggest', 'up', 'Under-prioritised skills',
    `Skilled above ${UNDERPRIORITISED_MIN_SKILL} but their priority is still ${DEFAULT_PRIORITY} (the default) or weaker — lower the number so they take that job first.`,
    mine.filter(v => priMatch(v).length > 0),
    v => {
      const hit = priMatch(v)[0];
      const s = v.skills[hit[0]];
      return `${hit[2]} ${s.level}/${s.cap} · priority ${jobPri(v, hit[0])}`;
    });

  return cards;
};

// ---- world helpers ---------------------------------------------------------
export const playerNpcs = (w: World): Npc[] => w.npcs.filter(n => n.is_player_npc);
// Generic villagers (VillagerIdle/Beggar templates) are recruitable in-game
// too — they just carry no profession. Include them alongside the tiered
// profession templates so the browser covers the full recruitable pool.
export const recruitNpcs = (w: World): Npc[] =>
  w.npcs.filter(n => !n.is_player_npc && (n.archetype === 'recruitable' || n.archetype === 'villager'));
