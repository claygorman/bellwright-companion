// Design tokens for the companion UI (Bellwright-inspired palette).
import type { CSSProperties } from 'react';

export const SERIF = "var(--font-spectral), 'Spectral', serif";
export const SANS = "var(--font-plex-sans), 'IBM Plex Sans', system-ui, sans-serif";
export const MONO = "var(--font-plex-mono), 'IBM Plex Mono', monospace";

export const C = {
  accent: 'var(--accent)',      // #E0A73C
  gold: 'var(--gold)',          // #F4C868
  pageBg: '#15120E',
  panelBg: '#16130E',
  cardBg: '#1B1711',
  cardBg2: '#1A160F',
  headBg: '#1C1811',
  inputBg: '#0F0D0A',
  border: '#241E18',
  border2: '#2C251C',
  border3: '#322A20',
  borderRow: '#201B15',
  text: '#E9E1D2',
  textBright: '#F1E7D4',
  textSerifBright: '#F4EBD8',
  textDim: '#9a8f7d',
  textDim2: '#8a8069',
  textFaint: '#7a7060',
  textFainter: '#6a6152',
  textDisabled: '#5f5849',
  green: '#7DB068',
  greenText: '#8FBF74',
  red: '#C4553B',
  redText: '#EDA593',
  redBar: '#D9614A',
  blue: '#5FA8CE',
  blueText: '#5FB4D6',
} as const;

export const rowBorder: CSSProperties = { borderBottom: `1px solid ${C.borderRow}` };

export const thStyle: CSSProperties = {
  position: 'sticky', top: 0, zIndex: 6, background: C.headBg,
  borderBottom: `1px solid ${C.border3}`, textAlign: 'left', padding: '8px 12px',
  color: '#B7A98F', fontWeight: 600, fontSize: 11, letterSpacing: '.6px',
  textTransform: 'uppercase',
};

export const searchBoxStyle = (h: number): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', height: h,
  background: C.inputBg, border: '1px solid #2E271E', borderRadius: 8,
});

export const searchInputStyle: CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none', color: C.text,
  fontSize: 13, fontFamily: 'inherit',
};

export const avatarStyle = (size: number, bg: string, radius = 7): CSSProperties => ({
  width: size, height: size, borderRadius: radius, flex: '0 0 auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: Math.round(size * 0.38), fontWeight: 600, color: '#0f0d0a', background: bg,
});

export const badge = (color: string, bg: string, bd: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px',
  borderRadius: 5, fontSize: 10.5, fontWeight: 500, color, background: bg,
  border: `1px solid ${bd}`, whiteSpace: 'nowrap',
});

export const sectionH3: CSSProperties = {
  margin: 0, fontFamily: SERIF, fontSize: 15, fontWeight: 600,
  color: '#D9CBB2', letterSpacing: '.3px',
};

export const miniBar = (
  width: number | string, height: number, pct: number, color: string,
): { outer: CSSProperties; inner: CSSProperties } => ({
  outer: {
    width, height, borderRadius: Math.ceil(height / 2),
    background: 'rgba(255,255,255,.08)', overflow: 'hidden',
  },
  inner: { height: '100%', width: `${pct}%`, background: color },
});

export const SEV = {
  alert: { c: '#E0997F', bg: 'rgba(196,85,59,.12)', bd: 'rgba(196,85,59,.4)', a: '#C4553B' },
  warn: { c: '#E8C07A', bg: 'rgba(224,167,60,.1)', bd: 'rgba(224,167,60,.35)', a: '#E0A73C' },
  suggest: { c: '#9AD0E6', bg: 'rgba(95,180,214,.1)', bd: 'rgba(95,180,214,.32)', a: '#5FB4D6' },
  tip: { c: '#A6D08C', bg: 'rgba(125,176,104,.1)', bd: 'rgba(125,176,104,.32)', a: '#7DB068' },
} as const;
