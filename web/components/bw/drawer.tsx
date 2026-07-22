'use client';
// Detail drawer — skills, equipment paper-doll, job priorities.
// Omitted vs the design (data not in the save): nourishment, innate traits,
// armor values, durability, reservist/fallen chips (not present in save data).
import type { Npc } from '@/lib/types';
import { cn } from '@/lib/utils';
import { itemLabel, moraleColor } from '@/lib/bw/format';
import { normalizeInjuries } from '@/lib/bw/injuries';
import { InjuryBadge } from './injury-badge';
import { COMBAT, WORK, SKILL_ICON, shapeCell, presetFor, professionOf, npcName, archetypeLabel } from '@/lib/bw/model';
import { Icon, PinIcon } from './icons';
import { ItemImg } from './item-img';
import { Avatar } from './avatar';
import { C } from './ui';

const DEFAULT_PRIORITY = 5;

const SECTION_H3 = 'font-serif text-[15px] font-semibold text-[#D9CBB2] tracking-[.3px]';

export type DrawerSquad = { name: string; members: Npc[] };
type Props = {
  v: Npc; playtime: number | null; ingestedAt: string | null;
  squads: DrawerSquad[]; onOpen: (guid: string) => void;
  isMobile: boolean; onClose: () => void;
  // real in-game gear-preset name (custom presets only); falls back to the
  // loadout heuristic when absent
  presetName?: string | null;
};

export const Drawer = ({ v, playtime, ingestedAt, squads, onOpen, isMobile, onClose, presetName }: Props) => {
  const name = npcName(v);
  const first = v.first_name ?? name, last = v.last_name ?? '';
  const morale = v.morale != null ? Math.round(v.morale) : null;
  const preset = presetFor(v);
  const hasPriorities = Object.keys(v.job_priorities).length > 0;
  return (
    <div onClick={onClose} className="fixed inset-0 bg-[rgba(8,7,5,.6)] backdrop-blur-[2px] z-[60] [animation:bwfade_.16s_ease]">
      <div onClick={e => e.stopPropagation()} className={cn(
        'bw-scroll absolute top-0 right-0 bottom-0 bg-iron-850 border-l border-line-4',
        'shadow-[-14px_0_40px_rgba(0,0,0,.5)] overflow-y-auto overflow-x-hidden',
        '[animation:bwslide_.22s_cubic-bezier(.2,.8,.2,1)]',
        isMobile ? 'w-full' : 'w-[440px]',
      )}>
        {/* header */}
        <div className="sticky top-0 z-[5] pt-[18px] px-5 pb-3.5 bg-gradient-to-b from-[#1E1912] to-[#16130E] border-b border-[#2A231A]">
          <div className="flex items-start gap-[13px]">
            <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,.4)] flex-none">
              <Avatar v={v} size={52} radius={12} />
            </div>
            <div className="flex-auto min-w-0">
              <div className="flex items-center gap-[9px] flex-wrap">
                <span className="font-serif text-[22px] font-semibold text-sand-50 leading-[1.1]">{name}</span>
                {professionOf(v) && (
                  <span className="text-[11px] font-semibold tracking-[.3px] text-gold-bright bg-gold/[.13] border border-gold/30 py-0.5 px-[9px] rounded-md">{professionOf(v)}</span>
                )}
                {v.tier && (
                  <span className="text-[11px] font-semibold text-sand-350 bg-[#221D16] border border-line-4 py-0.5 px-[9px] rounded-md">{v.tier}</span>
                )}
              </div>
              <div className="text-xs text-sand-400 mt-1">{v.gender ?? '—'} · {v.archetype}</div>

              <div className="text-[11.5px] text-[#7c715f] mt-px">
                {archetypeLabel(v)}{v.village ? ` · from ${v.village}` : ''}
              </div>
              {v.position && (
                <div className="text-[11.5px] text-sand-700 mt-[3px] flex items-center gap-[5px]">
                  <PinIcon color="currentColor" />
                  {v.village ? `near ${v.village}` : v.is_player_npc ? 'at the settlement' : 'Karvenia'} ·{' '}
                  <span className="font-mono">[{Math.round(v.position[0])}, {Math.round(v.position[1])}]</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="bg-transparent border border-[#342C22] text-sand-400 w-[30px] h-[30px] rounded-lg cursor-pointer text-base flex-none">×</button>
          </div>
          <div className="flex items-center gap-3.5 mt-3.5 flex-wrap">
            {morale != null && (
              <div className="flex items-center gap-[9px]">
                <span className="text-[11px] text-[#8a8069] uppercase tracking-[.5px]">Morale</span>
                <div className="w-[90px] h-1.5 rounded-[3px] bg-white/[.08] overflow-hidden">
                  <div className="h-full" style={{ width: `${morale}%`, background: moraleColor(morale) }} />
                </div>
                <span className="font-mono text-[13px]" style={{ color: moraleColor(morale) }}>{morale}</span>
              </div>
            )}
            {v.injuries.length > 0 && (
              <div className="flex gap-[5px] flex-wrap">
                {normalizeInjuries(v.injuries).map(inj => (
                  <InjuryBadge key={inj.type} inj={inj} playtime={playtime} ingestedAt={ingestedAt} size="large" />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-[18px] px-5 pb-10">
          {/* skills */}
          <div className="flex items-center justify-between mb-3">
            <h3 className={SECTION_H3}>Skills</h3>
            <span className="text-[11px] text-sand-700">level / cap · XP to next</span>
          </div>
          <div className="grid grid-cols-2 gap-[22px] mb-[26px]">
            <SkillCol title="Combat" color="var(--accent)" defs={COMBAT} v={v} />
            <SkillCol title="Work" color="#8FA05B" defs={WORK} v={v} />
          </div>

          {/* squads */}
          {squads.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-[11px]">
                <h3 className={SECTION_H3}>Squads</h3>
                <span className="text-[11px] text-sand-700">Army tab · updates each save</span>
              </div>
              <div className="flex flex-col gap-2 mb-[26px]">
                {squads.map(sq => (
                  <div key={sq.name} className="border border-line-2 rounded-[9px] py-2.5 px-3 bg-[#1A160F]">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="sword" size={13} color="#7FA8C9" />
                      <span className="font-semibold text-sand-100 text-[13px] flex-auto">{sq.name}</span>
                      <span className="font-mono text-[10.5px] font-semibold py-px px-[7px] rounded-full text-[#9AB0C9] bg-[rgba(127,168,201,.12)] border border-[rgba(127,168,201,.32)]">{sq.members.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sq.members.map(m => {
                        const mn = npcName(m);
                        const isSelf = m.guid === v.guid;
                        return (
                          <button key={m.guid ?? mn} data-tip={mn}
                            onClick={() => !isSelf && m.guid && onOpen(m.guid)}
                            className={cn(
                              'bg-transparent rounded-lg p-0 leading-[0] border-2',
                              isSelf ? 'border-gold-bright cursor-default' : 'border-transparent cursor-pointer',
                            )}>
                            <Avatar v={m} size={24} radius={6} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* equipment */}
          <div className="flex items-center justify-between mb-[11px]">
            <h3 className={SECTION_H3}>Equipment</h3>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10.5px] tracking-[.4px] uppercase text-[#8a8069]">Preset</span>
            {presetName ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-bright bg-gold/[.13] border border-gold/30 py-[3px] px-2.5 rounded-md">{presetName}</span>
            ) : (
              <>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold py-[3px] px-2.5 rounded-md border"
                  style={{
                    color: !preset.combat ? C.textDim : preset.fit ? C.green : 'var(--accent)',
                    background: !preset.combat ? 'rgba(154,143,125,.12)' : preset.fit ? 'rgba(125,176,104,.14)' : 'rgba(224,167,60,.14)',
                    borderColor: !preset.combat ? 'rgba(154,143,125,.3)' : preset.fit ? 'rgba(125,176,104,.4)' : 'rgba(224,167,60,.4)',
                  }}>{preset.preset}</span>
                <span className="text-[11.5px]" style={{ color: !preset.combat ? C.textDim : preset.fit ? C.green : 'var(--accent)' }}>
                  {preset.combat ? (preset.fit ? 'Matches loadout' : preset.reason) : 'Non-combat'}
                </span>
              </>
            )}
          </div>
          <SlotLabel>Weapons</SlotLabel>
          <div className="grid grid-cols-2 gap-2 mb-3.5">
            <Tile v={v} slot="weapon" label="Weapon" icon={v.equipment.weapon && /Bow/.test(v.equipment.weapon) ? 'bow' : 'sword'} />
            <Tile v={v} slot="offhand" label="Off-hand" icon="shield" />
          </div>
          <SlotLabel>Armor</SlotLabel>
          <div className="grid grid-cols-5 gap-[7px] mb-3.5">
            <Tile v={v} slot="head" label="Head" icon="helm" armorSlot />
            <Tile v={v} slot="chest" label="Chest" icon="torso" armorSlot />
            <Tile v={v} slot="gloves" label="Gloves" icon="gloves" armorSlot />
            <Tile v={v} slot="legs" label="Pants" icon="legs" armorSlot />
            <Tile v={v} slot="boots" label="Boots" icon="boots" armorSlot />
          </div>
          <SlotLabel>Storage &amp; Tools</SlotLabel>
          <div className="grid grid-cols-4 gap-[7px] mb-[26px]">
            <Tile v={v} slot="cloak" label="Cloak" icon="cloak" />
            <Tile v={v} slot="backpack" label="Backpack" icon="pack" />
            <Tile v={v} slot="food_bag" label="Food Bag" icon="pouch" />
            <Tile v={v} slot="tool" label="Tool" icon="tool" />
          </div>

          {/* job priorities (addition vs the design — real save data) */}
          {hasPriorities && (
            <>
              <h3 className={cn(SECTION_H3, 'mb-1')}>Job priorities</h3>
              <p className="mb-3 text-[11px] text-sand-700">
                Lower number = takes the job first · {DEFAULT_PRIORITY} is the default · 0 = disabled
              </p>
              <div className="flex flex-col gap-[7px] mb-[26px]">
                {WORK.map(([key, , label]) => {
                  const p = v.job_priorities[key] ?? DEFAULT_PRIORITY;
                  const disabled = p === 0;
                  const emphasised = !disabled && p < DEFAULT_PRIORITY;
                  return (
                    <div key={key} className="flex items-center gap-[9px] text-xs">
                      <span className="flex opacity-80">
                        <Icon name={SKILL_ICON[key]} size={13} color={C.textDim2} />
                      </span>
                      <span className={cn('flex-auto', disabled ? 'text-sand-800' : 'text-sand-300')}>{label}</span>
                      <span className={cn(
                        'font-mono text-xs font-semibold min-w-[26px] text-center py-px px-[7px] rounded-[5px] border',
                        disabled
                          ? 'text-sand-800 bg-transparent border-[#2A231A]'
                          : emphasised
                            ? 'text-gold-bright bg-gold/[.13] border-gold/35'
                            : 'text-sand-300 bg-[#221D16] border-line-3',
                      )}>{disabled ? '⊘' : p}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const SlotLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10.5px] tracking-[.5px] uppercase text-[#8a8069] mb-[7px] font-semibold">{children}</div>
);

export const SkillCol = ({ title, color, defs, v }: {
  title: string; color: string; defs: (readonly [string, string, string])[];
  v: Pick<Npc, 'skills'>;
}) => (
  <div>
    <div className="text-[11px] tracking-[.6px] uppercase mb-[9px] font-semibold" style={{ color }}>{title}</div>
    <div className="flex flex-col gap-[9px]">
      {defs.map(([key, , sname]) => {
        const s = v.skills[key];
        const c = shapeCell(sname, s);
        return (
          <div key={key}>
            <div className="flex justify-between items-center text-xs mb-[3px]">
              <span className="inline-flex items-center gap-1.5 text-sand-300">
                <span className="flex opacity-80"><Icon name={SKILL_ICON[key]} size={13} color={C.textDim2} /></span>
                {sname}
              </span>
              <span className="font-mono font-medium" style={{ color: c.numColor }}>{c.disp}</span>
            </div>
            <div className="h-[5px] rounded-[3px] bg-white/[.08] overflow-hidden">
              <div className="h-full" style={{ width: `${c.barPct}%`, background: c.numColor }} />
            </div>
            <div className="text-[10px] text-sand-700 mt-0.5 text-right">
              {!s || s.cap === 0 ? 'untrained' : c.atCap ? 'MAX' : `${c.pct}% to ${c.level + 1}`}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const Tile = ({ v, slot, label, icon, armorSlot = false }: {
  v: Pick<Npc, 'equipment'>; slot: string; label: string; icon: string; armorSlot?: boolean;
}) => {
  const raw = v.equipment[slot];
  const filled = Boolean(raw);
  return (
    <div data-tip={filled ? itemLabel(raw) : `Empty ${label.toLowerCase()} slot`} className={cn(
      'relative flex flex-col items-center justify-center gap-1 pt-[9px] px-[5px] pb-2 rounded-[9px] min-h-[78px]',
      filled
        ? 'bg-iron-650 border border-[#37301F]'
        : armorSlot
          ? 'bg-[repeating-linear-gradient(45deg,rgba(224,167,60,.05)_0_6px,transparent_6px_12px)] border border-dashed border-gold/40'
          : 'bg-[#17140E] border border-dashed border-[#332C21]',
    )}>
      <span className="flex">
        {filled
          ? <ItemImg cls={raw} size={30} fallback={<Icon name={icon} size={22} color="#D8CBB0" />} />
          : <Icon name={icon} size={22} color="#655c4c" />}
      </span>
      <span className={cn(
        'text-[9.5px] leading-[1.15] text-center max-w-full overflow-hidden text-ellipsis whitespace-nowrap',
        filled ? 'text-[#DBCFB4]' : 'text-sand-800',
      )}>{filled ? itemLabel(raw) : 'Empty'}</span>
      <span className="text-[8px] tracking-[.4px] uppercase text-sand-700">{label}</span>
    </div>
  );
};
