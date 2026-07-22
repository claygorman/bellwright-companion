// Fetch the world-map image from the Bellwright community wiki into
// public/map/ (gitignored — it's a game asset © Donkey Crew, hosted by the
// wiki; each install fetches its own copy, we don't redistribute it).
// Usage: pnpm map
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WIKI_API = 'https://bellwright.fandom.com/api.php';
const UA = { 'user-agent': 'bellwright-companion map fetcher' };
const OUT_DIR = path.join(import.meta.dirname, '..', 'public', 'map');

// wiki file name per save map name (keep in sync with web/lib/bw/map.ts)
const MAP_FILES: Record<string, string> = {
  Karvenia_08: 'Map 0 Karvenia.jpg',
};

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  for (const [mapName, wikiFile] of Object.entries(MAP_FILES)) {
    const q = new URLSearchParams({
      action: 'query', titles: `File:${wikiFile}`, prop: 'imageinfo',
      iiprop: 'url|size', format: 'json',
    });
    const res = await fetch(`${WIKI_API}?${q}`, { headers: UA });
    const data = (await res.json()) as {
      query: { pages: Record<string, { imageinfo?: { url: string; width: number }[] }> };
    };
    const info = Object.values(data.query.pages)[0]?.imageinfo?.[0];
    if (!info) { console.error(`no imageinfo for ${wikiFile}`); continue; }
    // server-side downscale: a 4096px texture zooms smoothly; the 7577px
    // original re-rasterizes for ~500ms on every scale change
    const url = info.width > 4096 ? `${info.url.split('?')[0]}/scale-to-width-down/4096` : info.url;
    const img = await fetch(url, { headers: UA });
    if (!img.ok) { console.error(`fetch failed (${img.status}) for ${wikiFile}`); continue; }
    const out = path.join(OUT_DIR, `${mapName}.jpg`);
    await writeFile(out, Buffer.from(await img.arrayBuffer()));
    console.log(`${mapName}: ${info.width}px → ${out}`);
  }
};

await run();
