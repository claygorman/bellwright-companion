// POST /api/telemetry — live game state from the telemetry mod (positions,
// per-village trust/prosperity). Ephemeral: kept in memory, read by the map.
// Optional shared secret via BW_TELEMETRY_TOKEN (matched against ?token= or
// the x-bw-token header) for internet-exposed servers.
import { setTelemetry, type Telemetry } from '@/lib/bw/telemetry';

const TOKEN = process.env.BW_TELEMETRY_TOKEN;

export const POST = async (req: Request) => {
  if (TOKEN) {
    const given = req.headers.get('x-bw-token') ?? new URL(req.url).searchParams.get('token');
    if (given !== TOKEN) return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: Telemetry;
  try {
    body = (await req.json()) as Telemetry;
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.actors) && !Array.isArray(body.villages) && !body.raid && !Array.isArray(body.raidParties)) {
    return Response.json({ error: 'expected { actors[] | villages[] | raid | raidParties[] }' }, { status: 400 });
  }
  // clamp to sane sizes so a runaway mod can't blow memory
  const data: Telemetry = {
    t: typeof body.t === 'number' ? body.t : Date.now(),
    actors: (body.actors ?? []).slice(0, 2000).filter(a => Number.isFinite(a.x) && Number.isFinite(a.y)),
    villages: (body.villages ?? []).slice(0, 64),
    raid: body.raid,
    // raid armies ("red blobs") — a handful at most; drop any without a real position
    raidParties: (body.raidParties ?? []).slice(0, 32).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
  };
  setTelemetry(data);
  return Response.json({ ok: true, actors: data.actors?.length ?? 0, villages: data.villages?.length ?? 0, raid: data.raid?.active ?? false, raidParties: data.raidParties?.length ?? 0 });
};
