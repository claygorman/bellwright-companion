#!/usr/bin/env node
// bellwright-publisher — ships Bellwright saves to the companion ingest API.
// Zero dependencies; Node 24 runs this TypeScript natively (also distributed
// as a self-contained binary — see publisher/scripts/build-sea.mjs).
//
// Usage:
//   bellwright-publisher push  [options]   one-shot: push the newest save, exit
//   bellwright-publisher watch [options]   keep running; push on change (debounced)
//
// Options (flag > env var > default):
//   --url <url>       BW_INGEST_URL    ingest endpoint
//                                      (default: http://localhost:8710/api/ingest)
//   --dir <path>      BW_SAVE_DIR      save tree (default: auto-detected Steam
//                                      Proton path; on Windows the game writes
//                                      %LOCALAPPDATA%\Bellwright\Saved\SaveGames)
//   --glob <name>     BW_SAVE_GLOB     exact filename instead of newest *.sav
//   --debounce <ms>   BW_DEBOUNCE_MS   watch debounce (default: 15000)
//   --help, --version
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, watch } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const VERSION = '0.0.6'; // keep in sync with publisher/package.json

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    url: { type: 'string' },
    dir: { type: 'string' },
    glob: { type: 'string' },
    debounce: { type: 'string' },
    help: { type: 'boolean' },
    version: { type: 'boolean' },
  },
});

const STEAM_APP_ID = 1812450;
const PROTON_SAVE_SUBPATH = path.join(
  'steamapps/compatdata', String(STEAM_APP_ID),
  'pfx/drive_c/users/steamuser/AppData/Local/Bellwright/Saved/SaveGames',
);
// Save-dir auto-detection:
//   Windows — the game writes %LOCALAPPDATA%\Bellwright\Saved\SaveGames
//   Linux   — Proton keeps it under <steam library>/steamapps/compatdata/<appid>/…
//             and games often live in SECONDARY libraries, so we also parse
//             Steam's libraryfolders.vdf for every library path.
const HOME = process.env.HOME ?? '~';
const STEAM_ROOTS = [
  path.join(HOME, '.local/share/Steam'),
  path.join(HOME, '.var/app/com.valvesoftware.Steam/.local/share/Steam'), // Flatpak
];

const steamLibraries = (): string[] => {
  const libs = new Set<string>(STEAM_ROOTS);
  for (const root of STEAM_ROOTS) {
    const vdf = path.join(root, 'steamapps/libraryfolders.vdf');
    if (!existsSync(vdf)) continue;
    const text = readFileSync(vdf, 'utf8');
    for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1]);
  }
  return [...libs];
};

const saveDirCandidates = (): string[] => [
  ...(process.env.LOCALAPPDATA
    ? [path.join(process.env.LOCALAPPDATA, 'Bellwright/Saved/SaveGames')] : []),
  ...steamLibraries().map(lib => path.join(lib, PROTON_SAVE_SUBPATH)),
];

const CANDIDATES = saveDirCandidates();
const SAVE_DIR = flags.dir ?? process.env.BW_SAVE_DIR
  ?? CANDIDATES.find(d => existsSync(d))
  ?? CANDIDATES[0] ?? '';
const INGEST_URL = flags.url ?? process.env.BW_INGEST_URL ?? 'http://localhost:8710/api/ingest';
const SAVE_GLOB = flags.glob ?? process.env.BW_SAVE_GLOB ?? null;
const DEBOUNCE_MS = Number(flags.debounce ?? process.env.BW_DEBOUNCE_MS) || 15_000;

const USAGE = `bellwright-publisher ${VERSION} — ship Bellwright saves to a companion server

Usage: bellwright-publisher [push|watch] [options]

  push               push the newest save once and exit (default)
  watch              keep running; push on save change (debounced)

Options:
  --url <url>        ingest endpoint        (env BW_INGEST_URL)
  --dir <path>       save directory         (env BW_SAVE_DIR; auto-detected)
  --glob <name>      exact save filename    (env BW_SAVE_GLOB)
  --debounce <ms>    watch debounce         (env BW_DEBOUNCE_MS; default 15000)
  --help, --version`;
const RETRY_MS = 60_000; // ingest endpoint unreachable → try the burst again later
// any save type counts (auto/quick/manual) — the newest mtime is always the
// freshest world state, regardless of how the player saved
const SAVE_SUFFIX = '.sav';

const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);
const humanSize = (n: number) =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MiB` : `${Math.round(n / 1024)} KiB`;

const isWantedSave = (name: string): boolean =>
  SAVE_GLOB ? name === SAVE_GLOB : name.endsWith(SAVE_SUFFIX);

/** Newest matching save anywhere under SAVE_DIR (per-character subdirs). */
const findNewestSave = (): string | null => {
  let best: { file: string; mtime: number } | null = null;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (isWantedSave(entry.name)) {
        const mtime = statSync(p).mtimeMs;
        if (!best || mtime > best.mtime) best = { file: p, mtime };
      }
    }
  };
  walk(SAVE_DIR);
  return best ? best.file : null;
};

let lastPushedSha: string | null = null;

/** Push the newest save. Returns 'pushed' | 'unchanged' | 'failed'. */
const pushNewestSave = async (): Promise<'pushed' | 'unchanged' | 'failed'> => {
  const file = findNewestSave();
  if (!file) {
    log(`no ${SAVE_GLOB ?? `*${SAVE_SUFFIX}`} found under ${SAVE_DIR}`);
    return 'failed';
  }
  const body = readFileSync(file);
  const sha = createHash('sha256').update(body).digest('hex');
  if (sha === lastPushedSha) {
    log(`${path.basename(file)} unchanged since last push — skipping`);
    return 'unchanged';
  }
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body,
    });
    const detail = await res.json().catch(() => ({}));
    log(`pushed ${path.basename(file)} (${humanSize(body.length)}) -> ${res.status} ${JSON.stringify(detail)}`);
    if (!res.ok) return 'failed';
    lastPushedSha = sha;
    return 'pushed';
  } catch (e) {
    log(`push failed: ${e instanceof Error ? e.message : e}`);
    return 'failed';
  }
};

const watchSaves = () => {
  log(`watching ${SAVE_DIR} -> ${INGEST_URL} (debounce ${DEBOUNCE_MS}ms)`);
  let timer: NodeJS.Timeout | null = null;
  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      const result = await pushNewestSave();
      if (result === 'failed') schedule(RETRY_MS);
    }, delay);
  };
  watch(SAVE_DIR, { recursive: true }, (_event, name) => {
    if (name?.toString().endsWith('.sav')) schedule(DEBOUNCE_MS);
  });
  schedule(0); // initial sync on startup
};

// ---- entry ----
// (no top-level await: the SEA build bundles this to CommonJS)
const main = async () => {
  if (flags.help) { console.log(USAGE); process.exit(0); }
  if (flags.version) { console.log(VERSION); process.exit(0); }
  const command = positionals[0] ?? 'push';
  if (command !== 'push' && command !== 'watch') {
    console.error(`unknown command "${command}"\n\n${USAGE}`);
    process.exit(2);
  }
  if (!SAVE_DIR || !existsSync(SAVE_DIR)) {
    const explicit = flags.dir ?? process.env.BW_SAVE_DIR;
    if (explicit) console.error(`save dir does not exist: ${explicit}`);
    else {
      console.error('could not find the Bellwright save folder. Checked:');
      for (const c of CANDIDATES) console.error('  - ' + c);
    }
    console.error(`
Point me at it with --dir (or BW_SAVE_DIR). Where to look:
  Windows:        %LOCALAPPDATA%\\Bellwright\\Saved\\SaveGames
  Linux (Proton): <steam library>/steamapps/compatdata/${STEAM_APP_ID}/pfx/drive_c/users/steamuser/AppData/Local/Bellwright/Saved/SaveGames
Your saves are <Character>_auto.sav / _quick.sav files — searching your drive
for "*_auto.sav" will find the folder.`);
    process.exit(1);
  }
  if (command === 'watch' || process.env.BW_WATCH === '1') {
    watchSaves();
  } else {
    const result = await pushNewestSave();
    process.exit(result === 'failed' ? 1 : 0);
  }
};
void main();
