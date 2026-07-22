#!/usr/bin/env node
// bellwright-parse <payload.bin> [--json] [--mine]
// Emits the TownNpc roster (all world NPCs, or --mine for Player-faction only).
import { readFileSync } from 'node:fs';
import { Payload, SKILLS } from './payload.ts';
import { extractNpcs } from './npcs.ts';
import { extractStorage } from './storage.ts';

const args = process.argv.slice(2);
const path = args.find(a => !a.startsWith('--'));
if (!path) { console.error('usage: bellwright-parse <payload.bin> [--json] [--mine]'); process.exit(2); }

const p = new Payload(readFileSync(path));
let npcs = extractNpcs(p);
if (args.includes('--mine')) npcs = npcs.filter(n => n.is_player_npc);

if (args.includes('--json')) {
  const storage = extractStorage(p);
  console.log(JSON.stringify({ meta: p.meta, npcs, storage }, null, 1));
} else {
  console.log(`${p.meta.saveName} (${p.meta.savedBuild}) — ${npcs.length} NPCs`);
  const short: Record<string, string> = { strength: 'STR', agility: 'AGI', one_handed: '1H', two_handed: '2H', polearm: 'Pole', block: 'Blk', archery: 'Arch', harvest: 'Hrv', farm: 'Frm', animal: 'Anm', cook: 'Cok', craft: 'Crf', research: 'Rsc', labour: 'Lab' };
  console.log('Name'.padEnd(22) + SKILLS.map(s => short[s].padStart(5)).join('') + '  equipment/injuries');
  for (const n of npcs) {
    if (!n.first_name) continue;
    const nm = `${n.first_name} ${n.last_name ?? ''}`.trim();
    const row = SKILLS.map(s => {
      const k = n.skills[s];
      return (k ? `${k.level}/${k.cap}` : '-').padStart(5);
    }).join('');
    const extra = [
      Object.values(n.equipment).length ? `⚔ ${Object.values(n.equipment).slice(0, 4).join(',')}` : '',
      n.injuries.length ? `🩹 ${n.injuries.join(',')}` : '',
    ].filter(Boolean).join(' ');
    console.log(nm.padEnd(22).slice(0, 22) + row + '  ' + extra);
  }
}
