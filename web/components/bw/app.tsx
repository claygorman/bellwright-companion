'use client';
// Bellwright Companion — app shell (header, tabs, toolbar) + tab bodies.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Npc, World } from '@/lib/types';
import { agoLabel, playtimeLabel } from '@/lib/bw/format';
import { classifyRole, insightsFor, npcName, playerNpcs, recruitNpcs, ROLE_COLORS, type RecruitRole } from '@/lib/bw/model';
import { shapeContainers } from '@/lib/bw/storage';
import { CompareModal, CompareTray } from './compare';
import { Drawer } from './drawer';
import { Insights } from './insights';
import { MapTab } from './map-tab';
import { MeTab } from './me';
import { Roster, guidOf, type SortState } from './roster';
import { SearchIcon } from './icons';
import { StorageTab, storagePressure } from './storage-tab';
import { Trends } from './trends';
import { C, MONO, SANS, SERIF, searchBoxStyle, searchInputStyle } from './ui';
import { useTooltips } from './use-tooltips';

const MOBILE_BREAKPOINT = 760;
const META_WIDE_BREAKPOINT = 1180;
const MAX_COMPARE = 3;
// live refresh: poll the version endpoint and re-render server data when a
// new snapshot lands (router.refresh() keeps all client state — tab, filters,
// open drawer — only the world prop changes)
const VERSION_POLL_MS = 30_000;

type TabKey = 'me' | 'villagers' | 'npcs' | 'trends' | 'insights' | 'storage' | 'map';
export type RosterView = 'skills' | 'gear';

export const CompanionApp = ({ world }: { world: World }) => {
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

  const [tab, setTab] = useState<TabKey>('villagers');
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
  const [metaWide, setMetaWide] = useState(true);
  const [ago, setAgo] = useState<string | null>(null); // client-only (avoids hydration mismatch)

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

  const villagers = useMemo(() => playerNpcs(world), [world]);
  const recruits = useMemo(() => recruitNpcs(world), [world]);
  const insights = useMemo(() => insightsFor(villagers), [villagers]);
  const containers = useMemo(() => shapeContainers(world.storage), [world.storage]);
  const storageAlert = useMemo(() => storagePressure(containers), [containers]);
  const villagerAlert = villagers.some(v => v.injuries.length > 0);

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
    [...new Set(recruits.map(v => v.village).filter((x): x is string => Boolean(x)))].sort(), [recruits]);
  const professions = useMemo(() =>
    [...new Set(recruits.map(v => v.profession).filter((x): x is string => Boolean(x)))].sort(), [recruits]);
  const rows = useMemo(() => {
    let list = dataset.filter(v => !ql
      || npcName(v).toLowerCase().includes(ql)
      || (v.template ?? '').toLowerCase().includes(ql)
      || (v.village ?? '').toLowerCase().includes(ql));
    if (tab === 'npcs') {
      if (villageFilter.size) list = list.filter(v => v.village != null && villageFilter.has(v.village));
      if (profFilter.size) list = list.filter(v => v.profession != null && profFilter.has(v.profession));
      if (roleFilter.size) list = list.filter(v => roleFilter.has(classifyRole(v)));
    }
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
  }, [dataset, ql, sort, tab, villageFilter, profFilter, roleFilter]);

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
    { key: 'insights', label: 'Insights', count: insights.length, alert: false },
    { key: 'storage', label: 'Storage', count: containers.length, alert: storageAlert },
    { key: 'map', label: 'Map', count: null, alert: false },
  ];

  return (
    <div ref={rootRef} style={{
      '--accent': '#E0A73C', '--gold': '#F4C868', '--rowpad': '9px',
      background: C.pageBg, color: C.text, height: '100dvh', maxWidth: '100vw', overflowX: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: SANS, WebkitFontSmoothing: 'antialiased',
    } as React.CSSProperties}>
      {/* header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 18, height: 56, padding: '0 18px', minWidth: 0, overflow: 'hidden',
        borderBottom: '1px solid #2C251D', background: 'linear-gradient(180deg,#1B1712,#17130E)',
        flex: '0 0 auto', position: 'relative', zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'radial-gradient(circle at 32% 28%, #F4C868, #C6892C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(244,200,104,.25), 0 2px 8px rgba(0,0,0,.4)',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L14 8 L20 8 L15 12 L17 19 L12 15 L7 19 L9 12 L4 8 L10 8 Z" fill="#2a1e08" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, letterSpacing: '.3px', color: C.textBright }}>
              Bellwright<span style={{ color: 'var(--accent)' }}> · Companion</span>
            </span>
            <span style={{ fontSize: 10.5, color: '#8A7F6C', letterSpacing: '.4px' }}>
              {world.meta.character ?? 'Player'}&apos;s settlement ledger
            </span>
          </div>
        </div>
        <div style={{ width: 1, height: 26, background: '#2E271F' }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, flex: '1 1 auto',
          minWidth: 0, flexWrap: 'wrap', maxHeight: 40, overflow: 'hidden',
        }}>
          <Meta k="save" v={world.meta.saveName ?? '—'} />
          <Meta k="build" v={world.meta.savedBuild ?? '—'} mono />
          {metaWide && <Meta k="region" v={world.meta.region ?? '—'} />}
          {metaWide && <Meta k="played" v={playtimeLabel(world.meta.playtimeSeconds)} mono />}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 11px', borderRadius: 999,
          background: 'rgba(111,160,91,.1)', border: '1px solid rgba(111,160,91,.3)', flex: '0 0 auto',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#7FB05B',
            boxShadow: '0 0 6px #7FB05B', animation: 'bwpulse 2.4s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11.5, color: '#A9C293', whiteSpace: 'nowrap' }}>
            {ago ? `Fresh · ingested ${ago}` : 'Fresh'}
          </span>
        </div>
      </header>

      {/* tabs + toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
        borderBottom: `1px solid ${C.border}`, background: '#18140F', flex: '0 0 auto',
        flexWrap: 'wrap', position: 'relative', zIndex: 15,
      }}>
        <nav className="bw-scroll" style={{ display: 'flex', gap: 3, background: C.inputBg, padding: 3, borderRadius: 9, border: '1px solid #2A2319', maxWidth: '100%', overflowX: 'auto', flexWrap: 'nowrap' }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', border: 'none', flex: '0 0 auto', whiteSpace: 'nowrap',
                borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                fontWeight: active ? 600 : 500, color: active ? '#1a150c' : C.textDim,
                background: active ? 'var(--accent)' : 'transparent', transition: 'all .12s',
              }}>
                <span>{t.label}</span>
                {t.count != null && (
                  <span style={{
                    fontFamily: MONO, fontSize: 11, padding: '1px 6px', borderRadius: 5,
                    color: active ? '#1a150c' : C.textDim2,
                    background: active ? 'rgba(0,0,0,.16)' : '#221D16',
                  }}>{t.count}</span>
                )}
                {t.alert && (
                  <span data-tip={t.key === 'storage' ? 'Storage needs attention' : 'Villagers need attention'} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15,
                    borderRadius: '50%', background: C.red, color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1,
                  }}>!</span>
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ flex: '1 1 auto' }} />
        {isTable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={searchBoxStyle(34)}>
              <SearchIcon />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Filter by name or archetype…" style={{ ...searchInputStyle, width: 190 }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 6px 0 12px',
              background: C.inputBg, border: '1px solid #2E271E', borderRadius: 8,
            }}>
              <span style={{ fontSize: 10.5, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textFaint }}>View</span>
              <select value={rosterView} onChange={e => setRosterView(e.target.value as RosterView)} style={{
                background: 'transparent', border: 'none', outline: 'none', color: C.text,
                fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', padding: '0 2px',
              }}>
                <option value="skills" style={{ background: C.cardBg }}>Skills</option>
                <option value="gear" style={{ background: C.cardBg }}>Gear &amp; inventory</option>
              </select>
            </div>
            <button onClick={() => setCompareMode(m => { if (m) setCompareSet([]); return !m; })} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px',
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
              border: `1px solid ${compareMode ? 'var(--accent)' : '#2E271E'}`,
              background: compareMode ? 'rgba(224,167,60,.14)' : C.inputBg,
              color: compareMode ? 'var(--gold)' : C.textDim,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 3v18M15 3v18M3 9h18" />
              </svg>
              <span>Compare</span>
            </button>
            <span style={{ fontSize: 12, color: C.textFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {rows.length} {tab === 'npcs' ? 'recruits' : 'villagers'}
            </span>
          </div>
        )}
      </div>

      {tab === 'npcs' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', flexWrap: 'wrap',
          borderBottom: `1px solid ${C.border}`, background: '#15110C', fontSize: 11.5,
        }}>
          <FilterChips label="Village" all={villages} sel={villageFilter}
            onToggle={v => setVillageFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
          <span style={{ width: 1, height: 16, background: '#2E271F' }} />
          <FilterChips label="Specialty" all={professions} sel={profFilter}
            onToggle={v => setProfFilter(s2 => { const n = new Set(s2); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
          <span style={{ width: 1, height: 16, background: '#2E271F' }} />
          <FilterChips label="Role" all={['Fighter', 'Worker', 'Balanced']} sel={roleFilter as Set<string>}
            colors={ROLE_COLORS as Record<string, string>}
            onToggle={v => setRoleFilter(s2 => { const n = new Set(s2); n.has(v as RecruitRole) ? n.delete(v as RecruitRole) : n.add(v as RecruitRole); return n; })} />
        </div>
      )}

      {/* main */}
      <main className="bw-scroll" style={{ flex: '1 1 auto', overflow: 'auto', position: 'relative', minHeight: 0 }}>
        {tab === 'me' && world.player && (
          <MeTab player={world.player} meta={world.meta} villagerCount={villagers.length}
            presetName={null} />
        )}
        {isTable && (
          <Roster rows={rows} npcCol={tab === 'npcs'} playtime={world.meta.playtimeSeconds} ingestedAt={world.ingested_at}
            isMobile={isMobile} view={rosterView} carried={world.carried}
            compareMode={compareMode} compareSet={compareSet} sort={sort} onSort={onSort}
            onOpen={setSelGuid} onToggleCompare={toggleCompare} />
        )}
        {tab === 'trends' && <Trends />}
        {tab === 'insights' && <Insights cards={insights} villagerCount={villagers.length} snapshotId={world.snapshot_id} onOpen={setSelGuid} />}
        {tab === 'storage' && <StorageTab containers={containers} />}
        {tab === 'map' && (
          <MapTab villagers={villagers} recruits={recruits}
            region={`${world.meta.map?.startsWith('Karvenia') ? 'Karvenia' : world.meta.map ?? ''} — ${world.meta.region ?? ''}`}
            onOpenProfile={setSelGuid} />
        )}
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
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 9.5, letterSpacing: '.5px', textTransform: 'uppercase', color: C.textFaint }}>{label}</span>
    {all.map(v => {
      const on = sel.has(v);
      const color = colors?.[v] ?? '#C6BBA4';
      return (
        <button key={v} onClick={() => onToggle(v)} style={{
          padding: '2px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
          border: `1px solid ${on ? color : '#2E271E'}`,
          background: on ? `${color}22` : 'transparent',
          color: on ? '#EDE4D2' : C.textDim,
        }}>{v}</button>
      );
    })}
  </span>
);

const Meta = ({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) => (
  <span style={{ display: 'inline-flex', gap: 6, color: '#9A8F7D', whiteSpace: 'nowrap' }}>
    <span style={{ color: '#6a6152' }}>{k}</span>
    <span style={mono ? { fontFamily: MONO } : undefined}>{v}</span>
  </span>
);
