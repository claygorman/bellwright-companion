'use client';
// Injury badge modeled on the in-game treatment: red disc icon with a radial
// countdown ring + "heals in Xm Ys", ticking down in real time anchored to
// the snapshot's ingest timestamp. Game time only advances while playing, so
// a paused game makes us run a little early — the tooltip says "estimated".
import { useEffect, useState } from 'react';
import { healCountdown, INJURY_DURATION, type InjuryVM } from '@/lib/bw/injuries';
import { C, MONO, badge } from './ui';

const TICK_MS = 1000;

const fmt = (secs: number): string => {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
};

// blood-splat-ish mark inside the disc
const Splat = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
    <circle cx="10" cy="11" r="4.2" />
    <circle cx="15.5" cy="8.5" r="2.1" />
    <circle cx="15" cy="14.5" r="1.6" />
    <circle cx="7" cy="6.5" r="1.4" />
    <circle cx="12.5" cy="17.5" r="1.2" />
  </svg>
);

export const InjuryBadge = ({ inj, playtime, ingestedAt, size = 'chip' }: {
  inj: InjuryVM;
  playtime: number | null;
  ingestedAt: string | null;
  size?: 'chip' | 'large';
}) => {
  const atSave = healCountdown(inj, playtime);
  // nowMs stays null through SSR/hydration; ticking starts client-side
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!atSave || !ingestedAt) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [atSave != null, ingestedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = INJURY_DURATION[inj.type];
  let remaining = atSave?.remainingSeconds ?? null;
  if (remaining != null && nowMs != null && ingestedAt) {
    remaining = Math.max(0, remaining - (nowMs - Date.parse(ingestedAt)) / 1000);
  }
  const healedByNow = remaining === 0;
  const frac = remaining != null && duration ? remaining / duration : null;

  const disc = size === 'large' ? 22 : 15;
  const ring = frac != null
    ? `conic-gradient(#E0574A ${Math.round(frac * 360)}deg, rgba(255,255,255,.18) 0)`
    : '#A03A2E';
  return (
    <span data-tip={remaining != null
      ? `${inj.label} — estimated from the last save; game time pauses while you're not playing`
      : inj.label}
      style={{
        ...badge(C.redText, 'rgba(196,85,59,.16)', 'rgba(196,85,59,.45)'),
        ...(size === 'large' ? { fontSize: 11.5, padding: '3px 9px', borderRadius: 6 } : {}),
        gap: 6,
      }}>
      <span style={{
        width: disc, height: disc, borderRadius: '50%', flex: '0 0 auto',
        background: ring, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          width: disc - 3, height: disc - 3, borderRadius: '50%', background: '#7E2B21',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Splat size={disc - 6} /></span>
      </span>
      {inj.label}
      {remaining != null && (
        <span style={{ fontFamily: MONO, fontSize: size === 'large' ? 10.5 : 9.5, color: healedByNow ? '#A6D08C' : '#F0B9A8' }}>
          {healedByNow ? '~healed' : `heals in ${fmt(remaining)}`}
        </span>
      )}
    </span>
  );
};
