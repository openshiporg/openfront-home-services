import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { keystoneContext } from '@/features/keystone/context';
import { cancelOnline } from '@/features/keystone/services/memberships';
import { money } from '@/features/platform/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your membership', robots: { index: false, follow: false } };

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(d) : '');
const CODE = /^MBR-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

async function cancel(formData: FormData) {
  'use server';
  const code = String(formData.get('code') ?? '');
  const reason = String(formData.get('reason') ?? '');
  try { await cancelOnline(keystoneContext.prisma as never, { publicCode: code, reason }); } catch { /* the page shows the current state */ }
  revalidatePath(`/membership/${code}`);
}

/** The customer's own link: see the membership and cancel it online. The work happens in the request. */
export default async function MembershipPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  if (!CODE.test(code)) notFound();
  const m = await (keystoneContext.prisma as any).membership.findUnique({
    where: { publicCode: code },
    select: {
      publicCode: true, status: true, autoRenew: true, cancelEffectiveOn: true, refundOwedMinor: true,
      customer: { select: { displayName: true } }, plan: { select: { name: true } }, location: { select: { address1: true, city: true } },
      terms: { where: { status: 'active' }, orderBy: { termNumber: 'desc' }, take: 1, select: { endsOn: true } },
    },
  });
  if (!m) notFound();
  const company = await (keystoneContext.prisma as any).companySettings.findFirst({ select: { displayName: true, legalName: true } });
  const name = company?.displayName || company?.legalName || 'Your service company';
  const ended = m.status === 'cancelled' || m.status === 'transferred';
  const endsOn: Date | null = m.terms[0]?.endsOn ?? null;
  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">{name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{m.plan?.name ?? 'Membership'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{m.customer?.displayName}{m.location ? ` · ${m.location.address1}, ${m.location.city}` : ''}</p>
      </div>
      {ended ? (
        <section className="space-y-2 rounded-md border p-4">
          <p className="font-medium">{m.status === 'cancelled' ? 'This membership is cancelled.' : 'This membership was moved to the new owner of the home.'}</p>
          {m.status === 'cancelled' ? <p className="text-sm text-muted-foreground">{m.cancelEffectiveOn ? `It ended on ${day(m.cancelEffectiveOn)}. ` : ''}{m.refundOwedMinor && m.refundOwedMinor > 0n ? `We owe you a refund of ${money(m.refundOwedMinor.toString())}. The office will send it to you.` : 'No refund is due.'}</p> : null}
        </section>
      ) : (
        <section className="space-y-4 rounded-md border p-4">
          <p className="text-sm">{m.autoRenew ? `Your membership renews automatically${endsOn ? ` after ${day(endsOn)}` : ''}. Cancel here at any time and it will not renew.` : `Your membership runs until ${endsOn ? day(endsOn) : 'the end of the term'} and does not renew by itself.`}</p>
          <form action={cancel} className="space-y-3">
            <input type="hidden" name="code" value={code} />
            <label className="block text-sm" htmlFor="reason">Anything you would like us to know? (optional)</label>
            <input id="reason" name="reason" maxLength={300} className="h-11 w-full rounded-md border bg-background px-3 text-sm" />
            <button type="submit" className="inline-flex h-11 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white">Cancel my membership</button>
          </form>
          <p className="text-xs text-muted-foreground">Cancelling ends the membership right away. You will see this page confirm it.</p>
        </section>
      )}
    </main>
  );
}
