// Drizzle schema — SQLite world-state store.
//
// snapshots    one row per ingested save (full world JSON + headline meta)
// npc_history  one row per PLAYER NPC per snapshot — normalized enough for
//              cheap progression/diff queries ("what changed since yesterday")
//              without exploding row counts (33 rows/snapshot, not 604).
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Npc, Storage, Meta, Group } from 'bellwright-parse/types';
import type { GearPreset } from 'bellwright-parse/gearpresets';
import type { PlayerState } from 'bellwright-parse/player';
import type { Poi } from 'bellwright-parse/pois';

export type World = {
  ingested_at: string;
  meta: Meta;
  npcs: Npc[];
  storage: Storage;
  groups?: Group[]; // absent on pre-2026-07-22 snapshots
  gear_sets?: Record<string, string[]>;
  gear_presets?: GearPreset[]; // custom preset definitions (named)
  player?: PlayerState; // the player pawn (absent on old snapshots)
  carried?: Record<string, { item: string; qty: number }[]>; // actor guid -> inventory
  pois?: Poi[]; // camps/chests/shrines/wildlife-spawner map points
};

export const snapshots = sqliteTable(
  'snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ingestedAt: text('ingested_at').notNull(),
    saveName: text('save_name'),
    savedBuild: text('saved_build'),
    region: text('region'),
    playtimeSeconds: integer('playtime_seconds'),
    npcCount: integer('npc_count').notNull(),
    mineCount: integer('mine_count').notNull(),
    world: text('world', { mode: 'json' }).$type<World>().notNull(),
  },
  t => [
    // same save at the same playtime = re-push of an identical world; upsert instead
    uniqueIndex('snapshots_save_playtime').on(t.saveName, t.playtimeSeconds),
  ],
);

export const npcHistory = sqliteTable(
  'npc_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => snapshots.id, { onDelete: 'cascade' }),
    guid: text('guid').notNull(),
    name: text('name').notNull(),
    morale: real('morale'),
    injuries: text('injuries', { mode: 'json' })
      .$type<(string | { type: string; since: number | null })[]>()
      .notNull(),
    skills: text('skills', { mode: 'json' })
      .$type<Record<string, { level: number; xp: number; cap: number }>>()
      .notNull(),
    equipment: text('equipment', { mode: 'json' }).$type<Record<string, string>>().notNull(),
    jobPriorities: text('job_priorities', { mode: 'json' })
      .$type<Record<string, number>>()
      .notNull(),
  },
  t => [index('npc_history_guid').on(t.guid), index('npc_history_snapshot').on(t.snapshotId)],
);
