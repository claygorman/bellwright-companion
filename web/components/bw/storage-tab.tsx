'use client';
// Storage tab — container sidebar with fill bars + aggregate item census.
import { useMemo, useState } from 'react';
import { CATS, type ContainerVM } from '@/lib/bw/storage';
import { Icon, PinIcon, SearchIcon } from './icons';
import { ItemImg } from './item-img';
import { C, MONO, SERIF, miniBar, searchBoxStyle, searchInputStyle } from './ui';

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
    <div style={{ height: '100%', display: 'flex' }}>
      {/* sidebar */}
      <div className="bw-scroll" style={{
        width: 246, flex: '0 0 auto', borderRight: `1px solid ${C.border}`,
        background: C.panelBg, overflowY: 'auto', padding: '12px 10px',
      }}>
        <div style={{ fontSize: 10, letterSpacing: '.7px', textTransform: 'uppercase', color: C.textDim2, fontWeight: 600, padding: '4px 8px 8px' }}>Containers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[null, ...containers].map(c => {
            const isAll = c === null;
            const id = isAll ? 'all' : c.id;
            const on = sel === id;
            const u = isAll ? totalQty : used(c);
            const f = !isAll && c.cap ? u / c.cap : 0;
            const pctR = Math.min(100, Math.round(f * 100));
            const hl = !isAll && highlight.includes(id);
            return (
              <button key={id} onClick={() => { setSel(id); setCat('all'); }} style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 11px', borderRadius: 9,
                cursor: 'pointer', width: '100%', fontFamily: 'inherit', textAlign: 'left',
                transition: 'box-shadow .2s,border-color .2s',
                border: `1px solid ${hl ? 'var(--accent)' : on ? '#4a3f2a' : 'transparent'}`,
                background: on ? 'rgba(224,167,60,.08)' : 'transparent',
                ...(hl ? { boxShadow: '0 0 0 1px var(--accent),0 0 16px rgba(224,167,60,.35)' } : {}),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 7, flex: '0 0 auto', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: on ? 'rgba(224,167,60,.14)' : '#201B15',
                  }}>{isAll
                    ? <Icon name="home" size={15} color={on ? '#F4C868' : C.textDim} />
                    : <ItemImg cls={c.cls} size={20} fallback={<Icon name={c.icon} size={15} color={on ? '#F4C868' : C.textDim} />} />
                  }</span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isAll ? 'All storage' : c.name}
                      </span>
                      {!isAll && c.cap != null && f >= FULL_FILL && (
                        <span data-tip="At capacity" style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14,
                          borderRadius: '50%', background: C.red, color: '#fff', fontSize: 9, fontWeight: 700, flex: '0 0 auto',
                        }}>!</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.textFaint }}>
                      {isAll ? `Aggregate · ${agg.length}` : `${c.type} · ${c.items.length}`}
                      {!isAll && c.remote && <span style={{ color: '#C99A4B' }}> · remote</span>}
                    </div>
                  </div>
                  {!isAll && c.cap == null && (
                    <span style={{
                      fontSize: 9, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textDim2,
                      border: '1px solid #37301F', borderRadius: 5, padding: '2px 6px', flex: '0 0 auto',
                    }}>buffer</span>
                  )}
                </div>
                {!isAll && c.cap != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ flex: '1 1 auto', ...miniBar('100%', 4, pctR, fillHex(f)).outer }}>
                      <div style={miniBar('100%', 4, pctR, fillHex(f)).inner} />
                    </div>
                    <span style={{ fontSize: 9.5, fontFamily: MONO, color: C.textFaint, whiteSpace: 'nowrap' }}>{u} / {c.cap}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* main */}
      <div className="bw-scroll" style={{ flex: '1 1 auto', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px 44px' }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.textBright }}>
              {container ? container.name : 'All storage'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: C.textDim2 }}>
              {container
                ? `${container.type}${container.cap ? ` · cap ${container.cap}` : ' · buffer'} · ${container.items.length} item types`
                : `${containers.length} containers · ${agg.length} unique items`}
            </p>
          </div>

          {showPressure && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, border: '1px solid rgba(196,85,59,.4)',
              background: 'linear-gradient(180deg,rgba(196,85,59,.12),transparent)', borderRadius: 11,
              padding: '13px 15px', marginBottom: 12,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'rgba(196,85,59,.16)', border: '1px solid rgba(196,85,59,.4)',
                color: '#E0997F', fontSize: 16, fontWeight: 700,
              }}>!</span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#EDBBA8' }}>{pressureTitle}</div>
                <div style={{ fontSize: 12.5, color: '#C9B3A4', marginTop: 2 }}>
                  {pressureDesc} — consider a clear-out or more storage.
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: fillHex(aggFill) }}>{Math.round(aggFill * 100)}%</div>
                <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.4px', color: C.textDim2 }}>of total capacity used</div>
              </div>
            </div>
          )}

          {remote && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: C.textDim,
              border: `1px solid ${C.border2}`, background: C.cardBg2, borderRadius: 9,
              padding: '9px 13px', marginBottom: 12,
            }}>
              <PinIcon size={14} color="#C99A4B" />
              <span><span style={{ color: '#DCD2BE' }}>{used(remote)} items</span> sitting in the remote {remote.name} awaiting pickup.</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total items', val: totalQty.toLocaleString(), color: C.textBright },
              { label: 'Unique items', val: String(agg.length), color: C.textBright },
              { label: 'Containers', val: String(containers.length), color: C.textBright },
              { label: 'Full / near', val: `${fullList.length} / ${nearList.length}`, color: fullList.length > 0 ? '#E0997F' : C.textBright },
            ].map(s => (
              <div key={s.label} style={{ background: C.cardBg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10.5, letterSpacing: '.4px', textTransform: 'uppercase', color: C.textDim2, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {hogs.length > 0 && (
            <div style={{ border: `1px solid ${C.border2}`, background: C.cardBg2, borderRadius: 11, padding: '13px 15px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E0A73C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" /><rect x="7" y="9" width="3" height="9" /><rect x="12" y="5" width="3" height="13" /><rect x="17" y="12" width="3" height="6" />
                </svg>
                <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#D9CBB2' }}>Storage hogs</span>
                <span style={{ fontSize: 11.5, color: C.textDim2 }}>— items eating the most space</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hogs.map(h => {
                  const p = Math.round(h.pct * 100);
                  const action = h.name === 'Spoiled Food' ? 'Convert to fertiliser'
                    : h.cat === 'Food' ? 'Cook or sell the surplus' : 'Sell or ease production';
                  return (
                    <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <ItemImg cls={h.raw} size={20}
                        fallback={<span style={{ width: 8, height: 8, borderRadius: 2, background: catColor[h.cat] ?? C.textDim, flex: '0 0 auto' }} />} />
                      <span style={{ width: 112, flex: '0 0 auto', fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                      <div style={{ flex: '1 1 auto', minWidth: 40, height: 7, borderRadius: 4, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, p)}%`, background: p >= 20 ? '#C4553B' : p >= 12 ? '#E0A73C' : '#B08D57' }} />
                      </div>
                      <span style={{ width: 52, flex: '0 0 auto', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: '#DCD2BE' }}>{h.qty.toLocaleString()}</span>
                      <span style={{ width: 96, flex: '0 0 auto', fontSize: 11, color: C.textDim2 }}>{p}% of capacity</span>
                      <span style={{ flex: '0 0 auto', fontSize: 11, color: '#C9A85E', whiteSpace: 'nowrap' }}>{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={searchBoxStyle(32)}>
              <SearchIcon size={13} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find item…"
                style={{ ...searchInputStyle, fontSize: 12.5, width: 120 }} />
            </div>
            {chips.map(ch => (
              <button key={ch.key} onClick={() => setCat(ch.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                border: `1px solid ${cat === ch.key ? ch.color : '#2E271E'}`,
                background: cat === ch.key ? `${ch.color}22` : C.inputBg,
                color: cat === ch.key ? '#EDE4D2' : C.textDim,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
                {ch.label}
                <span style={{ fontFamily: MONO, fontSize: 10.5, opacity: .7 }}>{ch.qty}</span>
              </button>
            ))}
          </div>

          {items.length > 0 ? (
            <div style={{ border: '1px solid #241E17', borderRadius: 11, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Item', 'Category', 'Qty', ...(sel === 'all' ? ['Location'] : [])].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 2 ? 'right' : 'left', padding: '9px 14px', background: C.headBg,
                        borderBottom: `1px solid ${C.border2}`, color: '#B7A98F', fontSize: 10.5,
                        letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 600,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.name} onClick={() => doHighlight(it.locs)} className="bw-row"
                      style={{ borderBottom: `1px solid ${C.borderRow}`, cursor: 'pointer' }}>
                      <td style={{ padding: '8px 14px', color: C.text, borderBottom: `1px solid ${C.borderRow}` }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                          <ItemImg cls={it.raw} size={22}
                            fallback={<span style={{ width: 22, height: 22, borderRadius: 4, background: '#211C15', display: 'inline-block' }} />} />
                          {it.name}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: `1px solid ${C.borderRow}` }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: catColor[it.cat] ?? C.textDim }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor[it.cat] ?? C.textDim }} />
                          {it.cat}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: MONO, color: '#DCD2BE', borderBottom: `1px solid ${C.borderRow}` }}>{it.qty}</td>
                      {sel === 'all' && (
                        <td style={{ padding: '8px 14px', borderBottom: `1px solid ${C.borderRow}` }}>
                          <span data-tip={it.locs.map(l => `${l.name} (${l.qty})`).join(', ')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#C6BBA4',
                            border: '1px solid #37301F', background: '#211C15', borderRadius: 999, padding: '3px 10px',
                          }}>
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
            <div style={{ textAlign: 'center', padding: '52px 20px', color: C.textFaint, fontSize: 13 }}>
              No items match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
