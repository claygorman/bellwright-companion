'use client';
// Insights tab — automated triage cards (real-data subset of the design).
import { avatarColor, initials } from '@/lib/bw/format';
import { npcName, type InsightCard } from '@/lib/bw/model';
import { Icon } from './icons';
import { Avatar } from './avatar';
import { C, MONO, SERIF, SEV, avatarStyle } from './ui';

export const Insights = ({ cards, villagerCount, onOpen }: {
  cards: InsightCard[]; villagerCount: number; onOpen: (guid: string) => void;
}) => (
  <div className="bw-scroll" style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ padding: '22px 24px 44px' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.textBright }}>Settlement insights</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.textDim2 }}>
          Automated triage &amp; suggestions across your {villagerCount} villagers.
        </p>
      </div>
      {cards.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12, alignItems: 'start' }}>
          {cards.map(c => {
            const s = SEV[c.severity];
            return (
              <div key={c.title} style={{
                border: `1px solid ${s.bd}`, background: `linear-gradient(180deg,${s.bg},transparent)`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 8, flex: '0 0 auto', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', background: s.bg, border: `1px solid ${s.bd}`,
                  }}><Icon name={c.icon} size={15} color={s.a} /></span>
                  <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, flex: '1 1 auto', color: s.c }}>{c.title}</span>
                  <span style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '1px 8px',
                    borderRadius: 999, color: s.a, background: s.bg, border: `1px solid ${s.bd}`,
                  }}>{c.items.length}</span>
                </div>
                <p style={{ margin: '0 0 11px', fontSize: 12, color: C.textDim, paddingLeft: 41 }}>{c.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingLeft: 41 }}>
                  {c.items.map(it => {
                    const name = npcName(it.npc);
                    const first = it.npc.first_name ?? name, last = it.npc.last_name ?? '';
                    return (
                      <button key={it.guid} onClick={() => onOpen(it.guid)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px 5px 5px',
                        background: C.cardBg, border: '1px solid #2E271E', borderRadius: 999,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        <Avatar v={it.npc} size={22} radius={6} />
                        <span style={{ fontSize: 12, color: C.text, whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontSize: 10.5, fontFamily: MONO, color: s.a }}>{it.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '64px 20px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 18, color: C.greenText, marginBottom: 6 }}>All clear</div>
          <div style={{ fontSize: 13, color: C.textFaint }}>
            No warnings or suggestions right now — the settlement is in good order.
          </div>
        </div>
      )}
    </div>
  </div>
);
