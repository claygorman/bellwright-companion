# Bellwright save format — inner payload notes

Container/compression layer (VSWB → UE `SerializeCompressed` → Oodle Kraken 128KB
chunks) is documented by
[bellwright-gold-editor](https://github.com/BradMoeller/bellwright-gold-editor/blob/main/docs/save_format.md);
`tools/dump` uses its loader and writes the decompressed payload. Everything below
is about that **decompressed payload** — a *custom* protobuf (NOT UE GVAS).

All findings verified 2026-07-21 against a real save (game build 0.0.51351,
payload 15,420,583 bytes; that exact size also appears in the container header
at 0x18, little-endian u64 = uncompressed size).

## Top-level message

| Field | Type | Meaning (confidence) |
|---|---|---|
| f1 | string | Character name ✓ |
| f2 | string | Map (`Karvenia_08`) ✓ |
| f3 | msg | GUID + ~9KB blob — player-ish state (gold lives ~here per gold-editor: its field-5/6 region) |
| f5 | msg ×64 | `{f1: id, f2: unix-timestamp}` pairs — event/last-seen table (?) |
| f6 | double | ~406516.9 — total playtime seconds (?) |
| f8 | **name table** ×23,822 | See below. THE key structure |
| f9 | string | Save display name (`bradford election`) ✓ |
| f10 | string | Region (`Lowlands`) ✓ |
| f11 | msg ×417 | GUID + ~358B — per-something state (quests? settlements? POIs?) |
| f12/f13 | varint | Unix timestamps (created / last-saved) ✓ |
| f14/f15 | string | Game build versions (`0.0.51011` / `0.0.51351`) — created-on / saved-on ✓ |
| f21 | msg | **THE WORLD BLOB** (~14MB) ✓ |
| f23 | string | Map again |

## f8 — entity name table (×23,822)

Each record is a **raw string** (not a nested message), e.g.:

```
Karvenia_08.Hen_AnimalHusbandry_Base_C_UAID_10FFE04C67B2E38802_cdf2d72c13aa9a77
```

**Numeric entity/class IDs elsewhere in the payload are INDEXES into this table**
(order of appearance). Resolution: collect f8 strings in order into a list,
`names[id]`. Verified: actor records' class ids resolve to sensible types
(TownNpc_C, ConstructionSite_C, LootChest_…, Wolf2Animal_C…).

~49 of the entries are NOT plain strings (parse as tiny float messages) — treat
"doesn't decode as printable string" records as opaque but KEEP them in the list
(they occupy indexes).

Useful name suffix parsing: `Karvenia_08.<ClassName>_UAID_<hw-id>_<instance>` →
`base = name.split('.')[-1].split('_UAID')[0]`.

## f21 — world blob

```
f21
 └─ f1: "Karvenia_08"
 └─ f2:
     ├─ f1 ×3,647  — PLACED ACTORS (transforms)      ~5.4MB
     ├─ f2 ×74,984 — small records (item instances / components?)  ~8.4MB
     └─ f3 ×538    — component-bag records (NPC/entity state?)     ~116KB
```

### f21.f2.f1 — placed actors (×3,647) ✓ decoded

```
f1: GUID string (32 hex chars)
f2:
  f1: varint (2)
  f2: repeated component records {f1: component-class id → f8 table, f2: data}
  f4: varint — ACTOR CLASS ID → f8 name table
  f5: transform
      f1: rotation (quaternion, f32 fields f1..f4; identity often collapses)
      f2: POSITION {f1:x, f2:y, f3:z} float32, UE units (cm)
      f3: scale {1,1,1}
```

Real sample: `TrapperCamp_C` at (103049, -68339, -39712). Actor histogram from a
real save: 604 TownNpc_C, 276 PatrolPoiMarker_C, 216 Wolf2Animal_C, 139
MistSettlement, 19 ConstructionSite_C, LootChest/Beggars_Tent/caravans etc.

### NPC records — ✅ DECODED (2026-07-21, `tools/extract_npcs.py`)

A TownNpc actor (f21.f2.f1 record, class `TownNpc_C`) has components
`MistCharacter` (22B), `MistHuman` (~7KB), `MistTownNpc` (~390B).

**Skills** live in `MistHuman` → f2 → repeated f2, each record:

```
{f1: skill_id (1..14), f2: level, f3: xp, f4: cap}   // absent field = 0
```

| id | skill | id | skill |
|---|---|---|---|
| 1 | Strength | 8 | Harvesting |
| 2 | Agility | 9 | Farming |
| 3 | One-Handed | 10 | Animal Handling |
| 4 | Two-Handed | 11 | Cooking |
| 5 | Polearm | 12 | Crafting |
| 6 | Block/Shields | 13 | Research |
| 7 | Archery | 14 | Labouring |

Levels are the DISPLAYED sheet values (incl. equipment modifiers, e.g. Fabian
1H 9 = 7 base + 2 gear — matches his in-game sheet). XP curve visible in f3
(lvl 10 ≈ 57,600). Verified against a hand-maintained in-game roster: 30/31 exact
or newer-than-doc (the save had fresh level-ups the doc lacked). BONUS: work
skills carry CAPS the in-game-screenshot workflow never captured.

**Names**: `MistTownNpc` embeds 32-hex-char GUID strings (UE-serialized,
`21 00 00 00` length prefix) referencing a global GUID→string name pool
(FirstName/LastName UE property-bags, ~588 entries, scattered in the payload —
scan with regex `\x21\x00\x00\x00([0-9A-F]{32})\x00<len><string>`). First GUID
hit = first name, second = last name.

`MistHuman` f2.f1 is a ~2KB BASE64 string wrapping float data — appearance
vector (not yet needed). f4/f5/f6/f7 = appearance k/v bags (f5 includes
`Gender`); **f3 = injuries** `{f1: asset id → f8 (e.g. BrokenLeg), f2: game-time}`.

**Equipment — ✅ DECODED** (`parser/src/npcs.js`): NOT on the actor — it's a
group-2 component `MistEquipmentComponent` whose owner ref (record f2.f3, four
varints) equals the actor GUID's 16 bytes read as **4×u32 BIG-endian**. Body:
`f2 → repeated f1 {f1: slot id, f2: {f1: item class id → f8, f2: provenance
actor}}`. Slots: 1=weapon 2=offhand/shield 3=head 4=chest 5=legs 6=gloves
7=boots 8=cloak 9=backpack 12=food bag 14=tool. Same owner-match retrieves
`MistNpcHappinessComponent` (morale float) and pocket `MistContainerComponent`s
(carried food/consumables). `MistTownNpc` f6 = NPC template (e.g.
FallenMercenaryNPCTemplate_C), **f7 = faction — `Player` marks YOUR villagers**
(the `--mine` filter); f28 = ACQUIRED statuses (Slacker/Onearmed/Blind…).

**Innate traits (Glutton, Coward, Weakling…) are NOT stored in the save** —
exhaustive scan found only the 22 trait assets in f8 plus ~48 acquired-status
refs. They're procedurally derived from template+seed at runtime. Don't hunt
for them; track acquired statuses + injuries instead.

### f21.f2.f2 — small records (×74,984) — PARTIALLY decoded

```
f1: GUID string
f2:
  f1: varint (1)
  f2: {f1: class id, f2: data}      — class ids resolve via f8
  f3: {f1..f4: 4×u32}               — packed GUID (owner ref?)
  f4: {f1: id, f2: varint}          — often another id + small value
  f5: varint — id
  f6/f7: varint flags
```

Hypothesis: per-item/per-component instances; the owner-GUID links them to
actors (containers, NPCs). **Counts not yet located** — next mapping task.

### f21.f2.f3 — component bags (×538)

`f1: GUID, f2: repeated {f1: small class id (44/45/47…), f2: nested}, f3: varint`.
538 ≈ the number of "live" NPC-ish entities; NPC appearance blobs
(FirstName/LastName/Gender/Hairs…, ×~605 in strings) live somewhere in this
area or inside actor components. Next mapping task.

## Known strings to hunt for next

`MistSettlementItemLedgerB%/Script/Mist.MistSettlementItemLedgerB` (storage
totals), `NpcData`/`MistNpcData` (×698), `FullNpcName`/`{FirstName} {LastName}`
(×613), item asset paths `/Game/Mist/Data/Items/...` (one occurrence each → a
registry, ids likely = f8 indexes or a parallel table).

## Parsing gotchas

- It's standard protobuf wire format, but heuristic walking needs guards:
  strings vs nested messages are ambiguous (try-parse, fall back to raw).
- Field numbers ARE stable within a build but MAY drift across game updates —
  gate on top-level f15 (saved-on build) and fail loudly.
- Save files: `.../compatdata/1812450/pfx/drive_c/users/steamuser/AppData/Local/`
  `Bellwright/Saved/SaveGames/<steamid64>/<Char>_auto.sav` (+ `_quick`, `_0`,
  `_auto_today`, `_auto_yesterday`, `.sav_backup0`). Autosaves ~every game-day;
  Steam Cloud syncs the folder (`steam_autocloud.vdf`).

## NPC classification (archetype) — ✅ DECODED

The `MistTownNpc` f6 **template name encodes the NPC's archetype**:
`(Novice|Apprentice|Expert|Unique)<Profession>NPCTemplate` = recruitable
professional; `*Merchant*`/`*Mechant*` (sic)/`*Trader*` = vendor (definitive
marker: the NPC owns a **`MistTraderComponent`**); `Low/Medium/HighVillagerIdle`
/ `LowBeggar` = generic villager (Low/Med/High ≈ quality tier);
`T0/T1/T2_<group>_<role>` = combatant; personal-name templates = quest/unique.
Faction strings name the home village directly (`PadstowVillagers` → Padstow).
Implemented in `parser/src/npcs.js` (`classify()`); fields: `archetype`,
`profession`, `tier`, `village`.

## Job priorities — ✅ DECODED

`MistTownNpc` **f34** = repeated `{f1: job id, f2: priority}` — the Population
screen's per-NPC job priorities. **Default is 5**; absent entries = untouched;
an EMPTY f34 map = non-worker (combat/reserve) NPC. Job ids 8–14 track the
work-skill enum (8 Harvest … 14 Labour); low ids (1, 2, 6, 7) are non-skill
jobs (construction/delivery/hunting/etc — map via the in-game priority screen).
Verified: Thomas Farming 9, Ernest Labour 9, Piers Crafting 8; Fabian/Arnold
empty. Also town-side: `MistTownLogicComponent` holds per-BUILDING-job records
`{guid, class, name, f4: signed priority}` (99 seen; -100 = disabled, stored
as u64 two's-complement 18446744073709551516).

## Gear presets — ✅ DECODED (`parser/src/gearpresets.ts`, 2026-07-22)

Custom preset definitions are top-level **f11** records: descend single-f2
wrappers to a node with both `f10` (len 24) and `f16`. Fields:

- **slot fields** — ranked preferences per slot. `f1` entries = category
  weights (OneHanded/Shields/MediumArmors/…), `f2` entries = specific items,
  each `{f1: item class id → f8 table, f2: rank}` with **higher rank =
  preferred** (e.g. Halmayan 9 > Heater 8 > … > Plank 5). Slot map:
  f2 weapon, f3 shield, f4 head, f5 chest, f6 gloves, f7 legs, f8 boots,
  f12 backpack, f13 cloak, f14 food, f15 meds.
- **f10** — preset GUID as 4 varints (the stable key).
- **f16** — `{f1.f1: UE-string name (13-byte header, u32le strlen at +9,
  cstring at +13), f2: owner SteamID64 string, f3: same GUID}`. Only
  present on CUSTOM presets.

**Per-NPC assignment**: MistTownNpc component body field **30** (plus a
duplicate f31) = assigned preset GUID (4 varints, matches f10). Built-in
presets (Marksman, recruit/default kits) are referenced by GUID only — they
have **no definition record** in the save (asset-side data), so only custom
presets resolve to names. The armory decode (MistTownHouseComponent,
`parser/src/gearsets.ts`) gives the RESOLVED per-slot items instead.

UI reference shots: docs/reference/game-ui/population-roles-presets.jpeg
(preset columns), attributes-priorities-block-toggles.jpeg (the ⊘ block
toggle = priority 0; blue-dot pips = priority level; thin blue bars = skill
XP → matches skill f3), population-gear-strips.jpeg (per-NPC equipment
strip view).

## Storage / containers — ✅ DECODED (`parser/src/storage.js`)

Chest/building contents live in `MistContainerComponent` bodies:
`f2 = { f1: context/building class id → f8 (e.g. Blacksmith_C, Barn_C),
f2: repeated slots { f1: slot#, f2: COUNT, f3: { f1: item class id → f8,
f2: durability/extra } } }` — same shape as NPC pockets, one nesting level
down from the body root (the earlier zero-result bug). Owner actor class
splits NPC-carried vs building storage. Verified vs doc: 23 PlankShield
banked, 16 RoundShield crafted, 88 bandages distributed on NPCs.
`MistSettlementItemLedger` is NOT storage totals — it's the pending
delivery/hauling task ledger {source GUID, worker GUID, {item, count},
source-name, flags} (useful for the "rack sits at 0" logistics debugging).
`MistInteractableInventoryComponent` bodies are small (UI/interaction state).
Caveat: totals span ALL world containers; per-settlement filter =
MistSettlementAffiliationComponent (future).

## Groups / squads — MistCombatGroup (decoded 2026-07-21, A/B/A session)

Actors of class `MistCombatGroup` (5 in the reference save) hold the squad system:
member NPC GUIDs as repeated 4×u32-BE groups inside the actor body. Observed:
one 33-member group (every player villager), 19- and 15-member squads
(combat crews), plus two smaller groups. Byte-identical across saves taken
minutes apart → stable, safe to extract. Actor LIST INDEXES reshuffle between
saves — always key actors by GUID, never by index.

## Reservist toggle — NOT FOUND in the world save (exhaustive negative)

A/B/A experiment (ON→OFF→ON quicksaves, 5–11s of game time apart) plus a
settled 16-min pair. Swept: every global+embedded component (hash + field
diff), every actor region, all 538 data bags, all top-level fields, GUID
references in varint/raw/hex encodings, membership counts per record.
Result: NO field flips with the toggle. Everything that correlated was
activity state: WorkerStateBehavior presence + its f2.f3 enum (task phase),
MistTownNpc f2 (current task target GUID) & f20 (work queue), per-structure
TownLogic work slots {f4: progress %, f5: worker GUID} (reservists appear to
simply not take structure jobs). MistTownMilitiaComponent = per-village
timers; MistSettlementDefenseComponent = empty stubs; MistTownHouseComponent
= gear/armory roster (see decisions log).
Open question: does the checkbox even survive a save+reload? (Test: toggle
OFF, save, quit to menu, load — still OFF?) If yes, the bit hides in a
non-protobuf UE-serialized side section; next tool = gap-region byte differ
over the unparsed spans between known regions.

## Player pawn — ✅ DECODED (`parser/src/player.ts`, 2026-07-22)

Exactly one actor with class `Player_C` (name-table `Player.Player_C`).
Same component layout as TownNpcs: skills + appearance bag via its
`MistHuman` component; equipment via owner-matched `MistEquipmentComponent`
(owner = actor GUID as 4×u32 BE); carried inventory via owner-matched
`MistContainerComponent`s (slot format `{f1: slot#, f2: count, f3: {f1:
item class}}`). Coins are physical `OldCoin_C` items in the carried
inventory — there is no separate currency field. The player has NO
MistTownNpc / happiness / gear-preset components (no morale, no preset).

**Renown**: NOT here. Top-level **f3** = `{f1: guid-string, f2:
OasisPlayerState wrapper}` whose body is an ~8KB blob that wraps a
base64-looking UE archive (`AQAAAAAAAACPcpA9...`) — this is the region
bellwright-gold-editor byte-patches. Renown/kingdom stats presumably live
inside; undecoded.

Per-NPC carried inventory (the Population "Gear & inventory" view) uses the
same container walk for every actor guid (`extractCarried`).
