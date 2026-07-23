'use client';
// AFK raid alerting: polls live telemetry for a scheduled raid and, when one
// goes active, shows a loud banner AND fires a browser notification (so it
// reaches you even if the tab is backgrounded / you've walked away). Delivery
// is in-app for now; Home Assistant / push can be added later.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RaidAlert } from '@/lib/bw/telemetry';

const POLL_MS = 5000;

const notify = (r: RaidAlert) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const body = [r.village && `Target: ${r.village}`, r.party && `${r.party} attackers`,
    r.eta_s != null && `ETA ${Math.max(0, Math.round(r.eta_s / 60))} min`]
    .filter(Boolean).join(' · ');
  try {
    new Notification('⚔️ Raid incoming — Bellwright', {
      body: r.message || body || 'A raid is heading for your settlement.',
      tag: 'bw-raid', requireInteraction: true,
    });
  } catch { /* notifications unavailable */ }
};

export const RaidWatcher = () => {
  const [raid, setRaid] = useState<RaidAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await fetch('/api/telemetry/latest', { cache: 'no-store' });
        const j = (await r.json()) as { age_ms?: number; data?: { raid?: RaidAlert } | null };
        const rd = j.data?.raid;
        const fresh = (j.age_ms ?? 1e9) < 60_000; // ignore stale telemetry
        if (rd?.active && fresh) {
          const key = `${rd.village}|${rd.eta_s}|${rd.party}`;
          if (key !== lastKey.current) { lastKey.current = key; setDismissed(false); notify(rd); }
          setRaid(rd);
        } else {
          setRaid(null); lastKey.current = '';
        }
      } catch { /* endpoint down — ignore */ }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const askPerm = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setPerm);
  }, []);

  // permission nudge — small, only while default and no active raid
  if (!raid || dismissed) {
    if (perm === 'default') {
      return (
        <button onClick={askPerm}
          className="fixed bottom-3 right-3 z-[95] inline-flex items-center gap-2 rounded-full border border-line-4 bg-iron-850 py-1.5 px-3 text-[11.5px] text-sand-300 shadow-[0_8px_24px_rgba(0,0,0,.5)] hover:border-[#4a4030]">
          <span className="text-rust-bright">⚔️</span> Enable raid alerts
        </button>
      );
    }
    return null;
  }

  const eta = raid.eta_s != null ? `${Math.max(0, Math.round(raid.eta_s / 60))} min` : null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-rust/95 to-rust-bright/90 text-white shadow-[0_6px_24px_rgba(0,0,0,.5)] [animation:bwfade_.18s_ease]">
      <span className="text-lg [animation:bwpulse_1s_ease-in-out_infinite]">⚔️</span>
      <div className="flex-auto min-w-0">
        <div className="font-serif font-semibold text-[15px] leading-tight">Raid incoming</div>
        <div className="text-[12px] text-white/90 truncate">
          {raid.message || [raid.village && `heading for ${raid.village}`,
            raid.party && `${raid.party} attackers`, eta && `ETA ${eta}`].filter(Boolean).join(' · ')
            || 'A raid is heading for your settlement.'}
        </div>
      </div>
      {perm !== 'granted' && (
        <button onClick={askPerm}
          className="flex-none rounded-md border border-white/40 bg-white/10 py-1 px-2.5 text-[11.5px] font-medium hover:bg-white/20">
          Notify me
        </button>
      )}
      <button onClick={() => setDismissed(true)}
        className="flex-none rounded-md border border-white/30 py-1 px-2.5 text-[11.5px] hover:bg-white/15">Dismiss</button>
    </div>
  );
};
