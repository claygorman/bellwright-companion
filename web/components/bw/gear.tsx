'use client';
// Gear & kits panel (Insights tab) — driven by /api/gear: craft shortfalls,
// custom gear presets with their current effective picks, and re-equip
// suggestions (preset pick sitting in storage while the NPC wears less).
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { itemLabel } from '@/lib/bw/format';
import { Icon } from './icons';
import { ItemImg } from './item-img';
import { C } from './ui';

type GearData = {
  presets: {
    key: string; name: string;
    members: { guid: string | null; name: string }[];
    picks: Record<string, string>;
    slots: Record<string, { item: string; rank: number }[]>;
  }[];
  craft: { item: string; need: number; equipped: number; stored: number; reserve: number; target: number; have: number; deficit: number }[];
  items: GearData['craft'];
  reequip: { name: string; slot: string; worn: string | null; pick: string }[];
  avail: Record<string, { stored: number; equipped: number; unlocked: boolean }>;
  has_reserves: boolean;
};

const SLOT_ORDER = ['weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'backpack'];

const Card = ({ title, badge, badgeColor, children }: {
  title: string; badge?: string | number; badgeColor?: string; children: React.ReactNode;
}) => (
  <div className="border border-line-2 bg-iron-750 rounded-xl py-3.5 px-4">
    <div className="flex items-center gap-[9px] mb-2.5">
      <span className="font-serif text-[15px] font-semibold text-sand-100 flex-auto">{title}</span>
      {badge != null && (
        <span className="font-mono text-[11px] font-semibold py-px px-2 rounded-full border border-line-4 bg-[#1A160F]"
          style={{ color: badgeColor ?? C.textDim }}>{badge}</span>
      )}
    </div>
    {children}
  </div>
);

export const GearPanel = ({ onOpen }: { onOpen: (guid: string) => void }) => {
  const [data, setData] = useState<GearData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch('/api/gear', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);
  if (err || !data) return null;
  const hasAny = data.presets.length > 0 || data.craft.length > 0;
  if (!hasAny) return null;

  return (
    <div className="mb-5">
      <div className="mb-3">
        <h2 className="font-serif text-xl font-semibold text-sand-100">Gear &amp; kits</h2>
        <p className="mt-1 text-[12.5px] text-[#8a8069]">
          Kit coverage from your gear presets — what to craft, and who can gear up from storage.
          {!data.has_reserves && (
            <> Set flat spare targets in <span className="font-mono text-[11.5px]">kits.json</span> to plan for breakage.</>
          )}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3 items-start">

        {data.craft.length > 0 && (
          <Card title="Craft list" badge={data.craft.reduce((s, x) => s + x.deficit, 0)} badgeColor={C.redText}>
            <div className="flex flex-col gap-1.5">
              {data.craft.map(x => (
                <div key={x.item} className="flex items-center gap-[9px]">
                  <ItemImg cls={x.item} size={22} fallback={<Icon name="pouch" size={16} color={C.textFaint} />} />
                  <span className="flex-auto text-[12.5px] text-sand-200 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{itemLabel(x.item)}</span>
                  <span className="font-mono text-[10.5px] text-sand-600 whitespace-nowrap">
                    {x.have}/{x.target}{x.reserve > 0 ? ` (+${x.reserve} spare)` : ''}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#EDA593] px-[7px] rounded-full bg-rust/[.12] border border-rust/30">+{x.deficit}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.reequip.length > 0 && (
          <Card title="Gear up from storage" badge={data.reequip.length} badgeColor={C.blueText}>
            <div className="flex flex-col gap-1.5">
              {data.reequip.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-sand-200 whitespace-nowrap">{r.name}</span>
                  <span className="font-mono text-[10px] text-sand-700 uppercase">{r.slot}</span>
                  <span className="flex-auto min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sand-400 text-right">
                    {r.worn ? itemLabel(r.worn) : 'empty'} → <span className="text-sky-bright">{itemLabel(r.pick)}</span>
                  </span>
                  <ItemImg cls={r.pick} size={20} fallback={<Icon name="pouch" size={14} color={C.textFaint} />} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.presets.map(p => (
          <Card key={p.key} title={p.name} badge={p.members.length} badgeColor={C.gold as string}>
            <div className={cn('flex flex-col gap-[5px]', p.members.length > 0 && 'mb-2.5')}>
              {SLOT_ORDER.filter(s => p.picks[s]).map(s => {
                // the preset's full ranked chain (top preference → fallback):
                // gold ring = effective pick (in use / craft planning),
                // normal = fielded/available, dimmed = not fielded yet
                const chain = p.slots?.[s] ?? [];
                const eff = p.picks[s];
                return (
                  <div key={s} className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-sand-700 uppercase w-[62px] flex-none">{s}</span>
                    <span className="flex items-center gap-1 min-w-0 flex-wrap">
                      {chain.map((r, i) => {
                        const a = data.avail?.[r.item];
                        const inUse = r.item === eff;
                        const tip = `${itemLabel(r.item)} — ${inUse ? 'in use · ' : ''}${
                          a?.unlocked ? `stored ${a.stored} · equipped ${a.equipped}` : 'not fielded yet'}`;
                        return (
                          <span key={r.item} className="inline-flex items-center gap-1">
                            {i > 0 && <span className="text-[10px] text-sand-700">›</span>}
                            <span data-tip={tip} className={cn(
                              'inline-flex items-center justify-center w-[24px] h-[24px] rounded-md border flex-none',
                              inUse ? 'border-gold bg-gold/[.14]'
                                : a?.unlocked ? 'border-line-3 bg-[#1A160F]'
                                  : 'border-line-2 bg-transparent opacity-40 grayscale',
                            )}>
                              <ItemImg cls={r.item} size={18} fallback={<Icon name="pouch" size={13} color={C.textFaint} />} />
                            </span>
                          </span>
                        );
                      })}
                    </span>
                    <span className="text-[11px] text-sand-300 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ml-auto pl-1">{itemLabel(eff)}</span>
                  </div>
                );
              })}
            </div>
            {p.members.length > 0 && (
              <div className="flex flex-wrap gap-[5px] border-t border-row pt-[9px]">
                {p.members.map(m => (
                  <button key={m.guid ?? m.name} onClick={() => m.guid && onOpen(m.guid)}
                    className={cn(
                      'text-[11px] text-sand-400 bg-[#1A160F] border border-line-2 rounded-full py-0.5 px-[9px]',
                      m.guid ? 'cursor-pointer' : 'cursor-default',
                    )}>{m.name}</button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
