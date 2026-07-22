// Server entry: load the newest world snapshot from SQLite, render the app.
import { desc } from 'drizzle-orm';
import { db, snapshots } from '@/db';
import { CompanionApp } from '@/components/bw/app';
import { SERIF } from '@/components/bw/ui';

export const dynamic = 'force-dynamic';

const Page = () => {
  const latest = db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1).get();
  if (!latest) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10, background: '#15120E', color: '#9a8f7d',
      }}>
        <div style={{ fontFamily: SERIF, fontSize: 22, color: '#F1E7D4' }}>No world ingested yet</div>
        <div style={{ fontSize: 13 }}>
          POST a save to <code style={{ color: '#E0A73C' }}>/api/ingest</code> — e.g.{' '}
          <code style={{ color: '#E0A73C' }}>
            curl -X POST --data-binary @YourChar_auto.sav http://localhost:8710/api/ingest
          </code>
        </div>
      </div>
    );
  }
  return <CompanionApp world={{ ...latest.world, snapshot_id: latest.id }} />;
};

export default Page;
