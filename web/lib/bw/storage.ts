// Storage domain knowledge: container capacities/types + item categorization.
// Caps are in-game values (verified in-game); unknown classes are "buffer"
// containers (cap null) — work stations, wells, drop bags, carts.
import { itemLabel } from './format.ts';
import type { StorageData } from '@/lib/types';

export type ContainerKind = {
  type: string;
  icon: string;
  cap: number | null;
  remote?: boolean;
};

const BARN_CAP = 2000;
const FOOD_CELLAR_CAP = 1000;
const SMALL_BARN_CAP = 400; // "storage shed"
const STOCKPILE_CAP = 400;
const SHARED_CHEST_CAP = 50;

// class-name → kind. First regex match wins; order matters.
const KIND_RULES: [RegExp, ContainerKind][] = [
  [/^Barn/, { type: 'Barn', icon: 'barn', cap: BARN_CAP }],
  [/^SmallBarn/, { type: 'Storage Shed', icon: 'barn', cap: SMALL_BARN_CAP }],
  [/FoodCellar/, { type: 'Food Cellar', icon: 'pot', cap: FOOD_CELLAR_CAP }],
  [/^Stockpile/, { type: 'Stockpile', icon: 'home', cap: STOCKPILE_CAP }],
  [/Chest/, { type: 'Chest', icon: 'loot', cap: SHARED_CHEST_CAP }],
  [/^Well|WaterCollector/, { type: 'Well', icon: 'home', cap: null }],
  [/Foraging|ForagerRack/, { type: 'Lodge', icon: 'berry', cap: null, remote: true }],
  [/MiningCamp/, { type: 'Mining Camp', icon: 'tool', cap: null, remote: true }],
  [/HuntersCamp|FishingCamp|LoggingCamp|Lumberjack|Forester/, { type: 'Camp', icon: 'camp', cap: null, remote: true }],
  [/Blacksmith|Toolmaker|Workshop|Bloomery|PitSaw|WeaverLoom|Thresher|SmokingRack|Butchery/, { type: 'Workshop', icon: 'anvil', cap: null }],
  [/Cauldron|CookingPot|Campfire/, { type: 'Station', icon: 'pot', cap: null }],
  [/Farm|Compost|BirdsCoop|MudCollector|MixingBucket/, { type: 'Farm', icon: 'wheat', cap: null }],
  [/ConstructionSite/, { type: 'Construction', icon: 'hammer', cap: null }],
  [/Library/, { type: 'Library', icon: 'scroll', cap: null }],
  [/Weapon_rack/, { type: 'Rack', icon: 'sword', cap: null }],
  [/Caravan|Cart|DropBag/, { type: 'Cart / Bag', icon: 'pack', cap: null }],
];

/** Classify by actor class ("SmallBarn_C"); fall back to words in a custom
 *  rename ("Barn #1 Spoiled") when the class is missing. */
export const containerKind = (cls: string | null, name: string | null): ContainerKind => {
  if (cls) {
    for (const [re, kind] of KIND_RULES) if (re.test(cls)) return kind;
  }
  if (name) {
    if (/barn/i.test(name)) return { type: 'Barn', icon: 'barn', cap: BARN_CAP };
    if (/dock|camp|mining/i.test(name)) return { type: 'Camp', icon: 'camp', cap: null, remote: true };
  }
  return { type: 'Container', icon: 'home', cap: null };
};

// ---- item categories -------------------------------------------------------
// The save carries no category data; this is an app-side heuristic keyed on
// item class names (best-effort heuristic).
export const CATS: [string, string][] = [
  ['Food', '#7DB068'],
  ['Materials', '#B08D57'],
  ['Weapons', '#C4553B'],
  ['Armor', '#5FA8CE'],
  ['Tools', '#C99A4B'],
  ['Misc', '#9A8F7D'],
];

const CAT_RULES: [RegExp, string][] = [
  // nothing is truly waste in Bellwright — spoiled food/dung/manure feed the
  // fertilizer chain and feathers fletch arrows; they're production inputs
  [/Feathers|SpoiledFood|Refuse|Dung|Manure|Fertili[sz]er/, 'Materials'],
  [/Sword|Axe(?!.*(Tool))|Mace|Spear|Halberd|Poleaxe|Bow(?!l)|Arrow|Dagger|Warhammer|Club|Knife(?!.*Skinning)|Falchion|Glaive|Pike/, 'Weapons'],
  [/Shield|Helm|Coif|Hood|Cuirass|Hauberk|Jerkin|Gambeson|Armor|Chausses|Trousers|Pants|Gloves|Mittens|Boots|Sabatons|Shirt|Tunic|Cloak|Gauntlet|Bracers|Cap$|Hat/, 'Armor'],
  [/Hatchet|Pickaxe|Sickle|Hammer|SkinningKnife|Hoe|Shovel|Saw|FishingRod|Scythe|Needle|Bucket(?!.*Mixing)|Torch/, 'Tools'],
  [/Meat|Stew|Soup|Bread|Fish(?!ing)|Berr|Egg|Mushroom|Cheese|Honey|Porridge|Grain|Wheat|Radish|Garlic|Potato|Carrot|Cabbage|Onion|Apple|Veg|Milk|Water(?!Collector)|Beer|Ale|Mead|Flour|Dough|Sausage|Lard|Butter|Turnip|Beet|Pea[sn]?_|Herb|Sage|Mint|Chamomile|Yarrow|Nettle(?!.*Fiber)/, 'Food'],
  [/Wood|Log|Plank|Stone|Ore|Ingot|Bar_|Clay|Mud|Charcoal|Coal|Leather|Hide|Pelt|Wool|Cloth|Fabric|Linen|Flax|Hemp|Fiber|Rope|Strap|Nail|Reed|Straw|Thatch|Seeds|Sapling|Resin|Tar|Ash_|Sand|Brick|Mortar|Bone|Antler|Tallow|Wax|Sinew|String|Thread|Stick|Branch|Bark/, 'Materials'],
];

export const categorize = (itemClass: string): string => {
  for (const [re, cat] of CAT_RULES) if (re.test(itemClass)) return cat;
  return 'Misc';
};

// ---- aggregation -----------------------------------------------------------
export type ContainerVM = {
  id: string;
  name: string;
  cls: string | null;
  type: string;
  icon: string;
  cap: number | null;
  remote: boolean;
  items: { name: string; raw: string; cat: string; qty: number }[];
};

// sidebar ordering: real storage first, then farms/stations/misc buffers
const TYPE_ORDER: Record<string, number> = {
  Barn: 0, 'Food Cellar': 1, 'Storage Shed': 2, Stockpile: 3, Chest: 4,
};
const typeRank = (type: string): number => TYPE_ORDER[type] ?? 4;

const PLAYER_FACTION = 'Player';

export const shapeContainers = (storage: StorageData): ContainerVM[] => {
  // Only the player's settlement — the save carries every container in the
  // world (other villages' barns/wells, caravan carts, even foxes' drop bags).
  const list = (storage.containers ?? []).filter(c => c.faction === PLAYER_FACTION);
  // number unnamed containers per class so "Barn" ×4 become Barn #1..#4
  const classCount = new Map<string, number>();
  const classSeen = new Map<string, number>();
  for (const c of list) {
    if (!c.name && c.cls) classCount.set(c.cls, (classCount.get(c.cls) ?? 0) + 1);
  }
  return list
    .map(c => {
      const kind = containerKind(c.cls, c.name);
      let name = c.name;
      if (!name) {
        const base = c.cls ? itemLabel(c.cls) : 'Container';
        if (c.cls && (classCount.get(c.cls) ?? 0) > 1) {
          const n = (classSeen.get(c.cls) ?? 0) + 1;
          classSeen.set(c.cls, n);
          name = `${base} #${n}`;
        } else name = base;
      }
      return {
        id: c.id,
        name,
        cls: c.cls,
        type: kind.type,
        icon: kind.icon,
        cap: kind.cap,
        remote: kind.remote ?? false,
        items: Object.entries(c.items)
          .map(([raw, qty]) => ({ name: itemLabel(raw), raw, cat: categorize(raw), qty })),
      };
    })
    .filter(c => c.items.length > 0)
    .sort((a, b) => {
      const r = typeRank(a.type) - typeRank(b.type);
      if (r !== 0) return r;
      const qty = (c: ContainerVM) => c.items.reduce((s, x) => s + x.qty, 0);
      return qty(b) - qty(a);
    });
};
