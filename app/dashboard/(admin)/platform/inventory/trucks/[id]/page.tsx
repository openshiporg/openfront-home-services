import { TruckPage } from '@/features/platform/operations/screens/pages';

export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TruckPage id={id} />;
}
