import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { keystoneContext } from '@/features/keystone/context';
import { cancelOnline } from '@/features/keystone/services/memberships';
import { money } from '@/features/platform/lib/format';
import { container, field, PageTitle } from '@/features/storefront/components/Shell';

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
    <>
      <PageTitle title={m.plan?.name ?? 'Membership'} lead={`${name}${m.customer?.displayName ? ` · ${m.customer.displayName}` : ''}${m.location ? ` · ${m.location.address1}, ${m.location.city}` : ''}`} />
      <div className={`${container} mt-8 max-w-[860px]`}>
        {ended ? (
          <section className="border-y border-[#d9dcdf] py-5">
            <p className="flex items-center gap-2.5 text-[20px] font-bold"><span aria-hidden="true" className="inline-block size-3 rounded-full bg-[#c8321e]" />{m.status === 'cancelled' ? 'This membership is cancelled.' : 'This membership was moved to the new owner of the home.'}</p>
            {m.status === 'cancelled' ? <p className="mt-2 text-[17px] leading-snug">{m.cancelEffectiveOn ? `It ended on ${day(m.cancelEffectiveOn)}. ` : ''}{m.refundOwedMinor && m.refundOwedMinor > 0n ? `We owe you a refund of ${money(m.refundOwedMinor.toString())}. The office will send it to you.` : 'No refund is due.'}</p> : null}
          </section>
        ) : (
          <section className="border-y border-[#d9dcdf] py-5">
            <p className="flex items-center gap-2.5 text-[20px] font-bold"><span aria-hidden="true" className="inline-block size-3 rounded-full bg-[#1e9e4a]" />Your membership is on.</p>
            <p className="mt-2 text-[17px] leading-snug">{m.autoRenew ? `Your membership renews automatically${endsOn ? ` after ${day(endsOn)}` : ''}. Cancel here at any time and it will not renew.` : `Your membership runs until ${endsOn ? day(endsOn) : 'the end of the term'} and does not renew by itself.`}</p>
            <form action={cancel} className="mt-6 max-w-xl">
              <input type="hidden" name="code" value={code} />
              <label className="block text-[15px] font-bold" htmlFor="reason">Anything you would like us to know? (optional)</label>
              <input id="reason" name="reason" maxLength={300} className={`${field} mt-1.5`} />
              <button type="submit" className="mt-4 inline-flex min-h-12 items-center rounded-[5px] border border-[#b3261e] bg-white px-5 text-[16px] font-bold text-[#b3261e] hover:bg-[#fdf1f0]">Cancel my membership</button>
            </form>
            <p className="mt-3 text-[15px] text-[#3d4347]">Cancelling ends the membership right away. You will see this page confirm it.</p>
          </section>
        )}
      </div>
    </>
  );
}
