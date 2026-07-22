'use client';
// Portrait resolution, best first:
//  1. REAL in-game portrait screenshot at /portraits/<name-slug>.png
//     (cropped from the player's population-screen photos — see
//     web/scripts note in docs; add more anytime)
//  2. generated SVG token from the save's appearance params
//  3. colored initials (snapshots that predate appearance extraction)
import { useEffect, useRef, useState } from 'react';
import type { Npc } from '@/lib/types';
import { avatarColor, initials } from '@/lib/bw/format';
import { npcName } from '@/lib/bw/model';
import { avatarStyle } from './ui';

const portraitSlug = (v: Npc): string =>
  npcName(v).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// SkinType "0".."6" → tone (rough match to the game's range, light→dark)
const SKIN: Record<string, string> = {
  '0': '#E8C29A', '1': '#DEB48A', '2': '#C99B72', '3': '#B98A62',
  '4': '#9C6F4C', '5': '#7E563B', '6': '#5C3E2A',
};
const HAIR_COLOR = '#3B2E22'; // silhouettes read as shape; one dark tone keeps it cohesive
const BG = '#221D16';

type HairFamily = 'short' | 'crew' | 'swept' | 'tied' | 'long' | 'combover' | 'pixie' | 'none';

const hairFamily = (hair: string | null): HairFamily => {
  if (!hair) return 'none';
  const h = hair.toLowerCase();
  if (/bald|none/.test(h)) return 'none';
  if (/manbun|pulled ?back|ponytail|bun/.test(h)) return 'tied';
  if (/pixie/.test(h)) return 'pixie';
  if (/crew|box|short/.test(h)) return 'crew';
  if (/swept|fringe|combover? ?back/.test(h)) return 'swept';
  if (/combover/.test(h)) return 'combover';
  if (/long|messy|wavy|casual|greystone(?!_)/.test(h)) return 'long';
  return 'short';
};

type BeardFamily = 'full' | 'goatee' | 'chinstrap' | 'none';
const beardFamily = (beard: string | null): BeardFamily => {
  if (!beard || /none/i.test(beard)) return 'none';
  const b = beard.toLowerCase();
  if (/chinstrap|soulpatch/.test(b)) return 'chinstrap';
  if (/goatee/.test(b)) return 'goatee';
  return 'full';
};

// paths are drawn in a 40x40 viewBox; head is a rounded shape centered ~ (20, 22)
const HAIR_PATHS: Record<HairFamily, string | null> = {
  none: null,
  crew: 'M11 15 Q12 8 20 8 Q28 8 29 15 L29 17 Q25 12.5 20 12.5 Q15 12.5 11 17 Z',
  short: 'M10.5 17 Q11 7.5 20 7.5 Q29 7.5 29.5 17 L29.5 20 Q28 12.5 20 12.5 Q12 12.5 10.5 20 Z',
  pixie: 'M10 18 Q10 7 20 7 Q30 7 30 18 L30 21 Q29 12 20 12 Q11 12 10 21 Z',
  swept: 'M10.5 17 Q11 7 21 7.5 Q29.5 8.5 29.5 16 L29.5 14.5 Q24 10.5 13 14.5 Q11 15.5 10.5 19 Z',
  combover: 'M10.5 16.5 Q10.5 8 19 8 Q28.5 8 29.5 16 L29.5 14 Q19 9.5 11 15.5 Q10.5 16 10.5 18 Z',
  tied: 'M11 16 Q11.5 8 20 8 Q28.5 8 29 16 L29 15 Q25 11.5 20 11.5 Q15 11.5 11 15 Z M17.5 6.5 A2.8 2.8 0 1 1 22.5 6.5 A2.8 2.8 0 1 1 17.5 6.5',
  long: 'M9.5 27 Q8.5 8 20 8 Q31.5 8 30.5 27 L28 27 Q29 14 20 12.5 Q11 14 12 27 Z',
};

const BEARD_PATHS: Record<BeardFamily, string | null> = {
  none: null,
  full: 'M12.5 24 Q13 32 20 33 Q27 32 27.5 24 Q26 29.5 20 30 Q14 29.5 12.5 24 Z',
  goatee: 'M17 29.5 Q17.5 33 20 33.2 Q22.5 33 23 29.5 Q21.5 31.2 20 31.2 Q18.5 31.2 17 29.5 Z',
  chinstrap: 'M13.5 26 Q15 31.5 20 32 Q25 31.5 26.5 26 Q25 30 20 30.4 Q15 30 13.5 26 Z',
};

export const Avatar = ({ v, size, radius }: { v: Npc; size: number; radius?: number }) => {
  const [noPortrait, setNoPortrait] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // error events can fire before hydration attaches onError — re-check on mount
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setNoPortrait(true);
  }, []);
  if (!noPortrait) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={imgRef} src={`/portraits/${portraitSlug(v)}.png`} alt="" width={size} height={size}
        onError={() => setNoPortrait(true)}
        style={{
          width: size, height: size, objectFit: 'cover',
          borderRadius: radius ?? Math.round(size / 4), background: BG,
          flex: '0 0 auto', display: 'block',
        }} />
    );
  }
  const a = v.appearance;
  const skin = a?.skin != null ? SKIN[a.skin] : undefined;
  if (!a || !skin) {
    // old snapshot without appearance data → initials fallback
    const name = npcName(v);
    const first = v.first_name ?? name, last = v.last_name ?? '';
    return (
      <div style={{ ...avatarStyle(size, avatarColor(first, last), radius ?? Math.round(size / 4)) }}>
        {initials(first, last)}
      </div>
    );
  }
  const hair = HAIR_PATHS[hairFamily(a.hair)];
  const beard = BEARD_PATHS[beardFamily(a.beard)];
  const hasMustache = a.mustache != null && !/none/i.test(a.mustache);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{
      borderRadius: radius ?? Math.round(size / 4), background: BG, flex: '0 0 auto', display: 'block',
    }}>
      {/* neck + shoulders */}
      <path d="M17 29 L23 29 L23 33 Q30 34.5 32 40 L8 40 Q10 34.5 17 33 Z" fill={skin} opacity={0.85} />
      {/* head */}
      <ellipse cx="20" cy="21" rx="8.6" ry="10" fill={skin} />
      {/* ears */}
      <circle cx="11.6" cy="22" r="1.7" fill={skin} />
      <circle cx="28.4" cy="22" r="1.7" fill={skin} />
      {/* eyes */}
      <circle cx="16.6" cy="21" r="1.05" fill="#2A2119" />
      <circle cx="23.4" cy="21" r="1.05" fill="#2A2119" />
      {/* mustache */}
      {hasMustache && <path d="M16.5 26.3 Q20 24.6 23.5 26.3 Q20 27.6 16.5 26.3 Z" fill={HAIR_COLOR} />}
      {/* beard */}
      {beard && <path d={beard} fill={HAIR_COLOR} />}
      {/* hair */}
      {hair && <path d={hair} fill={HAIR_COLOR} />}
    </svg>
  );
};
