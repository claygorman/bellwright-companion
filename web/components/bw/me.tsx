'use client';
// "My character" tab — the player pawn from the save: skills, equipment
// paper doll, carried inventory, coin/playtime/settlement stat cards.
// Design omissions (data not in the save): renown (opaque player-state
// blob), armor values, durability, nourishment buffs, traits.
import type { PlayerState, WorldMeta } from '@/lib/types';
import { cn } from '@/lib/utils';
import { avatarColor, initials, itemLabel, playtimeLabel } from '@/lib/bw/format';
import { COMBAT, WORK } from '@/lib/bw/model';
import { SkillCol, SlotLabel, Tile } from './drawer';
import { Icon } from './icons';
import { ItemImg } from './item-img';
import { C } from './ui';

const StatCard = ({ label, value, color, serif }: {
  label: string; value: string; color?: string; serif?: boolean;
}) => (
  <div className="bg-iron-750 border border-line-2 rounded-[10px] py-[11px] px-[15px] min-w-[96px]">
    <div
      className={cn('font-semibold', serif ? 'font-serif text-[18px]' : 'font-mono text-[19px]', !color && 'text-sand-200')}
      style={color ? { color } : undefined}
    >{value}</div>
    <div className="text-[10px] tracking-[.4px] uppercase text-sand-400 mt-0.5">{label}</div>
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
    <div className="bw-scroll h-full overflow-y-auto">
      <div className="pt-6 px-[26px] pb-12 max-w-[1080px]">
        {/* header */}
        <div className="flex items-start gap-4 flex-wrap mb-6">
          <div
            className="w-16 h-16 rounded-[14px] flex-none flex items-center justify-center text-2xl font-semibold text-[#0f0d0a] shadow-[0_3px_16px_rgba(0,0,0,.45)]"
            style={{ background: avatarColor(first, last) }}
          >{initials(first, last)}</div>
          <div className="flex-1 basis-80 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-serif text-[26px] font-bold text-sand-50 leading-none">{name}</span>
              <span className="text-[11.5px] font-semibold text-gold-bright bg-gold/[.14] border border-gold/35 py-0.5 px-2.5 rounded-md">Bellwright{meta.region ? ` of ${meta.region}` : ''}</span>
            </div>
            <div className="text-[12.5px] text-sand-400 mt-1">
              Player character{presetName ? ` · ${presetName}` : ''}
            </div>
            {player.position && (
              <div className="font-mono text-[11.5px] text-sand-700 mt-[13px]">
                [{Math.round(player.position[0])}, {Math.round(player.position[1])}]
              </div>
            )}
          </div>
          <div className="flex gap-2.5 flex-none flex-wrap">
            <StatCard label="Coins carried" value={String(player.coins)} color="#E9C766" />
            <StatCard label="Played" value={playtimeLabel(meta.playtimeSeconds)} />
            <StatCard label="Villagers" value={String(villagerCount)} />
            <StatCard label="Settlement" value={meta.region ?? '—'} serif />
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[26px] items-start">
          {/* skills */}
          <div>
            <h3 className="font-serif text-[15px] font-semibold text-[#D9CBB2] tracking-[.3px] mb-3">Skills</h3>
            <div className="grid grid-cols-2 gap-5">
              <SkillCol title="Combat" color="var(--accent)" defs={COMBAT} v={player} />
              <SkillCol title="Work" color="#8FA05B" defs={WORK} v={player} />
            </div>
          </div>

          {/* equipment + carried */}
          <div>
            <h3 className="font-serif text-[15px] font-semibold text-[#D9CBB2] tracking-[.3px] mb-[11px]">Equipment</h3>
            <SlotLabel>Weapons</SlotLabel>
            <div className="grid grid-cols-2 gap-2 mb-3.5">
              <Tile v={player} slot="weapon" label="Weapon" icon={player.equipment.weapon && /Bow/.test(player.equipment.weapon) ? 'bow' : 'sword'} />
              <Tile v={player} slot="offhand" label="Off-hand" icon="shield" />
            </div>
            <SlotLabel>Armor</SlotLabel>
            <div className="grid grid-cols-5 gap-[7px] mb-3.5">
              <Tile v={player} slot="head" label="Head" icon="helm" armorSlot />
              <Tile v={player} slot="chest" label="Chest" icon="torso" armorSlot />
              <Tile v={player} slot="gloves" label="Gloves" icon="gloves" armorSlot />
              <Tile v={player} slot="legs" label="Pants" icon="legs" armorSlot />
              <Tile v={player} slot="boots" label="Boots" icon="boots" armorSlot />
            </div>
            <SlotLabel>Storage &amp; Tools</SlotLabel>
            <div className="grid grid-cols-4 gap-[7px] mb-[22px]">
              <Tile v={player} slot="cloak" label="Cloak" icon="cloak" />
              <Tile v={player} slot="backpack" label="Backpack" icon="pack" />
              <Tile v={player} slot="food_bag" label="Food Bag" icon="pouch" />
              <Tile v={player} slot="tool" label="Tool" icon="tool" />
            </div>

            <h3 className="font-serif text-[15px] font-semibold text-[#D9CBB2] tracking-[.3px] mb-[3px]">Carrying</h3>
            <p className="mb-2.5 text-[11px] text-sand-700">
              {player.carried.reduce((a, x) => a + x.qty, 0)} items in inventory
            </p>
            <div className="flex flex-wrap gap-1.5">
              {player.carried.length === 0 && (
                <span className="text-xs text-sand-600">Nothing carried.</span>
              )}
              {player.carried.map(x => (
                <span key={x.item} data-tip={itemLabel(x.item)} className="relative inline-flex items-center gap-[7px] py-[5px] pr-2.5 pl-1.5 bg-[#1A160F] border border-line-4 rounded-lg text-xs text-sand-200">
                  <ItemImg cls={x.item} size={20} fallback={<Icon name="pouch" size={14} color={C.textFaint} />} />
                  {itemLabel(x.item)}
                  {x.qty > 1 && <span className="font-mono text-[10.5px] text-[#8a8069]">×{x.qty}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
