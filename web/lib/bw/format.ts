// Shared formatting/color helpers for the Companion UI.
// Ported from the Claude Design prototype, adapted to real save data.
import type { Skill } from '@/lib/types';

// Cumulative XP required to REACH each level (index 0 = level 1).
// Reverse-engineered from the save (docs/save-format.md).
export const XP_CURVE = [600, 1200, 2999, 4800, 7198, 9600, 14578, 23802, 28800, 43214];
export const MAX_LEVEL = 10;

/** % progress from `level` toward `level+1` given cumulative xp. */
export const pctToNext = (s: Skill): number => {
  if (s.level >= MAX_LEVEL) return 100;
  const floor = s.level === 0 ? 0 : (XP_CURVE[s.level - 1] ?? 0);
  const ceil = XP_CURVE[s.level] ?? floor + 1;
  const pct = Math.round(((s.xp - floor) / (ceil - floor)) * 100);
  return Math.max(0, Math.min(100, pct));
};

/** "SturdyWarhammer_C" -> "Sturdy Warhammer" */
export const itemLabel = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return raw
    .replace(/_C$/, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim();
};

/** "BrokenLeg" -> "Broken Leg" */
export const injLabel = (x: string): string =>
  x.replace(/^BP_/, '').replace(/_C$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/** "NoviceLabourerNPCTemplate_C" -> "Novice Labourer" */
export const tplLabel = (t: string | null): string =>
  (t ?? '')
    .replace(/(?:Npc|NPC)?Template_C$|_C$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

export const moraleColor = (m: number): string =>
  m < 35 ? '#D9614A' : m < 60 ? '#D6A24A' : '#7FB05B';

export const avatarColor = (first: string, last: string): string => {
  const h = ((first.charCodeAt(0) || 65) * 7 + (last.charCodeAt(0) || 65) * 13) % 360;
  return `hsl(${h} 34% 62%)`;
};

export const initials = (first: string, last: string): string =>
  `${first[0] ?? '?'}${last[0] ?? ''}`;

/** relative "ingested 2m ago" label */
export const agoLabel = (iso: string): string => {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const playtimeLabel = (secs: number | null): string => {
  if (secs == null) return '—';
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
};

// Bellwright stat semantics: white ≤3 · gold 4–6 · green 7+/6+ toward cap
export const GREEN = '#7DB068';
export const GOLD = 'var(--accent)';
export const WHITE = '#EDE4D2';

export const skillNumColor = (s: Skill | undefined): string => {
  if (!s || s.cap <= 0) return '#4f483d';
  if (s.level >= 6) return GREEN;
  if (s.level >= 4) return GOLD;
  if (s.level >= 1) return WHITE;
  return '#6a6152';
};
