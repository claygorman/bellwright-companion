# Contributing

Thanks for your interest! This is a self-hosted companion app for
[Bellwright](https://store.steampowered.com/app/1812450/Bellwright/) — it parses
the game's save files into a live roster/storage/map UI. Contributions welcome:
parser coverage (new record types), UI features, the map, icon coverage,
Postgres support, docs.

## How the project fits together

```
publisher/  →  POST /api/ingest  →  tools/dump (Rust, Oodle)  →  parser/ (TS)
(gaming box)      (web/)             .sav → protobuf payload      payload → world
                                                                     ↓
                                              SQLite snapshots (web/db, Drizzle)
                                                                     ↓
                                              web/ UI + /api/world + /api/snapshots
```

- `parser/` — pure TypeScript, no deps; maps the save's protobuf (see
  [docs/save-format.md](docs/save-format.md), the reverse-engineering reference)
- `web/` — Next.js 16 (App Router, TSX), Drizzle + better-sqlite3
- `publisher/` — zero-dependency CLI that ships autosaves from the gaming box
- `tools/dump` — Rust decompressor (VSWB container → Oodle → payload), built on
  [bellwright-gold-editor](https://github.com/BradMoeller/bellwright-gold-editor)
- `tools/exploration/` — historical RE scripts, unmaintained

## Dev setup

Prereqs: Node 24+, pnpm 9 (pinned via `packageManager`), Rust toolchain.

```sh
pnpm install
cargo build --release --manifest-path tools/dump/Cargo.toml
cp web/.env.example web/.env.local
pnpm dev                       # http://localhost:8710
# feed it one of YOUR saves (you need to own the game — saves aren't shippable):
curl -X POST --data-binary @YourChar_auto.sav http://localhost:8710/api/ingest
```

Your autosaves live at
`~/.local/share/Steam/steamapps/compatdata/1812450/pfx/drive_c/users/steamuser/AppData/Local/Bellwright/Saved/SaveGames/`
(Linux/Proton; Flatpak Steam under `~/.var/app/com.valvesoftware.Steam/…`;
on Windows directly under `%LOCALAPPDATA%\Bellwright\Saved\SaveGames`).

We can't ship a sample save (it's game data + someone's playthrough), so a copy
of the game is effectively required for end-to-end work. Pure-UI work is
possible against any previously ingested `bellwright.db`.

## Working on the parser

`docs/save-format.md` is the source of truth for what's been decoded. The
workflow that got us here: change one thing in-game → save → diff the payload
(`tools/dump` gives you the raw protobuf) → map the field → verify against the
in-game UI. Please extend the doc alongside any new extraction.
The parser is **read-only by design** — nothing in this project may ever write
to a save file.

## Code style

- TypeScript/TSX throughout; `const fn = () => {}` arrow style
- Named constants for values of significance (no magic numbers)
- pnpm workspace; Node 24 runs the TS in `parser/`/`publisher/` natively
- UI: match the existing inline-style design system (`web/components/bw/ui.ts`)

## Submitting changes

1. Fork, branch from `main`.
2. Make the change; run `pnpm build` (CI runs the same).
3. If you touched the DB schema: `cd web && pnpm exec drizzle-kit generate` and
   commit the migration.
4. Open a PR describing what changed and, for parser work, how you verified it
   against a real save (screenshots of the in-game UI vs the app are perfect).

CI must pass: the `ci` workflow builds the web app; the `docker` workflow
builds the full image on `main`.

## License

MIT. By contributing you agree your contributions are MIT-licensed. This
project was built with substantial AI assistance (Claude) and is not
affiliated with Donkey Crew.
