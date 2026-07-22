// Injury helpers: normalize both save shapes (old snapshots stored plain
// strings) and compute heal countdowns from the injury's start time.
import { injLabel } from './format.ts';

export type InjuryEntry = string | { type: string; since?: number | null };
export type InjuryVM = { type: string; label: string; since: number | null };

export const normalizeInjuries = (list: InjuryEntry[] | undefined): InjuryVM[] =>
  (list ?? []).map(x =>
    typeof x === 'string'
      ? { type: x, label: injLabel(x), since: null }
      : { type: x.type, label: injLabel(x.type), since: x.since ?? null });

// Total heal duration per injury type, in game-time seconds. The save only
// stores WHEN the injury was sustained; durations are game constants.
// FleshWound calibrated against the in-game "Heals in …" tooltip (2026-07-21).
export const INJURY_DURATION: Record<string, number> = {
  FleshWound: 2160, // 36min — calibrated live against the in-game timer 2026-07-21
};

export type HealCountdown = { remainingSeconds: number; fractionRemaining: number };

/** Countdown as of the snapshot's playtime; null when we can't know. */
export const healCountdown = (inj: InjuryVM, playtimeSeconds: number | null): HealCountdown | null => {
  const duration = INJURY_DURATION[inj.type];
  if (duration == null || inj.since == null || playtimeSeconds == null) return null;
  const elapsed = playtimeSeconds - inj.since;
  const remaining = duration - elapsed;
  if (remaining <= 0 || elapsed < 0) return null; // stale duration guess or clock oddity
  return { remainingSeconds: remaining, fractionRemaining: remaining / duration };
};

export const countdownLabel = (c: HealCountdown): string => {
  const m = Math.floor(c.remainingSeconds / 60);
  const s = Math.round(c.remainingSeconds % 60);
  return m > 0 ? `heals in ${m}m ${s}s` : `heals in ${s}s`;
};
