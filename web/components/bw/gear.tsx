'use client';
// Gear & kits panel (Insights tab) — driven by /api/gear: craft shortfalls,
// custom gear presets with their current effective picks, and re-equip
// suggestions (preset pick sitting in storage while the NPC wears less).
import { useEffect, useState } from 'react';
import { itemLabel } from '@/lib/bw/format';
import { Icon } from './icons';
import { ItemImg } from './item-img';
import { C, MONO, SERIF } from './ui';

type GearData = {
  presets: {
    key: string; name: string;
    members: { guid: string | null; name: string }[];
    picks: Record<string, string>;
  }[];
  craft: { item: string; need: number; equipped: number; stored: number; reserve: number; target: number; have: number; deficit: number }[];
  items: GearData['craft'];
  reequip: { name: string; slot: string; worn: string | null; pick: string }[];
  has_reserves: boolean;
};

const SLOT_ORDER = ['weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'backpack'];

const Card = ({ title, badge, badgeColor, children }: {
  title: string; badge?: string | number; badgeColor?: string; children: React.ReactNode;
}) => (
  <div style={{ border: `1px solid ${C.border2}`, background: C.cardBg, borderRadius: 12, padding: '14px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: C.textBright, flex: '1 1 auto' }}>{title}</span>
      {badge != null && (
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999,
          color: badgeColor ?? C.textDim, border: `1px solid ${C.border3}`, background: C.cardBg2,
        }}>{badge}</span>
      )}
    </div>
    {children}
  </div>
);

export const GearPanel = ({ onOpen }: { onOpen: (guid: string) => void }) => {
  const [data, setData] = useState<GearData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch('/api/gear', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr(true));
  }, []);
  if (err || !data) return null;
  const hasAny = data.presets.length > 0 || data.craft.length > 0;
  if (!hasAny) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.textBright }}>Gear &amp; kits</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.textDim2 }}>
          Kit coverage from your gear presets — what to craft, and who can gear up from storage.
          {!data.has_reserves && (
            <> Set flat spare targets in <span style={{ fontFamily: MONO, fontSize: 11.5 }}>kits.json</span> to plan for breakage.</>
          )}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12, alignItems: 'start' }}>

        {data.craft.length > 0 && (
          <Card title="Craft list" badge={data.craft.reduce((s, x) => s + x.deficit, 0)} badgeColor={C.redText}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.craft.map(x => (
                <div key={x.item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <ItemImg cls={x.item} size={22} fallback={<Icon name="pouch" size={16} color={C.textFaint} />} />
                  <span style={{ flex: '1 1 auto', fontSize: 12.5, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemLabel(x.item)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.textFaint, whiteSpace: 'nowrap' }}>
                    {x.have}/{x.target}{x.reserve > 0 ? ` (+${x.reserve} spare)` : ''}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.redText,
                    padding: '0 7px', borderRadius: 999, background: 'rgba(196,85,59,.12)', border: '1px solid rgba(196,85,59,.3)',
                  }}>+{x.deficit}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.reequip.length > 0 && (
          <Card title="Gear up from storage" badge={data.reequip.length} badgeColor={C.blueText}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.reequip.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: C.text, whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.textFainter, textTransform: 'uppercase' }}>{r.slot}</span>
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textDim, textAlign: 'right' }}>
                    {r.worn ? itemLabel(r.worn) : 'empty'} → <span style={{ color: C.blueText }}>{itemLabel(r.pick)}</span>
                  </span>
                  <ItemImg cls={r.pick} size={20} fallback={<Icon name="pouch" size={14} color={C.textFaint} />} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.presets.map(p => (
          <Card key={p.key} title={p.name} badge={p.members.length} badgeColor={C.gold as string}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: p.members.length ? 10 : 0 }}>
              {SLOT_ORDER.filter(s => p.picks[s]).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.textFainter, textTransform: 'uppercase', width: 62, flex: '0 0 auto' }}>{s}</span>
                  <ItemImg cls={p.picks[s]} size={18} fallback={<Icon name="pouch" size={13} color={C.textFaint} />} />
                  <span style={{ fontSize: 12, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemLabel(p.picks[s])}</span>
                </div>
              ))}
            </div>
            {p.members.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, borderTop: `1px solid ${C.borderRow}`, paddingTop: 9 }}>
                {p.members.map(m => (
                  <button key={m.guid ?? m.name} onClick={() => m.guid && onOpen(m.guid)} style={{
                    fontSize: 11, color: C.textDim, background: C.cardBg2, border: `1px solid ${C.border2}`,
                    borderRadius: 999, padding: '2px 9px', cursor: m.guid ? 'pointer' : 'default', fontFamily: 'inherit',
                  }}>{m.name}</button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
