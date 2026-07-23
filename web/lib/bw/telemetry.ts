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
export type Telemetry = {
  t: number;                        // sender's clock (ms), informational
  actors?: LiveActor[];
  villages?: LiveVillage[];
};

type Stored = { received_at: number; data: Telemetry };

// survive dev hot-reload by parking on globalThis
const g = globalThis as unknown as { __bwTelemetry?: Stored | null };
export const setTelemetry = (data: Telemetry): void => {
  g.__bwTelemetry = { received_at: Date.now(), data };
};
export const getTelemetry = (): Stored | null => g.__bwTelemetry ?? null;
