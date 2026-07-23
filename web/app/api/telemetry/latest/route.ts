// GET /api/telemetry/latest — the freshest live telemetry + its age. The map
// polls this and renders live pins when the data is fresh.
import { getTelemetry } from '@/lib/bw/telemetry';

export const GET = async () => {
  const t = getTelemetry();
  return Response.json(
    t ? { received_at: t.received_at, age_ms: Date.now() - t.received_at, data: t.data } : { data: null },
    { headers: { 'cache-control': 'no-store' } },
  );
};
