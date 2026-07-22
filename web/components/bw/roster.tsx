'use client';
// Villagers/Recruits table (desktop) + cards (mobile).
import type { Npc } from '@/lib/types';
import { cn } from '@/lib/utils';
import { avatarColor, initials, itemLabel, moraleColor } from '@/lib/bw/format';
import { normalizeInjuries } from '@/lib/bw/injuries';
import { ALL_SKILLS, shapeCell, professionOf, combatTotal, classifyRole, ROLE_COLORS, NOTABLE_COMBAT_TOTAL, npcName, archetypeLabel, hireGateOf } from '@/lib/bw/model';
import { InjuryBadge } from './injury-badge';
import { Avatar } from './avatar';
import { Icon } from './icons';
import { ItemImg } from './item-img';
import { C } from './ui';

export type SortState = { key: string; dir: 1 | -1 };
type Carried = Record<string, { item: string; qty: number }[]>;

type Props = {
  rows: Npc[];
  npcCol: boolean;         // recruits view: location column + "near village"
  archCol?: boolean;       // archetype/background column + role chip (both tables)
  playtime: number | null; // save playtime, for injury heal countdowns
  ingestedAt: string | null; // ingest wall-clock, anchors live countdown ticking
  isMobile: boolean;
  view: 'skills' | 'gear'; // gear view swaps skill columns for armor + inventory
  carried?: Carried;       // actor guid -> carried items (gear view)
  compareMode: boolean;
  compareSet: string[];
  sort: SortState;
  onSort: (key: string, defDir: 1 | -1) => void;
  onOpen: (guid: string) => void;
  onToggleCompare: (guid: string) => void;
};

const TH = 'sticky top-0 z-[6] bg-iron-700 border-b border-line-4 text-left py-2 px-3 text-sand-350 font-semibold text-[11px] tracking-[.6px] uppercase';

const skillTh = (active: boolean, divider: boolean): string => cn(
  'sticky top-0 z-[6] bg-iron-700 border-b border-line-4 py-2 px-[3px] font-semibold text-[10px] tracking-[.3px] cursor-pointer text-center w-11 hover:text-sand-100',
  active ? 'text-sand-100' : 'text-sand-400',
  divider && 'border-l border-[#2A231A]',
);

export const guidOf = (v: Npc): string => v.guid ?? npcName(v);

export const Roster = ({ rows, npcCol, archCol = false, playtime, ingestedAt, isMobile, view, carried, compareMode, compareSet, sort, onSort, onOpen, onToggleCompare }: Props) => {
  if (isMobile) return <MobileCards rows={rows} npcCol={npcCol} onOpen={onOpen} />;
  const arrow = sort.dir > 0 ? '▲' : '▼';
  const gearView = view === 'gear';
  return (
    <div className="bw-scroll overflow-auto h-full">
      <table className={cn('border-separate border-spacing-0 w-full text-[12.5px]', gearView ? 'min-w-[900px]' : 'min-w-[1120px]')}>
        <thead>
          <tr>
            {compareMode && <th className={cn(TH, 'w-9 p-0')} />}
            <th onClick={() => onSort('name', 1)} className={cn(TH, 'left-0 z-[7] cursor-pointer min-w-[190px] hover:text-sand-100')}>
              Villager <span className="text-gold">{sort.key === 'name' ? arrow : ''}</span>
            </th>
            {archCol && <th className={cn(TH, 'px-2.5')}>Archetype</th>}
            {!gearView && ALL_SKILLS.map(([key, abbr, name], i) => (
              <th key={key} onClick={() => onSort(key, -1)} data-tip={name} className={skillTh(sort.key === key, i === 7)}>
                <span>{abbr}</span>
                {sort.key === key && <span className="text-gold text-[8px]"> {arrow}</span>}
              </th>
            ))}
            {gearView && <th className={cn(TH, 'border-l border-[#2A231A]')}>Armor</th>}
            {gearView && <th className={cn(TH, 'border-l border-[#2A231A]')}>Inventory</th>}
            <th className={cn(TH, 'border-l border-[#2A231A]')}>Gear</th>
            <th onClick={() => onSort('morale', 1)} className={cn(TH, 'cursor-pointer hover:text-sand-100')}>
              Morale <span className="text-gold">{sort.key === 'morale' ? arrow : ''}</span>
            </th>
            <th className={TH}>Status</th>
            {npcCol && <th className={TH}>Location</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(v => <Row key={guidOf(v)} v={v} npcCol={npcCol} archCol={archCol} playtime={playtime} ingestedAt={ingestedAt} compareMode={compareMode}
            gearView={gearView} carried={carried}
            selected={compareSet.includes(guidOf(v))} onOpen={onOpen} onToggleCompare={onToggleCompare} />)}
        </tbody>
      </table>
    </div>
  );
};

const Row = ({ v, npcCol, archCol, playtime, ingestedAt, compareMode, gearView, carried, selected, onOpen, onToggleCompare }: {
  v: Npc; npcCol: boolean; archCol: boolean; playtime: number | null; ingestedAt: string | null; compareMode: boolean;
  gearView: boolean; carried?: Carried; selected: boolean;
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
    <tr onClick={() => onOpen(g)} className="bw-row cursor-pointer border-b border-row">
      {compareMode && (
        <td className="text-center border-b border-row">
          <button onClick={e => { e.stopPropagation(); onToggleCompare(g); }} className={cn(
            'w-[18px] h-[18px] rounded-[5px] border cursor-pointer text-[11px] leading-none inline-flex items-center justify-center',
            selected ? 'border-gold bg-gold text-[#0f0d0a]' : 'border-[#4a4030] bg-transparent text-transparent',
          )}>{selected ? '✓' : ''}</button>
        </td>
      )}
      <td className="py-[var(--rowpad)] px-3 border-b border-row sticky left-0 bg-iron-900">
        <div className="flex items-center gap-2.5">
          <Avatar v={v} size={28} radius={7} />
          <div className="min-w-0 leading-[1.15]">
            <div className="flex items-center gap-1.5 text-sand-100 font-medium whitespace-nowrap">{name}</div>
            <div className="flex items-center gap-[5px] text-[10.5px] text-[#877C69]">
              {prof && (
                <span className="inline-block px-[5px] rounded-[4px] text-[9px] font-semibold tracking-[.3px] uppercase text-moss-soft bg-[#8FA05B22]">{prof}</span>
              )}
              {v.gender ?? ''}
            </div>
          </div>
        </div>
      </td>
      {archCol && (
        <td className="py-1.5 px-2.5 border-b border-row whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            {notable && <span data-tip="High-value recruit" className="text-gold-bright">★</span>}
            <span className="text-[11.5px] text-sand-350">{archetypeLabel(v)}</span>
            <HireDiamonds v={v} />
            <span data-tip="Role by skill caps (potential)" className="text-[8.5px] font-bold tracking-[.4px] uppercase border py-px px-[5px] rounded-[4px]" style={{
              color: ROLE_COLORS[classifyRole(v)], borderColor: `${ROLE_COLORS[classifyRole(v)]}55`,
            }}>{classifyRole(v)}</span>
          </span>
        </td>
      )}
      {!gearView && ALL_SKILLS.map(([key, , sname], i) => {
        const c = shapeCell(sname, v.skills[key]);
        return (
          <td key={key} data-tip={c.tip} className={cn('py-1.5 px-1 border-b border-row text-center', i === 7 && 'border-l border-[#2A231A]')}>
            <div className="flex flex-col items-center gap-[3px]">
              <span className="font-mono text-[11.5px] font-medium" style={{ color: c.numColor }}>{c.disp}</span>
              {c.showBar && (
                <div className="w-[30px] h-[3px] rounded-[2px] bg-white/[.08] overflow-hidden">
                  <div className="h-full" style={{ width: `${c.barPct}%`, background: c.numColor }} />
                </div>
              )}
            </div>
          </td>
        );
      })}
      {gearView && (
        <td className="py-1.5 px-3 border-b border-row border-l border-row">
          <div className="flex gap-[5px]">
            {([['head', 'helm'], ['chest', 'torso'], ['gloves', 'gloves'], ['legs', 'legs'], ['boots', 'boots']] as const).map(([slot, ik]) => {
              const raw = v.equipment[slot];
              return (
                <div key={slot} data-tip={raw ? itemLabel(raw) : `No ${slot}`} className={cn(
                  'relative w-[34px] h-[34px] flex-none rounded-lg flex items-center justify-center',
                  raw
                    ? 'bg-iron-650 border border-[#37301F]'
                    : 'bg-[repeating-linear-gradient(45deg,rgba(224,167,60,.05)_0_6px,transparent_6px_12px)] border border-dashed border-gold/35',
                )}>
                  {raw
                    ? <ItemImg cls={raw} size={26} fallback={<Icon name={ik} size={16} color="#D8CBB0" />} />
                    : <Icon name={ik} size={16} color="#5f5849" />}
                </div>
              );
            })}
          </div>
        </td>
      )}
      {gearView && (
        <td className="py-1.5 px-3 border-b border-row border-l border-row">
          <div className="flex items-center gap-[5px] flex-wrap max-w-[360px]">
            {(v.guid ? carried?.[v.guid] ?? [] : []).slice(0, 8).map(x => (
              <div key={x.item} data-tip={`${itemLabel(x.item)} × ${x.qty}`} className="relative w-[30px] h-[30px] flex-none rounded-[7px] bg-iron-650 border border-line-4 flex items-center justify-center">
                <ItemImg cls={x.item} size={22} fallback={<Icon name="pouch" size={14} color="#C6BBA4" />} />
                {x.qty > 1 && (
                  <span className="absolute -bottom-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center bg-[#2A231A] border border-[#3a3020] rounded-[4px] font-mono text-[8px] font-semibold text-sand-300">{x.qty}</span>
                )}
              </div>
            ))}
            {(v.guid ? carried?.[v.guid] ?? [] : []).length === 0 && (
              <span className="text-[11px] text-sand-800">Empty</span>
            )}
            {(v.guid ? carried?.[v.guid] ?? [] : []).length > 8 && (
              <span className="font-mono text-[10px] text-sand-600">
                +{(v.guid ? carried?.[v.guid] ?? [] : []).length - 8}
              </span>
            )}
          </div>
        </td>
      )}
      <td className="py-1.5 px-3 border-b border-row border-l border-row whitespace-nowrap leading-[1.3]">
        <div className="text-[#DCD2BE] text-[11.5px]">{itemLabel(v.equipment.weapon) || 'Unarmed'}</div>
        <div className={cn('text-[10.5px]', v.equipment.offhand ? 'text-sand-400' : 'text-sand-800')}>
          {v.equipment.offhand ? itemLabel(v.equipment.offhand) : 'No shield'}
        </div>
      </td>
      <td className="py-1.5 px-3 border-b border-row">
        {morale != null ? (
          <div className="flex items-center gap-[7px]">
            <div className="w-9 h-[5px] rounded-[3px] bg-white/[.08] overflow-hidden">
              <div className="h-full" style={{ width: `${morale}%`, background: mc }} />
            </div>
            <span className="font-mono text-[11px]" style={{ color: mc }}>{morale}</span>
          </div>
        ) : <span className="text-[11px] text-sand-800">—</span>}
      </td>
      <td className="py-1.5 px-3 border-b border-row">
        {v.injuries.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {normalizeInjuries(v.injuries).map(inj => (
              <InjuryBadge key={inj.type} inj={inj} playtime={playtime} ingestedAt={ingestedAt} />
            ))}
          </div>
        ) : <span className="text-[11px] text-[#5f7a52]">Healthy</span>}
      </td>
      {npcCol && (
        <td className="py-1.5 px-3 border-b border-row whitespace-nowrap">
          <div className="text-[11.5px] text-sand-350">{v.village ? `near ${v.village}` : '—'}</div>
          {v.position && (
            <div className="font-mono text-[10px] text-sand-700">
              [{Math.round(v.position[0])}, {Math.round(v.position[1])}]
            </div>
          )}
        </td>
      )}
    </tr>
  );
};

// Exact in-game hire gate (from hire-gates.json): trust-rank diamonds,
// liberation requirement, renown cost.
const HireDiamonds = ({ v }: { v: Npc }) => {
  const g = hireGateOf(v);
  if (!g) return null;
  // base cost only — the game scales renown cost up as you hire more people
  const tip = `Hire: ${g.trust} trust${g.liberation ? ' + village liberated' : ''} · base ${Math.round(g.renown)} renown (scales with hires)`;
  return (
    <span data-tip={tip} className="inline-flex items-center gap-1 cursor-default">
      {/* the game's trust-rank badge (wiki-hosted first-party asset) */}
      <img src={`/icons/bw/trust-${g.trust.toLowerCase()}.png`} alt={g.trust}
        className="w-[18px] h-[18px] max-w-none object-contain" />
      {g.liberation && <span className="text-[8px] font-bold tracking-[.4px] uppercase text-gold-bright/80">LIB</span>}
    </span>
  );
};

const MobileCards = ({ rows, npcCol, onOpen }: {
  rows: Npc[]; npcCol: boolean; onOpen: (g: string) => void;
}) => (
  <div className="flex flex-col gap-[9px] p-3.5">
    {rows.map(v => {
      const name = npcName(v);
      const first = v.first_name ?? name, last = v.last_name ?? '';
      const morale = v.morale != null ? Math.round(v.morale) : null;
      const top = ALL_SKILLS
        .map(([key, abbr, sname]) => ({ abbr, sname, s: v.skills[key] }))
        .filter(o => o.s && o.s.cap > 0)
        .sort((a, b) => b.s.level - a.s.level).slice(0, 3);
      return (
        <div key={guidOf(v)} onClick={() => onOpen(guidOf(v))} className="bg-iron-750 border border-line-2 rounded-[11px] p-[13px] cursor-pointer">
          <div className="flex items-center gap-[11px]">
            <Avatar v={v} size={36} radius={9} />
            <div className="flex-1 min-w-0">
              <div className="text-sand-100 font-semibold text-[15px]">{name}</div>
              <div className="text-[11.5px] text-[#877C69]">{v.gender ?? ''} · {archetypeLabel(v)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {morale != null && (
                <span className="font-mono text-xs" style={{ color: moraleColor(morale) }}>♥ {morale}</span>
              )}
              {v.injuries.length > 0 && (
                <span className="text-[10px] text-[#EDA593]">
                  {normalizeInjuries(v.injuries).map(i => i.label).join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-[7px] mt-[11px] flex-wrap">
            {top.map(o => {
              const cell = shapeCell(o.sname, o.s);
              return (
                <span key={o.abbr} className="inline-flex gap-[5px] text-[11px] py-[3px] px-2 rounded-md bg-[#221D16] border border-line-3">
                  <span className="text-sand-400">{o.abbr}</span>
                  <span className="font-mono" style={{ color: cell.numColor }}>{o.s.level}/{o.s.cap}</span>
                </span>
              );
            })}
          </div>
          <div className="mt-2.5 pt-[9px] border-t border-[#241E17] flex justify-between text-[11.5px]">
            <span className="text-[#DCD2BE]">
              {itemLabel(v.equipment.weapon) || 'Unarmed'}
              <span className="text-sand-700"> · </span>
              <span className="text-sand-400">{v.equipment.offhand ? itemLabel(v.equipment.offhand) : 'No shield'}</span>
            </span>
            {npcCol && v.village && <span className="text-sand-700">near {v.village}</span>}
          </div>
        </div>
      );
    })}
  </div>
);
