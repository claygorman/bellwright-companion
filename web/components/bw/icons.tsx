// Line-icon set ported 1:1 from the Claude Design prototype (mkIcon).
import type { CSSProperties } from 'react';

const PATHS: Record<string, string[]> = {
  person: ['M12 12a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2', 'M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5'],
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
  hammer: ['M14 3l7 7-3 3-7-7z', 'M11 6L3 14l4 4 8-8'],
  recruit: ['M9 11.5a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8', 'M3 20c0-3.4 2.8-5 6-5', 'M18 6v6M15 9h6'],
  loot: ['M4 8h16v11H4z', 'M4 12h16', 'M10 12v3h4v-3', 'M7 8V6.5A2.5 2.5 0 019.5 4h5A2.5 2.5 0 0117 6.5V8'],
  camp: ['M5 5l14 14', 'M19 5L5 19'],
  helm: ['M5 12a7 7 0 0114 0v6H5z', 'M5 15h14', 'M11 9h2'],
  torso: ['M7 4l5 2 5-2 1 5-2 2v7H8v-7L6 9z'],
  legs: ['M8 3h8l-1 8-1 10h-2l-1-9-1 9H7l-1-10z'],
  gloves: ['M7 10V6a1.5 1.5 0 013 0M10 10V5a1.5 1.5 0 013 0v5M13 8a1.5 1.5 0 013 0v5a5 5 0 01-5 5H9a4 4 0 01-4-4v-2l2-2'],
  boots: ['M7 4h4v9l6 3v4H7z', 'M11 13l6 3'],
  sword: ['M14 3l7 7-3 3-7-7z', 'M14 10l-8 8', 'M6 22l4-4', 'M5 17l2 2'],
  bow: ['M6 3a14 14 0 010 18', 'M6 3l13 9-13 9', 'M6 12h13'],
  shield: ['M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z'],
  cloak: ['M12 3l6 4-2 3v9H8V10L6 7z', 'M12 3v16'],
  pack: ['M8 7V6a4 4 0 018 0v1', 'M6 7h12v13H6z', 'M6 12h12'],
  pouch: ['M7 8h10l-1 12H8z', 'M9 8V6a3 3 0 016 0v2'],
  tool: ['M14.5 3a4 4 0 00-1.4 6.9L4 19l1 1 9.1-9.1A4 4 0 0021 6l-3 3-2-2 3-3a4 4 0 00-4.5-1z'],
  strength: ['M4 9v6', 'M7 8v8', 'M17 8v8', 'M20 9v6', 'M7 12h10'],
  agility: ['M6 18l4-6 3 2 5-8', 'M16 4h3v3'],
  spear: ['M20 4L5 19', 'M20 4l-5 1 4 4z', 'M5 19l-1 1'],
  berry: ['M12 4c1.6 1.8 1.6 4-.2 5', 'M9.5 14a3 3 0 106 0 3 3 0 00-6 0', 'M8 10a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0'],
  wheat: ['M12 4v16', 'M12 9c-2-1-4-1-4-3 2 0 4 0 4 2', 'M12 9c2-1 4-1 4-3-2 0-4 0-4 2', 'M12 14c-2-1-4-1-4-3 2 0 4 0 4 2', 'M12 14c2-1 4-1 4-3-2 0-4 0-4 2'],
  paw: ['M7 12a1.4 1.4 0 100-.01', 'M10.5 9a1.4 1.4 0 100-.01', 'M13.5 9a1.4 1.4 0 100-.01', 'M17 12a1.4 1.4 0 100-.01', 'M8.5 16a3.5 3.5 0 017 0 2.6 2.6 0 01-7 0'],
  pot: ['M4 9h16', 'M6 9v6a3 3 0 003 3h6a3 3 0 003-3V9', 'M8.5 6c0-1.5 3-1.5 3 0', 'M4 12H3M20 12h1'],
  anvil: ['M5 9h11a4 4 0 01-4 4H9l-1 4', 'M6 17h6', 'M14 7l4 2'],
  scroll: ['M7 4h8a2 2 0 012 2v11a2 2 0 002 2H9a2 2 0 01-2-2z', 'M9.5 8h5M9.5 11h5M9.5 14h3'],
  meal: ['M3 13a9 9 0 0118 0z', 'M3 13h18', 'M12 4v2'],
  heart: ['M12 20s-7-4.6-7-10a3.6 3.6 0 017-1.1 3.6 3.6 0 017 1.1c0 5.4-7 10-7 10z'],
  cross: ['M9.5 4h5v5h5v5h-5v5h-5v-5h-5v-5h5z'],
  up: ['M12 19V6', 'M6 12l6-6 6 6'],
  barn: ['M3 10l9-6 9 6', 'M5 10v10h14V10', 'M9 20v-6h6v6', 'M3 10h18'],
  skull: ['M6 10.5a6 6 0 0112 0V14a2 2 0 01-2 2v2h-2v-2h-4v2H8v-2a2 2 0 01-2-2z', 'M9.4 11.2a1.2 1.2 0 100-.01', 'M14.6 11.2a1.2 1.2 0 100-.01', 'M12 15v2'],
};

export const Icon = ({ name, size = 14, color = 'currentColor', style }: {
  name: string; size?: number; color?: string; style?: CSSProperties;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {(PATHS[name] ?? []).map((d, i) => <path key={i} d={d} />)}
  </svg>
);

export const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#7a7060" strokeWidth={2}>
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
  </svg>
);

export const PinIcon = ({ size = 11, color = '#8a8069' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);
