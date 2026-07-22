#!/usr/bin/env node
// Build bellwright-publisher as a self-contained executable (Node SEA):
// the target machine needs NO Node install. Produces a binary for the
// platform this script runs on:
//   publisher/dist/bellwright-publisher-<os>-<arch>[.exe]
//
//   node scripts/build-sea.mjs
//
// Steps: esbuild TS -> single CJS file, node --experimental-sea-config to
// blob it, copy the running node binary, inject the blob with postject.
import { execSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'; // fixed upstream sentinel

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
};

mkdirSync(DIST, { recursive: true });

// 1. bundle to CommonJS (SEA blobs run CJS)
run('npx -y esbuild src/publisher.ts --bundle --platform=node --format=cjs --target=node22 --outfile=dist/publisher.cjs');

// 2. SEA blob
writeFileSync(path.join(DIST, 'sea-config.json'), JSON.stringify({
  main: 'dist/publisher.cjs',
  output: 'dist/sea-prep.blob',
  disableExperimentalSEAWarning: true,
}, null, 2));
// the blob is VERSION-LOCKED to the node that generates it — always use the
// same binary that will be the donor (i.e. the one running this script)
run(`"${process.execPath}" --experimental-sea-config dist/sea-config.json`);

// 3. copy the node binary running this script and inject the blob.
// IMPORTANT: run this script with an OFFICIAL nodejs.org build (or GitHub
// Actions setup-node). Package-manager builds (Homebrew/linuxbrew) link their
// own loader paths, so the resulting "self-contained" binary wouldn't run on
// other machines. The donor and the blob generator must be the SAME binary.
const donor = process.execPath;
const ext = process.platform === 'win32' ? '.exe' : '';
const out = path.join(DIST, `bellwright-publisher-${process.platform}-${process.arch}${ext}`);
rmSync(out, { force: true });
copyFileSync(donor, out);
chmodSync(out, 0o755);
if (process.platform === 'darwin') run(`codesign --remove-signature "${out}"`);
run(`npx -y postject "${out}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse ${SEA_FUSE}${process.platform === 'darwin' ? ' --macho-segment-name NODE_SEA' : ''}`);
if (process.platform === 'darwin') run(`codesign --sign - "${out}"`);

console.log(`\nbuilt ${out}`);
