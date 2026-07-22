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
import { C, MONO, SERIF } from './ui';

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

const panel: React.CSSProperties = {
  border: `1px solid ${C.border2}`, background: C.cardBg2, borderRadius: 12, padding: '14px 16px',
};

const chartTooltip = {
  contentStyle: {
    background: '#201B14', border: '1px solid #39311F', borderRadius: 8,
    fontSize: 12, color: '#EDE4D2',
  },
  labelStyle: { color: '#8a8069' },
};

const hoursFmt = (s: number) => `${Math.floor(s / 3600)}h`;

export const Trends = () => {
  const [data, setData] = useState<TrendsData | null>(null);
  useEffect(() => {
    fetch('/api/trends', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{ padding: 40, color: C.textFaint, fontSize: 13 }}>Loading history…</div>;
  const { points, top_items, deltas } = data;
  if (points.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 20px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, color: C.textDim, marginBottom: 6 }}>Not enough history yet</div>
        <div style={{ fontSize: 13, color: C.textFaint }}>Trends appear after a few saves have been ingested.</div>
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
    <div className="bw-scroll" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '22px 24px 44px' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.textBright }}>Trends</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.textDim2 }}>
            {points.length} snapshots · {deltas ? `${deltas.hours_played.toFixed(1)}h of tracked playtime` : ''}
          </p>
        </div>

        {/* runway alerts */}
        {runway.length > 0 && (
          <div style={{ ...panel, marginBottom: 14, borderColor: runway[0].hours < RUNWAY_WARN_HOURS ? 'rgba(196,85,59,.4)' : C.border2 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 10 }}>
              Runway — consumables trending down
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {runway.map(r => (
                <div key={r.item}>
                  <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: r.hours < RUNWAY_WARN_HOURS ? '#E0997F' : C.gold }}>
                    ~{r.hours < 48 ? `${Math.round(r.hours)}h` : `${Math.round(r.hours / 24)}d`}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim2 }}>{r.item} ({r.to} left)</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 8 }}>
              Hours of playtime until empty at the current net rate.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 12, marginBottom: 14 }}>
          {/* storage over time */}
          <div style={panel}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 10 }}>Storage — top items</div>
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
          <div style={panel}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 10 }}>Morale & injuries</div>
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
          <div style={panel}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 10 }}>Settlement XP (all villagers)</div>
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
            <div style={panel}>
              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 4 }}>
                Who trained ({deltas.hours_played.toFixed(1)}h window)
              </div>
              {deltas.idle_villagers.length > 0 && (
                <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 8 }}>
                  No XP gained: {deltas.idle_villagers.join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {deltas.xp_movers.map(m => {
                  const max = deltas.xp_movers[0].gained;
                  return (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 130, flex: '0 0 auto', fontSize: 12, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <div style={{ flex: '1 1 auto', height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(3, (m.gained / max) * 100)}%`, background: '#E0A73C' }} />
                      </div>
                      <span style={{ width: 64, textAlign: 'right', fontFamily: MONO, fontSize: 11.5, color: '#DCD2BE' }}>+{m.gained.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* storage movement table */}
        {deltas && (gainers.length > 0 || drainers.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
            {[['Produced (net)', gainers, '#8FBF74'], ['Consumed (net)', drainers, '#E0997F']].map(([title, list, color]) => (
              <div key={title as string} style={panel}>
                <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2', marginBottom: 10 }}>{title as string}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(list as [string, { delta: number; perHour: number | null; to: number }][]).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5 }}>
                      <span style={{ flex: '1 1 auto', color: C.text }}>{itemLabel(k)}</span>
                      <span style={{ fontFamily: MONO, color: color as string }}>{v.delta > 0 ? '+' : ''}{v.delta}</span>
                      {v.perHour != null && (
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.textFaint, width: 70, textAlign: 'right' }}>
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
