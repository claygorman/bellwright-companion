'use client';
// Compare tray (bottom bar) + compare modal (matrix table).
// Section-header rows are a DISTINCT row type with no value getter — the
// best-value pass never touches them (fix relayed from the design prototype).
import type { Npc } from '@/lib/types';
import { avatarColor, initials, itemLabel } from '@/lib/bw/format';
import { COMBAT, WORK, npcName } from '@/lib/bw/model';
import { C, MONO, SERIF, avatarStyle } from './ui';
import { Avatar } from './avatar';

export const CompareTray = ({ npcs, onRemove, onClear, onOpen }: {
  npcs: Npc[]; onRemove: (guid: string) => void; onClear: () => void; onOpen: () => void;
}) => (
  <div style={{
    flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px',
    borderTop: `1px solid ${C.border3}`, background: '#1B1712', zIndex: 18,
  }}>
    <span style={{ fontSize: 11, letterSpacing: '.5px', textTransform: 'uppercase', color: C.textDim2, fontWeight: 600 }}>Compare</span>
    <div style={{ display: 'flex', gap: 7, flex: '1 1 auto', flexWrap: 'wrap' }}>
      {npcs.map(v => {
        const name = npcName(v);
        const first = v.first_name ?? name, last = v.last_name ?? '';
        return (
          <span key={v.guid ?? name} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 6px 4px 4px',
            background: '#231E16', border: '1px solid #342C22', borderRadius: 8,
          }}>
            <Avatar v={v} size={22} radius={6} />
            <span style={{ fontSize: 12, color: C.text }}>{name}</span>
            <button onClick={() => onRemove(v.guid ?? name)} style={{
              background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer',
              fontSize: 14, lineHeight: 1, padding: '0 2px',
            }}>×</button>
          </span>
        );
      })}
    </div>
    <button onClick={onClear} style={{
      background: 'none', border: '1px solid #342C22', color: C.textDim, padding: '7px 12px',
      borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    }}>Clear</button>
    <button onClick={onOpen} disabled={npcs.length < 2} style={{
      padding: '7px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent)',
      color: '#1a150c', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
      cursor: npcs.length > 1 ? 'pointer' : 'not-allowed', opacity: npcs.length > 1 ? 1 : .5,
    }}>Compare ({npcs.length})</button>
  </div>
);

// matrix row model: sections carry no getter, so no accidental invocation
type MatrixRow =
  | { kind: 'section'; label: string }
  | { kind: 'value'; label: string; num: ((v: Npc) => number) | null; text: (v: Npc) => string };

const MATRIX: MatrixRow[] = [
  { kind: 'value', label: 'Morale', num: v => v.morale ?? -1, text: v => (v.morale != null ? String(Math.round(v.morale)) : '—') },
  { kind: 'section', label: 'Combat' },
  ...COMBAT.map(([key, , label]): MatrixRow => ({
    kind: 'value', label,
    num: v => v.skills[key]?.level ?? -1,
    text: v => (v.skills[key]?.cap ? `${v.skills[key].level}/${v.skills[key].cap}` : '—'),
  })),
  { kind: 'section', label: 'Work' },
  ...WORK.map(([key, , label]): MatrixRow => ({
    kind: 'value', label,
    num: v => v.skills[key]?.level ?? -1,
    text: v => (v.skills[key]?.cap ? `${v.skills[key].level}/${v.skills[key].cap}` : '—'),
  })),
  { kind: 'section', label: 'Gear' },
  { kind: 'value', label: 'Weapon', num: null, text: v => itemLabel(v.equipment.weapon) || 'Unarmed' },
  { kind: 'value', label: 'Off-hand', num: null, text: v => (v.equipment.offhand ? itemLabel(v.equipment.offhand) : '—') },
];

export const CompareModal = ({ npcs, onClose }: { npcs: Npc[]; onClose: () => void }) => (
  <div onClick={onClose} style={{
    position: 'fixed', inset: 0, background: 'rgba(8,7,5,.65)', backdropFilter: 'blur(2px)',
    zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, animation: 'bwfade .16s ease',
  }}>
    <div onClick={e => e.stopPropagation()} className="bw-scroll" style={{
      background: C.panelBg, border: `1px solid ${C.border3}`, borderRadius: 14,
      maxWidth: 900, width: '100%', maxHeight: '88vh', overflowY: 'auto',
      boxShadow: '0 24px 60px rgba(0,0,0,.6)',
    }}>
      <div style={{
        position: 'sticky', top: 0, background: '#1B1712', borderBottom: '1px solid #2A231A',
        padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5,
      }}>
        <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: C.textSerifBright }}>Compare villagers</h3>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #342C22', color: C.textDim, width: 30, height: 30,
          borderRadius: 8, cursor: 'pointer', fontSize: 16,
        }}>×</button>
      </div>
      <div style={{ padding: '18px 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px' }} />
              {npcs.map(v => {
                const name = npcName(v);
                const first = v.first_name ?? name, last = v.last_name ?? '';
                return (
                  <th key={v.guid ?? name} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: `1px solid ${C.border2}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar v={v} size={26} radius={7} />
                      <span style={{ color: C.textBright, fontWeight: 600, fontFamily: SERIF, fontSize: 14 }}>{name}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textDim2, fontWeight: 400, marginTop: 3 }}>
                      {v.gender ?? ''}{v.village ? ` · ${v.village}` : ''}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map(row => {
              if (row.kind === 'section') {
                return (
                  <tr key={`s-${row.label}`}>
                    <td style={{
                      padding: '12px 8px 5px', borderBottom: `1px solid ${C.borderRow}`, color: 'var(--accent)',
                      fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px',
                    }}>{row.label}</td>
                    {npcs.map((v, i) => <td key={i} style={{ borderBottom: `1px solid ${C.borderRow}` }} />)}
                  </tr>
                );
              }
              // best-value highlight only when a numeric getter exists
              const nums = row.num ? npcs.map(row.num) : null;
              const best = nums ? Math.max(...nums) : null;
              return (
                <tr key={row.label}>
                  <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.borderRow}`, color: '#B3A88F', fontSize: 12 }}>{row.label}</td>
                  {npcs.map((v, i) => {
                    const isBest = nums != null && best != null && best > 0 && nums[i] === best && npcs.length > 1;
                    return (
                      <td key={i} style={{
                        padding: '5px 10px', borderBottom: `1px solid ${C.borderRow}`, fontFamily: MONO,
                        fontSize: 12, color: isBest ? 'var(--gold)' : '#D6CBB4', fontWeight: isBest ? 600 : 400,
                      }}>{row.text(v)}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
