// In-memory live-telemetry store (ephemeral, not persisted). A telemetry mod
// POSTs the live game state every second or two; the map reads the latest.
// Single-process Next standalone server → a module-level singleton is fine.
export type LiveActor = {
  id: string;                       // stable id (GUID hex or name)
  name?: string;
  kind: 'player' | 'villager' | 'hostile' | 'other';
  x: number;                        // UE world cm (same frame as save positions)
  y: number;
};
export type LiveVillage = {
  name: string;
  trust?: number;
  trust_level?: number;
  prosperity?: number;
  liberated?: boolean;
};
// A raid the game has scheduled/spawned against your settlement (Conquest).
export type RaidAlert = {
  active: boolean;
  village?: string;   // target settlement
  eta_s?: number;     // seconds until it hits (if known)
  party?: number;     // attacker count (if known)
  message?: string;   // human summary
};
export type Telemetry = {
  t: number;                        // sender's clock (ms), informational
  actors?: LiveActor[];
  villages?: LiveVillage[];
  raid?: RaidAlert;                 // AFK raid alert
};

type Stored = { received_at: number; data: Telemetry };

// Durable last-snapshot: persist to the PVC so the "last known" positions +
// tasks survive the game closing AND server restarts. The map/roster can then
// show where everyone was and what they were doing when the session ended,
// timestamped by received_at (age). Atomic write (tmp + rename) so concurrent
// /latest reads never see a half-written file.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'telemetry.json');

// survive dev hot-reload by parking on globalThis
const g = globalThis as unknown as { __bwTelemetry?: Stored | null };

export const setTelemetry = (data: Telemetry): void => {
  const stored: Stored = { received_at: Date.now(), data };
  g.__bwTelemetry = stored;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(stored));
    renameSync(tmp, FILE); // atomic on same filesystem
  } catch { /* PVC unavailable — in-memory copy still serves this process */ }
};

export const getTelemetry = (): Stored | null => {
  if (g.__bwTelemetry) return g.__bwTelemetry;
  // cold process (restart/redeploy): rehydrate the last snapshot from disk
  try {
    const stored = JSON.parse(readFileSync(FILE, 'utf8')) as Stored;
    g.__bwTelemetry = stored;
    return stored;
  } catch {
    return null;
  }
};
