'use client';
// Detail drawer — skills, equipment paper-doll, job priorities.
// Omitted vs the design (data not in the save): nourishment, innate traits,
// armor values, durability, reservist/fallen chips (not present in save data).
import type { CSSProperties } from 'react';
import type { Npc } from '@/lib/types';
import { avatarColor, initials, itemLabel, moraleColor, tplLabel } from '@/lib/bw/format';
import { normalizeInjuries } from '@/lib/bw/injuries';
import { InjuryBadge } from './injury-badge';
import { COMBAT, WORK, SKILL_ICON, shapeCell, presetFor, professionOf, npcName } from '@/lib/bw/model';
import { Icon, PinIcon } from './icons';
import { ItemImg } from './item-img';
import { Avatar } from './avatar';
import { C, MONO, SERIF, avatarStyle, miniBar, sectionH3 } from './ui';

const DEFAULT_PRIORITY = 5;

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
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,7,5,.6)', backdropFilter: 'blur(2px)',
      zIndex: 60, animation: 'bwfade .16s ease',
    }}>
      <div onClick={e => e.stopPropagation()} className="bw-scroll" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : 440,
        background: C.panelBg, borderLeft: `1px solid ${C.border3}`,
        boxShadow: '-14px 0 40px rgba(0,0,0,.5)', overflowY: 'auto', overflowX: 'hidden',
        animation: 'bwslide .22s cubic-bezier(.2,.8,.2,1)',
      }}>
        {/* header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, padding: '18px 20px 14px',
          background: 'linear-gradient(180deg,#1E1912,#16130E)', borderBottom: '1px solid #2A231A',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <div style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.4)', flex: '0 0 auto' }}>
              <Avatar v={v} size={52} radius={12} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.textSerifBright, lineHeight: 1.1 }}>{name}</span>
                {professionOf(v) && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: '.3px', color: C.gold,
                    background: 'rgba(224,167,60,.13)', border: '1px solid rgba(224,167,60,.3)',
                    padding: '2px 9px', borderRadius: 6,
                  }}>{professionOf(v)}</span>
                )}
                {v.tier && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#B3A88F', background: '#221D16',
                    border: '1px solid #322A20', padding: '2px 9px', borderRadius: 6,
                  }}>{v.tier}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{v.gender ?? '—'} · {v.archetype}</div>

              <div style={{ fontSize: 11.5, color: '#7c715f', marginTop: 1 }}>
                {tplLabel(v.template)}{v.village ? ` · from ${v.village}` : ''}
              </div>
              {v.position && (
                <div style={{ fontSize: 11.5, color: C.textFainter, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PinIcon color="currentColor" />
                  {v.village ? `near ${v.village}` : v.is_player_npc ? 'at the settlement' : 'Karvenia'} ·{' '}
                  <span style={{ fontFamily: MONO }}>[{Math.round(v.position[0])}, {Math.round(v.position[1])}]</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid #342C22', color: C.textDim, width: 30, height: 30,
              borderRadius: 8, cursor: 'pointer', fontSize: 16, flex: '0 0 auto',
            }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {morale != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11, color: C.textDim2, textTransform: 'uppercase', letterSpacing: '.5px' }}>Morale</span>
                <div style={miniBar(90, 6, morale, moraleColor(morale)).outer}>
                  <div style={miniBar(90, 6, morale, moraleColor(morale)).inner} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: moraleColor(morale) }}>{morale}</span>
              </div>
            )}
            {v.injuries.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {normalizeInjuries(v.injuries).map(inj => (
                  <InjuryBadge key={inj.type} inj={inj} playtime={playtime} ingestedAt={ingestedAt} size="large" />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '18px 20px 40px' }}>
          {/* skills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={sectionH3}>Skills</h3>
            <span style={{ fontSize: 11, color: C.textFainter }}>level / cap · XP to next</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginBottom: 26 }}>
            <SkillCol title="Combat" color="var(--accent)" defs={COMBAT} v={v} />
            <SkillCol title="Work" color="#8FA05B" defs={WORK} v={v} />
          </div>

          {/* squads */}
          {squads.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <h3 style={sectionH3}>Squads</h3>
                <span style={{ fontSize: 11, color: C.textFainter }}>Army tab · updates each save</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 26 }}>
                {squads.map(sq => (
                  <div key={sq.name} style={{
                    border: '1px solid #2C251C', borderRadius: 9, padding: '10px 12px', background: '#1A160F',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Icon name="sword" size={13} color="#7FA8C9" />
                      <span style={{ fontWeight: 600, color: '#F1E7D4', fontSize: 13, flex: '1 1 auto' }}>{sq.name}</span>
                      <span style={{
                        fontFamily: MONO, fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                        color: '#9AB0C9', background: 'rgba(127,168,201,.12)', border: '1px solid rgba(127,168,201,.32)',
                      }}>{sq.members.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {sq.members.map(m => {
                        const mn = npcName(m);
                        const isSelf = m.guid === v.guid;
                        return (
                          <button key={m.guid ?? mn} data-tip={mn}
                            onClick={() => !isSelf && m.guid && onOpen(m.guid)}
                            style={{
                              background: 'none', borderRadius: 8, padding: 0, lineHeight: 0,
                              border: isSelf ? '2px solid var(--gold)' : '2px solid transparent',
                              cursor: isSelf ? 'default' : 'pointer',
                            }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <h3 style={sectionH3}>Equipment</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textDim2 }}>Preset</span>
            {presetName ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                color: C.gold, background: 'rgba(224,167,60,.13)',
                border: '1px solid rgba(224,167,60,.3)', padding: '3px 10px', borderRadius: 6,
              }}>{presetName}</span>
            ) : (
              <>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                  color: !preset.combat ? C.textDim : preset.fit ? C.green : 'var(--accent)',
                  background: !preset.combat ? 'rgba(154,143,125,.12)' : preset.fit ? 'rgba(125,176,104,.14)' : 'rgba(224,167,60,.14)',
                  border: `1px solid ${!preset.combat ? 'rgba(154,143,125,.3)' : preset.fit ? 'rgba(125,176,104,.4)' : 'rgba(224,167,60,.4)'}`,
                  padding: '3px 10px', borderRadius: 6,
                }}>{preset.preset}</span>
                <span style={{ fontSize: 11.5, color: !preset.combat ? C.textDim : preset.fit ? C.green : 'var(--accent)' }}>
                  {preset.combat ? (preset.fit ? 'Matches loadout' : preset.reason) : 'Non-combat'}
                </span>
              </>
            )}
          </div>
          <SlotLabel>Weapons</SlotLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Tile v={v} slot="weapon" label="Weapon" icon={v.equipment.weapon && /Bow/.test(v.equipment.weapon) ? 'bow' : 'sword'} />
            <Tile v={v} slot="offhand" label="Off-hand" icon="shield" />
          </div>
          <SlotLabel>Armor</SlotLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 14 }}>
            <Tile v={v} slot="head" label="Head" icon="helm" armorSlot />
            <Tile v={v} slot="chest" label="Chest" icon="torso" armorSlot />
            <Tile v={v} slot="gloves" label="Gloves" icon="gloves" armorSlot />
            <Tile v={v} slot="legs" label="Pants" icon="legs" armorSlot />
            <Tile v={v} slot="boots" label="Boots" icon="boots" armorSlot />
          </div>
          <SlotLabel>Storage &amp; Tools</SlotLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 26 }}>
            <Tile v={v} slot="cloak" label="Cloak" icon="cloak" />
            <Tile v={v} slot="backpack" label="Backpack" icon="pack" />
            <Tile v={v} slot="food_bag" label="Food Bag" icon="pouch" />
            <Tile v={v} slot="tool" label="Tool" icon="tool" />
          </div>

          {/* job priorities (addition vs the design — real save data) */}
          {hasPriorities && (
            <>
              <h3 style={{ ...sectionH3, marginBottom: 4 }}>Job priorities</h3>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: C.textFainter }}>
                Lower number = takes the job first · {DEFAULT_PRIORITY} is the default · 0 = disabled
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 26 }}>
                {WORK.map(([key, , label]) => {
                  const p = v.job_priorities[key] ?? DEFAULT_PRIORITY;
                  const disabled = p === 0;
                  const emphasised = !disabled && p < DEFAULT_PRIORITY;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}>
                      <span style={{ display: 'flex', opacity: .8 }}>
                        <Icon name={SKILL_ICON[key]} size={13} color={C.textDim2} />
                      </span>
                      <span style={{ flex: '1 1 auto', color: disabled ? C.textDisabled : '#C6BBA4' }}>{label}</span>
                      <span style={{
                        fontFamily: MONO, fontSize: 12, fontWeight: 600, minWidth: 26, textAlign: 'center',
                        padding: '1px 7px', borderRadius: 5,
                        color: disabled ? C.textDisabled : emphasised ? C.gold : '#C6BBA4',
                        background: disabled ? 'transparent' : emphasised ? 'rgba(224,167,60,.13)' : '#221D16',
                        border: `1px solid ${disabled ? '#2A231A' : emphasised ? 'rgba(224,167,60,.35)' : '#2E271E'}`,
                      }}>{disabled ? '⊘' : p}</span>
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
  <div style={{
    fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase',
    color: C.textDim2, margin: '0 0 7px', fontWeight: 600,
  }}>{children}</div>
);

export const SkillCol = ({ title, color, defs, v }: {
  title: string; color: string; defs: (readonly [string, string, string])[];
  v: Pick<Npc, 'skills'>;
}) => (
  <div>
    <div style={{
      fontSize: 11, letterSpacing: '.6px', textTransform: 'uppercase',
      color, marginBottom: 9, fontWeight: 600,
    }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {defs.map(([key, , sname]) => {
        const s = v.skills[key];
        const c = shapeCell(sname, s);
        const bar = miniBar('100%', 5, c.barPct, c.numColor);
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#C6BBA4' }}>
                <span style={{ display: 'flex', opacity: .8 }}><Icon name={SKILL_ICON[key]} size={13} color={C.textDim2} /></span>
                {sname}
              </span>
              <span style={{ fontFamily: MONO, fontWeight: 500, color: c.numColor }}>{c.disp}</span>
            </div>
            <div style={bar.outer}><div style={bar.inner} /></div>
            <div style={{ fontSize: 10, color: C.textFainter, marginTop: 2, textAlign: 'right' }}>
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
  const base: CSSProperties = {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 4, padding: '9px 5px 8px', borderRadius: 9, minHeight: 78,
  };
  const style: CSSProperties = filled
    ? { ...base, background: '#211C15', border: '1px solid #37301F' }
    : armorSlot
      ? { ...base, background: 'repeating-linear-gradient(45deg,rgba(224,167,60,.05) 0 6px,transparent 6px 12px)', border: '1px dashed rgba(224,167,60,.4)' }
      : { ...base, background: '#17140E', border: '1px dashed #332C21' };
  return (
    <div data-tip={filled ? itemLabel(raw) : `Empty ${label.toLowerCase()} slot`} style={style}>
      <span style={{ display: 'flex' }}>
        {filled
          ? <ItemImg cls={raw} size={30} fallback={<Icon name={icon} size={22} color="#D8CBB0" />} />
          : <Icon name={icon} size={22} color="#655c4c" />}
      </span>
      <span style={{
        fontSize: 9.5, lineHeight: 1.15, textAlign: 'center', maxWidth: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: filled ? '#DBCFB4' : C.textDisabled,
      }}>{filled ? itemLabel(raw) : 'Empty'}</span>
      <span style={{ fontSize: 8, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textFainter }}>{label}</span>
    </div>
  );
};
