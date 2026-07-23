'use client';
// Trends tab — history charts + session deltas from snapshot history.
// The insight layer the game can't show: production rates, runway
// forecasts, XP movement, morale trajectory.
import { useEffect, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { itemLabel } from '@/lib/bw/format';
import { cn } from '@/lib/utils';

const SERIES_COLORS = ['#E0A73C', '#7FA8C9', '#7DB068', '#D9614A', '#B08D57', '#9AD0E6', '#C99A4B', '#A6836A'];
const RUNWAY_WARN_HOURS = 24;

type TrendsData = {
  points: {
    playtime: number; avg_morale: number | null; injured: number;
    items: Record<string, number>; skill_xp_total: number;
  }[];
  top_items: string[];
  deltas: {
    hours_played: number;
    items: Record<string, { from: number; to: number; delta: number; perHour: number | null }>;
    xp_movers: { name: string; gained: number }[];
    idle_villagers: string[];
  } | null;
};

const panel = 'rounded-xl border border-line-2 bg-[#1A160F] py-3.5 px-4';

const chartTooltip = {
  // zIndex lifts the tooltip above the legend (recharts renders the legend
  // after the tooltip wrapper, so without it the legend paints on top);
  // the shadow separates the panel from same-hue card backgrounds
  wrapperStyle: { zIndex: 60 },
  contentStyle: {
    background: '#221D15', border: '1px solid #453A25', borderRadius: 8,
    fontSize: 12, color: '#EDE4D2', boxShadow: '0 10px 28px rgba(0,0,0,.55)',
  },
  labelStyle: { color: '#8a8069' },
};

const hoursFmt = (s: number) => `${Math.floor(s / 3600)}h`;

export const Trends = () => {
  const [data, setData] = useState<TrendsData | null>(null);
  useEffect(() => {
    fetch('/api/trends', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="p-10 text-[13px] md:text-[14.5px] text-sand-600">Loading history…</div>;
  const { points, top_items, deltas } = data;
  if (points.length < 2) {
    return (
      <div className="py-16 px-5 text-center">
        <div className="mb-1.5 font-serif text-lg md:text-[20px] text-sand-400">Not enough history yet</div>
        <div className="text-[13px] md:text-[14.5px] text-sand-600">Trends appear after a few saves have been ingested.</div>
      </div>
    );
  }

  const chartData = points.map(p => ({
    playtime: p.playtime,
    hours: p.playtime / 3600,
    morale: p.avg_morale != null ? Math.round(p.avg_morale * 10) / 10 : null,
    injured: p.injured,
    xp: p.skill_xp_total,
    ...Object.fromEntries(top_items.map(k => [k, p.items[k] ?? 0])),
  }));

  // runway: consumables trending down → hours until empty at current rate
  const runway = deltas ? Object.entries(deltas.items)
    .filter(([, v]) => v.perHour != null && v.perHour < 0 && v.to > 0)
    .map(([k, v]) => ({ item: itemLabel(k), hours: v.to / -(v.perHour as number), to: v.to }))
    .sort((a, b) => a.hours - b.hours)
    .slice(0, 6) : [];

  const gainers = deltas ? Object.entries(deltas.items).filter(([, v]) => v.delta > 0).slice(0, 6) : [];
  const drainers = deltas ? Object.entries(deltas.items).filter(([, v]) => v.delta < 0).slice(0, 6) : [];

  return (
    <div className="bw-scroll h-full overflow-y-auto">
      <div className="pt-5.5 px-6 pb-11">
        <div className="mb-4">
          <h2 className="font-serif text-xl md:text-[22px] font-semibold text-sand-100">Trends</h2>
          <p className="mt-1 text-[12.5px] md:text-[14px] text-sand-400">
            {points.length} snapshots · {deltas ? `${deltas.hours_played.toFixed(1)}h of tracked playtime` : ''}
          </p>
        </div>

        {/* runway alerts */}
        {runway.length > 0 && (
          <div className={cn(panel, 'mb-3.5', runway[0].hours < RUNWAY_WARN_HOURS && 'border-rust/40')}>
            <div className="mb-2.5 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">
              Runway — consumables trending down
            </div>
            <div className="flex flex-wrap gap-4.5">
              {runway.map(r => (
                <div key={r.item}>
                  <div className={cn('font-mono text-[17px] md:text-[18.5px] font-semibold', r.hours < RUNWAY_WARN_HOURS ? 'text-rust-soft' : 'text-gold-bright')}>
                    ~{r.hours < 48 ? `${Math.round(r.hours)}h` : `${Math.round(r.hours / 24)}d`}
                  </div>
                  <div className="text-[11px] md:text-[12px] text-sand-400">{r.item} ({r.to} left)</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10.5px] md:text-[11.5px] text-sand-600">
              Hours of playtime until empty at the current net rate.
            </div>
          </div>
        )}

        <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] gap-3">
          {/* storage over time */}
          <div className={panel}>
            <div className="mb-2.5 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">Storage — top items</div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{ left: -14, right: 8, top: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="playtime" tickFormatter={hoursFmt} tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <YAxis tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <Tooltip {...chartTooltip} labelFormatter={v => `${(Number(v) / 3600).toFixed(1)}h played`}
                  formatter={(val, name) => [String(val), itemLabel(String(name))]} />
                <Legend formatter={(v: string) => <span style={{ color: '#9a8f7d', fontSize: 11 }}>{itemLabel(v)}</span>} />
                {top_items.map((k, i) => (
                  <Line key={k} dataKey={k} dot={false} strokeWidth={1.8}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* morale + injuries */}
          <div className={panel}>
            <div className="mb-2.5 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">Morale & injuries</div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{ left: -14, right: 8, top: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="playtime" tickFormatter={hoursFmt} tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <YAxis yAxisId="m" domain={[0, 100]} tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <YAxis yAxisId="i" orientation="right" allowDecimals={false} tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <Tooltip {...chartTooltip} labelFormatter={v => `${(Number(v) / 3600).toFixed(1)}h played`} />
                <Legend formatter={(v: string) => <span style={{ color: '#9a8f7d', fontSize: 11 }}>{v}</span>} />
                <Line yAxisId="m" dataKey="morale" name="avg morale" dot={false} strokeWidth={1.8} stroke="#7DB068" isAnimationActive={false} />
                <Line yAxisId="i" dataKey="injured" name="injured" dot={false} strokeWidth={1.8} stroke="#D9614A" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* total XP */}
          <div className={panel}>
            <div className="mb-2.5 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">Settlement XP (all villagers)</div>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={chartData} margin={{ left: -6, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E0A73C" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E0A73C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="playtime" tickFormatter={hoursFmt} tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" />
                <YAxis tick={{ fill: '#7a7060', fontSize: 10 }} stroke="#39311F" width={70} />
                <Tooltip {...chartTooltip} labelFormatter={v => `${(Number(v) / 3600).toFixed(1)}h played`} />
                <Area dataKey="xp" name="total XP" stroke="#E0A73C" fill="url(#xpFill)" strokeWidth={1.8} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* XP movers */}
          {deltas && deltas.xp_movers.length > 0 && (
            <div className={panel}>
              <div className="mb-1 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">
                Who trained ({deltas.hours_played.toFixed(1)}h window)
              </div>
              {deltas.idle_villagers.length > 0 && (
                <div className="mb-2 text-[11px] md:text-[12px] text-sand-600">
                  No XP gained: {deltas.idle_villagers.join(', ')}
                </div>
              )}
              <div className="flex flex-col gap-1.75">
                {deltas.xp_movers.map(m => {
                  const max = deltas.xp_movers[0].gained;
                  return (
                    <div key={m.name} className="flex items-center gap-2.5">
                      <span className="w-32.5 flex-none overflow-hidden text-ellipsis whitespace-nowrap text-xs md:text-[13px] text-sand-200">{m.name}</span>
                      <div className="h-1.75 flex-1 overflow-hidden rounded-[4px] bg-white/[.07]">
                        <div className="h-full bg-gold" style={{ width: `${Math.max(3, (m.gained / max) * 100)}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-[11.5px] md:text-[12.5px] text-[#DCD2BE]">+{m.gained.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* storage movement table */}
        {deltas && (gainers.length > 0 || drainers.length > 0) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
            {[['Produced (net)', gainers, '#8FBF74'], ['Consumed (net)', drainers, '#E0997F']].map(([title, list, color]) => (
              <div key={title as string} className={panel}>
                <div className="mb-2.5 font-serif text-[15px] md:text-[16.5px] font-semibold text-[#D9CBB2]">{title as string}</div>
                <div className="flex flex-col gap-1.5">
                  {(list as [string, { delta: number; perHour: number | null; to: number }][]).map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-2.5 text-[12.5px] md:text-[14px]">
                      <span className="flex-1 text-sand-200">{itemLabel(k)}</span>
                      <span className="font-mono" style={{ color: color as string }}>{v.delta > 0 ? '+' : ''}{v.delta}</span>
                      {v.perHour != null && (
                        <span className="w-17.5 text-right font-mono text-[10.5px] md:text-[11.5px] text-sand-600">
                          {v.perHour > 0 ? '+' : ''}{v.perHour.toFixed(1)}/h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
