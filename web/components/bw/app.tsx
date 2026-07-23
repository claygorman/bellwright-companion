'use client';
// Bellwright Companion — app shell (header, tabs, toolbar) + tab bodies.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Npc, World } from '@/lib/types';
import { agoLabel, playtimeLabel } from '@/lib/bw/format';
import { classifyRole, hireGateOf, insightsFor, npcName, playerNpcs, recruitNpcs, ROLE_COLORS, specialtyOf, upgradeSuggestions, type RecruitRole } from '@/lib/bw/model';
import { shapeContainers } from '@/lib/bw/storage';
import { CompareModal, CompareTray } from './compare';
import { UploadButton } from './upload-modal';
import { RaidWatcher } from './raid-alert';
import { EventsTab } from './events-tab';
import { useRealtime } from './use-realtime';
import { BwSelect } from '@/components/ui/dropdown-menu';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Drawer } from './drawer';
import { Insights } from './insights';
import { MapTab } from './map-tab';
import { MeTab } from './me';
import { Roster, guidOf, type SortState } from './roster';
import { SearchIcon } from './icons';
import { StorageTab, storagePressure } from './storage-tab';
import { Trends } from './trends';
import { cn } from '@/lib/utils';
import { useTooltips } from './use-tooltips';

const MOBILE_BREAKPOINT = 760;
const META_WIDE_BREAKPOINT = 1180;
const MAX_COMPARE = 3;
// live refresh: poll the version endpoint and re-render server data when a
// new snapshot lands (router.refresh() keeps all client state — tab, filters,
// open drawer — only the world prop changes)
const VERSION_POLL_MS = 30_000;

type TabKey = 'me' | 'villagers' | 'npcs' | 'trends' | 'insights' | 'storage' | 'map' | 'events';
export type RosterView = 'skills' | 'gear';

// tab <-> URL slug (deep-linkable routes served by app/[tab]/page.tsx)
const TAB_SLUG: Record<TabKey, string> = {
  me: 'me', villagers: 'population', npcs: 'recruits',
  trends: 'trends', insights: 'insights', storage: 'storage', map: 'map', events: 'events',
};
const SLUG_TAB = Object.fromEntries(
  Object.entries(TAB_SLUG).map(([k, s]) => [s, k as TabKey]),
) as Record<string, TabKey>;

export const CompanionApp = ({ world, initialSlug }: { world: World; initialSlug?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useTooltips(rootRef);
  const router = useRouter();

  // watch for new snapshots and pull fresh server data in place
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch('/api/world/version', { cache: 'no-store' });
        if (!res.ok) return;
        const v = (await res.json()) as { snapshot_id: number | null; ingested_at?: string };
        if (v.snapshot_id != null
          && (v.snapshot_id !== world.snapshot_id || v.ingested_at !== world.ingested_at)) {
          router.refresh();
        }
      } catch { /* endpoint unreachable — try again next tick */ }
    };
    const t = setInterval(check, VERSION_POLL_MS);
    const onVisible = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, world.snapshot_id, world.ingested_at]);

  const [tab, setTab] = useState<TabKey>(() => {
    const t = SLUG_TAB[initialSlug ?? ''] ?? 'villagers';
    return t === 'me' && !world.player ? 'villagers' : t;
  });
  const [rosterView, setRosterView] = useState<RosterView>('skills');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 1 });
  const [selGuid, setSelGuid] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSet, setCompareSet] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [villageFilter, setVillageFilter] = useState<Set<string>>(new Set());
  const [profFilter, setProfFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<RecruitRole>>(new Set());
  const [rankFilter, setRankFilter] = useState<Set<string>>(new Set());
  const [metaWide, setMetaWide] = useState(true);
  const [ago, setAgo] = useState<string | null>(null); // client-only (avoids hydration mismatch)
  const [realtime, setRealtime] = useRealtime(); // opt-in live monitor (per-browser)

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setMetaWide(window.innerWidth >= META_WIDE_BREAKPOINT);
    };
    onResize();
    window.addEventListener('resize', onResize);
    const tick = () => setAgo(agoLabel(world.ingested_at));
    tick();
    const t = setInterval(tick, 30_000);
    return () => { window.removeEventListener('resize', onResize); clearInterval(t); };
  }, [world.ingested_at]);

  useEffect(() => {
    setVillageFilter(new Set()); setProfFilter(new Set()); setRoleFilter(new Set()); setRankFilter(new Set());
  }, [tab]);

  // switch tab + reflect it in the URL so refresh/back keep the active tab
  const openTab = (k: TabKey) => {
    setTab(k);
    window.history.pushState(null, '', `/${TAB_SLUG[k]}`);
  };
  useEffect(() => {
    const onPop = () => {
      const t = SLUG_TAB[window.location.pathname.replace(/^\//, '')] ?? 'villagers';
      setTab(t === 'me' && !world.player ? 'villagers' : t);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [world.player]);

  const villagers = useMemo(() => playerNpcs(world), [world]);
  const recruits = useMemo(() => recruitNpcs(world), [world]);
  const insights = useMemo(() => insightsFor(villagers), [villagers]);
  const upgrades = useMemo(
    () => upgradeSuggestions(villagers, recruits, world.villages),
    [villagers, recruits, world.villages]);
  const containers = useMemo(() => shapeContainers(world.storage), [world.storage]);
  const storageAlert = useMemo(() => storagePressure(containers), [containers]);
  // homelessness: villagers beyond total sleeping quarters (aggregate deficit)
  const homeless = world.housing ? Math.max(0, villagers.length - world.housing.quarters) : 0;
  const villagerAlert = villagers.some(v => v.injuries.length > 0) || homeless > 0;

  const npcByRawGuid = useMemo(() => {
    const m = new Map<string, Npc>();
    for (const v of world.npcs) if (v.guid) m.set(v.guid, v);
    return m;
  }, [world.npcs]);

  const squadsOfSel = (guid: string | null) =>
    guid == null ? [] : (world.groups ?? [])
      .filter(g => g.name && g.members.includes(guid))
      .map(g => ({
        name: g.name as string,
        members: g.members.map(m => npcByRawGuid.get(m)).filter((x): x is Npc => Boolean(x)),
      }));

  const byGuid = useMemo(() => {
    const m = new Map<string, Npc>();
    for (const v of world.npcs) m.set(guidOf(v), v);
    return m;
  }, [world.npcs]);

  const isTable = tab === 'villagers' || tab === 'npcs';
  const dataset = tab === 'npcs' ? recruits : villagers;
  const ql = q.trim().toLowerCase();
  const villages = useMemo(() =>
    [...new Set(dataset.map(v => v.village).filter((x): x is string => Boolean(x)))].sort(), [dataset]);
  const professions = useMemo(() =>
    [...new Set(dataset.map(v => specialtyOf(v)).filter((x): x is string => Boolean(x)))].sort(), [dataset]);
  // profession specialties are liberation unlocks; Commoner/Beggar hire on
  // village Trust — split the chip groups to mirror the game's system
  const specialistChips = useMemo(() => professions.filter(p => p !== 'Commoner' && p !== 'Beggar'), [professions]);
  const commonChips = useMemo(() => professions.filter(p => p === 'Commoner' || p === 'Beggar'), [professions]);
  // trust ranks present in the dataset, in ladder order (exact hire-gate data)
  const RANK_ORDER = ['Stranger', 'Associate', 'Friend', 'Protector', 'Leader'];
  const ranks = useMemo(() => {
    const present = new Set(dataset.map(v => hireGateOf(v)?.trust).filter((x): x is string => Boolean(x)));
    return RANK_ORDER.filter(r => present.has(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);
  const rows = useMemo(() => {
    let list = dataset.filter(v => !ql
      || npcName(v).toLowerCase().includes(ql)
      || (v.template ?? '').toLowerCase().includes(ql)
      || (v.village ?? '').toLowerCase().includes(ql));
    if (villageFilter.size) list = list.filter(v => v.village != null && villageFilter.has(v.village));
    if (profFilter.size) { const p = specialtyOf; list = list.filter(v => { const x = p(v); return x != null && profFilter.has(x); }); }
    if (roleFilter.size) list = list.filter(v => roleFilter.has(classifyRole(v)));
    if (rankFilter.size) list = list.filter(v => { const g = hireGateOf(v); return g != null && rankFilter.has(g.trust); });
    const { key: k, dir } = sort;
    list = [...list].sort((a, b) => {
      if (k === 'name') {
        const av = `${a.last_name ?? ''}${a.first_name ?? ''}`, bv = `${b.last_name ?? ''}${b.first_name ?? ''}`;
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      let av: number, bv: number;
      if (k === 'morale') { av = a.morale ?? -1; bv = b.morale ?? -1; }
      else {
        av = a.skills[k]?.level ?? -1; bv = b.skills[k]?.level ?? -1;
        if (av === bv) { av = a.skills[k]?.xp ?? 0; bv = b.skills[k]?.xp ?? 0; }
      }
      return (av - bv) * dir;
    });
    return list;
  }, [dataset, ql, sort, tab, villageFilter, profFilter, roleFilter, rankFilter]);

  const onSort = (key: string, defDir: 1 | -1) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: defDir }));

  const toggleCompare = (g: string) =>
    setCompareSet(s => (s.includes(g) ? s.filter(x => x !== g) : s.length < MAX_COMPARE ? [...s, g] : s));

  const compareNpcs = compareSet.map(g => byGuid.get(g)).filter((v): v is Npc => Boolean(v));
  const sel = selGuid ? byGuid.get(selGuid) ?? null : null;

  const tabs: { key: TabKey; label: string; count: number | null; alert: boolean }[] = [
    ...(world.player ? [{ key: 'me' as TabKey, label: world.meta.character ?? 'My character', count: null, alert: false }] : []),
    { key: 'villagers', label: 'Population', count: villagers.length, alert: villagerAlert },
    { key: 'npcs', label: 'Recruits', count: recruits.length, alert: false },
    { key: 'trends', label: 'Trends', count: null, alert: false },
    { key: 'insights', label: 'Insights', count: insights.length, alert: homeless > 0 },
    { key: 'storage', label: 'Storage', count: containers.length, alert: storageAlert },
    { key: 'map', label: 'Map', count: null, alert: false },
    ...(realtime ? [{ key: 'events' as TabKey, label: 'Events', count: null, alert: false }] : []),
  ];

  return (
    <div ref={rootRef}
      className="bg-iron-900 text-sand-200 h-dvh max-w-[100vw] overflow-x-hidden flex flex-col font-sans antialiased"
      style={{ '--accent': '#E0A73C', '--gold': '#F4C868', '--rowpad': '9px' } as React.CSSProperties}>
      {realtime && <RaidWatcher />}
      {/* header */}
      <header className="flex items-center gap-[18px] h-14 px-[18px] min-w-0 overflow-hidden border-b border-line-2 bg-gradient-to-b from-[#1B1712] to-[#17130E] flex-none relative z-20">
        <div className="flex items-center gap-[11px]">
          <div className="w-[30px] h-[30px] rounded-[7px] bg-[radial-gradient(circle_at_32%_28%,#F4C868,#C6892C)] flex items-center justify-center shadow-[0_0_0_1px_rgba(244,200,104,.25),0_2px_8px_rgba(0,0,0,.4)]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L14 8 L20 8 L15 12 L17 19 L12 15 L7 19 L9 12 L4 8 L10 8 Z" fill="#2a1e08" />
            </svg>
          </div>
          <div className="flex flex-col leading-[1.05]">
            <span className="font-serif font-semibold text-base tracking-[.3px] text-sand-100">
              Bellwright<span className="text-gold"> · Companion</span>
            </span>
            <span className="text-[10.5px] text-sand-500 tracking-[.4px]">
              {world.meta.character ?? 'Player'}&apos;s settlement ledger
            </span>
          </div>
        </div>
        <div className="w-px h-[26px] bg-line-3" />
        <div className="flex items-center gap-[14px] text-[11.5px] flex-1 min-w-0 flex-wrap max-h-10 overflow-hidden">
          <Meta k="save" v={world.meta.saveName ?? '—'} />
          <Meta k="build" v={world.meta.savedBuild ?? '—'} mono />
          {metaWide && <Meta k="region" v={world.meta.region ?? '—'} />}
          {metaWide && <Meta k="played" v={playtimeLabel(world.meta.playtimeSeconds)} mono />}
        </div>
        <div className="flex items-center gap-2 py-[5px] px-[11px] rounded-full bg-moss-bright/10 border border-moss-bright/30 flex-none">
          <span className="w-[7px] h-[7px] rounded-full bg-moss-bright shadow-[0_0_6px_#7FB05B] [animation:bwpulse_2.4s_ease-in-out_infinite]" />
          <span className="text-[11.5px] text-[#A9C293] whitespace-nowrap">
            {ago ? `Fresh · ingested ${ago}` : 'Fresh'}
          </span>
        </div>
        <UploadButton onIngested={() => router.refresh()} />
        <SettingsMenu realtime={realtime} onRealtime={setRealtime} />
      </header>

      {/* tabs + toolbar */}
      <div className="flex items-center gap-1.5 py-[9px] px-[18px] border-b border-line bg-iron-800 flex-none flex-wrap relative z-[15]">
        <nav className="bw-scroll flex gap-[3px] bg-ink p-[3px] rounded-[9px] border border-[#2A2319] max-w-full overflow-x-auto flex-nowrap">
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => openTab(t.key)} className={cn(
                'inline-flex items-center gap-[7px] py-1.5 px-[13px] border-none flex-none whitespace-nowrap rounded-[7px] cursor-pointer font-sans text-[13px] transition-all duration-100',
                active ? 'font-semibold text-[#1a150c] bg-gold' : 'font-medium text-sand-400 bg-transparent hover:text-[#EFE6D4] hover:bg-white/[.03]',
              )}>
                <span>{t.label}</span>
                {t.count != null && (
                  <span className={cn(
                    'font-mono text-[11px] py-px px-1.5 rounded-[5px]',
                    active ? 'text-[#1a150c] bg-black/[.16]' : 'text-sand-400 bg-[#221D16]',
                  )}>{t.count}</span>
                )}
                {t.alert && (
                  <span data-tip={t.key === 'storage' ? 'Storage needs attention'
                    : t.key === 'insights' ? `${homeless} villager${homeless === 1 ? '' : 's'} without a bed`
                    : 'Villagers need attention'}
                    className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-rust text-white text-[10px] font-bold leading-none">!</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex-1" />
        {isTable && (
          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-2 px-[11px] h-[34px] bg-ink border border-line-3 rounded-lg flex-1 min-w-0 sm:flex-none">
              <SearchIcon />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Filter by name or archetype…"
                className="bg-transparent border-none outline-none text-sand-200 text-[13px] w-full sm:w-[190px] min-w-0 font-sans" />
            </div>
            <BwSelect label="View" value={rosterView} align="start"
              options={[{ value: 'skills', label: 'Skills' }, { value: 'gear', label: 'Gear & inventory' }]}
              onChange={v => setRosterView(v as RosterView)} />
            <button onClick={() => setCompareMode(m => { if (m) setCompareSet([]); return !m; })} className={cn(
              'inline-flex items-center gap-[7px] h-[34px] px-[13px] rounded-lg cursor-pointer font-sans text-[12.5px] font-medium border transition-colors',
              compareMode ? 'border-gold bg-gold/[.14] text-gold-bright' : 'border-line-3 bg-ink text-sand-400 hover:border-[#4a4030]',
            )}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 3v18M15 3v18M3 9h18" />
              </svg>
              <span>Compare</span>
            </button>
            <span className="hidden sm:inline text-xs text-sand-600 tabular-nums whitespace-nowrap">
              {rows.length} {tab === 'npcs' ? 'recruits' : 'villagers'}
            </span>
          </div>
        )}
      </div>

      {isTable && (
        <div className="bw-scroll flex items-center gap-1.5 py-[7px] px-[18px] flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible border-b border-line bg-[#15110C] text-[11.5px]">
          {villages.length > 0 && (<>
            <FilterChips label="Village" all={villages} sel={villageFilter}
              onToggle={v => setVillageFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
            <span className="w-px h-4 bg-line-3 flex-none" />
          </>)}
          {specialistChips.length > 0 && (<>
            <FilterChips label="Specialist (liberated)" all={specialistChips} sel={profFilter}
              onToggle={v => setProfFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
            <span className="w-px h-4 bg-line-3 flex-none" />
          </>)}
          {commonChips.length > 0 && (<>
            <FilterChips label="Common" all={commonChips} sel={profFilter}
              onToggle={v => setProfFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
            <span className="w-px h-4 bg-line-3 flex-none" />
          </>)}
          {ranks.length > 0 && (<>
            <FilterChips label="Trust" all={ranks} sel={rankFilter}
              onToggle={v => setRankFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
            <span className="w-px h-4 bg-line-3 flex-none" />
          </>)}
          <FilterChips label="Role" all={['Fighter', 'Worker', 'Balanced']} sel={roleFilter as Set<string>}
            colors={ROLE_COLORS as Record<string, string>}
            onToggle={v => setRoleFilter(s2 => { const n = new Set(s2); n.has(v as RecruitRole) ? n.delete(v as RecruitRole) : n.add(v as RecruitRole); return n; })} />
        </div>
      )}

      {/* main */}
      <main className="bw-scroll flex-1 overflow-auto relative min-h-0">
        {tab === 'me' && world.player && (
          <MeTab player={world.player} meta={world.meta} villagerCount={villagers.length}
            presetName={null} />
        )}
        {isTable && (
          <Roster rows={rows} npcCol={tab === 'npcs'} archCol playtime={world.meta.playtimeSeconds} ingestedAt={world.ingested_at}
            isMobile={isMobile} view={rosterView} carried={world.carried}
            compareMode={compareMode} compareSet={compareSet} sort={sort} onSort={onSort}
            onOpen={setSelGuid} onToggleCompare={toggleCompare} />
        )}
        {tab === 'trends' && <Trends />}
        {tab === 'insights' && <Insights cards={insights} upgrades={upgrades} villages={world.villages ?? []} housing={world.housing} villagerCount={villagers.length} snapshotId={world.snapshot_id} onOpen={setSelGuid} />}
        {tab === 'storage' && <StorageTab containers={containers} />}
        {tab === 'map' && (
          <MapTab world={world} realtime={realtime}
            region={`${world.meta.map?.startsWith('Karvenia') ? 'Karvenia' : world.meta.map ?? ''} — ${world.meta.region ?? ''}`}
            onOpenProfile={setSelGuid} />
        )}
        {tab === 'events' && (realtime
          ? <EventsTab />
          : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
              <div className="font-serif text-lg text-sand-200">Realtime monitor is off</div>
              <p className="text-[13px] text-sand-600 max-w-[420px]">
                The Events feed and live map need the realtime monitor, which reads from the
                companion daemon. Enable it to view reader status and the live event log.
              </p>
              <button onClick={() => setRealtime(true)}
                className="mt-1 inline-flex items-center gap-2 h-[34px] px-3.5 rounded-lg border border-gold bg-gold/[.14] text-gold-bright text-[12.5px] font-medium cursor-pointer">
                Enable realtime monitor
              </button>
            </div>
          ))}
      </main>

      {compareMode && compareNpcs.length > 0 && (
        <CompareTray npcs={compareNpcs} onRemove={toggleCompare}
          onClear={() => setCompareSet([])} onOpen={() => setShowCompare(true)} />
      )}
      {sel && <Drawer v={sel} playtime={world.meta.playtimeSeconds} ingestedAt={world.ingested_at} squads={squadsOfSel(sel.guid)}
        presetName={sel.gear_preset ? (world.gear_presets ?? []).find(p => p.key === sel.gear_preset)?.name ?? null : null}
        onOpen={setSelGuid} isMobile={isMobile} onClose={() => setSelGuid(null)} />}
      {showCompare && <CompareModal npcs={compareNpcs} onClose={() => setShowCompare(false)} />}
    </div>
  );
};

const FilterChips = ({ label, all, sel, onToggle, colors }: {
  label: string; all: string[]; sel: Set<string>;
  onToggle: (v: string) => void; colors?: Record<string, string>;
}) => (
  <span className="inline-flex items-center gap-[5px] flex-none flex-nowrap sm:flex-wrap">
    <span className="text-[9.5px] tracking-[.5px] uppercase text-sand-600 whitespace-nowrap">{label}</span>
    {all.map(v => {
      const on = sel.has(v);
      const color = colors?.[v] ?? '#C6BBA4';
      return (
        <button key={v} onClick={() => onToggle(v)}
          className={cn(
            'py-0.5 px-[9px] rounded-full cursor-pointer font-sans text-[11px] border flex-none whitespace-nowrap',
            on ? 'text-[#EDE4D2]' : 'border-line-3 bg-transparent text-sand-400',
          )}
          // active chip tint comes from the role/village color in data
          style={on ? { borderColor: color, background: `${color}22` } : undefined}>{v}</button>
      );
    })}
  </span>
);

// Header settings menu — houses the per-browser Realtime monitor toggle.
const SettingsMenu = ({ realtime, onRealtime }: { realtime: boolean; onRealtime: (v: boolean) => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      data-tip="Settings"
      className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg border border-line-3 bg-ink text-sand-400 hover:border-[#4a4030] cursor-pointer outline-none flex-none">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[280px] p-2.5">
      <button onClick={() => onRealtime(!realtime)}
        className="flex items-start gap-2.5 w-full text-left rounded-md p-2 hover:bg-white/[.04] cursor-pointer">
        <span className={cn('mt-0.5 w-[34px] h-[19px] rounded-full flex-none relative transition-colors',
          realtime ? 'bg-gold' : 'bg-[#3a3327]')}>
          <span className={cn('absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white transition-all',
            realtime ? 'left-[17px]' : 'left-[2px]')} />
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] text-sand-100 font-medium">Realtime monitor</span>
          <span className="block text-[11px] text-sand-500 leading-snug">
            Live map pins, raid alerts &amp; the Events tab — needs the companion reader daemon running.
          </span>
        </span>
      </button>
    </DropdownMenuContent>
  </DropdownMenu>
);

const Meta = ({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) => (
  <span className="inline-flex gap-1.5 text-sand-400 whitespace-nowrap">
    <span className="text-sand-700">{k}</span>
    <span className={mono ? 'font-mono' : undefined}>{v}</span>
  </span>
);
