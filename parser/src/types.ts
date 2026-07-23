// Shared types for the Bellwright save parser.

export type Region = { off: number; len: number };

// v is number|bigint for 'v', number for 'd'/'f', Region for 'len'.
// Typed as any pragmatically — callers narrow by `kind` at runtime.
export type Field = { f: number; kind: 'v' | 'd' | 'f' | 'len'; v: any };

export type Skill = { level: number; xp: number; cap: number };

export type NpcArchetype = 'recruitable' | 'vendor' | 'villager' | 'combatant' | 'unique';

// `since` is the game-time (playtime seconds) when the injury was sustained;
// remaining heal time = duration(type) - (meta.playtimeSeconds - since).
export type Injury = { type: string; since: number | null };

export type Npc = {
  guid: string | null;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  template: string | null;
  faction: string | null;
  is_player_npc: boolean;
  archetype: NpcArchetype;
  profession: string | null;
  tier: string | null;
  village: string | null;
  job_priorities: Record<string, number>;
  // assigned gear-preset GUID ('4xu32' join) — resolves to a GearPreset.key
  // for custom presets; built-in presets exist only as unresolvable GUIDs
  gear_preset: string | null;
  position: number[] | null;
  skills: Record<string, Skill>;
  injuries: Injury[];
  // ACQUIRED trait statuses stored in the save (SlackerTrait, BlindTrait, …).
  // Innate traits (Neurotic, Coward, …) are generated in-engine and are NOT
  // persisted — verified by full recursive sweep 2026-07-22.
  traits: string[];
  morale: number | null;
  equipment: Record<string, string>;
  // occupant of any house (null = undeterminable); meaningful for player NPCs
  housed: boolean | null;
  // cosmetic appearance params (subset of the MistHuman k/v bag) — drives
  // generated avatars; faces are procedural in-engine, no image exists
  appearance: {
    skin: string | null;      // SkinType "0".."6"
    hair: string | null;      // e.g. "Hair_ManBun"
    beard: string | null;     // e.g. "Beard_L_Messy"
    mustache: string | null;  // e.g. "Mustache_M_Gunslinger"
    face: string | null;      // Face_Preset "1".."30"
  };
};

// One physical container actor (a barn, chest, station…). `name` is the
// player's custom rename when present; `cls` is the actor class; `id` is the
// actor GUID key so identically-named/classed buildings stay distinct.
export type ContainerRec = {
  id: string;
  name: string | null;
  cls: string | null;
  faction: string | null;
  position: number[] | null;
  items: Record<string, number>;
};

// Army-tab squad: MistCombatGroup actor with custom/display name + members
export type Group = {
  guid: string;
  name: string | null;
  members: string[]; // NPC actor GUIDs (hex)
};

export type Storage = {
  totals: Record<string, number>;
  npc_carried: Record<string, number>;
  containers: ContainerRec[];
};

export type Meta = {
  character: string | null;
  map: string | null;
  saveName: string | null;
  region: string | null;
  createdBuild: string | null;
  savedBuild: string | null;
  playtimeSeconds: number | null;
};
