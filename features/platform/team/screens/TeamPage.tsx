import { q, companyTimeZone, localToday, plusDays, requestTime } from '../../lib/server';
import { label, when } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Tabs } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';

type Employee = {
  id: string; displayName: string; employeeNumber: string; kind: string; status: string; dispatchable: boolean;
  businessUnits: { name: string }[]; skills: { name: string }[];
  credentials: { id: string; kind: string; licenseClass: string; epaType: string; number: string; issuer: string; expiresOn: string | null; status: string; version: number; verifiedAt: string | null; verifiedBy: { name: string } | null }[];
};

/** Technicians (S§3): licences and EPA cards with expiry and maker-checker verification, shifts and the on-call rota. */
export default async function TeamPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const view = (await searchParams)?.view === 'oncall' ? 'oncall' : 'people';
  const tz = await companyTimeZone();
  const today = localToday(tz);
  const now = new Date(requestTime()).toISOString();
  const d = await q<{ employees: Employee[]; onCallRotations: { id: string; startsAt: string; endsAt: string; escalationOrder: number; businessUnit: { name: string } | null; employee: { displayName: string } | null }[]; expiring: number }>(`
    query Team($soon: CalendarDay!, $now: DateTime!) {
      employees(where: { status: { equals: "active" } }, orderBy: [{ displayName: asc }]) {
        id displayName employeeNumber kind status dispatchable businessUnits { name } skills { name }
        credentials(orderBy: [{ expiresOn: asc }]) { id kind licenseClass epaType number issuer expiresOn status version verifiedAt verifiedBy { name } }
      }
      onCallRotations(where: { endsAt: { gt: $now } }, orderBy: [{ startsAt: asc }, { escalationOrder: asc }], take: 40) { id startsAt endsAt escalationOrder businessUnit { name } employee { displayName } }
      expiring: credentialsCount(where: { status: { in: ["verified", "pending_verification"] }, expiresOn: { lte: $soon } })
    }`, { soon: plusDays(today, 60), now });
  const path = '/dashboard/platform/team';
  return (
    <Page title="Technicians">
      <Tabs active={view} items={[
        { key: 'people', label: 'People and credentials', href: path, count: d.employees.length },
        { key: 'oncall', label: 'On-call rota', href: `${path}?view=oncall` },
      ]} />
      {view === 'people' ? (
        <Section title={d.expiring ? `${d.expiring} credentials expire within 60 days` : 'People'}>
          {d.employees.map(e => (
            <div key={e.id} className="space-y-2 border-b py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{e.displayName} <span className="font-mono text-xs text-muted-foreground">{e.employeeNumber}</span></span>
                <Meta>{label(e.kind)} · {e.businessUnits.map(b => b.name).join(', ') || 'no department'}{e.dispatchable ? '' : ' · not dispatchable'}</Meta>
              </div>
              {e.skills.length ? <Meta>Skills: {e.skills.map(s => s.name).join(', ')}</Meta> : null}
              {e.credentials.map(c => {
                const expiring = c.expiresOn !== null && c.expiresOn <= plusDays(today, 60);
                return (
                  <Row key={c.id} className="pl-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{label(c.kind)}{c.licenseClass ? ` · ${label(c.licenseClass)}` : ''}{c.epaType ? ` · EPA ${label(c.epaType)}` : ''}</span>
                      <Meta> · {c.issuer} {c.number}{c.expiresOn ? ` · ${expiring ? 'expires' : 'valid to'} ${c.expiresOn}` : ''}{c.verifiedBy ? ` · verified by ${c.verifiedBy.name} ${when(c.verifiedAt, tz)}` : ''}</Meta>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {expiring ? <span className="text-xs text-amber-600">renew</span> : null}
                      <Status value={c.status} />
                      {c.status === 'pending_verification' ? <ActionButton op="verifyCredential" vars={{ credentialId: c.id, expectedVersion: c.version }} confirm="You checked the licence against the issuer's public lookup?" paths={[path]}>Verify</ActionButton> : null}
                      {c.status === 'verified' ? <ActionButton op="revokeCredential" vars={{ credentialId: c.id, expectedVersion: c.version }} ask="Why revoke this credential?" paths={[path]}>Revoke</ActionButton> : null}
                    </div>
                  </Row>
                );
              })}
            </div>
          ))}
        </Section>
      ) : (
        <Section title="Upcoming on-call">
          {d.onCallRotations.length ? d.onCallRotations.map(o => (
            <Row key={o.id}>
              <span className="text-sm"><span className="font-medium">{o.employee?.displayName}</span> <Meta>{o.businessUnit?.name} · {o.escalationOrder === 1 ? 'primary' : 'backup'}</Meta></span>
              <Meta>{when(o.startsAt, tz)} – {when(o.endsAt, tz)}</Meta>
            </Row>
          )) : <Empty>No on-call rota yet.</Empty>}
        </Section>
      )}
    </Page>
  );
}
