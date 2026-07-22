// Fetch item + building icons from the Bellwright wiki (MediaWiki pageimages
// API) for every class present in the latest ingested world snapshot.
// Icons land in web/public/icons/bw/<Class>.png (gitignored — fetched assets,
// not redistributed). The UI falls back to line icons when a file is missing.
//
//   pnpm --filter bellwright-companion-web icons
//
// Re-run any time after new items appear in a save; existing files are kept.
import Database from 'better-sqlite3';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WIKI_API = 'https://bellwright.fandom.com/api.php';
const THUMB_PX = 96;
const BATCH = 50;
const OUT_DIR = path.join(process.cwd(), 'public', 'icons', 'bw');
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
const DB_URL = process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, 'bellwright.db')}`;

// class → wiki page title, for names that don't match after prettifying
const ALIASES: Record<string, string> = {
  Grains_C: 'Grain',
  SmallBarn_C: 'Warehouse',
  SmallFarm_C: 'Farm',
  SharedChest_C: 'Camp Chest',
  ShackChest_C: 'Camp Chest',
  Weapon_rack_C: 'Weapon Rack',
  Cauldron_Tavern_C: 'Cauldron',
  BigCookingPot_C: 'Cooking Pot',
};

const pretty = (raw: string): string =>
  raw.replace(/_C$/, '').replace(/_\d+$/, '').replace(/^BP_/, '').replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').trim();

// collect every class we might want an icon for
const dbFile = DB_URL.startsWith('file:') ? path.resolve(DB_URL.slice(5)) : null;
if (!dbFile || !existsSync(dbFile)) {
  console.error(`no sqlite db at ${dbFile} — ingest a save first`);
  process.exit(1);
}
const sqlite = new Database(dbFile, { readonly: true });
const row = sqlite.prepare('select world from snapshots order by id desc limit 1').get() as { world: string } | undefined;
if (!row) {
  console.error('no snapshots in the db — ingest a save first');
  process.exit(1);
}
const world = JSON.parse(row.world);

const classes = new Set<string>();
for (const k of Object.keys(world.storage?.totals ?? {})) classes.add(k);
for (const k of Object.keys(world.storage?.npc_carried ?? {})) classes.add(k);
for (const c of world.storage?.containers ?? []) {
  if (c.cls) classes.add(c.cls);
  for (const k of Object.keys(c.items ?? {})) classes.add(k);
}
for (const n of world.npcs ?? []) {
  for (const v of Object.values(n.equipment ?? {})) classes.add(v as string);
}

const wanted = [...classes].filter(cls => !existsSync(path.join(OUT_DIR, `${cls}.png`)));
console.log(`${classes.size} classes referenced · ${wanted.length} icons to fetch`);
mkdirSync(OUT_DIR, { recursive: true });

// candidate titles per class: alias, pretty, pretty±s
const candidates = (cls: string): string[] => {
  const p = pretty(cls);
  const out = [ALIASES[cls], p, p.endsWith('s') ? p.slice(0, -1) : `${p}s`]
    .filter((x): x is string => Boolean(x));
  // wiki titles often use possessives: WoodcuttersAxe -> "Woodcutter's Axe"
  const poss = p.replace(/(\w+)s (?=[A-Z])/g, "$1's ");
  if (poss !== p) out.push(poss);
  return [...new Set(out)];
};

type PageImage = { title: string; thumb: string };

const queryBatch = async (titles: string[]): Promise<Map<string, string>> => {
  const url = `${WIKI_API}?action=query&format=json&redirects=1&prop=pageimages` +
    `&piprop=thumbnail&pithumbsize=${THUMB_PX}&titles=${encodeURIComponent(titles.join('|'))}`;
  const res = await fetch(url, { headers: { 'user-agent': 'bellwright-companion icon fetcher' } });
  const json = await res.json() as {
    query?: {
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
      pages?: Record<string, { title: string; thumbnail?: { source: string } }>;
    };
  };
  // map resolved page title -> thumb, then walk redirects/normalization back
  const byTitle = new Map<string, string>();
  for (const p of Object.values(json.query?.pages ?? {})) {
    if (p.thumbnail?.source) byTitle.set(p.title, p.thumbnail.source);
  }
  const back = new Map<string, string>(); // requested title -> resolved title
  for (const t of titles) back.set(t, t);
  for (const n of json.query?.normalized ?? []) {
    for (const [req, cur] of back) if (cur === n.from) back.set(req, n.to);
  }
  for (const r of json.query?.redirects ?? []) {
    for (const [req, cur] of back) if (cur === r.from) back.set(req, r.to);
  }
  const out = new Map<string, string>();
  for (const [req, resolved] of back) {
    const thumb = byTitle.get(resolved);
    if (thumb) out.set(req, thumb);
  }
  return out;
};

const main = async () => {
  // resolve all candidate titles in batches
  const titleToThumb = new Map<string, string>();
  const allTitles = [...new Set(wanted.flatMap(candidates))];
  for (let i = 0; i < allTitles.length; i += BATCH) {
    const batch = allTitles.slice(i, i + BATCH);
    try {
      const m = await queryBatch(batch);
      for (const [t, u] of m) titleToThumb.set(t, u);
    } catch (e) {
      console.error(`batch ${i / BATCH} failed:`, e instanceof Error ? e.message : e);
    }
  }

  // Fallback: many pages exist but have no designated "page image", yet a
  // File:<name>.png upload exists — resolve those via prop=imageinfo.
  const fileTitleCandidates = (cls: string): string[] => {
    const out: string[] = [];
    for (const t of candidates(cls)) {
      const words = t.split(' ');
      out.push(`File:${t}.png`); // File:Wooden Plank.png
      out.push(`File:${[words[0], ...words.slice(1).map(w => w.toLowerCase())].join(' ')}.png`); // File:Wooden plank.png
    }
    return [...new Set(out)];
  };

  const fileThumbs = new Map<string, string>(); // File: title -> thumb url
  const pendingFiles = [...new Set(
    wanted.filter(cls => !candidates(cls).some(t => titleToThumb.has(t))).flatMap(fileTitleCandidates),
  )];
  for (let i = 0; i < pendingFiles.length; i += BATCH) {
    const batch = pendingFiles.slice(i, i + BATCH);
    try {
      const url = `${WIKI_API}?action=query&format=json&prop=imageinfo&iiprop=url` +
        `&iiurlwidth=${THUMB_PX}&titles=${encodeURIComponent(batch.join('|'))}`;
      const res = await fetch(url, { headers: { 'user-agent': 'bellwright-companion icon fetcher' } });
      const json = await res.json() as {
        query?: { pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; url?: string }[] }> };
      };
      for (const p of Object.values(json.query?.pages ?? {})) {
        const ii = p.imageinfo?.[0];
        const u = ii?.thumburl ?? ii?.url;
        if (u) fileThumbs.set(p.title, u);
      }
    } catch (e) {
      console.error(`imageinfo batch failed:`, e instanceof Error ? e.message : e);
    }
  }

  const download = async (url: string): Promise<Buffer | null> => {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch { return null; }
  };

  let ok = 0;
  const misses: string[] = [];
  for (const cls of wanted) {
    const thumb = candidates(cls).map(t => titleToThumb.get(t)).find(Boolean)
      ?? fileTitleCandidates(cls).map(t => fileThumbs.get(t)).find(Boolean);
    const buf = thumb ? await download(thumb) : null;
    if (!buf) { misses.push(cls); continue; }
    writeFileSync(path.join(OUT_DIR, `${cls}.png`), buf);
    ok++;
  }
  console.log(`fetched ${ok} icons -> ${OUT_DIR}`);
  if (misses.length) {
    console.log(`\n${misses.length} classes with no wiki image (add to ALIASES if the page exists):`);
    for (const m of misses.sort()) console.log(`  ${m}  (tried: ${candidates(m).join(', ')})`);
  }
};

main();
