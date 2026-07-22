// Server entry: / is the Population tab (see app/[tab]/page.tsx for the rest).
import WorldPage from './world-page';

export const dynamic = 'force-dynamic';

const Page = () => <WorldPage slug="population" />;

export default Page;
