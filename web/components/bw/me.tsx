'use client';
// "My character" tab — the player pawn from the save: skills, equipment
// paper doll, carried inventory, coin/playtime/settlement stat cards.
// Design omissions (data not in the save): renown (opaque player-state
// blob), armor values, durability, nourishment buffs, traits.
import type { PlayerState, WorldMeta } from '@/lib/types';
import { avatarColor, initials, itemLabel, playtimeLabel } from '@/lib/bw/format';
import { COMBAT, WORK } from '@/lib/bw/model';
import { SkillCol, SlotLabel, Tile } from './drawer';
import { Icon } from './icons';
import { ItemImg } from './item-img';
import { C, MONO, SERIF, avatarStyle, sectionH3 } from './ui';

const StatCard = ({ label, value, color, serif }: {
  label: string; value: string; color?: string; serif?: boolean;
}) => (
  <div style={{ background: C.cardBg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '11px 15px', minWidth: 96 }}>
    <div style={{
      fontFamily: serif ? SERIF : MONO, fontSize: serif ? 18 : 19, fontWeight: 600,
      color: color ?? C.text,
    }}>{value}</div>
    <div style={{ fontSize: 10, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textDim2, marginTop: 2 }}>{label}</div>
  </div>
);

export const MeTab = ({ player, meta, presetName, villagerCount }: {
  player: PlayerState; meta: WorldMeta; presetName: string | null; villagerCount: number;
}) => {
  const name = meta.character ?? 'Player';
  const first = name, last = '';
  // coins anywhere in the world (carried + stored) would need storage totals;
  // the card shows what the character has on them
  return (
    <div className="bw-scroll" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '24px 26px 48px', maxWidth: 1080 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{
            ...avatarStyle(64, avatarColor(first, last), 14),
            fontSize: 24, boxShadow: '0 3px 16px rgba(0,0,0,.45)',
          }}>{initials(first, last)}</div>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: C.textSerifBright, lineHeight: 1 }}>{name}</span>
              <span style={{
                fontSize: 11.5, fontWeight: 600, color: C.gold, background: 'rgba(224,167,60,.14)',
                border: '1px solid rgba(224,167,60,.35)', padding: '2px 10px', borderRadius: 6,
              }}>Bellwright{meta.region ? ` of ${meta.region}` : ''}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4 }}>
              Player character{presetName ? ` · ${presetName}` : ''}
            </div>
            {player.position && (
              <div style={{ fontSize: 11.5, color: C.textFainter, marginTop: 13, fontFamily: MONO }}>
                [{Math.round(player.position[0])}, {Math.round(player.position[1])}]
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flex: '0 0 auto', flexWrap: 'wrap' }}>
            <StatCard label="Coins carried" value={String(player.coins)} color="#E9C766" />
            <StatCard label="Played" value={playtimeLabel(meta.playtimeSeconds)} />
            <StatCard label="Villagers" value={String(villagerCount)} />
            <StatCard label="Settlement" value={meta.region ?? '—'} serif />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 26, alignItems: 'start' }}>
          {/* skills */}
          <div>
            <h3 style={{ ...sectionH3, marginBottom: 12 }}>Skills</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <SkillCol title="Combat" color="var(--accent)" defs={COMBAT} v={player} />
              <SkillCol title="Work" color="#8FA05B" defs={WORK} v={player} />
            </div>
          </div>

          {/* equipment + carried */}
          <div>
            <h3 style={{ ...sectionH3, marginBottom: 11 }}>Equipment</h3>
            <SlotLabel>Weapons</SlotLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <Tile v={player} slot="weapon" label="Weapon" icon={player.equipment.weapon && /Bow/.test(player.equipment.weapon) ? 'bow' : 'sword'} />
              <Tile v={player} slot="offhand" label="Off-hand" icon="shield" />
            </div>
            <SlotLabel>Armor</SlotLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 14 }}>
              <Tile v={player} slot="head" label="Head" icon="helm" armorSlot />
              <Tile v={player} slot="chest" label="Chest" icon="torso" armorSlot />
              <Tile v={player} slot="gloves" label="Gloves" icon="gloves" armorSlot />
              <Tile v={player} slot="legs" label="Pants" icon="legs" armorSlot />
              <Tile v={player} slot="boots" label="Boots" icon="boots" armorSlot />
            </div>
            <SlotLabel>Storage &amp; Tools</SlotLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 22 }}>
              <Tile v={player} slot="cloak" label="Cloak" icon="cloak" />
              <Tile v={player} slot="backpack" label="Backpack" icon="pack" />
              <Tile v={player} slot="food_bag" label="Food Bag" icon="pouch" />
              <Tile v={player} slot="tool" label="Tool" icon="tool" />
            </div>

            <h3 style={{ ...sectionH3, marginBottom: 3 }}>Carrying</h3>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textFainter }}>
              {player.carried.reduce((a, x) => a + x.qty, 0)} items in inventory
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {player.carried.length === 0 && (
                <span style={{ fontSize: 12, color: C.textFaint }}>Nothing carried.</span>
              )}
              {player.carried.map(x => (
                <span key={x.item} data-tip={itemLabel(x.item)} style={{
                  position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px 5px 6px', background: C.cardBg2, border: `1px solid ${C.border3}`,
                  borderRadius: 8, fontSize: 12, color: C.text,
                }}>
                  <ItemImg cls={x.item} size={20} fallback={<Icon name="pouch" size={14} color={C.textFaint} />} />
                  {itemLabel(x.item)}
                  {x.qty > 1 && <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim2 }}>×{x.qty}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
