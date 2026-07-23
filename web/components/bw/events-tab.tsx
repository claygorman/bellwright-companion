'use client';
// Events tab — webhook event-log feed (reader daemon + companion). All content
// rendered as plain text (React auto-escapes) so a hostile /api/events post
// can't inject markup. A reader-status banner is DERIVED from heartbeats:
// silence = reader down, distinct from "game off".
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type EventRow = {
  id: number; ts: number; received_at: number;
  source: string; level: string; event: string; message: string;
  meta: Record<string, string | number | boolean> | null;
};
const POLL_MS = 10_000;
const HEARTBEAT_STALE_MS = 300_000; // 5 min — daemon heartbeats every ~2 min

const LEVEL: Record<string, { dot: string; text: string; chip: string }> = {
  error: { dot: 'bg-rust', text: 'text-rust-soft', chip: 'border-rust/40 bg-rust/[.10]' },
  warn: { dot: 'bg-brass', text: 'text-brass', chip: 'border-brass/40 bg-brass/[.10]' },
  info: { dot: 'bg-sky', text: 'text-sand-300', chip: 'border-line-3 bg-white/[.03]' },
};
const hhmmss = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

// derive reader health from the newest reader event
const readerStatus = (rows: EventRow[]) => {
  const r = rows.find(e => e.source === 'reader');
  if (!r) return { tone: 'idle', label: 'No reader activity yet' };
  const age = Date.now() - r.received_at;
  if (r.level === 'error') return { tone: 'error', label: `Reader error: ${r.message}` };
  if (age > HEARTBEAT_STALE_MS) return { tone: 'error', label: `No reader heartbeat for ${Math.round(age / 1000)}s — daemon may be down` };
  if (r.event === 'world_unloaded' || r.event === 'game_closed') return { tone: 'idle', label: 'Reader alive · game not in-world' };
  return { tone: 'ok', label: 'Reader alive · streaming' };
};
const STATUS_TONE: Record<string, string> = {
  ok: 'border-moss/40 bg-moss/[.08] text-[#A9C293]',
  idle: 'border-line-3 bg-white/[.03] text-sand-400',
  error: 'border-rust/45 bg-rust/[.10] text-rust-soft',
};

export const EventsTab = () => {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/events?limit=300', { cache: 'no-store' });
      const j = (await r.json()) as { events: EventRow[] };
      if (!stop.current) { setRows(j.events ?? []); setErr(false); }
    } catch { if (!stop.current) setErr(true); }
  }, []);

  useEffect(() => {
    stop.current = false;
    void load();
    const t = setInterval(load, POLL_MS);
    return () => { stop.current = true; clearInterval(t); };
  }, [load]);

  const status = readerStatus(rows);
  // heartbeats drive the status banner but are hidden from the feed (noise)
  const feed = rows.filter(e => e.event !== 'heartbeat');
  const shown = filter ? feed.filter(e => e.level === filter) : feed;
  const counts = feed.reduce<Record<string, number>>((a, e) => ((a[e.level] = (a[e.level] ?? 0) + 1), a), {});

  return (
    <div className="bw-scroll h-full overflow-y-auto">
      <div className="pt-5.5 px-6 pb-16 max-w-215">
        <div className="mb-3">
          <h2 className="font-serif text-xl md:text-[22px] font-semibold text-sand-100">Events</h2>
          <p className="mt-1 text-[12.5px] md:text-[14px] text-[#8a8069]">
            System log from the memory-reader daemon and the companion. Heartbeats let this tell
            &ldquo;reader is down&rdquo; apart from &ldquo;game is off.&rdquo;
          </p>
        </div>

        <div className={cn('rounded-lg border px-3.5 py-2.5 mb-4 text-[12.5px] md:text-[14px] flex items-center gap-2.5', STATUS_TONE[status.tone])}>
          <span className={cn('w-2.25 h-2.25 rounded-full flex-none',
            status.tone === 'ok' ? 'bg-moss-bright [animation:bwpulse_2.4s_ease-in-out_infinite]' : status.tone === 'error' ? 'bg-rust' : 'bg-sand-600')} />
          <span className="font-medium">{status.label}</span>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {(['error', 'warn', 'info'] as const).map(l => (
            <button key={l} onClick={() => setFilter(f => (f === l ? null : l))}
              className={cn('inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full border text-[11px] md:text-[12px] cursor-pointer',
                filter === l ? LEVEL[l].chip + ' ' + LEVEL[l].text : 'border-line-3 bg-transparent text-sand-500')}>
              <span className={cn('w-1.5 h-1.5 rounded-full', LEVEL[l].dot)} />
              {l} <span className="font-mono text-sand-600">{counts[l] ?? 0}</span>
            </button>
          ))}
          {filter && <button onClick={() => setFilter(null)} className="text-[11px] md:text-[12px] text-sand-600 hover:text-sand-300 cursor-pointer">clear</button>}
          <span className="flex-auto" />
          {err && <span className="text-[11px] md:text-[12px] text-rust-soft">feed unreachable</span>}
        </div>

        {shown.length === 0 ? (
          <div className="text-center py-16 text-[13px] md:text-[14.5px] text-sand-600">No events{filter ? ` at level "${filter}"` : ' yet'}.</div>
        ) : (
          <div className="rounded-xl border border-line-2 overflow-hidden">
            {shown.map((e, i) => {
              const lv = LEVEL[e.level] ?? LEVEL.info;
              return (
                <div key={e.id} className={cn('flex items-start gap-3 px-3.5 py-2', i > 0 && 'border-t border-row')}>
                  <span className={cn('mt-1.5 w-2 h-2 rounded-full flex-none', lv.dot)} />
                  <span className="font-mono text-[10.5px] md:text-[11.5px] text-sand-600 mt-0.5 flex-none w-15.5">{hhmmss(e.received_at)}</span>
                  <div className="min-w-0 flex-auto">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[.4px] text-sand-500 border border-line-3 rounded px-1 py-px">{e.source}</span>
                      <span className={cn('font-mono text-[10.5px] md:text-[11.5px]', lv.text)}>{e.event}</span>
                    </div>
                    <div className="text-[12.5px] md:text-[14px] text-sand-200 mt-0.5 break-words">{e.message}</div>
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(e.meta).map(([k, v]) => (
                          <span key={k} className="font-mono text-[10px] md:text-[11px] text-sand-600 bg-white/[.03] border border-line-3 rounded px-1.5 py-px">
                            {k}={String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
