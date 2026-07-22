// Extract map POIs from world actors: camps, chests, shrines/lore, prisons,
// caravans, fast-travel signs, wildlife spawners. Everything here is a real
// actor with a position in the save — resource nodes (berries/ores) are NOT
// actors (spawner/world-static data), so they can't be provided honestly.
import { first } from './wire.ts';
import type { Payload } from './payload.ts';

export type Poi = { cls: string; layer: string; position: number[] };

// first match wins
const RULES: [RegExp, string][] = [
  [/Big_Robbers_Camp|Robber_Tower|BanditLeaderCamp|WhereTheLostLay/i, 'campsHard'],
  [/Mid_(Swamp_)?Robber/i, 'campsMedium'],
  [/Robbers_Camp|Robber_Camp|RobbersCamp|BanditCamp|KidnapperCamp/i, 'campsEasy'],
  [/^MistBanditPatrolParty$/, 'patrols'],
  [/LootChest|Loot_C$|BarrelLoot|SmallTreasuresLoot|ShackChest|ChestLoot|JesterChest/, 'chests'],
  [/PaganShrine|VMShrine/, 'shrines'],
  [/ChapterNote|RebellionMessage|_Lore_C$|Letter|Journal|DiaryNote|LastWord|ShepherdsNote|BanditsUnsentMessage|NoticeRaisedTaxes/, 'lore'],
  [/Prisoner.*Cage|Prisoner.*QuestPoi|BrigandPrison_Logic/, 'prisoners'],
  [/CaravanCart|MistCaravanParty/, 'caravans'],
  [/MerchantStand|SM_Merchant/, 'merchants'],
  [/^FastTravelSign_C$/, 'fasttravel'],
  [/^(WolfSpawner|HighlandsWolfSpawner|QuestWolfSpawner)/, 'wolves'],
  [/^(BearSpawner|BlackTuskerSpawner|DemonBoarSpawner)/, 'bears'],
  [/^BoarSpawner/, 'boars'],
  [/^(DeerStagSpawner|DeerDoeSpawner)/, 'deer'],
  [/^FoxSpawner/, 'foxes'],
  [/^WildGoatKarveniaSpawner/, 'goats'],
];

export const extractPois = (p: Payload): Poi[] => {
  const out: Poi[] = [];
  for (const region of p.actors) {
    const fs = p.fields(region) ?? [];
    let cls: string | null = null, pos: number[] | null = null;
    for (const x of fs) {
      if (x.f === 2 && x.kind === 'len') {
        for (const y of p.fields(x.v) ?? []) {
          if (y.f === 4 && y.kind === 'v') cls = p.baseName(y.v);
          if (y.f === 5 && y.kind === 'len') {
            const posF = first(p.fields(y.v), 2, 'len');
            const v = (p.fields(posF?.v) ?? []).filter(z => z.kind === 'f').map(z => z.v);
            if (v.length >= 3) pos = v.slice(0, 3);
          }
        }
      }
    }
    if (!cls || !pos) continue;
    for (const [re, layer] of RULES) {
      if (re.test(cls)) { out.push({ cls, layer, position: pos }); break; }
    }
  }
  return out;
};
