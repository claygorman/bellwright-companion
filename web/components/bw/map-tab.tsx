'use client';
// Map tab — placeholder terrain + live pins from save coordinates.
// Live layers: villagers + recruit candidates. Buildings/chests/camps need
// parser support (future pass).
import { useMemo, useState } from 'react';
import type { Npc } from '@/lib/types';
import { moraleColor, tplLabel } from '@/lib/bw/format';
import { combatTotal, npcName, professionOf } from '@/lib/bw/model';
import { Icon, SearchIcon } from './icons';
import { C, MONO, SERIF, searchBoxStyle, searchInputStyle } from './ui';

type LayerKey = 'villagers' | 'recruits';

const LAYERS: Record<LayerKey, { label: string; color: string; group: string; icon: string }> = {
  villagers: { label: 'My Villagers', color: '#E0A73C', group: 'Settlement', icon: 'person' },
  recruits: { label: 'Recruit Candidates', color: '#6FA88C', group: 'Scouting', icon: 'recruit' },
};
const GROUPS = ['Settlement', 'Scouting'];

type Pin = {
  key: string; layer: LayerKey; left: string; top: string;
  label: string; sub: string; desc: string; guid: string; npc: Npc;
};

const BOUNDS_PAD = 0.06;

export const MapTab = ({ villagers, recruits, region, onOpenProfile }: {
  villagers: Npc[]; recruits: Npc[]; region: string; onOpenProfile: (guid: string) => void;
}) => {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ villagers: true, recruits: true });
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [selKey, setSelKey] = useState<string | null>(null);

  const pins = useMemo<Pin[]>(() => {
    // UE is Z-up: ground plane = position[0], position[1]
    const src: { npc: Npc; layer: LayerKey }[] = [
      ...villagers.filter(v => v.position).map(npc => ({ npc, layer: 'villagers' as const })),
      ...recruits.filter(v => v.position).map(npc => ({ npc, layer: 'recruits' as const })),
    ];
    if (!src.length) return [];
    const xs = src.map(s => s.npc.position![0]), ys = src.map(s => s.npc.position![1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const spanX = Math.max(1, x1 - x0), spanY = Math.max(1, y1 - y0);
    const proj = (x: number, y: number) => ({
      left: `${(((x - x0) / spanX) * (1 - 2 * BOUNDS_PAD) + BOUNDS_PAD) * 88 + 6}%`,
      top: `${(((y - y0) / spanY) * (1 - 2 * BOUNDS_PAD) + BOUNDS_PAD) * 82 + 9}%`,
    });
    return src.map(({ npc, layer }) => {
      const p = proj(npc.position![0], npc.position![1]);
      const name = npcName(npc);
      return {
        key: `${layer}-${npc.guid ?? name}`, layer, ...p, label: name, npc,
        sub: layer === 'villagers'
          ? [professionOf(npc), tplLabel(npc.template)].filter(Boolean).join(' · ')
          : `${tplLabel(npc.template)}${npc.village ? ` · near ${npc.village}` : ''}`,
        desc: layer === 'villagers'
          ? `Settlement member.${npc.morale != null ? ` Morale ${Math.round(npc.morale)}.` : ''}`
          : `Scouted recruit — combat rating ${combatTotal(npc)}. Worth approaching for your warband.`,
        guid: npc.guid ?? name,
      };
    });
  }, [villagers, recruits]);

  const mq = q.trim().toLowerCase();
  const visible = pins.filter(p => layers[p.layer] && (!mq || p.label.toLowerCase().includes(mq)));
  const shown = pins.filter(p => layers[p.layer]).length;
  const selPin = selKey ? pins.find(p => p.key === selKey) ?? null : null;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 520, display: 'flex', background: '#0C0B08' }}>
      {/* sidebar */}
      <div className="bw-scroll" style={{
        width: 248, flex: '0 0 auto', borderRight: `1px solid ${C.border}`,
        background: C.panelBg, overflowY: 'auto', zIndex: 10,
      }}>
        <div style={{ padding: '14px 14px 10px' }}>
          <div style={{ ...searchBoxStyle(0), height: 'auto', padding: '8px 11px' }}>
            <SearchIcon />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the map…"
              style={{ ...searchInputStyle, fontSize: 12.5, width: '100%' }} />
          </div>
        </div>
        <div style={{
          margin: '0 14px 12px', padding: '11px 12px', border: '1px solid #2A231A', borderRadius: 9,
          background: 'linear-gradient(180deg,rgba(224,167,60,.06),transparent)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.5px',
            textTransform: 'uppercase', color: C.textDim2, marginBottom: 7,
          }}>
            <span>Scouting progress</span>
            <span style={{ fontFamily: MONO, color: 'var(--accent)' }}>{shown} / {pins.length}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pins.length ? Math.round((shown / pins.length) * 100) : 0}%`,
              background: 'linear-gradient(90deg,#C6892C,var(--gold))',
            }} />
          </div>
        </div>
        <div style={{ padding: '0 10px 16px' }}>
          {GROUPS.map(g => {
            const keys = (Object.keys(LAYERS) as LayerKey[]).filter(k => LAYERS[k].group === g);
            return (
              <div key={g} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 8px 6px' }}>
                  <span style={{ fontSize: 10, letterSpacing: '.7px', textTransform: 'uppercase', color: C.textDim2, fontWeight: 600 }}>{g}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.textFaint, background: '#201B15', padding: '1px 7px', borderRadius: 5 }}>
                    {keys.reduce((a, k) => a + pins.filter(p => p.layer === k).length, 0)}
                  </span>
                </div>
                {keys.map(k => {
                  const m = LAYERS[k], on = layers[k];
                  const count = pins.filter(p => p.layer === k).length;
                  return (
                    <button key={k} onClick={() => setLayers(s => ({ ...s, [k]: !s[k] }))} style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', border: 'none',
                      background: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12.5, color: on ? '#DCD2BE' : C.textFainter, width: '100%', textAlign: 'left',
                    }}>
                      <span style={{
                        width: 23, height: 23, borderRadius: 6, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flex: '0 0 auto', background: on ? `${m.color}22` : '#201B15',
                      }}><Icon name={m.icon} size={13} color={on ? m.color : C.textDisabled} /></span>
                      <span style={{ flex: '1 1 auto' }}>{m.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.textFaint }}>{count}</span>
                      <span style={{
                        width: 15, height: 15, borderRadius: 4, flex: '0 0 auto',
                        border: `1px solid ${on ? m.color : '#4a4030'}`, background: on ? m.color : 'transparent',
                      }} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0 16px 18px', fontSize: 10, color: C.textDisabled, lineHeight: 1.45 }}>
          Base map imagery pending — dark placeholder terrain. Pin coordinates are live from the save file.
          Building, loot-chest and bandit-camp layers arrive with the next parser pass.
        </div>
      </div>

      {/* canvas */}
      <div onClick={() => setSelKey(null)} style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 42% 38%, #221C13 0%, #17130D 55%, #0C0B08 100%)' }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: .5,
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(90,74,45,.25), transparent 40%), radial-gradient(circle at 68% 62%, rgba(60,66,50,.22), transparent 42%), radial-gradient(circle at 55% 20%, rgba(70,78,90,.14), transparent 38%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: .13,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 47px, #6b5f47 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, #6b5f47 48px)',
        }} />
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 160px 40px rgba(0,0,0,.7)', pointerEvents: 'none' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .5 }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M8 12 C 28 26, 22 44, 40 54 S 62 74, 82 92" fill="none" stroke="#3a4a55" strokeWidth="1.1" />
          <path d="M62 4 C 58 24, 70 34, 66 56" fill="none" stroke="#3a4a55" strokeWidth=".7" />
        </svg>

        {visible.map(p => {
          const m = LAYERS[p.layer];
          const sel2 = selKey === p.key, hov = hover === p.key;
          return (
            <div key={p.key}
              onClick={e => { e.stopPropagation(); setSelKey(p.key); }}
              onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
              style={{
                position: 'absolute', left: p.left, top: p.top, transform: 'translate(-50%,-100%)',
                zIndex: sel2 ? 40 : hov ? 30 : 10, cursor: 'pointer',
              }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50% 50% 50% 0',
                transform: `rotate(-45deg) scale(${sel2 ? 1.2 : hov ? 1.1 : 1})`,
                background: m.color, border: '2px solid rgba(0,0,0,.45)',
                boxShadow: `0 3px 8px rgba(0,0,0,.5)${sel2 ? `, 0 0 0 4px ${m.color}55` : ''}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .1s',
              }}>
                <span style={{ transform: 'rotate(45deg)', display: 'flex' }}>
                  <Icon name={m.icon} size={13} color="#14110b" />
                </span>
              </div>
              {hov && !sel2 && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap', background: C.inputBg, border: '1px solid #3A3128', borderRadius: 8,
                  padding: '6px 10px', boxShadow: '0 8px 24px rgba(0,0,0,.6)', zIndex: 60,
                  animation: 'bwfade .1s ease', pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright }}>{p.label}</div>
                  <div style={{ fontSize: 10.5, color: C.textDim2 }}>{p.sub}</div>
                </div>
              )}
            </div>
          );
        })}

        {!selPin && (
          <div style={{
            position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%',
            border: '1px solid #3A3128', background: 'rgba(17,14,10,.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 40, pointerEvents: 'none',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 2 L15 12 L12 10 L9 12 Z" fill="var(--accent)" />
              <path d="M12 22 L9 12 L12 14 L15 12 Z" fill="#5f5849" />
            </svg>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 4, zIndex: 40, pointerEvents: 'none',
        }}>
          <div style={{ width: 80, height: 5, border: '1px solid #6a6152', borderTop: 'none' }} />
          <span style={{ fontSize: 10, color: C.textDim2, fontFamily: MONO }}>500 m</span>
        </div>
        <div style={{
          position: 'absolute', bottom: 16, left: 16, fontFamily: SERIF, fontSize: 15,
          color: C.textDim2, letterSpacing: '.5px', zIndex: 40, pointerEvents: 'none',
        }}>{region}</div>

        {selPin && (
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 16, right: 16, width: 274, background: '#14110C',
            border: `1px solid ${C.border3}`, borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,.55)', zIndex: 55, animation: 'bwfade .14s ease',
          }}>
            <div style={{ height: 112, position: 'relative', background: `radial-gradient(circle at 42% 32%, ${LAYERS[selPin.layer].color}2e, #0c0a07)` }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .55 }}>
                <Icon name={LAYERS[selPin.layer].icon} size={40} color={LAYERS[selPin.layer].color} />
              </div>
              <span style={{
                position: 'absolute', top: 9, left: 11, fontSize: 9.5, letterSpacing: '.5px',
                textTransform: 'uppercase', color: '#B3A88F', background: 'rgba(0,0,0,.4)',
                padding: '2px 7px', borderRadius: 5,
              }}>{LAYERS[selPin.layer].label}</span>
              <button onClick={() => setSelKey(null)} style={{
                position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 6,
                border: 'none', background: 'rgba(0,0,0,.45)', color: '#DCD2BE', cursor: 'pointer',
                fontSize: 14, lineHeight: 1,
              }}>×</button>
            </div>
            <div style={{ padding: '13px 15px 15px' }}>
              <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: C.textSerifBright, lineHeight: 1.15 }}>{selPin.label}</div>
              <div style={{ fontSize: 11.5, color: LAYERS[selPin.layer].color, marginTop: 2 }}>{selPin.sub}</div>
              <p style={{ margin: '9px 0 0', fontSize: 12, lineHeight: 1.5, color: '#B3A88F' }}>{selPin.desc}</p>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textFainter, marginTop: 9 }}>
                [{Math.round(selPin.npc.position![0])}, {Math.round(selPin.npc.position![1])}]
              </div>
              <button onClick={() => { onOpenProfile(selPin.guid); setSelKey(null); }} style={{
                marginTop: 12, width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--accent)',
                background: 'rgba(224,167,60,.13)', color: 'var(--gold)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Open profile</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
