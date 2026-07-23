'use client';
// Map tab — the game's world-map imagery (wiki-hosted texture, `pnpm map`)
// with live pins projected from save coordinates via a calibrated affine
// transform (web/lib/bw/map.ts). Pan (drag) + zoom (wheel/buttons).
// Falls back to dark placeholder terrain when no imagery exists for the map.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Npc, World } from '@/lib/types';
import { tplLabel } from '@/lib/bw/format';
import { combatTotal, npcName, playerNpcs, professionOf, recruitNpcs, archetypeLabel } from '@/lib/bw/model';
import { mapFor, project } from '@/lib/bw/map';
import { shapeContainers } from '@/lib/bw/storage';
import { cn } from '@/lib/utils';
import { BwSelect } from '@/components/ui/dropdown-menu';
import { Icon, SearchIcon } from './icons';
import { C } from './ui';

type LayerKey =
  | 'player' | 'villagers' | 'buildings' | 'recruits' | 'hostiles'
  | 'campsEasy' | 'campsMedium' | 'campsHard' | 'patrols' | 'chests' | 'shrines' | 'lore' | 'prisoners'
  | 'merchants' | 'caravans' | 'fasttravel' | 'wolves' | 'bears' | 'boars' | 'deer' | 'foxes' | 'goats'
  | 'flax' | 'hemp' | 'riverreed' | 'sage' | 'garlic' | 'wheat' | 'cotton' | 'mosses' | 'cranberry'
  | 'mud' | 'peat' | 'copper' | 'tin' | 'iron' | 'granite' | 'wikipoi' | 'ruins';

const LAYERS: Record<LayerKey, { label: string; color: string; group: string; icon: string; dot?: boolean; iconImg?: string }> = {
  player: { label: 'Character', color: '#F4C868', group: 'Settlement', icon: 'person' },
  villagers: { label: 'Villagers', color: '#E0A73C', group: 'Settlement', icon: 'person' },
  buildings: { label: 'Buildings', color: '#C9A96A', group: 'Settlement', icon: 'home' },
  recruits: { label: 'Recruits', color: '#5FB4A6', group: 'Scouting', icon: 'recruit' },
  chests: { label: 'Loot', color: '#4FC9B1', group: 'Scouting', icon: 'loot', iconImg: '/map/icons/chests.png'  },
  shrines: { label: 'Shrines', color: '#6FD0C0', group: 'Scouting', icon: 'scroll', iconImg: '/map/icons/shrines.png'  },
  lore: { label: 'Lore', color: '#3FA893', group: 'Scouting', icon: 'scroll', dot: true },
  fasttravel: { label: 'Fast Travel', color: '#7FE0CE', group: 'Scouting', icon: 'up' },
  campsEasy: { label: 'Camp Easy', color: '#E0755A', group: 'Threats', icon: 'camp', iconImg: '/map/icons/campsEasy.png' },
  campsMedium: { label: 'Camp Med', color: '#D0543B', group: 'Threats', icon: 'camp', iconImg: '/map/icons/campsMedium.png' },
  campsHard: { label: 'Camp Hard', color: '#B03A28', group: 'Threats', icon: 'camp', iconImg: '/map/icons/campsHard.png' },
  patrols: { label: 'Patrols', color: '#E88D75', group: 'Threats', icon: 'sword', dot: true },
  prisoners: { label: 'Prisoners', color: '#C97A6A', group: 'Threats', icon: 'skull', iconImg: '/map/icons/prisoners.png'  },
  hostiles: { label: 'Hostiles', color: '#9A3E2E', group: 'Threats', icon: 'camp', dot: true },
  merchants: { label: 'Merchants', color: '#6FA8D6', group: 'Traders', icon: 'pouch' },
  caravans: { label: 'Caravans', color: '#5A8FC0', group: 'Traders', icon: 'pack' },
  wolves: { label: 'Wolves', color: '#D6688C', group: 'Wildlife', icon: 'paw', dot: true },
  bears: { label: 'Bears', color: '#B84A6E', group: 'Wildlife', icon: 'paw', dot: true },
  boars: { label: 'Boars', color: '#E087A5', group: 'Wildlife', icon: 'paw', dot: true },
  deer: { label: 'Deer', color: '#C05A7E', group: 'Wildlife', icon: 'paw', dot: true },
  foxes: { label: 'Foxes', color: '#E896B0', group: 'Wildlife', icon: 'paw', dot: true },
  goats: { label: 'Goats', color: '#A84262', group: 'Wildlife', icon: 'paw', dot: true },
  wikipoi: { label: 'Points of Interest', color: '#58BFAE', group: 'Scouting', icon: 'scroll', iconImg: '/map/icons/res-wikipoi.png' },
  ruins: { label: 'Ruins', color: '#48A08F', group: 'Scouting', icon: 'home', iconImg: '/map/icons/res-ruins.png' },
  flax: { label: 'Flax', color: '#9BD186', group: 'Food & Foraging', icon: 'leaf', dot: true, iconImg: '/map/icons/res-flax.png' },
  hemp: { label: 'Hemp', color: '#8FC978', group: 'Food & Foraging', icon: 'wheat', dot: true, iconImg: '/map/icons/res-hemp.png' },
  riverreed: { label: 'River Reed', color: '#6A9E58', group: 'Food & Foraging', icon: 'leaf', dot: true, iconImg: '/map/icons/res-riverreed.png' },
  sage: { label: 'Sage', color: '#7DB068', group: 'Food & Foraging', icon: 'leaf', dot: true, iconImg: '/map/icons/res-sage.png' },
  garlic: { label: 'Garlic', color: '#5C8F4C', group: 'Food & Foraging', icon: 'berry', dot: true, iconImg: '/map/icons/res-garlic.png' },
  wheat: { label: 'Wheat', color: '#A8D890', group: 'Food & Foraging', icon: 'wheat', dot: true, iconImg: '/map/icons/res-wheat.png' },
  cotton: { label: 'Cotton', color: '#86BA72', group: 'Food & Foraging', icon: 'leaf', dot: true, iconImg: '/map/icons/res-cotton.png' },
  mosses: { label: 'Mosses', color: '#74AC60', group: 'Food & Foraging', icon: 'leaf', dot: true, iconImg: '/map/icons/res-mosses.png' },
  cranberry: { label: 'Cranberry', color: '#98CF80', group: 'Food & Foraging', icon: 'berry', dot: true, iconImg: '/map/icons/res-cranberry.png' },
  mud: { label: 'Mud', color: '#8B7355', group: 'Mining', icon: 'stone', dot: true, iconImg: '/map/icons/res-mud.png' },
  peat: { label: 'Peat', color: '#6B5B45', group: 'Mining', icon: 'stone', dot: true, iconImg: '/map/icons/res-peat.png' },
  copper: { label: 'Copper Ore', color: '#A9773F', group: 'Mining', icon: 'ore', dot: true, iconImg: '/map/icons/res-copper.png' },
  tin: { label: 'Tin Ore', color: '#9C8B72', group: 'Mining', icon: 'ore', dot: true, iconImg: '/map/icons/res-tin.png' },
  iron: { label: 'Iron Ore', color: '#7A6A55', group: 'Mining', icon: 'ore', dot: true, iconImg: '/map/icons/res-iron.png' },
  granite: { label: 'Granite', color: '#8A8172', group: 'Mining', icon: 'stone', dot: true, iconImg: '/map/icons/res-granite.png' },
};
const RESOURCE_LAYERS = ['flax', 'hemp', 'riverreed', 'sage', 'garlic', 'wheat', 'cotton', 'mosses', 'cranberry', 'mud', 'peat', 'copper', 'tin', 'iron', 'granite', 'wikipoi', 'ruins'] as const;
const GROUPS = ['Settlement', 'Scouting', 'Threats', 'Traders', 'Wildlife', 'Food & Foraging', 'Mining'];
// provenance: 'save' layers re-project from every ingested snapshot;
// 'wiki' layers are static community-curated markers (CC-BY-SA)
const WIKI_STATIC = new Set(['flax', 'hemp', 'riverreed', 'sage', 'garlic', 'wheat', 'cotton', 'mosses', 'cranberry', 'mud', 'peat', 'copper', 'tin', 'iron', 'granite', 'wikipoi', 'ruins']);
const srcOf = (k: LayerKey) => (WIKI_STATIC.has(k) ? 'wiki' : 'save');
const POI_LABEL: Record<string, string> = {
  campsEasy: 'Bandit camp (easy)', campsMedium: 'Bandit camp (medium)', campsHard: 'Bandit camp (hard)',
  patrols: 'Bandit patrol', chests: 'Loot chest',
  shrines: 'Pagan shrine', lore: 'Lore note', prisoners: 'Prisoner cage',
  merchants: 'Merchant', caravans: 'Caravan', fasttravel: 'Fast travel sign',
  wolves: 'Wolf spawn', bears: 'Beast spawn', boars: 'Boar spawn',
  deer: 'Deer spawn', foxes: 'Fox spawn', goats: 'Goat spawn',
};
const POI_DESC: Record<string, string> = {
  campsEasy: 'Small hostile encampment — an easy clear.',
  campsMedium: 'Mid-size hostile encampment.',
  campsHard: 'Large fortified encampment — bring your best squad.',
  patrols: 'Bandit patrol party — position from the latest save.',
  chests: 'Contains loot like Old Coins, Knowledge Books, and crafting resources.',
  shrines: 'Pagan shrine point of interest.',
  lore: 'A readable note, letter, or journal.',
  prisoners: 'A cage with a prisoner who can be freed.',
  merchants: 'Merchant stand.', caravans: 'Traveling caravan.',
  fasttravel: 'Fast travel signpost.',
  wolves: 'Wolf spawn area.', bears: 'Bear or great beast spawn area.',
  boars: 'Boar spawn area.', deer: 'Deer spawn area.',
  foxes: 'Fox spawn area.', goats: 'Wild goat spawn area.',
};

type Pin = {
  key: string; layer: LayerKey; u: number; v: number;
  label: string; sub: string; desc: string; guid: string | null; coords: string;
  live?: boolean; // position is from live telemetry, not the save
};

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;

export const MapTab = ({ world, region, onOpenProfile }: {
  world: World; region: string; onOpenProfile: (guid: string) => void;
}) => {
  const map = mapFor(world.meta.map);
  const ALL_ON = Object.fromEntries(Object.keys(LAYERS).map(k => [k, true])) as Record<LayerKey, boolean>;
  const ALL_OFF = Object.fromEntries(Object.keys(LAYERS).map(k => [k, false])) as Record<LayerKey, boolean>;
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    ...ALL_OFF, player: true, villagers: true, buildings: true, recruits: true,
    campsEasy: true, campsMedium: true, campsHard: true, chests: true,
  });
  const [q, setQ] = useState('');
  // tooltip lives OUTSIDE the scaled stage (text rasterized inside a
  // GPU-scaled layer resamples blurry) — screen-space position captured on hover
  const [tip, setTip] = useState<{ key: string; label: string; sub: string; x: number; y: number } | null>(null);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [hoverLayer, setHoverLayer] = useState<LayerKey | null>(null);
  // placement planner: a draggable ring in real in-game meters (UE units are
  // cm, so px-per-meter = the calibrated u-scale coefficient x 100)
  const pxPerM = map ? map.transform[0] * 100 : 1;
  // work-building max radii (meters). VERIFIED = read off the in-game
  // slider; others are community estimates (tier-1 camps ~175m, Mining Hut
  // ~200m, UI cap 500m) — correct these as real values get confirmed.
  // Exact max work radii from the game's building actor blueprints
  // (official Modkit data, MaxRadius in UE cm / 100 — see private/TASKS.md)
  const BUILDINGS: [string, number][] = [
    ['Mining Camp', 150],
    ['Mining Hut', 200],
    ['Logging Camp', 150],
    ["Lumberjack's Hut", 200],
    ['Lumbermill', 250],
    ['Foraging Camp', 150],
    ['Foraging Hut', 200],
    ['Foraging Lodge', 250],
    ['Mud Collector', 150],
    ['Pit', 200],
    ['Village Hall', 150],
    ['Town Hall', 150],
  ];
  const [building, setBuilding] = useState<string>('custom');
  const [planner, setPlanner] = useState<{ u: number; v: number; radius: number } | null>(null);
  const plannerDrag = useRef<{ x: number; y: number; u: number; v: number } | null>(null);
  const [imgOk, setImgOk] = useState(true);

  const villagers = useMemo(() => playerNpcs(world), [world]);
  const recruits = useMemo(() => recruitNpcs(world), [world]);
  // community-curated resource locations from the wiki interactive map
  // (CC-BY-SA; fetched per-install alongside the base imagery)
  const [wikiPois, setWikiPois] = useState<Record<string, { u: number; v: number; t?: string }[]>>({});
  useEffect(() => {
    fetch('/map/wiki-pois.json').then(r => (r.ok ? r.json() : {})).then(setWikiPois).catch(() => {});
  }, []);

  // live telemetry (from the companion mod): poll the latest and treat it as
  // fresh for LIVE_TTL. When fresh, actor pins use live positions.
  const LIVE_TTL = 8000;
  const [live, setLive] = useState<{ actors: { id: string; name?: string; kind: string; x: number; y: number }[]; age: number } | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden) return;
      try {
        const r = await fetch('/api/telemetry/latest', { cache: 'no-store' });
        const j = (await r.json()) as { age_ms?: number; data?: { actors?: never[] } | null };
        if (j.data?.actors && (j.age_ms ?? 1e9) < LIVE_TTL) setLive({ actors: j.data.actors, age: j.age_ms ?? 0 });
        else setLive(null);
      } catch { /* offline — no live layer */ }
    };
    void tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const pins = useMemo<Pin[]>(() => {
    if (!map) return [];
    const out: Pin[] = [];
    const npcPin = (npc: Npc, layer: LayerKey, sub: string, desc: string) => {
      if (!npc.position) return;
      const { u, v } = project(map, npc.position[0], npc.position[1]);
      const name = npcName(npc);
      out.push({
        key: `${layer}-${npc.guid ?? name}`, layer, u, v, label: name, sub, desc,
        guid: npc.guid, coords: `[${Math.round(npc.position[0])}, ${Math.round(npc.position[1])}]`,
      });
    };
    if (world.player?.position) {
      const { u, v } = project(map, world.player.position[0], world.player.position[1]);
      out.push({
        key: 'player', layer: 'player', u, v, label: world.meta.character ?? 'Player',
        sub: 'Player character', desc: 'Your last saved position.', guid: null,
        coords: `[${Math.round(world.player.position[0])}, ${Math.round(world.player.position[1])}]`,
      });
    }
    for (const npc of villagers) {
      npcPin(npc, 'villagers',
        [professionOf(npc), archetypeLabel(npc)].filter(Boolean).join(' · '),
        `Settlement member.${npc.morale != null ? ` Morale ${Math.round(npc.morale)}.` : ''}`);
    }
    for (const npc of recruits) {
      npcPin(npc, 'recruits',
        `${archetypeLabel(npc)}${npc.village ? ` · near ${npc.village}` : ''}`,
        `Scouted recruit — combat rating ${combatTotal(npc)}.`);
    }
    for (const npc of world.npcs) {
      if (npc.archetype !== 'combatant' || !npc.position) continue;
      npcPin(npc, 'hostiles', tplLabel(npc.template) || npc.faction || 'Hostile',
        `Hostile — ${npc.faction ?? 'unknown faction'}.`);
    }
    for (const [i, poi] of (world.pois ?? []).entries()) {
      if (!(poi.layer in LAYERS)) continue;
      const { u, v } = project(map, poi.position[0], poi.position[1]);
      out.push({
        key: `poi-${i}`, layer: poi.layer as LayerKey, u, v,
        label: POI_LABEL[poi.layer] ?? poi.layer, sub: poi.cls.replace(/_C$/, '').replace(/_/g, ' '),
        desc: POI_DESC[poi.layer] ?? '', guid: null,
        coords: `[${Math.round(poi.position[0])}, ${Math.round(poi.position[1])}]`,
      });
    }
    for (const layer of RESOURCE_LAYERS) {
      for (const [i, r] of (wikiPois[layer] ?? []).entries()) {
        out.push({
          key: `res-${layer}-${i}`, layer, u: r.u, v: r.v,
          label: r.t || LAYERS[layer].label,
          sub: layer === 'wikipoi' || layer === 'ruins' ? 'Point of interest' : 'Resource node',
          desc: 'Community-curated location from the Bellwright wiki (CC-BY-SA).',
          guid: null, coords: '',
        });
      }
    }
    // overlay live telemetry: override matching actors' positions and add
    // live-only actors — reuses the whole zoom/positioning pin machinery
    if (live?.actors?.length) {
      const byKey = new Map(out.map(pn => [pn.guid ?? pn.label, pn]));
      const layerFor = (k: string): LayerKey => k === 'player' ? 'player' : k === 'hostile' ? 'hostiles' : 'villagers';
      for (const a of live.actors) {
        const pn = byKey.get(a.id) ?? (a.name ? byKey.get(a.name) : undefined);
        const { u, v } = project(map, a.x, a.y);
        if (pn) { pn.u = u; pn.v = v; pn.live = true; }
        else {
          const layer = layerFor(a.kind);
          out.push({ key: `live-${a.id}`, layer, u, v, label: a.name ?? a.id,
            sub: 'Live position', desc: 'Streaming live from the game.', guid: null,
            coords: `[${Math.round(a.x)}, ${Math.round(a.y)}]`, live: true });
        }
      }
    }

    for (const c of shapeContainers(world.storage)) {
      if (!c.position) continue;
      const { u, v } = project(map, c.position[0], c.position[1]);
      out.push({
        key: `b-${c.id}`, layer: 'buildings', u, v, label: c.name,
        sub: c.type, desc: `${c.items.reduce((a, x) => a + x.qty, 0)} items stored.`,
        guid: null, coords: `[${Math.round(c.position[0])}, ${Math.round(c.position[1])}]`,
      });
    }
    return out;
  }, [map, world, villagers, recruits, wikiPois, live]);

  // viewport pan/zoom — imperative for performance: gestures write the
  // container transform + a --ps counter-scale CSS var directly (rAF-batched),
  // so panning/zooming never re-renders the ~hundreds of React pins
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinLayerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<{ scale: number; tx: number; ty: number } | null>(null);
  const raf = useRef(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const apply = () => {
    raf.current = 0;
    const v = viewRef.current, el = stageRef.current, pl = pinLayerRef.current;
    if (!v || !el || !pl) return;
    // the IMAGE layer scales; pins live in a translate-only layer so they
    // rasterize at 1:1 and stay crisp — their positions track zoom instead
    el.style.transform = `translate3d(${v.tx}px, ${v.ty}px, 0) scale(${v.scale})`;
    pl.style.transform = `translate3d(${v.tx}px, ${v.ty}px, 0)`;
    for (const child of pl.children as unknown as HTMLElement[]) {
      const u = Number(child.dataset.u), pv = Number(child.dataset.v);
      if (Number.isFinite(u)) child.style.transform = `translate3d(${u * v.scale}px, ${pv * v.scale}px, 0)`;
    }
  };
  const schedule = () => { if (!raf.current) raf.current = requestAnimationFrame(apply); };

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const el = wrapRef.current, v = viewRef.current;
    if (!el || !v) return;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
    const k = s2 / v.scale;
    viewRef.current = { scale: s2, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
    schedule();
  };

  // initial view: center on the settlement (villager centroid), sensible zoom
  useEffect(() => {
    if (!map || viewRef.current) return;
    const el = wrapRef.current;
    if (!el) return;
    const vill = pins.filter(p => p.layer === 'villagers');
    const cu = vill.length ? vill.reduce((a, p) => a + p.u, 0) / vill.length : map.size / 2;
    const cv = vill.length ? vill.reduce((a, p) => a + p.v, 0) / vill.length : map.size / 2;
    const scale = 0.83;
    viewRef.current = { scale, tx: el.clientWidth / 2 - cu * scale, ty: el.clientHeight / 2 - cv * scale };
    apply();
  }, [map, pins]);

  // wheel must be a NON-PASSIVE native listener: React's onWheel is passive,
  // so preventDefault can't stop ctrl+wheel / trackpad pinch from zooming the
  // whole browser page
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.012) // trackpad pinch: deltaY is fine-grained
        : e.deltaY < 0 ? 1.18 : 1 / 1.18;
      zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map != null]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { apply(); });

  const mq = q.trim().toLowerCase();
  const visible = pins.filter(p => layers[p.layer] && (!mq || p.label.toLowerCase().includes(mq)));
  const selPin = selKey ? pins.find(p => p.key === selKey) ?? null : null;

  if (!map) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-sand-600">
        No map imagery for “{world.meta.map ?? 'unknown map'}” yet — pins need a calibrated base image.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[520px] bg-[#0C0B08]">
      {/* sidebar */}
      <div className="bw-scroll z-10 w-[290px] flex-none overflow-y-auto border-r border-line bg-iron-850">
        <div className="pt-3.5 px-3.5 pb-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-line-3 bg-ink py-2 px-[11px]">
            <SearchIcon />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the map…"
              className="w-full border-none bg-transparent font-sans text-[12.5px] text-sand-200 outline-none" />
          </div>
          <div className="flex gap-[5px] mt-2">
            {([
              ['Show all', () => setLayers(ALL_ON)],
              ['Hide all', () => setLayers(ALL_OFF)],
              ['Settlement', () => setLayers({ ...ALL_OFF, player: true, villagers: true, buildings: true })],
            ] as const).map(([label, act]) => (
              <button key={label} onClick={act}
                className="flex-1 py-[7px] px-1 bg-ink border border-line-3 rounded-[7px] cursor-pointer font-sans text-[10.5px] tracking-[.3px] uppercase text-sand-400 hover:text-sand-200 hover:border-[#4a4030]">
                {label}
              </button>
            ))}
          </div>
          {/* placement planner */}
          <div className="mt-2 rounded-[9px] border border-[#2A231A] bg-gradient-to-b from-gold/[.06] to-transparent py-[9px] px-2.5">
            <button
              onClick={() => {
                if (planner) { setPlanner(null); return; }
                const el = wrapRef.current, v = viewRef.current;
                if (!el || !v) return;
                setPlanner({
                  u: (el.clientWidth / 2 - v.tx) / v.scale,
                  v: (el.clientHeight / 2 - v.ty) / v.scale,
                  radius: 150,
                });
              }}
              className={cn(
                'w-full cursor-pointer rounded-[7px] border py-[7px] px-2 font-sans text-[10.5px] uppercase tracking-[.3px]',
                planner ? 'border-gold bg-gold/[.14] text-gold-bright' : 'border-line-3 bg-ink text-sand-400 hover:text-sand-200',
              )}>
              {planner ? 'Remove radius circle' : 'Place radius circle'}
            </button>
            {planner && (
              <>
                <div className="mt-2">
                  <BwSelect value={building} align="start"
                    triggerClassName="w-full h-auto py-[5px] pl-1.5 pr-1.5 rounded-[7px] text-[11px]"
                    options={[{ value: 'custom', label: 'Custom radius…' },
                      ...BUILDINGS.map(([n, r]) => ({ value: n, label: `${n} — ${r}m` }))]}
                    onChange={v => {
                      setBuilding(v);
                      const b = BUILDINGS.find(([n]) => n === v);
                      if (b) setPlanner(pl => pl && { ...pl, radius: b[1] });
                    }} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input type="range" min={10}
                    max={building !== 'custom' ? BUILDINGS.find(([n]) => n === building)?.[1] ?? 500 : 500}
                    step={5} value={planner.radius}
                    onChange={e => setPlanner(pl => pl && { ...pl, radius: Number(e.target.value) })}
                    className="h-1 flex-1 cursor-pointer accent-[#E0A73C]" />
                  <span className="w-11 text-right font-mono text-[11px] text-gold-bright">{planner.radius}m</span>
                </div>
                <div className="mt-1.5 flex gap-1">
                  {[100, 150, 200, 300].map(r => (
                    <button key={r} onClick={() => setPlanner(pl => pl && { ...pl, radius: r })}
                      className={cn(
                        'flex-1 cursor-pointer rounded-[5px] border py-0.5 font-mono text-[9.5px]',
                        planner.radius === r ? 'border-gold text-gold-bright' : 'border-line-3 text-sand-600 hover:text-sand-300',
                      )}>{r}m</button>
                  ))}
                </div>
                {(() => {
                  const rPx = planner.radius * pxPerM;
                  const inside = new Map<LayerKey, number>();
                  for (const pn of pins) {
                    if (!layers[pn.layer]) continue;
                    const d = Math.hypot(pn.u - planner.u, pn.v - planner.v);
                    if (d <= rPx) inside.set(pn.layer, (inside.get(pn.layer) ?? 0) + 1);
                  }
                  const rows = [...inside.entries()].sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="mt-2 border-t border-[#2A231A] pt-1.5">
                      <div className="mb-1 text-[9px] uppercase tracking-[.5px] text-sand-600">Inside radius (visible layers)</div>
                      {rows.length === 0 && <div className="text-[10.5px] text-sand-700">Nothing in range — drag the circle.</div>}
                      {rows.map(([k, n]) => (
                        <div key={k} className="flex items-center gap-1.5 py-px text-[10.5px] text-sand-300">
                          <span className="h-[6px] w-[6px] rounded-full" style={{ background: LAYERS[k].color }} />
                          <span className="flex-1">{LAYERS[k].label}</span>
                          <span className="font-mono text-[10px] text-gold-bright">{n}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
        <div className="px-2.5 pb-4">
          {GROUPS.map(g => {
            const keys = (Object.keys(LAYERS) as LayerKey[]).filter(k => LAYERS[k].group === g);
            return (
              <div key={g} className="mb-1.5">
                <button
                  onClick={() => {
                    const allOn = keys.every(k => layers[k]);
                    setLayers(s => ({ ...s, ...Object.fromEntries(keys.map(k => [k, !allOn])) }));
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 border-none bg-transparent pt-[9px] px-2 pb-1.5 font-sans hover:opacity-80"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[.7px] text-sand-400">{g}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-[5px] bg-row py-px px-[7px] font-mono text-[10.5px] text-sand-600">
                      {keys.reduce((a, k) => a + pins.filter(p => p.layer === k).length, 0)}
                    </span>
                    <span className={cn(
                      'h-[15px] w-[15px] flex-none rounded-[4px] border',
                      keys.every(k => layers[k]) ? 'border-gold bg-gold'
                        : keys.some(k => layers[k]) ? 'border-gold bg-gold/40'
                          : 'border-[#4a4030] bg-transparent',
                    )} />
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-x-1">
                {keys.map(k => {
                  const m = LAYERS[k], on = layers[k];
                  const count = pins.filter(p => p.layer === k).length;
                  return (
                    <button key={k} onClick={() => setLayers(s => ({ ...s, [k]: !s[k] }))}
                      onMouseEnter={() => setHoverLayer(k)} onMouseLeave={() => setHoverLayer(null)}
                      data-tip={`${m.label} — ${srcOf(k) === 'save' ? 'live from your save' : 'static wiki data (community-curated)'}`}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent py-[5px] px-1.5 text-left font-sans text-[11.5px] hover:bg-white/[.04]',
                        on ? 'text-[#DCD2BE]' : 'text-sand-700 opacity-70',
                      )}>
                      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px]"
                        style={{ background: on ? `${m.color}22` : '#201B15' }}>
                        {m.iconImg
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.iconImg} alt="" width={12} height={12} className={cn('select-none', !on && 'opacity-40 grayscale')} />
                          : <Icon name={m.icon} size={11} color={on ? m.color : C.textDisabled} />}
                      </span>
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{m.label}</span>
                      <span className="font-mono text-[10px] text-sand-600">{count}</span>
                      {srcOf(k) === 'save'
                        ? <span className="h-[5px] w-[5px] flex-none rounded-full bg-moss-bright" />
                        : <span className="flex-none font-mono text-[8px] leading-none text-sand-700">W</span>}
                    </button>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 pb-[18px] text-[10px] leading-[1.45] text-sand-800">
          <div>Map imagery: Bellwright game asset via the community wiki (fetched per-install, not redistributed).</div>
          <div className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-[5px] w-[5px] flex-none rounded-full bg-moss-bright" />
            <span>live from your save</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-[5px] flex-none text-center font-mono text-[8px] leading-none">W</span>
            <span>static wiki data (CC-BY-SA)</span>
          </div>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={wrapRef}
        onClick={() => { if (!drag.current?.moved) setSelKey(null); }}
        onPointerDown={e => {
          const v = viewRef.current;
          if (!v) return;
          drag.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
          // do NOT capture the pointer yet: capturing retargets the eventual
          // `click` to this element, which would swallow pin clicks — capture
          // only once an actual drag starts (movement past the threshold)
        }}
        onPointerMove={e => {
          const d = drag.current, v = viewRef.current;
          if (!d || !v) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
            d.moved = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          if (!d.moved) return;
          viewRef.current = { scale: v.scale, tx: d.tx + dx, ty: d.ty + dy };
          schedule();
        }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        className="relative flex-1 cursor-grab touch-none overflow-hidden overscroll-contain bg-[#141311]"
      >
        {(
          // stage transform/size/willChange are imperative (apply()) — keep inline
          <div ref={stageRef} className="absolute left-0 top-0" style={{
            width: map.size, height: map.size,
            transform: 'translate3d(0,0,0) scale(0.0001)', transformOrigin: '0 0',
            willChange: 'transform',
          }}>
            {imgOk && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={map.image} alt="" width={map.size} height={map.size} draggable={false}
                onError={() => setImgOk(false)}
                className="absolute inset-0 h-full w-full select-none brightness-[.92]" />
            )}
            {!imgOk && (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_42%_38%,#221C13_0%,#17130D_55%,#0C0B08_100%)]" />
            )}
            {planner && (() => {
              const r = planner.radius * pxPerM;
              return (
                <div
                  onPointerDown={e => {
                    e.stopPropagation();
                    plannerDrag.current = { x: e.clientX, y: e.clientY, u: planner.u, v: planner.v };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={e => {
                    const d = plannerDrag.current, vw = viewRef.current;
                    if (!d || !vw) return;
                    setPlanner(pl => pl && {
                      ...pl,
                      u: d.u + (e.clientX - d.x) / vw.scale,
                      v: d.v + (e.clientY - d.y) / vw.scale,
                    });
                  }}
                  onPointerUp={() => { plannerDrag.current = null; }}
                  onClick={e => e.stopPropagation()}
                  className="absolute cursor-move rounded-full border-2 border-dashed border-gold-bright bg-gold/[.08] shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
                  style={{ left: planner.u - r, top: planner.v - r, width: r * 2, height: r * 2 }}
                >
                  <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-bright shadow-[0_0_6px_rgba(0,0,0,.6)]" />
                </div>
              );
            })()}
          </div>
        )}
        {/* pin-layer transform/size/willChange are imperative (apply()) — keep inline */}
        <div ref={pinLayerRef} className="pointer-events-none absolute left-0 top-0" style={{
          width: 0, height: 0, willChange: 'transform',
        }}>
            {map.labels.map(l => (
              // outer wrapper transform is set imperatively via data-u/data-v — no transform classes here
              <div key={l.name} data-u={l.u} data-v={l.v} className="absolute left-0 top-0">
                <div className="pointer-events-none -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-serif text-[15px] uppercase tracking-[3px] text-[rgba(28,22,14,.8)] [text-shadow:0_0_6px_rgba(240,230,210,.55)]">{l.name}</div>
              </div>
            ))}
            {visible.map(p => {
              const m = LAYERS[p.layer];
              const sel2 = selKey === p.key, hov = tip?.key === p.key;
              const lhl = hoverLayer === p.layer;
              const small = Boolean(LAYERS[p.layer].dot) || p.layer === 'buildings';
              return (
                // outer wrapper transform is set imperatively via data-u/data-v — no transform classes here
                <div key={p.key} data-u={p.u} data-v={p.v}
                  onClick={e => { e.stopPropagation(); setSelKey(p.key); }}
                  onMouseEnter={e => {
                    const wr = wrapRef.current?.getBoundingClientRect();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    if (wr) setTip({ key: p.key, label: p.label, sub: p.sub, x: r.left + r.width / 2 - wr.left, y: r.top - wr.top });
                  }}
                  onMouseLeave={() => setTip(null)}
                  className="pointer-events-auto absolute left-0 top-0 cursor-pointer"
                  style={{
                    zIndex: p.live ? 35 : sel2 ? 40 : hov ? 30 : lhl ? 25 : small ? 8 : 10,
                    opacity: hoverLayer && !lhl ? 0.15 : 1,
                    transition: 'opacity .12s ease',
                  }}>
                  {p.live && (
                    <span className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 h-[22px] w-[22px] rounded-full border-2 border-moss-bright [animation:bwpulse_1.6s_ease-in-out_infinite]" />
                  )}
                  {m.iconImg ? (
                    // bare wiki icon straight on the terrain, like the game map
                    <div className="-translate-x-1/2 -translate-y-1/2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.iconImg} alt="" width={small ? 20 : 28} height={small ? 20 : 28}
                        className="pointer-events-none max-w-none select-none transition-transform duration-100"
                        style={{
                          transform: `scale(${sel2 ? 1.25 : hov ? 1.12 : lhl ? 1.35 : 1})`,
                          filter: `drop-shadow(0 1px 3px rgba(0,0,0,.8))${sel2 ? ` drop-shadow(0 0 8px ${m.color})` : ''}${lhl ? ' drop-shadow(0 0 2px #fff) drop-shadow(0 0 6px #fff)' : ''}`,
                        }} />
                    </div>
                  ) : (
                  <div className="-translate-x-1/2 -translate-y-full">
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-[50%_50%_50%_0] border-2 border-[rgba(0,0,0,.45)] transition-transform duration-100',
                      small ? 'h-[18px] w-[18px]' : 'h-[26px] w-[26px]',
                    )}
                    style={{
                      transform: `rotate(-45deg) scale(${sel2 ? 1.2 : hov ? 1.1 : lhl ? 1.25 : 1})`,
                      background: m.color,
                      boxShadow: `0 3px 8px rgba(0,0,0,.5)${sel2 ? `, 0 0 0 6px ${m.color}44, 0 0 22px 8px ${m.color}55` : ''}${lhl ? ', 0 0 0 3px #fff, 0 0 16px 4px #fffa' : ''}`,
                    }}>
                    <span className="flex rotate-45">
                      <Icon name={m.icon} size={small ? 9 : 13} color="#14110b" />
                    </span>
                  </div>
                  </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* screen-space pin tooltip (crisp at any zoom) */}
        {tip && selKey !== tip.key && (
          <div className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[#3A3128] bg-ink py-1.5 px-2.5 shadow-[0_8px_24px_rgba(0,0,0,.6)] [animation:bwfade_.1s_ease]"
            style={{ left: tip.x, top: tip.y - 8 }}>
            <div className="text-xs font-semibold text-sand-100">{tip.label}</div>
            <div className="text-[10.5px] text-sand-400">{tip.sub}</div>
          </div>
        )}

        {/* zoom controls */}
        <div className="absolute bottom-4 right-4 z-[45] flex flex-col gap-1.5">
          {[['+', 1.35] as const, ['−', 1 / 1.35] as const].map(([lbl, f]) => (
            <button key={lbl} onClick={e => { e.stopPropagation(); zoomAt(f); }}
              className="h-[34px] w-[34px] cursor-pointer rounded-lg border border-[#3A3128] bg-[rgba(17,14,10,.85)] text-[17px] leading-none text-[#DCD2BE]">{lbl}</button>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 z-40 flex items-center gap-2.5">
          <span className="font-serif text-[15px] tracking-[.5px] text-[#D8CBB0] [text-shadow:0_1px_6px_rgba(0,0,0,.8)]">{region}</span>
          {live && (
            <span data-tip="Streaming live positions from the game (telemetry mod)"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-moss-bright/40 bg-moss-bright/15 py-[3px] px-2.5 text-[11px] font-semibold text-[#A9C293] [text-shadow:none]">
              <span className="h-[7px] w-[7px] rounded-full bg-moss-bright shadow-[0_0_6px_#7FB05B] [animation:bwpulse_1.6s_ease-in-out_infinite]" />
              LIVE
            </span>
          )}
        </div>

        {selPin && (
          <div onClick={e => e.stopPropagation()}
            className="absolute top-4 right-4 z-[55] w-[274px] overflow-hidden rounded-xl border border-line-4 bg-[#14110C] shadow-[0_16px_40px_rgba(0,0,0,.55)] [animation:bwfade_.14s_ease]">
            <div className="relative h-28" style={{ background: `radial-gradient(circle at 42% 32%, ${LAYERS[selPin.layer].color}2e, #0c0a07)` }}>
              <div className="absolute inset-0 flex items-center justify-center opacity-55">
                <Icon name={LAYERS[selPin.layer].icon} size={40} color={LAYERS[selPin.layer].color} />
              </div>
              <span className="absolute top-[9px] left-[11px] rounded-[5px] bg-black/40 py-0.5 px-[7px] text-[9.5px] uppercase tracking-[.5px] text-sand-350">{LAYERS[selPin.layer].label}</span>
              <span className={cn(
                'absolute top-[9px] right-10 rounded-[5px] py-0.5 px-[7px] text-[9px] uppercase tracking-[.5px]',
                srcOf(selPin.layer) === 'save' ? 'bg-moss-bright/15 text-[#A9C293]' : 'bg-white/10 text-sand-400',
              )}>{srcOf(selPin.layer) === 'save' ? 'Live save data' : 'Wiki data'}</span>
              <button onClick={() => setSelKey(null)}
                className="absolute top-2 right-2 h-6 w-6 cursor-pointer rounded-md border-none bg-black/45 text-sm leading-none text-[#DCD2BE]">×</button>
            </div>
            <div className="pt-[13px] px-[15px] pb-[15px]">
              <div className="font-serif text-[17px] font-semibold leading-[1.15] text-sand-50">{selPin.label}</div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: LAYERS[selPin.layer].color }}>{selPin.sub}</div>
              <p className="mt-[9px] text-xs leading-[1.5] text-sand-350">{selPin.desc}</p>
              <div className="mt-[9px] font-mono text-[10.5px] text-sand-700">{selPin.coords}</div>
              {selPin.guid && (
                <button onClick={() => { onOpenProfile(selPin.guid!); setSelKey(null); }}
                  className="mt-3 w-full cursor-pointer rounded-lg border border-gold bg-gold/[.13] p-[9px] font-sans text-[12.5px] font-semibold text-gold-bright">Open profile</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
