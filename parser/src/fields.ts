// Named protobuf field numbers for the Bellwright save payload.
// See docs/save-format.md for the full reverse-engineered layout.
// Convention: <SCOPE>.<MEANING> = field number within that message scope.

// Placed-actor record (world blob f21.f2.f1 entries)
export const ACTOR = {
  GUID: 1,          // 32-hex-char actor GUID string
  DATA: 2,          // actor data message (below)
};
export const ACTOR_DATA = {
  COMPONENT: 2,     // repeated component entry {f1: class id, f2: body}
  CLASS: 4,         // actor class id -> f8 name table
  TRANSFORM: 5,     // {f1: rotation, f2: position xyz f32, f3: scale}
};
export const COMPONENT_ENTRY = {
  CLASS: 1,
  BODY: 2,
};
export const TRANSFORM = {
  POSITION: 2,
};

// Town-structure component body (buildings): {f1:1, f2: struct-data}
export const STRUCT_WRAP = { DATA: 2 };
export const STRUCT_DATA = {
  CLASS: 1,         // building class id
  FACTION: 3,       // faction id -> f8 ('Player' = ours)
  RENAME: 7,        // blob containing the custom name + owner SteamID64
};

// Standalone component record (world blob f21.f2.f2 entries)
export const COMP_RECORD = {
  GUID: 1,
  DATA: 2,          // {f2: {f1: class id, f2: body}, f3: owner guid 4xu32 BE}
};
export const COMP_DATA = {
  CLASS_AND_BODY: 2, // {f1: class id, f2: body}
  OWNER: 3,          // actor GUID as 4x u32 BIG-endian
};

// MistContainerComponent body: {f1, f2: container}
export const CONTAINER = {
  INVENTORY: 2,     // {f1: context/config class id (MISLEADING), f2: slots}
};
export const INVENTORY = {
  CONTEXT: 1,       // config/filter class ref — NOT the owning building
  SLOT: 2,          // repeated slot (below)
};
export const SLOT = {
  INDEX: 1,         // slot number (absent = 0)
  COUNT: 2,         // stack count
  ITEM: 3,          // {f1: item class id -> f8, f2: durability/provenance}
};
export const SLOT_ITEM = {
  CLASS: 1,
};
