'use client';
// Insights tab — automated triage cards (real-data subset of the design).
import { hireGateOf, NEGATIVE_TRAITS, npcName, traitLabel, type InsightCard, type UpgradeSuggestion } from '@/lib/bw/model';
import { trustRankName } from 'bellwright-parse/villages';
import type { VillageState, Housing } from '@/lib/types';
import { Icon } from './icons';
import { Avatar } from './avatar';
import { GearPanel } from './gear';
import { SEV } from './ui';

// Upgrade candidates: weakest non-specialized villagers vs the recruit pool
const UpgradePanel = ({ upgrades, onOpen }: {
  upgrades: UpgradeSuggestion[]; onOpen: (guid: string) => void;
}) => upgrades.length === 0 ? null : (
  <div className="mb-7">
    <div className="mb-3">
      <h2 className="font-serif text-xl font-semibold text-sand-100">Upgrade candidate</h2>
      <p className="mt-1 text-[12.5px] text-[#8a8069]">
        Your weakest non-specialized villager, with recruits that beat them on both combat and
        work ceilings — replace them and the next weakest takes this spot. Deltas are
        trait-adjusted (a Slacker counts ≈10% weaker, so a clean sideways swap still rates as an
        upgrade). Trained levels are lost on replacement — and innate traits aren&apos;t in save
        data, so check a candidate&apos;s traits in game before hiring. Candidates are limited to who you can actually hire right now, based on each
        village&apos;s current trust rank.
      </p>
    </div>
    <div className="max-w-[620px]">
      {upgrades.map(u => {
        const vg = u.villager;
        return (
          <div key={vg.guid ?? npcName(vg)} className="rounded-xl border border-line-2 bg-[#1A160F] py-3 px-3.5">
            <button onClick={() => vg.guid && onOpen(vg.guid)}
              className="flex items-center gap-2.5 w-full text-left cursor-pointer bg-transparent border-none p-0">
              <Avatar v={vg} size={30} radius={8} />
              <span className="min-w-0 flex-auto">
                <span className="block text-[13px] text-sand-100 font-medium">{npcName(vg)}</span>
                <span className="block text-[10.5px] text-sand-500">
                  caps {u.vCombat + u.vWork} (C{u.vCombat}/W{u.vWork}) · {u.trainedLevels} trained levels at stake
                  {u.vPenalized && <span className="text-rust-soft"> · trait-hobbled</span>}
                </span>
              </span>
              {vg.traits?.map(t => (
                <span key={t} className={NEGATIVE_TRAITS.has(t)
                  ? 'text-[9px] font-bold uppercase tracking-[.3px] text-rust-soft bg-rust/[.12] border border-rust/35 rounded-[4px] px-[5px] py-px'
                  : 'text-[9px] font-bold uppercase tracking-[.3px] text-moss-soft bg-moss/[.12] border border-moss/35 rounded-[4px] px-[5px] py-px'}>{traitLabel(t)}</span>
              ))}
            </button>
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-row pt-2.5">
              {u.candidates.map(c => {
                const g = hireGateOf(c.npc);
                return (
                  <button key={c.npc.guid ?? npcName(c.npc)} onClick={() => c.npc.guid && onOpen(c.npc.guid)}
                    className="flex items-center gap-2 w-full text-left cursor-pointer bg-transparent border-none p-0">
                    <Avatar v={c.npc} size={24} radius={6} />
                    <span className="text-xs text-sand-200 whitespace-nowrap overflow-hidden text-ellipsis">{npcName(c.npc)}</span>
                    {c.npc.traits?.map(t => (
                      <span key={t} className={NEGATIVE_TRAITS.has(t)
                        ? 'text-[8.5px] font-bold uppercase text-rust-soft bg-rust/[.12] border border-rust/35 rounded-[4px] px-1 py-px flex-none'
                        : 'text-[8.5px] font-bold uppercase text-moss-soft bg-moss/[.12] border border-moss/35 rounded-[4px] px-1 py-px flex-none'}>{traitLabel(t)}</span>
                    ))}
                    <span className="font-mono text-[10.5px] text-moss-bright flex-none">+{c.delta}</span>
                    <span className="text-[10.5px] text-sand-600 flex-none">C{c.combat}/W{c.work}</span>
                    <span className="flex-auto" />
                    {c.npc.village && <span className="text-[10.5px] text-sand-600 whitespace-nowrap flex-none">{c.npc.village}</span>}
                    {g && (
                      <span data-tip={`Hire: ${g.trust} trust${g.liberation ? ' + liberated' : ''} · base ${Math.round(g.renown)} renown`}
                        className="inline-flex items-center gap-1 flex-none">
                        <img src={`/icons/bw/trust-${g.trust.toLowerCase()}.png`} alt={g.trust}
                          className="w-[15px] h-[15px] max-w-none object-contain" />
                        {g.liberation && <span className="text-[7.5px] font-bold uppercase text-gold-bright/80">LIB</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Per-village trust + prosperity (from MistNeutralVillageComponent)
const TRUST_TIERS = ['Stranger', 'Associate', 'Friend', 'Protector', 'Leader'];
const TRUST_FLOOR: Record<string, number> = { Stranger: 0, Associate: 100, Friend: 500, Protector: 1200, Leader: 2400 };
const VillagesPanel = ({ villages }: { villages: VillageState[] }) => villages.length === 0 ? null : (
  <div className="mb-7">
    <div className="mb-3">
      <h2 className="font-serif text-xl font-semibold text-sand-100">Villages</h2>
      <p className="mt-1 text-[12.5px] text-[#8a8069]">
        Current trust rank per village (gates who you can recruit) and prosperity where liberated.
      </p>
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
      {[...villages].sort((a, b) => b.trust_level - a.trust_level || b.trust - a.trust).map(v => {
        const rank = TRUST_TIERS[v.trust_level] ?? 'Stranger';
        const next = TRUST_FLOOR[TRUST_TIERS[v.trust_level + 1]] ?? null;
        const floor = TRUST_FLOOR[rank] ?? 0;
        const pct = v.liberated ? 100 : next ? Math.min(100, Math.round(((v.trust - floor) / (next - floor)) * 100)) : 100;
        return (
          <div key={v.name} className="rounded-xl border border-line-2 bg-[#1A160F] py-2.5 px-3">
            <div className="flex items-center gap-2">
              <img src={`/icons/bw/trust-${rank.toLowerCase()}.png`} alt={rank} className="w-[18px] h-[18px] max-w-none object-contain" />
              <span className="text-[13px] text-sand-100 font-medium flex-auto">{v.name}</span>
              <span className="text-[10.5px] text-sand-500">{rank}</span>
            </div>
            <div className="mt-2 h-[4px] rounded-full bg-white/[.07] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: v.liberated ? '#F4C868' : '#C9A96A' }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-sand-600">
              <span>{v.liberated ? 'Liberated' : `${v.trust}${next ? ` / ${next}` : ''} trust`}</span>
              {v.liberated && <span className="text-gold-bright/80">✦ {v.prosperity} prosperity</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Villager housing: aggregate sleeping quarters vs. population. The save can't
// name who's homeless, so this is a settlement-wide bed deficit (beds < people).
const HousingPanel = ({ housing, villagerCount }: { housing: Housing; villagerCount: number }) => {
  const { quarters, houses, byType } = housing;
  const homeless = Math.max(0, villagerCount - quarters);
  const free = Math.max(0, quarters - villagerCount);
  const occupied = Math.min(villagerCount, quarters);
  const pct = quarters > 0 ? Math.min(100, Math.round((occupied / quarters) * 100)) : 100;
  const alert = homeless > 0;
  return (
    <div className="mb-7">
      <div className="mb-3">
        <h2 className="font-serif text-xl font-semibold text-sand-100">Housing</h2>
        <p className="mt-1 text-[12.5px] text-[#8a8069]">
          Total sleeping quarters across your houses vs. your {villagerCount} villagers.
          Beds come from the building type (Housing Tent 2 · House 4 · Big House 7); the
          save doesn&apos;t say who specifically lacks a bed, only the settlement-wide total.
        </p>
      </div>
      <div className="max-w-[620px] rounded-xl border py-3 px-3.5"
        style={{ borderColor: alert ? '#8B4A3966' : '#2A2319', background: alert ? 'linear-gradient(180deg,#3a1f1730,transparent)' : '#1A160F' }}>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold" style={{ color: alert ? '#EDA593' : '#8FBF74' }}>
            {quarters}
          </span>
          <span className="text-[12.5px] text-sand-400">beds</span>
          <span className="text-sand-700">·</span>
          <span className="font-serif text-2xl font-semibold text-sand-100">{villagerCount}</span>
          <span className="text-[12.5px] text-sand-400">villagers</span>
          <span className="flex-auto" />
          <span className="text-[12.5px] font-medium" style={{ color: alert ? '#EDA593' : '#8FBF74' }}>
            {alert ? `${homeless} without a bed` : `${free} free bed${free === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="mt-2.5 h-[6px] rounded-full bg-white/[.07] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: alert ? '#C4664F' : '#7FB05B' }} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {byType.map(t => (
            <span key={t.cls} className="inline-flex items-center gap-1.5 text-[11px] py-1 px-2.5 rounded-full bg-iron-750 border border-line-3">
              <span className="text-sand-200">{t.count}× {t.label}</span>
              <span className="font-mono text-sand-600">{t.beds} beds</span>
            </span>
          ))}
          {houses === 0 && <span className="text-[11.5px] text-sand-600">No houses detected.</span>}
        </div>
        {alert && (
          <p className="mt-2.5 text-[11.5px] text-[#d69783]">
            Build more housing (or upgrade tents to houses) — homeless villagers lose morale.
          </p>
        )}
      </div>
    </div>
  );
};

export const Insights = ({ cards, upgrades, villages, housing, villagerCount, snapshotId, onOpen }: {
  cards: InsightCard[]; upgrades: UpgradeSuggestion[]; villages: VillageState[]; housing?: Housing; villagerCount: number; snapshotId?: number; onOpen: (guid: string) => void;
}) => (
  <div className="bw-scroll h-full overflow-y-auto">
    <div className="pt-[22px] px-6 pb-16">
      <GearPanel key={snapshotId ?? 0} onOpen={onOpen} />
      {housing && <HousingPanel housing={housing} villagerCount={villagerCount} />}
      <VillagesPanel villages={villages} />
      <UpgradePanel upgrades={upgrades} onOpen={onOpen} />
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
