// World→map-image projection. The base image is the game's world-map texture
// as hosted by the Bellwright wiki (fetched via `pnpm map`, gitignored).
// The affine transform below was least-squares fitted from the 7 village
// capitals: wiki interactive-map marker pixels vs the centroid of each
// village's NPCs in a real save (residuals ±50px on 7577px ≈ 0.7%).
// Save coordinates are UE units (cm), Z-up: ground plane = position[0,1].

export type MapDef = {
  image: string;      // under public/
  size: number;       // square, px
  // px_u = a*X + b*Y + c ; px_v = d*X + e*Y + f
  transform: [number, number, number, number, number, number];
  labels: { name: string; u: number; v: number }[];
};

export const MAPS: Record<string, MapDef> = {
  Karvenia_08: {
    // 4096px server-side downscale of the wiki's 7577px original — a smaller
    // GPU texture keeps zoom re-rasterization fast (the full-size layer took
    // ~500ms per scale change)
    image: '/map/Karvenia_08.jpg',
    size: 4096,
    // NOTE: wiki interactive-map marker coords are origin:bottom-left, so the
    // fitted v-row is negated and offset by the image height (verified by
    // rendering both conventions — this one lands on the village clusters);
    // coefficients are the 7577px fit scaled by 4096/7577
    transform: [8.642874e-3, 3.269422e-5, 2050.02, -1.651886e-4, 8.595345e-3, 2069.67],
    labels: [
      { name: 'Haerndean', u: 2843, v: 1063 },
      { name: 'Padstow', u: 2586, v: 1523 },
      { name: 'Bradford', u: 3578, v: 1536 },
      { name: 'Farnworth', u: 3358, v: 2375 },
      { name: 'Blackridgepool', u: 1982, v: 2285 },
      { name: 'Horndean', u: 1975, v: 3558 },
      { name: 'Crasmere', u: 3323, v: 3169 },
    ],
  },
};

export const mapFor = (mapName: string | null): MapDef | null =>
  (mapName && MAPS[mapName]) || null;

export const project = (m: MapDef, x: number, y: number): { u: number; v: number } => {
  const [a, b, c, d, e, f] = m.transform;
  return { u: a * x + b * y + c, v: d * x + e * y + f };
};
