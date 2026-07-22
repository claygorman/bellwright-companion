'use client';
// Insights tab — automated triage cards (real-data subset of the design).
import { npcName, type InsightCard } from '@/lib/bw/model';
import { Icon } from './icons';
import { Avatar } from './avatar';
import { GearPanel } from './gear';
import { SEV } from './ui';

export const Insights = ({ cards, villagerCount, snapshotId, onOpen }: {
  cards: InsightCard[]; villagerCount: number; snapshotId?: number; onOpen: (guid: string) => void;
}) => (
  <div className="bw-scroll h-full overflow-y-auto">
    <div className="pt-[22px] px-6 pb-11">
      <GearPanel key={snapshotId ?? 0} onOpen={onOpen} />
      <div className="mb-4">
        <h2 className="font-serif text-xl font-semibold text-sand-100">Settlement insights</h2>
        <p className="mt-1 text-[12.5px] text-[#8a8069]">
          Automated triage &amp; suggestions across your {villagerCount} villagers.
        </p>
      </div>
      {cards.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3 items-start">
          {cards.map(c => {
            const s = SEV[c.severity];
            return (
              <div key={c.title} className="rounded-xl py-3.5 px-4 border"
                style={{ borderColor: s.bd, background: `linear-gradient(180deg,${s.bg},transparent)` }}>
                <div className="flex items-center gap-[11px] mb-1">
                  <span className="w-[30px] h-[30px] rounded-lg flex-none flex items-center justify-center border"
                    style={{ background: s.bg, borderColor: s.bd }}>
                    <Icon name={c.icon} size={15} color={s.a} />
                  </span>
                  <span className="font-serif text-[15px] font-semibold flex-auto" style={{ color: s.c }}>{c.title}</span>
                  <span className="font-mono text-[11px] font-semibold py-px px-2 rounded-full border"
                    style={{ color: s.a, background: s.bg, borderColor: s.bd }}>{c.items.length}</span>
                </div>
                <p className="mb-[11px] text-xs text-sand-400 pl-[41px]">{c.desc}</p>
                <div className="flex flex-wrap gap-[7px] pl-[41px]">
                  {c.items.map(it => {
                    const name = npcName(it.npc);
                    const first = it.npc.first_name ?? name, last = it.npc.last_name ?? '';
                    return (
                      <button key={it.guid} onClick={() => onOpen(it.guid)}
                        className="inline-flex items-center gap-2 py-[5px] pr-[11px] pl-[5px] bg-iron-750 border border-line-3 rounded-full cursor-pointer">
                        <Avatar v={it.npc} size={22} radius={6} />
                        <span className="text-xs text-sand-200 whitespace-nowrap">{name}</span>
                        <span className="text-[10.5px] font-mono" style={{ color: s.a }}>{it.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-5">
          <div className="font-serif text-lg text-[#8FBF74] mb-1.5">All clear</div>
          <div className="text-[13px] text-sand-600">
            No warnings or suggestions right now — the settlement is in good order.
          </div>
        </div>
      )}
    </div>
  </div>
);
