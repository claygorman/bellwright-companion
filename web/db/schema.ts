// Drizzle schema — SQLite world-state store.
//
// snapshots    one row per ingested save (full world JSON + headline meta)
// npc_history  one row per PLAYER NPC per snapshot — normalized enough for
//              cheap progression/diff queries ("what changed since yesterday")
//              without exploding row counts (33 rows/snapshot, not 604).
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Npc, Storage, Meta, Group, Housing } from 'bellwright-parse/types';
import type { GearPreset } from 'bellwright-parse/gearpresets';
import type { PlayerState } from 'bellwright-parse/player';
import type { Poi } from 'bellwright-parse/pois';
import type { VillageState } from 'bellwright-parse/villages';

export type World = {
  ingested_at: string;
  meta: Meta;
  npcs: Npc[];
  storage: Storage;
  housing?: Housing; // villager sleeping quarters (absent on pre-2026-07-23 snapshots)
  groups?: Group[]; // absent on pre-2026-07-22 snapshots
  gear_sets?: Record<string, string[]>;
  gear_presets?: GearPreset[]; // custom preset definitions (named)
  player?: PlayerState; // the player pawn (absent on old snapshots)
  carried?: Record<string, { item: string; qty: number }[]>; // actor guid -> inventory
  pois?: Poi[];
  // per-village trust/prosperity/liberation (MistNeutralVillageComponent)
  villages?: VillageState[]; // per-village trust/prosperity/liberation
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

// System event log — webhook-style feed from the reader daemon (and the
// companion itself). Bounded ring buffer (pruned to a cap). Distinguishes
// "reader dead" (no heartbeat) from "game off" (stale telemetry).
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: integer('ts').notNull(), // producer clock (ms)
    receivedAt: integer('received_at').notNull(), // server clock (ms)
    source: text('source').notNull(), // reader | companion | publisher
    level: text('level').notNull(), // info | warn | error
    event: text('event').notNull(), // slug, e.g. offsets_invalid
    message: text('message').notNull(),
    meta: text('meta', { mode: 'json' }).$type<Record<string, string | number | boolean>>(),
  },
  t => [index('events_received').on(t.receivedAt), index('events_source').on(t.source)],
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
