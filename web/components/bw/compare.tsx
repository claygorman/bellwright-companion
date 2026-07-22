'use client';
// Compare tray (bottom bar) + compare modal (matrix table).
// Section-header rows are a DISTINCT row type with no value getter — the
// best-value pass never touches them (fix relayed from the design prototype).
import type { Npc } from '@/lib/types';
import { itemLabel } from '@/lib/bw/format';
import { COMBAT, WORK, npcName } from '@/lib/bw/model';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';

export const CompareTray = ({ npcs, onRemove, onClear, onOpen }: {
  npcs: Npc[]; onRemove: (guid: string) => void; onClear: () => void; onOpen: () => void;
}) => (
  <div className="flex-none flex items-center gap-3 py-2.5 px-[18px] border-t border-line-4 bg-[#1B1712] z-[18]">
    <span className="text-[11px] tracking-[.5px] uppercase text-sand-400 font-semibold">Compare</span>
    <div className="flex gap-[7px] flex-1 flex-wrap">
      {npcs.map(v => {
        const name = npcName(v);
        const first = v.first_name ?? name, last = v.last_name ?? '';
        return (
          <span key={v.guid ?? name} className="inline-flex items-center gap-[7px] py-1 pr-1.5 pl-1 bg-[#231E16] border border-[#342C22] rounded-lg">
            <Avatar v={v} size={22} radius={6} />
            <span className="text-xs text-sand-200">{name}</span>
            <button onClick={() => onRemove(v.guid ?? name)}
              className="bg-none border-none text-sand-600 cursor-pointer text-sm leading-none px-0.5 hover:text-[#EDA593]">×</button>
          </span>
        );
      })}
    </div>
    <button onClick={onClear}
      className="bg-none border border-[#342C22] text-sand-400 py-[7px] px-3 rounded-lg text-xs cursor-pointer font-sans hover:border-[#4a4030]">Clear</button>
    <button onClick={onOpen} disabled={npcs.length < 2} className={cn(
      'py-[7px] px-3.5 rounded-lg border border-gold bg-gold text-[#1a150c] text-[12.5px] font-semibold font-sans',
      npcs.length > 1 ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50',
    )}>Compare ({npcs.length})</button>
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
  <div onClick={onClose}
    className="fixed inset-0 bg-[rgba(8,7,5,.65)] backdrop-blur-[2px] z-[70] flex items-center justify-center p-6 [animation:bwfade_.16s_ease]">
    <div onClick={e => e.stopPropagation()}
      className="bw-scroll bg-iron-850 border border-line-4 rounded-[14px] max-w-[900px] w-full max-h-[88vh] overflow-y-auto shadow-[0_24px_60px_rgba(0,0,0,.6)]">
      <div className="sticky top-0 bg-[#1B1712] border-b border-[#2A231A] py-[15px] px-5 flex items-center justify-between z-[5]">
        <h3 className="m-0 font-serif text-[17px] font-semibold text-sand-50">Compare villagers</h3>
        <button onClick={onClose}
          className="bg-none border border-[#342C22] text-sand-400 w-[30px] h-[30px] rounded-lg cursor-pointer text-base hover:border-[#4a4030] hover:text-[#EDA593]">×</button>
      </div>
      <div className="py-[18px] px-5">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2" />
              {npcs.map(v => {
                const name = npcName(v);
                const first = v.first_name ?? name, last = v.last_name ?? '';
                return (
                  <th key={v.guid ?? name} className="py-1.5 px-2.5 text-left border-b border-line-2">
                    <div className="flex items-center gap-2">
                      <Avatar v={v} size={26} radius={7} />
                      <span className="text-sand-100 font-semibold font-serif text-sm">{name}</span>
                    </div>
                    <div className="text-[10.5px] text-sand-400 font-normal mt-[3px]">
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
                    <td className="py-[5px] pt-3 px-2 border-b border-row text-gold font-semibold text-[10px] uppercase tracking-[.5px]">{row.label}</td>
                    {npcs.map((v, i) => <td key={i} className="border-b border-row" />)}
                  </tr>
                );
              }
              // best-value highlight only when a numeric getter exists
              const nums = row.num ? npcs.map(row.num) : null;
              const best = nums ? Math.max(...nums) : null;
              return (
                <tr key={row.label}>
                  <td className="py-[5px] px-2 border-b border-row text-sand-350 font-normal text-xs">{row.label}</td>
                  {npcs.map((v, i) => {
                    const isBest = nums != null && best != null && best > 0 && nums[i] === best && npcs.length > 1;
                    return (
                      <td key={i} className={cn(
                        'py-[5px] px-2.5 border-b border-row font-mono text-xs',
                        isBest ? 'text-gold-bright font-semibold' : 'text-[#D6CBB4] font-normal',
                      )}>{row.text(v)}</td>
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
