'use client';
// Storage tab — container sidebar with fill bars + aggregate item census.
import { useMemo, useState } from 'react';
import { CATS, type ContainerVM } from '@/lib/bw/storage';
import { cn } from '@/lib/utils';
import { Icon, PinIcon, SearchIcon } from './icons';
import { ItemImg } from './item-img';
import { C } from './ui';

const FULL_FILL = 0.95;   // effectively full — flag it
const NEAR_FILL = 0.8;    // filling up — worth a look
const HOG_MIN_SHARE = 0.06;
const HOG_MIN_QTY = 350;
const HOG_LIMIT = 5;

const fillHex = (f: number): string => (f >= 0.9 ? '#C4553B' : f >= NEAR_FILL ? '#E0A73C' : '#7DB068');

type AggItem = { name: string; raw: string; cat: string; qty: number; locs: { id: string; name: string; qty: number }[] };

export const storagePressure = (containers: ContainerVM[]): boolean =>
  containers.some(c =>
    c.cap != null && c.items.reduce((s, x) => s + x.qty, 0) / c.cap >= NEAR_FILL);

export const StorageTab = ({ containers }: { containers: ContainerVM[] }) => {
  const [sel, setSel] = useState('all');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState<string[]>([]);

  const agg = useMemo(() => {
    const m = new Map<string, AggItem>();
    for (const c of containers) {
      for (const it of c.items) {
        const cur = m.get(it.name) ?? { name: it.name, raw: it.raw, cat: it.cat, qty: 0, locs: [] };
        cur.qty += it.qty;
        cur.locs.push({ id: c.id, name: c.name, qty: it.qty });
        m.set(it.name, cur);
      }
    }
    return [...m.values()];
  }, [containers]);

  const totalQty = agg.reduce((a, x) => a + x.qty, 0);
  const container = sel === 'all' ? null : containers.find(c => c.id === sel) ?? null;
  const scope: AggItem[] = container
    ? container.items.map(it => ({ name: it.name, raw: it.raw, cat: it.cat, qty: it.qty, locs: [{ id: container.id, name: container.name, qty: it.qty }] }))
    : agg;

  const catTotals: Record<string, number> = {};
  for (const it of scope) catTotals[it.cat] = (catTotals[it.cat] ?? 0) + it.qty;
  const catColor = Object.fromEntries(CATS);

  const sq = q.trim().toLowerCase();
  const items = scope
    .filter(it => (cat === 'all' || it.cat === cat) && (!sq || it.name.toLowerCase().includes(sq)))
    .sort((a, b) => b.qty - a.qty);

  const used = (c: ContainerVM) => c.items.reduce((a, x) => a + x.qty, 0);
  const fillOf = (c: ContainerVM) => used(c) / (c.cap ?? 1);
  const capped = containers.filter(c => c.cap);
  const aggUsed = capped.reduce((a, c) => a + used(c), 0);
  const aggCap = capped.reduce((a, c) => a + (c.cap ?? 0), 0);
  const aggFill = aggCap ? aggUsed / aggCap : 0;
  const fullList = capped.filter(c => fillOf(c) >= FULL_FILL);
  const nearList = capped.filter(c => { const f = fillOf(c); return f >= NEAR_FILL && f < FULL_FILL; });
  const remote = containers.find(c => c.remote && used(c) > 0);
  const pressureList = [...fullList, ...nearList];
  const showPressure = pressureList.length > 0;
  const pressureTitle = fullList.length
    ? `${fullList.length} container${fullList.length > 1 ? 's' : ''} full${nearList.length ? ` · ${nearList.length} nearly full` : ''}`
    : `${nearList.length} container${nearList.length > 1 ? 's' : ''} nearly full`;
  const pressureDesc = pressureList
    .map(c => `${c.name} ${Math.min(100, Math.round(fillOf(c) * 100))}%`)
    .join(' · ');

  const hogs = agg
    .map(it => ({ ...it, pct: aggCap ? it.qty / aggCap : 0 }))
    .filter(h => h.pct >= HOG_MIN_SHARE || h.qty >= HOG_MIN_QTY)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, HOG_LIMIT);

  const doHighlight = (locs: AggItem['locs']) => {
    setHighlight(locs.map(l => l.id));
    setTimeout(() => setHighlight([]), 2800);
  };

  const chips = [
    { key: 'all', label: 'All', color: '#C6BBA4', qty: scope.reduce((a, x) => a + x.qty, 0) },
    ...CATS.filter(([n]) => catTotals[n]).map(([n, c]) => ({ key: n, label: n, color: c, qty: catTotals[n] })),
  ];

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* sidebar (horizontal scroll strip on mobile, column on desktop) */}
      <div className="bw-scroll w-full flex-none overflow-x-auto border-b border-line bg-iron-850 px-2.5 py-2 md:max-h-none md:w-[246px] md:overflow-x-visible md:overflow-y-auto md:border-b-0 md:border-r md:py-3">
        <div className="hidden pt-1 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.7px] text-sand-400 md:block">Containers</div>
        <div className="flex flex-row gap-[3px] md:flex-col">
          {[null, ...containers].map(c => {
            const isAll = c === null;
            const id = isAll ? 'all' : c.id;
            const on = sel === id;
            const u = isAll ? totalQty : used(c);
            const f = !isAll && c.cap ? u / c.cap : 0;
            const pctR = Math.min(100, Math.round(f * 100));
            const hl = !isAll && highlight.includes(id);
            return (
              <button key={id} onClick={() => { setSel(id); setCat('all'); }} className={cn(
                'flex min-w-[168px] flex-none cursor-pointer flex-col gap-1.5 rounded-[9px] border py-2.5 px-[11px] text-left font-sans transition-[box-shadow,border-color] duration-200 md:w-full md:min-w-0',
                hl ? 'border-gold shadow-[0_0_0_1px_var(--color-gold),0_0_16px_rgba(224,167,60,.35)]'
                  : on ? 'border-[#4a3f2a] bg-gold/[.08]' : 'border-transparent',
              )}>
                <div className="flex items-center gap-[9px]">
                  <span className={cn('flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px]', on ? 'bg-gold/[.14]' : 'bg-row')}>
                    {isAll
                      ? <Icon name="home" size={15} color={on ? '#F4C868' : C.textDim} />
                      : <ItemImg cls={c.cls} size={20} fallback={<Icon name={c.icon} size={15} color={on ? '#F4C868' : C.textDim} />} />
                    }</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-sand-200">
                        {isAll ? 'All storage' : c.name}
                      </span>
                      {!isAll && c.cap != null && f >= FULL_FILL && (
                        <span data-tip="At capacity" className="inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-rust text-[9px] font-bold text-white">!</span>
                      )}
                    </div>
                    <div className="text-[10px] text-sand-600">
                      {isAll ? `Aggregate · ${agg.length}` : `${c.type} · ${c.items.length}`}
                      {!isAll && c.remote && <span className="text-brass"> · remote</span>}
                    </div>
                  </div>
                  {!isAll && c.cap == null && (
                    <span className="flex-none rounded-[5px] border border-[#37301F] py-0.5 px-1.5 text-[9px] uppercase tracking-[.4px] text-sand-400">buffer</span>
                  )}
                </div>
                {!isAll && c.cap != null && (
                  <div className="flex items-center gap-[7px]">
                    <div className="h-1 flex-1 overflow-hidden rounded-[2px] bg-white/[.08]">
                      <div className="h-full" style={{ width: `${pctR}%`, background: fillHex(f) }} />
                    </div>
                    <span className="whitespace-nowrap font-mono text-[9.5px] text-sand-600">{u} / {c.cap}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* main */}
      <div className="bw-scroll flex-1 overflow-y-auto">
        <div className="pt-4 px-4 pb-11 md:pt-5 md:px-6">
          <div className="mb-3.5">
            <h2 className="font-serif text-xl font-semibold text-sand-100">
              {container ? container.name : 'All storage'}
            </h2>
            <p className="mt-[3px] text-[12.5px] text-sand-400">
              {container
                ? `${container.type}${container.cap ? ` · cap ${container.cap}` : ' · buffer'} · ${container.items.length} item types`
                : `${containers.length} containers · ${agg.length} unique items`}
            </p>
          </div>

          {showPressure && (
            <div className="mb-3 flex items-start gap-[11px] rounded-[11px] border border-rust/40 bg-gradient-to-b from-rust/[.12] to-transparent py-[13px] px-[15px]">
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-rust/40 bg-rust/[.16] text-base font-bold text-rust-soft">!</span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-[15px] font-semibold text-[#EDBBA8]">{pressureTitle}</div>
                <div className="mt-0.5 text-[12.5px] text-[#C9B3A4]">
                  {pressureDesc} — consider a clear-out or more storage.
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="font-mono text-lg font-semibold" style={{ color: fillHex(aggFill) }}>{Math.round(aggFill * 100)}%</div>
                <div className="text-[9.5px] uppercase tracking-[.4px] text-sand-400">of total capacity used</div>
              </div>
            </div>
          )}

          {remote && (
            <div className="mb-3 flex items-center gap-[9px] rounded-[9px] border border-line-2 bg-[#1A160F] py-[9px] px-[13px] text-xs text-sand-400">
              <PinIcon size={14} color="#C99A4B" />
              <span><span className="text-[#DCD2BE]">{used(remote)} items</span> sitting in the remote {remote.name} awaiting pickup.</span>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { label: 'Total items', val: totalQty.toLocaleString(), color: C.textBright },
              { label: 'Unique items', val: String(agg.length), color: C.textBright },
              { label: 'Containers', val: String(containers.length), color: C.textBright },
              { label: 'Full / near', val: `${fullList.length} / ${nearList.length}`, color: fullList.length > 0 ? '#E0997F' : C.textBright },
            ].map(s => (
              <div key={s.label} className="rounded-[10px] border border-line-2 bg-iron-750 py-[11px] px-[13px]">
                <div className="font-mono text-xl font-semibold" style={{ color: s.color }}>{s.val}</div>
                <div className="mt-0.5 text-[10.5px] uppercase tracking-[.4px] text-sand-400">{s.label}</div>
              </div>
            ))}
          </div>

          {hogs.length > 0 && (
            <div className="mb-3.5 rounded-[11px] border border-line-2 bg-[#1A160F] py-[13px] px-[15px]">
              <div className="mb-3 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E0A73C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" /><rect x="7" y="9" width="3" height="9" /><rect x="12" y="5" width="3" height="13" /><rect x="17" y="12" width="3" height="6" />
                </svg>
                <span className="font-serif text-[15px] font-semibold text-[#D9CBB2]">Storage hogs</span>
                <span className="text-[11.5px] text-sand-400">— items eating the most space</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {hogs.map(h => {
                  const p = Math.round(h.pct * 100);
                  const action = h.name === 'Spoiled Food' ? 'Convert to fertiliser'
                    : h.cat === 'Food' ? 'Cook or sell the surplus' : 'Sell or ease production';
                  return (
                    <div key={h.name} className="flex items-center gap-[11px]">
                      <ItemImg cls={h.raw} size={20}
                        fallback={<span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: catColor[h.cat] ?? C.textDim }} />} />
                      <span className="w-[96px] flex-none overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-sand-200 md:w-[112px]">{h.name}</span>
                      <div className="h-[7px] min-w-[40px] flex-1 overflow-hidden rounded-[4px] bg-white/[.07]">
                        <div className="h-full" style={{ width: `${Math.min(100, p)}%`, background: p >= 20 ? '#C4553B' : p >= 12 ? '#E0A73C' : '#B08D57' }} />
                      </div>
                      <span className="w-[52px] flex-none text-right font-mono text-xs text-[#DCD2BE]">{h.qty.toLocaleString()}</span>
                      <span className="hidden w-[96px] flex-none text-[11px] text-sand-400 sm:inline">{p}% of capacity</span>
                      <span className="hidden flex-none whitespace-nowrap text-[11px] text-[#C9A85E] md:inline">{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-3.5 flex flex-wrap items-center gap-[9px]">
            <div className="flex h-8 items-center gap-2 rounded-lg border border-line-3 bg-ink px-[11px]">
              <SearchIcon size={13} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find item…"
                className="w-[120px] border-none bg-transparent font-sans text-[12.5px] text-sand-200 outline-none" />
            </div>
            {chips.map(ch => (
              <button key={ch.key} onClick={() => setCat(ch.key)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-[5px] px-[11px] font-sans text-xs',
                  cat === ch.key ? 'text-[#EDE4D2]' : 'border-line-3 bg-ink text-sand-400',
                )}
                style={cat === ch.key ? { borderColor: ch.color, background: `${ch.color}22` } : undefined}>
                <span className="h-2 w-2 rounded-[2px]" style={{ background: ch.color }} />
                {ch.label}
                <span className="font-mono text-[10.5px] opacity-70">{ch.qty}</span>
              </button>
            ))}
          </div>

          {items.length > 0 ? (
            <div className="overflow-hidden rounded-[11px] border border-[#241E17]">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr>
                    {['Item', 'Category', 'Qty', ...(sel === 'all' ? ['Location'] : [])].map((h, i) => (
                      <th key={h} className={cn(
                        'border-b border-line-2 bg-iron-700 py-[9px] px-3.5 text-[10.5px] font-semibold uppercase tracking-[.5px] text-sand-350',
                        i === 2 ? 'text-right' : 'text-left',
                        h === 'Category' && 'hidden sm:table-cell',
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.name} onClick={() => doHighlight(it.locs)} className="bw-row cursor-pointer">
                      <td className="border-b border-row py-2 px-2.5 text-sand-200 sm:px-3.5">
                        <span className="inline-flex items-center gap-[9px]">
                          <ItemImg cls={it.raw} size={22}
                            fallback={<span className="inline-block h-[22px] w-[22px] rounded bg-iron-650" />} />
                          {it.name}
                        </span>
                      </td>
                      <td className="hidden border-b border-row py-2 px-3.5 sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: catColor[it.cat] ?? C.textDim }}>
                          <span className="h-2 w-2 rounded-[2px]" style={{ background: catColor[it.cat] ?? C.textDim }} />
                          {it.cat}
                        </span>
                      </td>
                      <td className="border-b border-row py-2 px-3.5 text-right font-mono text-[#DCD2BE]">{it.qty}</td>
                      {sel === 'all' && (
                        <td className="border-b border-row py-2 px-3.5">
                          <span data-tip={it.locs.map(l => `${l.name} (${l.qty})`).join(', ')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#37301F] bg-iron-650 py-[3px] px-2.5 text-xs text-sand-300">
                            <PinIcon />
                            {it.locs.length === 1 ? it.locs[0].name : `${it.locs.length} containers`}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-[52px] px-5 text-center text-[13px] text-sand-600">
              No items match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
