// POST /api/events — webhook event log ingest (reader daemon, companion, …).
// Zod-validated (see lib/bw/events). Optional shared secret via BW_TELEMETRY_TOKEN
// (matched against ?token= or the x-bw-token header) for internet-exposed servers.
// GET /api/events — newest-first feed for the Events tab.
import { eventInput, insertEvent, listEvents } from '@/lib/bw/events';

const TOKEN = process.env.BW_TELEMETRY_TOKEN;

export const POST = async (req: Request) => {
  if (TOKEN) {
    const given = req.headers.get('x-bw-token') ?? new URL(req.url).searchParams.get('token');
    if (given !== TOKEN) return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = eventInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid event', issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) },
      { status: 422 },
    );
  }
  insertEvent(parsed.data);
  return Response.json({ ok: true });
};

export const GET = (req: Request) => {
  const n = Number(new URL(req.url).searchParams.get('limit')) || 200;
  return Response.json({ events: listEvents(n) });
};
