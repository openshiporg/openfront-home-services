import { q, companyTimeZone, localToday } from '../../lib/server';
import { Page } from '../../components/ui';
import { BookingWizard } from '../components/BookingWizard';

/** Book a job (CSR): customer → problem → window with room → hold → book. */
export default async function BookPage() {
  const [d, tz] = await Promise.all([
    q<{ jobTypes: { id: string; code: string; name: string; priority: string; businessUnit: { name: string } | null }[] }>(`{
      jobTypes(where: { active: { equals: true } }, orderBy: [{ name: asc }]) { id code name priority businessUnit { name } }
    }`),
    companyTimeZone(),
  ]);
  return (
    <Page title="Book a job">
      <BookingWizard timeZone={tz} today={localToday(tz)} jobTypes={d.jobTypes.map(t => ({ id: t.id, code: t.code, name: t.name, priority: t.priority, businessUnit: t.businessUnit?.name ?? '' }))} />
    </Page>
  );
}
