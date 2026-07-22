// World-state types as served by /api/world (mirrors parser output).
export type Skill = { level: number; xp: number; cap: number };

export type NpcArchetype = 'recruitable' | 'vendor' | 'villager' | 'combatant' | 'unique';

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
  position: number[] | null;
  skills: Record<string, Skill>;
  // new snapshots: {type, since}; pre-2026-07-22 snapshots: plain strings
  injuries: (string | { type: string; since: number | null })[];
  morale: number | null;
  equipment: Record<string, string>;
  housed?: boolean | null;
  // absent on pre-2026-07-22 snapshots
  appearance?: {
    skin: string | null;
    hair: string | null;
    beard: string | null;
    mustache: string | null;
    face: string | null;
  } | null;
};

export type ContainerRec = {
  id: string;
  name: string | null;
  cls: string | null;
  faction: string | null;
  position: number[] | null;
  items: Record<string, number>;
};

export type StorageData = {
  totals: Record<string, number>;
  npc_carried: Record<string, number>;
  containers: ContainerRec[];
};

export type WorldMeta = {
  character: string | null;
  map: string | null;
  saveName: string | null;
  region: string | null;
  createdBuild: string | null;
  savedBuild: string | null;
  playtimeSeconds: number | null;
};

export type Group = {
  guid: string;
  name: string | null;
  members: string[]; // NPC actor GUIDs (hex)
};

export type World = {
  snapshot_id?: number;
  ingested_at: string;
  meta: WorldMeta;
  npcs: Npc[];
  storage: StorageData;
  groups?: Group[]; // absent on pre-2026-07-22 snapshots
};
