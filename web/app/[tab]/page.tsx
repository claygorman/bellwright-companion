// Deep-linkable tab routes (/population /recruits /trends /insights /storage
// /map /me) — same world page, so a refresh keeps the active tab.
import { notFound } from 'next/navigation';
import WorldPage, { TAB_SLUGS, type TabSlug } from '../world-page';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { params: Promise<{ tab: string }> }) => {
  const { tab } = await params;
  if (!(TAB_SLUGS as readonly string[]).includes(tab)) notFound();
  return <WorldPage slug={tab as TabSlug} />;
};

export default Page;
