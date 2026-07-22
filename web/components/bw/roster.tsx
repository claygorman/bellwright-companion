'use client';
// Villagers/Recruits table (desktop) + cards (mobile).
import type { CSSProperties } from 'react';
import type { Npc } from '@/lib/types';
import { avatarColor, initials, itemLabel, moraleColor, tplLabel } from '@/lib/bw/format';
import { normalizeInjuries } from '@/lib/bw/injuries';
import { ALL_SKILLS, shapeCell, professionOf, combatTotal, classifyRole, ROLE_COLORS, NOTABLE_COMBAT_TOTAL, npcName } from '@/lib/bw/model';
import { InjuryBadge } from './injury-badge';
import { Avatar } from './avatar';
import { C, MONO, avatarStyle, miniBar, rowBorder, thStyle } from './ui';

export type SortState = { key: string; dir: 1 | -1 };

type Props = {
  rows: Npc[];
  npcCol: boolean;         // recruits view: archetype + location columns
  playtime: number | null; // save playtime, for injury heal countdowns
  ingestedAt: string | null; // ingest wall-clock, anchors live countdown ticking
  isMobile: boolean;
  compareMode: boolean;
  compareSet: string[];
  sort: SortState;
  onSort: (key: string, defDir: 1 | -1) => void;
  onOpen: (guid: string) => void;
  onToggleCompare: (guid: string) => void;
};

const skillTh = (active: boolean, divider: boolean): CSSProperties => ({
  ...thStyle, padding: '8px 3px', textAlign: 'center', width: 44, cursor: 'pointer',
  color: active ? C.textBright : C.textDim, fontSize: 10, letterSpacing: '.3px',
  ...(divider ? { borderLeft: '1px solid #2A231A' } : {}),
});

export const guidOf = (v: Npc): string => v.guid ?? npcName(v);

export const Roster = ({ rows, npcCol, playtime, ingestedAt, isMobile, compareMode, compareSet, sort, onSort, onOpen, onToggleCompare }: Props) => {
  if (isMobile) return <MobileCards rows={rows} npcCol={npcCol} onOpen={onOpen} />;
  const arrow = sort.dir > 0 ? '▲' : '▼';
  return (
    <div className="bw-scroll" style={{ overflow: 'auto', height: '100%' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1120, fontSize: 12.5 }}>
        <thead>
          <tr>
            {compareMode && <th style={{ ...thStyle, width: 36, padding: 0 }} />}
            <th onClick={() => onSort('name', 1)} style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 7, cursor: 'pointer', minWidth: 190 }}>
              Villager <span style={{ color: C.accent }}>{sort.key === 'name' ? arrow : ''}</span>
            </th>
            {npcCol && <th style={{ ...thStyle, padding: '8px 10px' }}>Archetype</th>}
            {ALL_SKILLS.map(([key, abbr, name], i) => (
              <th key={key} onClick={() => onSort(key, -1)} data-tip={name} style={skillTh(sort.key === key, i === 7)}>
                <span>{abbr}</span>
                {sort.key === key && <span style={{ color: C.accent, fontSize: 8 }}> {arrow}</span>}
              </th>
            ))}
            <th style={{ ...thStyle, borderLeft: '1px solid #2A231A' }}>Gear</th>
            <th onClick={() => onSort('morale', 1)} style={{ ...thStyle, cursor: 'pointer' }}>
              Morale <span style={{ color: C.accent }}>{sort.key === 'morale' ? arrow : ''}</span>
            </th>
            <th style={thStyle}>Status</th>
            {npcCol && <th style={thStyle}>Location</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(v => <Row key={guidOf(v)} v={v} npcCol={npcCol} playtime={playtime} ingestedAt={ingestedAt} compareMode={compareMode}
            selected={compareSet.includes(guidOf(v))} onOpen={onOpen} onToggleCompare={onToggleCompare} />)}
        </tbody>
      </table>
    </div>
  );
};

const Row = ({ v, npcCol, playtime, ingestedAt, compareMode, selected, onOpen, onToggleCompare }: {
  v: Npc; npcCol: boolean; playtime: number | null; ingestedAt: string | null; compareMode: boolean; selected: boolean;
  onOpen: (g: string) => void; onToggleCompare: (g: string) => void;
}) => {
  const name = npcName(v);
  const first = v.first_name ?? name, last = v.last_name ?? '';
  const morale = v.morale != null ? Math.round(v.morale) : null;
  const mc = morale != null ? moraleColor(morale) : C.textDisabled;
  const prof = professionOf(v);
  const notable = combatTotal(v) >= NOTABLE_COMBAT_TOTAL;
  const g = guidOf(v);
  return (
    <tr onClick={() => onOpen(g)} className="bw-row" style={{ cursor: 'pointer', ...rowBorder }}>
      {compareMode && (
        <td style={{ textAlign: 'center', ...rowBorder }}>
          <button onClick={e => { e.stopPropagation(); onToggleCompare(g); }} style={{
            width: 18, height: 18, borderRadius: 5, cursor: 'pointer', fontSize: 11, lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${selected ? 'var(--accent)' : '#4a4030'}`,
            background: selected ? 'var(--accent)' : 'transparent',
            color: selected ? '#0f0d0a' : 'transparent',
          }}>{selected ? '✓' : ''}</button>
        </td>
      )}
      <td style={{ padding: 'var(--rowpad) 12px', ...rowBorder, position: 'sticky', left: 0, background: C.pageBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar v={v} size={28} radius={7} />
          <div style={{ minWidth: 0, lineHeight: 1.15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textBright, fontWeight: 500, whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#877C69' }}>
              {prof && (
                <span style={{
                  display: 'inline-block', padding: '0 5px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                  letterSpacing: '.3px', textTransform: 'uppercase', color: '#8FA05B', background: '#8FA05B22',
                }}>{prof}</span>
              )}
              {v.gender ?? ''}
            </div>
          </div>
        </div>
      </td>
      {npcCol && (
        <td style={{ padding: '6px 10px', ...rowBorder, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {notable && <span data-tip="High-value recruit" style={{ color: C.gold }}>★</span>}
            <span style={{ fontSize: 11.5, color: '#B3A88F' }}>{tplLabel(v.template)}</span>
            <span data-tip="Role by skill caps (potential)" style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase',
              color: ROLE_COLORS[classifyRole(v)], border: `1px solid ${ROLE_COLORS[classifyRole(v)]}55`,
              padding: '1px 5px', borderRadius: 4,
            }}>{classifyRole(v)}</span>
          </span>
        </td>
      )}
      {ALL_SKILLS.map(([key, , sname], i) => {
        const c = shapeCell(sname, v.skills[key]);
        const bar = miniBar(30, 3, c.barPct, c.numColor);
        return (
          <td key={key} data-tip={c.tip} style={{
            padding: '6px 4px', ...rowBorder, textAlign: 'center',
            ...(i === 7 ? { borderLeft: '1px solid #2A231A' } : {}),
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: c.numColor }}>{c.disp}</span>
              {c.showBar && <div style={bar.outer}><div style={bar.inner} /></div>}
            </div>
          </td>
        );
      })}
      <td style={{ padding: '6px 12px', ...rowBorder, borderLeft: `1px solid ${C.borderRow}`, whiteSpace: 'nowrap', lineHeight: 1.3 }}>
        <div style={{ color: '#DCD2BE', fontSize: 11.5 }}>{itemLabel(v.equipment.weapon) || 'Unarmed'}</div>
        <div style={{ fontSize: 10.5, color: v.equipment.offhand ? C.textDim : C.textDisabled }}>
          {v.equipment.offhand ? itemLabel(v.equipment.offhand) : 'No shield'}
        </div>
      </td>
      <td style={{ padding: '6px 12px', ...rowBorder }}>
        {morale != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={miniBar(36, 5, morale, mc).outer}><div style={miniBar(36, 5, morale, mc).inner} /></div>
            <span style={{ fontFamily: MONO, fontSize: 11, color: mc }}>{morale}</span>
          </div>
        ) : <span style={{ fontSize: 11, color: C.textDisabled }}>—</span>}
      </td>
      <td style={{ padding: '6px 12px', ...rowBorder }}>
        {v.injuries.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {normalizeInjuries(v.injuries).map(inj => (
              <InjuryBadge key={inj.type} inj={inj} playtime={playtime} ingestedAt={ingestedAt} />
            ))}
          </div>
        ) : <span style={{ fontSize: 11, color: '#5f7a52' }}>Healthy</span>}
      </td>
      {npcCol && (
        <td style={{ padding: '6px 12px', ...rowBorder, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 11.5, color: '#B3A88F' }}>{v.village ? `near ${v.village}` : '—'}</div>
          {v.position && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.textFainter }}>
              [{Math.round(v.position[0])}, {Math.round(v.position[1])}]
            </div>
          )}
        </td>
      )}
    </tr>
  );
};

const MobileCards = ({ rows, npcCol, onOpen }: {
  rows: Npc[]; npcCol: boolean; onOpen: (g: string) => void;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 14 }}>
    {rows.map(v => {
      const name = npcName(v);
      const first = v.first_name ?? name, last = v.last_name ?? '';
      const morale = v.morale != null ? Math.round(v.morale) : null;
      const top = ALL_SKILLS
        .map(([key, abbr, sname]) => ({ abbr, sname, s: v.skills[key] }))
        .filter(o => o.s && o.s.cap > 0)
        .sort((a, b) => b.s.level - a.s.level).slice(0, 3);
      return (
        <div key={guidOf(v)} onClick={() => onOpen(guidOf(v))} style={{
          background: C.cardBg, border: `1px solid ${C.border2}`, borderRadius: 11, padding: 13, cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Avatar v={v} size={36} radius={9} />
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ color: C.textBright, fontWeight: 600, fontSize: 15 }}>{name}</div>
              <div style={{ fontSize: 11.5, color: '#877C69' }}>{v.gender ?? ''} · {tplLabel(v.template)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {morale != null && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: moraleColor(morale) }}>♥ {morale}</span>
              )}
              {v.injuries.length > 0 && (
                <span style={{ fontSize: 10, color: C.redText }}>
                  {normalizeInjuries(v.injuries).map(i => i.label).join(', ')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
            {top.map(o => {
              const cell = shapeCell(o.sname, o.s);
              return (
                <span key={o.abbr} style={{
                  display: 'inline-flex', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 6,
                  background: '#221D16', border: '1px solid #2E271E',
                }}>
                  <span style={{ color: C.textDim2 }}>{o.abbr}</span>
                  <span style={{ fontFamily: MONO, color: cell.numColor }}>{o.s.level}/{o.s.cap}</span>
                </span>
              );
            })}
          </div>
          <div style={{
            marginTop: 10, paddingTop: 9, borderTop: '1px solid #241E17',
            display: 'flex', justifyContent: 'space-between', fontSize: 11.5,
          }}>
            <span style={{ color: '#DCD2BE' }}>
              {itemLabel(v.equipment.weapon) || 'Unarmed'}
              <span style={{ color: C.textFainter }}> · </span>
              <span style={{ color: C.textDim }}>{v.equipment.offhand ? itemLabel(v.equipment.offhand) : 'No shield'}</span>
            </span>
            {npcCol && v.village && <span style={{ color: C.textFainter }}>near {v.village}</span>}
          </div>
        </div>
      );
    })}
  </div>
);
