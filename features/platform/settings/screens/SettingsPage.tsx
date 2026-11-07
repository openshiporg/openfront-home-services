import Link from 'next/link';
import { q } from '../../lib/server';
import { money, bpsPercent, label, dateText, actionText, permissionText } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Stat, Status } from '../../components/ui';

type Company = {
  legalName: string; displayName: string; homeTimeZone: string; currencyCode: string; estimateValidityDays: number; recallWindowDays: number;
  discountApprovalThresholdBps: number; refundApprovalThresholdMinor: string; poApprovalThresholdMinor: string; arPeriodCloseDay: number; onboardingStatus: string; version: number;
} | null;
type Data = {
  companySettings: Company;
  contractorLicenses: { id: string; trade: string; issuer: string; licenseNumber: string; licenseClass: string; responsibleName: string; expiresOn: string | null }[];
  branches: { id: string; name: string; code: string; timeZone: string; city: string; region: string; calendar: { code: string } | null }[];
  businessUnits: { id: string; name: string; code: string; trade: string; kind: string; active: boolean; branch: { code: string } | null }[];
  serviceAreas: { id: string; name: string; zips: string[]; travelZone: string }[];
  businessCalendars: { id: string; code: string; name: string; kind: string; timeZone: string; coverageThrough: string; exceptionsCount: number }[];
  approvalPolicies: { id: string; action: string; description: string; requiredPermission: string; thresholdMinor: string | null; expiresAfterMinutes: number }[];
};

/** Company settings: who we are, where we work, and which controls need a second person. Edits go through maker-checker. */
export default async function SettingsPage() {
  const d = await q<Data>(`{
    companySettings { legalName displayName homeTimeZone currencyCode estimateValidityDays recallWindowDays discountApprovalThresholdBps refundApprovalThresholdMinor poApprovalThresholdMinor arPeriodCloseDay onboardingStatus version }
    contractorLicenses(orderBy: { trade: asc }) { id trade issuer licenseNumber licenseClass responsibleName expiresOn }
    branches { id name code timeZone city region calendar { code } }
    businessUnits(orderBy: { code: asc }) { id name code trade kind active branch { code } }
    serviceAreas { id name zips travelZone }
    businessCalendars { id code name kind timeZone coverageThrough exceptionsCount }
    approvalPolicies(orderBy: { action: asc }) { id action description requiredPermission thresholdMinor expiresAfterMinutes }
  }`);
  const c = d.companySettings;
  return (
    <Page title="Settings">
      {c ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat name="Company" value={c.displayName} />
          <Stat name="Time zone" value={<span className="text-base">{c.homeTimeZone}</span>} />
          <Stat name="Discounts above" value={bpsPercent(c.discountApprovalThresholdBps)} />
          <Stat name="Refunds above" value={money(c.refundApprovalThresholdMinor, c.currencyCode)} />
          <Stat name="Purchase orders above" value={money(c.poApprovalThresholdMinor, c.currencyCode)} />
          <Stat name="Estimates valid" value={`${c.estimateValidityDays} days`} />
          <Stat name="Recall window" value={`${c.recallWindowDays} days`} />
          <Stat name="Setup" value={<Status value={c.onboardingStatus} />} />
        </div>
      ) : <Empty>Company settings are not loaded yet. Use the setup card in the sidebar.</Empty>}

      <Section title="Licences">
        {d.contractorLicenses.length ? d.contractorLicenses.map(l => (
          <Row key={l.id}>
            <div className="min-w-0 space-y-1"><div className="font-medium">{l.issuer} {l.licenseNumber}</div><Meta>{label(l.trade)}{l.licenseClass ? ` · ${l.licenseClass}` : ''}{l.responsibleName ? ` · ${l.responsibleName}` : ''}</Meta></div>
            <Meta>{l.expiresOn ? `Expires ${dateText(l.expiresOn)}` : 'No expiry on file'}</Meta>
          </Row>
        )) : <Empty>No licences yet.</Empty>}
      </Section>

      <Section title="Branches and business units">
        {d.branches.map(b => (
          <Row key={b.id}>
            <div className="min-w-0 space-y-1"><div className="font-medium">{b.name} <span className="font-mono text-xs text-muted-foreground">{b.code}</span></div><Meta>{[b.city, b.region].filter(Boolean).join(', ')} · {b.timeZone}{b.calendar ? ` · calendar ${b.calendar.code}` : ''}</Meta></div>
          </Row>
        ))}
        {d.businessUnits.map(u => (
          <Row key={u.id}>
            <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{u.name}</span><span className="font-mono text-xs text-muted-foreground">{u.code}</span><Status value={u.active ? 'active' : 'retired'} /></div><Meta>{label(u.trade)} · {label(u.kind).toLowerCase()}{u.branch ? ` · ${u.branch.code}` : ''}</Meta></div>
          </Row>
        ))}
        {!d.branches.length && !d.businessUnits.length ? <Empty>No branches yet.</Empty> : null}
      </Section>

      <Section title="Service areas">
        {d.serviceAreas.length ? d.serviceAreas.map(a => (
          <Row key={a.id}>
            <div className="min-w-0 space-y-1"><div className="font-medium">{a.name}</div><Meta>{a.zips.length} ZIP codes · {label(a.travelZone)} travel</Meta></div>
            <Meta><span className="break-all font-mono">{a.zips.slice(0, 6).join(' ')}{a.zips.length > 6 ? ' …' : ''}</span></Meta>
          </Row>
        )) : <Empty>No service areas yet.</Empty>}
      </Section>

      <Section title="Calendars">
        {d.businessCalendars.length ? d.businessCalendars.map(cal => (
          <Row key={cal.id}>
            <div className="min-w-0 space-y-1"><div className="font-medium">{cal.name} <span className="font-mono text-xs text-muted-foreground">{cal.code}</span></div><Meta>{label(cal.kind)} · {cal.timeZone} · {cal.exceptionsCount} holidays</Meta></div>
            <Meta>Covers through {dateText(cal.coverageThrough)}</Meta>
          </Row>
        )) : <Empty>No calendars yet.</Empty>}
      </Section>

      <Section title="Approval policies" aside={<Link href="/dashboard/platform/approvals" className="text-xs underline">Approvals</Link>}>
        {d.approvalPolicies.length ? d.approvalPolicies.map(p => (
          <Row key={p.id}>
            <div className="min-w-0 flex-1 space-y-1"><div className="font-medium">{actionText(p.action)}</div><Meta>{p.description}</Meta></div>
            <Meta>{permissionText(p.requiredPermission)}{p.thresholdMinor ? ` · above ${money(p.thresholdMinor)}` : ''}</Meta>
          </Row>
        )) : <Empty>No approval policies yet.</Empty>}
      </Section>
    </Page>
  );
}
