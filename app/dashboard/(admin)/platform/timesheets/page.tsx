import { TimesheetsPage } from '@/features/platform/labour/screens/pages';

export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return <TimesheetsPage status={(await searchParams).status} />;
}
