import { q, companyTimeZone } from '../../lib/server';
import { dateText, label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status } from '../../components/ui';

type SourceRef = { ref: string; url?: string; verified: boolean; checkedOn?: string; note?: string };
type Pack = {
  id: string; code: string; name: string; kind: string; jurisdictionCode: string; description: string;
  versions: { id: string; versionNumber: number; status: string; effectiveFrom: string; effectiveTo: string | null; contentHash: string; verifiedAt: string | null; sourceRefs: SourceRef[] }[];
  bindings: { id: string; scope: string; scopeValue: string; priority: number; status: string }[];
};

/**
 * Jurisdiction policy packs (DOMAIN §7). Each version cites its sources; an unverified source is
 * shown as such, and the rule engine refuses to guess when no version, or more than one, applies.
 */
export default async function PoliciesPage() {
  const [d, tz] = await Promise.all([
    q<{ policyPacks: Pack[] }>(`{
      policyPacks(orderBy: { code: asc }) {
        id code name kind jurisdictionCode description
        versions(orderBy: { versionNumber: desc }) { id versionNumber status effectiveFrom effectiveTo contentHash verifiedAt sourceRefs }
        bindings { id scope scopeValue priority status }
      }
    }`),
    companyTimeZone(),
  ]);
  return (
    <Page title="Policies">
      <p className="max-w-3xl text-sm text-muted-foreground">Rules that change by place and date: cancellation rights, calling hours, call recording, sales tax, licensing, liens and wage-hour. The most specific active binding wins; overlapping versions or tied bindings stop the action until someone fixes the policy.</p>
      {d.policyPacks.length ? d.policyPacks.map(p => (
        <Section key={p.id} title={`${label(p.kind)} · ${p.jurisdictionCode}`}>
          <Row>
            <div className="min-w-0 flex-1 space-y-1"><div className="font-medium">{p.name}</div><Meta><span className="font-mono">{p.code}</span>{p.description ? ` · ${p.description}` : ''}</Meta></div>
            <Meta>{p.bindings.map(b => `${label(b.scope)}${b.scopeValue ? ` ${b.scopeValue}` : ''} (${label(b.status).toLowerCase()})`).join(', ') || 'Not in use'}</Meta>
          </Row>
          {p.versions.map(v => (
            <Row key={v.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Version {v.versionNumber}</span><Status value={v.status} /></div>
                <Meta>From {dateText(v.effectiveFrom)}{v.effectiveTo ? ` to ${dateText(v.effectiveTo)}` : ''} · hash <span className="font-mono">{v.contentHash.slice(0, 12)}</span>{v.verifiedAt ? ` · verified ${when(v.verifiedAt, tz, 'day')}` : ''}</Meta>
                <ul className="space-y-0.5 text-xs">
                  {(v.sourceRefs ?? []).map((s, i) => (
                    <li key={i} className="break-words">
                      <span className={s.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{s.verified ? 'Verified' : 'To verify'}</span>
                      {' · '}{s.url ? <a href={s.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">{s.ref}</a> : s.ref}
                      {s.checkedOn ? ` · checked ${dateText(s.checkedOn)}` : ''}{s.note ? ` · ${s.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </Row>
          ))}
        </Section>
      )) : <Empty>No policy packs yet. Load the company from the setup card to add the federal and Texas packs.</Empty>}
    </Page>
  );
}
