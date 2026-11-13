import { notFound } from 'next/navigation';
import { keystoneContext } from '@/features/keystone/context';
import { stockSummary } from '@/features/keystone/services/inventory';
import { registrationList } from '@/features/keystone/services/warranty';
import { lienList } from '@/features/keystone/services/compliance';
import { advanceTimedStates } from '@/features/keystone/services/maintenance';
import { viewer } from '../../lib/server';
import { money, dateText, label, quantity } from '../../lib/format';
import { Page, Row, Empty, Meta, Section, Status, Stat } from '../../components/ui';
import { ActionButton } from '../../components/ActionButton';
import { CommandForm } from '../../components/CommandForm';

/*
 * Equipment, warranty, stock, purchasing, permits, refrigerant and liens. Plain server screens over the Phase 5 commands. Costs show only
 * to people who may buy; nothing here sends anything outside.
 */

const db = () => keystoneContext.prisma as never as any;
type Viewer = Awaited<ReturnType<typeof viewer>>;
async function gate(...perms: string[]) {
  const me = await viewer();
  if (!perms.some(p => me.can(p))) notFound();
  await advanceTimedStates(keystoneContext.prisma as never);
  return me;
}
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const csv = (href: string) => <a className="inline-flex h-11 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm md:h-8" href={href}>Export CSV</a>;
const opt = (rows: { id: string; name?: string; code?: string; ref?: string; sku?: string }[]) => rows.map(r => ({ value: r.id, label: r.name ?? r.code ?? r.ref ?? r.sku ?? r.id }));

// ── Equipment ───────────────────────────────────────────────────────────────────────────────────────────────────

export async function EquipmentPage() {
  await gate('canManageEquipment', 'canSubmitWarrantyClaims', 'canDispatch', 'canWorkVisits');
  const rows = await db().installedEquipment.findMany({ where: { status: { in: ['active', 'unknown'] } }, orderBy: [{ locationId: 'asc' }, { installDate: 'desc' }], take: 300, select: { id: true, ref: true, manufacturer: true, modelNumber: true, serialNumber: true, kind: true, installDate: true, refrigerantType: true, location: { select: { id: true, address1: true, city: true, customer: { select: { displayName: true } } } }, from_WarrantyCoverage_equipment: { select: { kind: true, endsOn: true } } } });
  const locations = await db().serviceLocation.findMany({ take: 100, orderBy: { address1: 'asc' }, select: { id: true, address1: true, city: true } });
  const today = new Date().toISOString().slice(0, 10);
  const groups = new Map<string, any[]>();
  for (const r of rows) groups.set(r.location?.id ?? 'none', [...(groups.get(r.location?.id ?? 'none') ?? []), r]);
  return (
    <Page title="Equipment">
      <Section title="Record equipment">
        <CommandForm op="recordEquipment" submit="Record equipment" paths={['/dashboard/platform/equipment']} fields={[
          { name: 'locationId', label: 'Location', kind: 'select', required: true, width: 'lg', options: locations.map((l: any) => ({ value: l.id, label: `${l.address1}, ${l.city}` })) },
          { name: 'manufacturer', label: 'Maker', required: true }, { name: 'modelNumber', label: 'Model', required: true }, { name: 'serialNumber', label: 'Serial', required: true },
          { name: 'kind', label: 'Kind', kind: 'select', options: ['ac_condenser', 'furnace', 'heat_pump', 'mini_split', 'water_heater_tank', 'water_heater_tankless', 'other'].map(v => ({ value: v, label: label(v) })) },
          { name: 'installDate', label: 'Installed', kind: 'date', width: 'sm' }, { name: 'refrigerantType', label: 'Refrigerant', width: 'sm' },
        ]} />
      </Section>
      {[...groups.entries()].map(([key, list]) => (
        <Section key={key} title={`${list[0].location?.customer?.displayName ?? 'Unplaced'} · ${list[0].location?.address1 ?? ''}, ${list[0].location?.city ?? ''}`}>
          {list.map((e: any) => (
            <Row key={e.id}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{e.manufacturer} {e.modelNumber}</span><Meta>{label(e.kind)} · serial {e.serialNumber} · {e.ref}</Meta></div>
                <Meta>{e.installDate ? `Installed ${dateText(ymd(e.installDate))}` : 'Install date unknown'}{e.refrigerantType ? ` · ${e.refrigerantType}` : ''}</Meta>
                <div className="flex flex-wrap gap-2">{e.from_WarrantyCoverage_equipment.map((c: any, i: number) => <Status key={i} value={c.endsOn && ymd(c.endsOn)! < today ? 'expired' : 'active'} />)}{e.from_WarrantyCoverage_equipment.length ? <Meta>{e.from_WarrantyCoverage_equipment.map((c: any) => `${label(c.kind)} to ${dateText(ymd(c.endsOn))}`).join(' · ')}</Meta> : <Meta>No warranty on file</Meta>}</div>
              </div>
              <ActionButton op="openWarrantyClaim" vars={{ equipmentId: e.id }} paths={['/dashboard/platform/warranty/claims']}>Start claim</ActionButton>
            </Row>
          ))}
        </Section>
      ))}
      {!rows.length ? <Section title="Installed equipment"><Empty>No equipment recorded yet.</Empty></Section> : null}
    </Page>
  );
}

// ── Warranty ────────────────────────────────────────────────────────────────────────────────────────────────────

export async function RegistrationsPage() {
  await gate('canManageEquipment', 'canSubmitWarrantyClaims');
  const rows = await registrationList(keystoneContext.prisma as never);
  const paths = ['/dashboard/platform/warranty/registrations'];
  const late = rows.filter(r => r.effectiveStatus === 'overdue');
  return (
    <Page title="Warranty registrations">
      <div className="grid grid-cols-3 gap-2"><Stat name="Overdue" value={late.length} /><Stat name="Due" value={rows.filter(r => r.effectiveStatus === 'due').length} /><Stat name="Waiting for confirmation" value={rows.filter(r => r.effectiveStatus === 'submitted').length} /></div>
      <Section title={`Registrations · ${rows.length}`} aside={csv('/api/warranty-registrations/csv')}>
        {rows.length ? rows.map(r => (
          <Row key={r.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{r.equipment?.manufacturer} {r.equipment?.modelNumber}</span><Status value={r.effectiveStatus} /><Meta>{r.ref}</Meta></div>
              <Meta>Serial {r.equipment?.serialNumber} · {r.equipment?.location?.address1}, {r.equipment?.location?.city} · {r.daysLeft >= 0 ? `due ${dateText(r.deadline)} (${r.daysLeft} days)` : `${-r.daysLeft} days late`}</Meta>
              {r.effectiveStatus === 'overdue' ? <Meta>Registering late shortens the parts warranty to the unregistered term.</Meta> : null}
              <div className="flex flex-wrap gap-2">
                <a className="inline-flex h-8 items-center rounded-md border px-3 text-sm" href={`/dashboard/platform/warranty/registrations/${r.id}`}>Portal packet</a>
                {r.effectiveStatus !== 'submitted' ? <ActionButton op="markWarrantyRegistrationSubmitted" vars={{ registrationId: r.id, expectedVersion: r.version }} confirm="Registered on the manufacturer's site?" paths={paths}>Mark submitted</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>Nothing waiting to be registered.</Empty>}
      </Section>
    </Page>
  );
}

export async function RegistrationPacketPage({ id }: { id: string }) {
  await gate('canManageEquipment', 'canSubmitWarrantyClaims');
  const { registrationPacket } = await import('@/features/keystone/services/warranty');
  const packet = await registrationPacket(keystoneContext.prisma as never, id).catch(() => null);
  if (!packet) notFound();
  return (
    <Page title="Registration packet" crumbs={[{ label: 'Warranty registrations', href: '/dashboard/platform/warranty/registrations' }]}>
      <Section title="Copy these into the manufacturer's portal">
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">{typeof packet === 'string' ? packet : JSON.stringify(packet, null, 2)}</pre>
      </Section>
      <Section title="After you register">
        <CommandForm op="confirmWarrantyRegistration" fixed={{ registrationId: id }} submit="Record confirmation" paths={['/dashboard/platform/warranty/registrations']} fields={[{ name: 'confirmationNumber', label: 'Confirmation number', required: true }, { name: 'expectedVersion', label: 'Version', width: 'sm', defaultValue: String((await db().warrantyRegistration.findUnique({ where: { id }, select: { version: true } }))?.version ?? 0) }]} />
      </Section>
    </Page>
  );
}

export async function ClaimsPage() {
  const me = await gate('canSubmitWarrantyClaims', 'canManageEquipment');
  const rows = await db().warrantyClaim.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, ref: true, status: true, version: true, claimant: true, failedPart: true, claimedMinor: true, recoveredMinor: true, externalClaimNumber: true, deadline: true, equipment: { select: { manufacturer: true, modelNumber: true, serialNumber: true } } } });
  const paths = ['/dashboard/platform/warranty/claims'];
  return (
    <Page title="Warranty claims">
      <Section title={`Claims · ${rows.length}`} aside={csv('/api/warranty-claims/csv')}>
        {rows.length ? rows.map((c: any) => (
          <Row key={c.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{c.equipment?.manufacturer} {c.equipment?.modelNumber}</span><Status value={c.status} /><Meta>{c.ref}</Meta></div>
              <Meta>{c.failedPart || 'Failed part not entered'} · claimed {money(String(c.claimedMinor))} · recovered {money(String(c.recoveredMinor))}{c.externalClaimNumber ? ` · maker claim ${c.externalClaimNumber}` : ''}{c.deadline ? ` · file by ${dateText(ymd(c.deadline))}` : ''}</Meta>
              <div className="flex flex-wrap gap-2">
                {c.status === 'draft' ? <ActionButton op="markWarrantyClaimReady" vars={{ claimId: c.id, expectedVersion: c.version }} paths={paths}>Mark ready</ActionButton> : null}
                {c.status === 'ready' ? <ActionButton op="submitWarrantyClaim" vars={{ claimId: c.id, expectedVersion: c.version }} confirm="Filed on the manufacturer's portal?" paths={paths}>Mark filed</ActionButton> : null}
                {c.status === 'denied' ? <ActionButton op="appealWarrantyClaim" vars={{ claimId: c.id, expectedVersion: c.version }} ask="Why appeal?" paths={paths}>Appeal</ActionButton> : null}
                {c.status === 'denied' && me.can('canApproveWarrantyWriteOff') ? <ActionButton op="requestWarrantyWriteOff" vars={{ claimId: c.id }} ask="Why write it off?" paths={paths}>Ask to write off</ActionButton> : null}
                {['approved', 'partially_approved'].includes(c.status) ? <ActionButton op="settleWarrantyClaim" vars={{ claimId: c.id, expectedVersion: c.version }} ask="Payment or credit reference" paths={paths}>Mark paid</ActionButton> : null}
                {c.status === 'settled' ? <ActionButton op="closeWarrantyClaim" vars={{ claimId: c.id, expectedVersion: c.version }} paths={paths}>Close</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>No warranty claims yet. Start one from Equipment.</Empty>}
      </Section>
    </Page>
  );
}

export async function HomeWarrantyPage() {
  await gate('canSubmitWarrantyClaims', 'canManageEquipment', 'canDispatch');
  const rows = await db().homeWarrantyDispatch.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, externalDispatchNumber: true, status: true, version: true, serviceFeeMinor: true, authorizedMinor: true, note: true, payer: { select: { id: true, name: true } } } });
  const payers = await db().payerProfile.findMany({ take: 100, select: { id: true, name: true } });
  return (
    <Page title="Home warranty">
      <Section title="Log a dispatch from a home-warranty company">
        <CommandForm op="receiveHomeWarrantyDispatch" submit="Log dispatch" paths={['/dashboard/platform/home-warranty']} fields={[
          { name: 'payerId', label: 'Company', kind: 'select', required: true, options: opt(payers) }, { name: 'externalDispatchNumber', label: 'Their dispatch number', required: true }, { name: 'serviceFeeMinor', label: 'Service fee (cents)', width: 'sm' },
        ]} />
      </Section>
      <Section title={`Dispatches · ${rows.length}`}>
        {rows.length ? rows.map((d: any) => (
          <Row key={d.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{d.payer?.name ?? 'Company'} · {d.externalDispatchNumber}</span><Status value={d.status} /></div>
              <Meta>Service fee {money(String(d.serviceFeeMinor))} · authorized {money(String(d.authorizedMinor))}{d.note ? ` · ${d.note}` : ''}</Meta>
              <div className="flex flex-wrap gap-2">
                {d.status === 'received' ? <ActionButton op="advanceHomeWarrantyDispatch" vars={{ dispatchId: d.id, to: 'scheduled', expectedVersion: d.version }} paths={['/dashboard/platform/home-warranty']}>Scheduled</ActionButton> : null}
                {['received', 'scheduled', 'on_site'].includes(d.status) ? <ActionButton op="advanceHomeWarrantyDispatch" vars={{ dispatchId: d.id, to: 'declined', expectedVersion: d.version }} ask="Why?" paths={['/dashboard/platform/home-warranty']}>Decline</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>No dispatches logged.</Empty>}
      </Section>
    </Page>
  );
}

// ── Inventory ───────────────────────────────────────────────────────────────────────────────────────────────────

export async function InventoryPage({ kind }: { kind?: 'warehouse' | 'truck' } = {}) {
  const me = await gate('canManageInventory', 'canPurchase', 'canReceive', 'canWorkVisits');
  const levels = await stockSummary(keystoneContext.prisma as never, kind);
  const locations = await db().stockLocation.findMany({ where: { active: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, kind: true } });
  const by = new Map<string, typeof levels>();
  for (const l of levels) by.set(l.location?.id ?? '', [...(by.get(l.location?.id ?? '') ?? []), l]);
  const items = await db().item.findMany({ where: { active: true }, orderBy: { name: 'asc' }, take: 300, select: { id: true, sku: true, name: true } });
  return (
    <Page title="Inventory">
      {me.can('canManageInventory') ? (
        <Section title="Move stock">
          <CommandForm op="transferStock" submit="Transfer" paths={['/dashboard/platform/inventory']} fields={[
            { name: 'itemId', label: 'Item', kind: 'select', required: true, width: 'lg', options: items.map((i: any) => ({ value: i.id, label: `${i.sku} · ${i.name}` })) },
            { name: 'fromLocationId', label: 'From', kind: 'select', required: true, options: opt(locations) }, { name: 'toLocationId', label: 'To', kind: 'select', required: true, options: opt(locations) }, { name: 'quantity', label: 'Quantity', required: true, width: 'sm' },
          ]} />
          <CommandForm className="mt-2" op="adjustStock" submit="Adjust" paths={['/dashboard/platform/inventory']} fields={[
            { name: 'itemId', label: 'Item', kind: 'select', required: true, width: 'lg', options: items.map((i: any) => ({ value: i.id, label: `${i.sku} · ${i.name}` })) },
            { name: 'locationId', label: 'Where', kind: 'select', required: true, options: opt(locations) }, { name: 'quantity', label: '+/- quantity', required: true, width: 'sm' }, { name: 'reason', label: 'Reason', required: true },
          ]} />
        </Section>
      ) : null}
      {locations.map((loc: any) => (
        <Section key={loc.id} title={`${loc.name} · ${label(loc.kind)}`} aside={loc.kind === 'truck' ? <a className="text-sm underline" href={`/dashboard/platform/inventory/trucks/${loc.id}`}>Truck page</a> : undefined}>
          {(by.get(loc.id) ?? []).length ? (by.get(loc.id) ?? []).map(l => (
            <Row key={l.id}><span className="min-w-0 flex-1 truncate font-medium">{l.item?.name}</span><Meta>{l.item?.sku}</Meta><span className="tabular-nums">{quantity(l.onHand)}</span>{l.negativeSince ? <Status value="negative" /> : null}</Row>
          )) : <Empty>Nothing on hand.</Empty>}
        </Section>
      ))}
      {me.can('canManageInventory') ? csv('/api/stock/csv') : null}
    </Page>
  );
}

export async function TruckPage({ id }: { id: string }) {
  await gate('canManageInventory', 'canWorkVisits');
  const loc = await db().stockLocation.findUnique({ where: { id }, select: { id: true, code: true, name: true, kind: true, employee: { select: { displayName: true } } } });
  if (!loc || loc.kind !== 'truck') notFound();
  const levels = (await stockSummary(keystoneContext.prisma as never, 'truck')).filter(l => l.location?.id === id);
  const moves = await db().stockMovement.findMany({ where: { locationId: id }, orderBy: { occurredAt: 'desc' }, take: 40, select: { id: true, type: true, baseQuantity: true, occurredAt: true, item: { select: { name: true } } } });
  return (
    <Page title={`${loc.name}${loc.employee?.displayName ? ` · ${loc.employee.displayName}` : ''}`} crumbs={[{ label: 'Inventory', href: '/dashboard/platform/inventory' }]}>
      <Section title="On the truck">{levels.length ? levels.map(l => <Row key={l.id}><span className="min-w-0 flex-1 truncate font-medium">{l.item?.name}</span><span className="tabular-nums">{quantity(l.onHand)}</span>{l.negativeSince ? <Status value="negative" /> : null}</Row>) : <Empty>Nothing on this truck.</Empty>}</Section>
      <Section title="Recent movements">{moves.length ? moves.map((m: any) => <Row key={m.id}><span className="min-w-0 flex-1 truncate">{m.item?.name}</span><Meta>{label(m.type)}</Meta><span className="tabular-nums">{quantity(String(m.baseQuantity))}</span><Meta>{m.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}</Meta></Row>) : <Empty>No movements.</Empty>}</Section>
    </Page>
  );
}

export async function ReplenishmentPage() {
  await gate('canManageInventory', 'canPurchase');
  const rows = await db().replenishmentRequest.findMany({ where: { status: { in: ['proposed', 'approved'] } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, ref: true, status: true, version: true, lines: true, location: { select: { name: true } } } });
  const items = new Map<string, string>((await db().item.findMany({ select: { id: true, name: true } })).map((i: any) => [i.id, i.name]));
  const paths = ['/dashboard/platform/replenishment'];
  return (
    <Page title="Replenishment">
      <Section title="Check minimums" aside={<ActionButton op="proposeReplenishment" vars={{}} paths={paths}>Check now</ActionButton>}>
        <Meta>Looks at every location with a min/max rule and proposes a refill up to the max. Nothing is ordered until someone approves it.</Meta>
      </Section>
      <Section title={`Proposals · ${rows.length}`}>
        {rows.length ? rows.map((r: any) => (
          <Row key={r.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{r.location?.name}</span><Status value={r.status} /><Meta>{r.ref}</Meta></div>
              <Meta>{((r.lines ?? []) as { itemId: string; need: string }[]).map(l => `${items.get(l.itemId) ?? 'Item'} × ${l.need}`).join(' · ')}</Meta>
              <div className="flex flex-wrap gap-2">
                {r.status === 'proposed' ? <><ActionButton op="decideReplenishment" vars={{ requestId: r.id, decision: 'approved', expectedVersion: r.version }} paths={paths}>Approve</ActionButton><ActionButton op="decideReplenishment" vars={{ requestId: r.id, decision: 'rejected', expectedVersion: r.version }} paths={paths}>Reject</ActionButton></> : null}
                {r.status === 'approved' ? <ActionButton op="fillReplenishment" vars={{ requestId: r.id, expectedVersion: r.version }} confirm="Move this stock from the warehouse to the truck now?" paths={paths}>Fill from warehouse</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>Everything is at or above its minimum.</Empty>}
      </Section>
    </Page>
  );
}

export async function CountsPage() {
  await gate('canManageInventory');
  const rows = await db().cycleCount.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, ref: true, status: true, version: true, varianceMinor: true, lines: true, location: { select: { name: true } } } });
  const locations = await db().stockLocation.findMany({ where: { active: true }, select: { id: true, name: true } });
  const paths = ['/dashboard/platform/counts'];
  return (
    <Page title="Cycle counts">
      <Section title="Start a count">
        <CommandForm op="startCycleCount" submit="Start count" paths={paths} fields={[{ name: 'locationId', label: 'Location', kind: 'select', required: true, options: opt(locations) }]} />
      </Section>
      <Section title={`Counts · ${rows.length}`}>
        {rows.length ? rows.map((c: any) => (
          <Row key={c.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{c.location?.name}</span><Status value={c.status} /><Meta>{c.ref}</Meta></div>
              <Meta>{(c.lines ?? []).length} items · variance {money(String(c.varianceMinor))}</Meta>
              <div className="flex flex-wrap gap-2">
                {c.status === 'submitted' ? <ActionButton op="requestCycleCountApproval" vars={{ countId: c.id }} paths={paths}>Ask for approval</ActionButton> : null}
                {c.status === 'approved' ? <ActionButton op="postCycleCount" vars={{ countId: c.id, expectedVersion: c.version }} confirm="Post the count to stock?" paths={paths}>Post count</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>No counts yet.</Empty>}
      </Section>
    </Page>
  );
}

// ── Purchasing ──────────────────────────────────────────────────────────────────────────────────────────────────

export async function PurchaseOrdersPage({ receiving = false }: { receiving?: boolean } = {}) {
  const me = await gate(receiving ? 'canReceive' : 'canPurchase', 'canApprovePurchases', 'canManageInventory');
  const rows = await db().purchaseOrder.findMany({ where: receiving ? { status: { in: ['sent', 'partially_received'] } } : {}, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, ref: true, status: true, version: true, totalMinor: true, externalOrderNumber: true, supplier: { select: { name: true } }, shipTo: { select: { name: true } }, lines: { select: { id: true, quantity: true, receivedQuantity: true, item: { select: { name: true } } } } } });
  const paths = [`/dashboard/platform/${receiving ? 'receiving' : 'purchase-orders'}`];
  const seeCost = me.can('canPurchase') || me.can('canApprovePurchases');
  return (
    <Page title={receiving ? 'Receiving' : 'Purchase orders'}>
      <Section title={`${receiving ? 'Waiting to arrive' : 'Orders'} · ${rows.length}`}>
        {rows.length ? rows.map((p: any) => (
          <Row key={p.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{p.ref} · {p.supplier?.name}</span><Status value={p.status} />{seeCost ? <Meta>{money(String(p.totalMinor))}</Meta> : null}</div>
              <Meta>Ship to {p.shipTo?.name}{p.externalOrderNumber ? ` · supplier order ${p.externalOrderNumber}` : ''}</Meta>
              {p.lines.map((l: any) => <Meta key={l.id}>{l.item?.name}: {quantity(String(l.receivedQuantity))} of {quantity(String(l.quantity))} received</Meta>)}
              <div className="flex flex-wrap gap-2">
                {p.status === 'draft' && seeCost ? <ActionButton op="submitPurchaseOrder" vars={{ purchaseOrderId: p.id, expectedVersion: p.version }} paths={paths}>Submit</ActionButton> : null}
                {p.status === 'approved' && seeCost ? <><a className="inline-flex h-8 items-center rounded-md border px-3 text-sm" href={`/api/purchase-orders/${p.id}/csv`}>Order sheet (CSV)</a><ActionButton op="markPurchaseOrderSent" vars={{ purchaseOrderId: p.id, expectedVersion: p.version }} confirm="Ordered from the supplier?" paths={paths}>Mark sent</ActionButton></> : null}
                {['sent', 'partially_received'].includes(p.status) ? <ActionButton op="receivePurchaseOrder" vars={{ purchaseOrderId: p.id, lines: p.lines.map((l: any) => ({ lineId: l.id, quantity: String(Number(l.quantity) - Number(l.receivedQuantity)) })).filter((l: any) => Number(l.quantity) > 0) }} confirm="Receive everything still outstanding?" paths={paths}>Receive all outstanding</ActionButton> : null}
                {['draft', 'approved', 'sent'].includes(p.status) && seeCost ? <ActionButton op="cancelPurchaseOrder" vars={{ purchaseOrderId: p.id, expectedVersion: p.version }} ask="Why cancel?" paths={paths}>Cancel</ActionButton> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>{receiving ? 'Nothing is on its way.' : 'No purchase orders yet.'}</Empty>}
      </Section>
    </Page>
  );
}

// ── Permits, refrigerant, liens ─────────────────────────────────────────────────────────────────────────────────

export async function PermitsPage() {
  await gate('canManagePermits', 'canDispatch');
  const rows = await db().permit.findMany({ where: { status: { not: 'closed' } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, ref: true, ahj: true, permitType: true, status: true, version: true, externalNumber: true, feeMinor: true, job: { select: { id: true, ref: true } }, inspections: { select: { id: true, kind: true, status: true, version: true, scheduledFor: true } } } });
  const paths = ['/dashboard/platform/permits'];
  const NEXT: Record<string, [string, string][]> = { needed: [['applied', 'Applied']], applied: [['rejected', 'Rejected']], rejected: [['needed', 'Reopen']], issued: [['closed', 'Close permit']] };
  return (
    <Page title="Permits and inspections">
      <Section title={`Open permits · ${rows.length}`}>
        {rows.length ? rows.map((p: any) => (
          <Row key={p.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{p.permitType} · {p.ahj}</span><Status value={p.status} /><Meta>{p.ref} · job {p.job?.ref}</Meta></div>
              <Meta>{p.externalNumber ? `Permit ${p.externalNumber} · ` : ''}Fee {money(String(p.feeMinor))} (billed to the customer at cost)</Meta>
              {p.inspections.map((i: any) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2"><Meta>{i.kind}</Meta><Status value={i.status} />
                  {['requested', 'scheduled'].includes(i.status) ? <><ActionButton op="recordInspectionResult" vars={{ inspectionId: i.id, result: 'passed', expectedVersion: i.version }} paths={paths}>Passed</ActionButton><ActionButton op="recordInspectionResult" vars={{ inspectionId: i.id, result: 'failed', expectedVersion: i.version }} ask="What failed?" paths={paths}>Failed</ActionButton></> : null}
                  {i.status === 'failed' ? <ActionButton op="reinspect" vars={{ inspectionId: i.id, expectedVersion: i.version }} paths={paths}>Corrected: ask again</ActionButton> : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {(NEXT[p.status] ?? []).map(([to, text]) => <ActionButton key={to} op="advancePermit" vars={{ permitId: p.id, to, expectedVersion: p.version }} paths={paths}>{text}</ActionButton>)}
                {p.status === 'applied' ? <CommandForm op="advancePermit" fixed={{ permitId: p.id, to: 'issued', expectedVersion: p.version }} submit="Issued" paths={paths} fields={[{ name: 'externalNumber', label: 'Permit number', required: true, width: 'sm' }]} /> : null}
                {p.status === 'issued' ? <CommandForm op="requestInspection" fixed={{ permitId: p.id }} submit="Request inspection" paths={paths} fields={[{ name: 'kind', label: 'Inspection', required: true, width: 'sm' }, { name: 'scheduledFor', label: 'Date', kind: 'datetime-local', width: 'md' }]} /> : null}
              </div>
            </div>
          </Row>
        )) : <Empty>No open permits.</Empty>}
      </Section>
    </Page>
  );
}

export async function RefrigerantPage() {
  await gate('canManageRefrigerant');
  const entries = await db().refrigerantLogEntry.findMany({ orderBy: { occurredAt: 'desc' }, take: 100, select: { id: true, kind: true, refrigerantType: true, quantityLb: true, occurredAt: true, technician: { select: { displayName: true } }, equipment: { select: { ref: true, modelNumber: true } }, cylinder: { select: { serialOrTag: true } }, job: { select: { ref: true } } } });
  const cylinders = await db().refrigerantCylinder.findMany({ where: { status: 'in_service' }, take: 100, select: { id: true, serialOrTag: true, refrigerantType: true } });
  const techs = await db().employee.findMany({ where: { kind: { in: ['technician', 'apprentice'] } }, orderBy: { displayName: 'asc' }, select: { id: true, displayName: true } });
  const leaks = await db().leakRateEvaluation.findMany({ where: { status: { in: ['open', 'repair_due'] } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, status: true, version: true, leakRatePct: true, threshold: true, repairDueBy: true, equipment: { select: { ref: true, manufacturer: true, modelNumber: true } } } });
  const paths = ['/dashboard/platform/refrigerant'];
  return (
    <Page title="Refrigerant log">
      <Section title="Log refrigerant">
        <Meta>The technician must hold a verified, unexpired EPA 608 card. Entries cannot be edited afterwards.</Meta>
        <CommandForm className="mt-2" op="logRefrigerant" submit="Add entry" paths={paths} fields={[
          { name: 'kind', label: 'Kind', kind: 'select', required: true, options: ['charge', 'recover', 'transfer', 'reclaim_shipment', 'disposal_verification'].map(v => ({ value: v, label: label(v) })) },
          { name: 'technicianId', label: 'Technician', kind: 'select', required: true, options: techs.map((t: any) => ({ value: t.id, label: t.displayName })) },
          { name: 'refrigerantType', label: 'Refrigerant', required: true, width: 'sm', defaultValue: 'R-410A' }, { name: 'quantityLb', label: 'Pounds', required: true, width: 'sm' },
          { name: 'cylinderId', label: 'Cylinder', kind: 'select', options: cylinders.map((c: any) => ({ value: c.id, label: `${c.serialOrTag} · ${c.refrigerantType}` })) },
          { name: 'jobId', label: 'Job id', width: 'sm' }, { name: 'equipmentId', label: 'Equipment id', width: 'sm' },
        ]} />
        <CommandForm className="mt-2" op="saveRefrigerantCylinder" submit="Add cylinder" paths={paths} fields={[{ name: 'serialOrTag', label: 'Cylinder tag', required: true, width: 'sm' }, { name: 'refrigerantType', label: 'Refrigerant', required: true, width: 'sm' }, { name: 'kind', label: 'Kind', kind: 'select', options: [{ value: 'virgin', label: 'Virgin' }, { value: 'recovery', label: 'Recovery' }] }]} />
      </Section>
      <Section title={`Leak-rate records · ${leaks.length}`}>
        {leaks.length ? leaks.map((l: any) => (
          <Row key={l.id}><div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">{l.equipment?.manufacturer} {l.equipment?.modelNumber}</span><Status value={l.status} /></div><Meta>{String(l.leakRatePct)}% against a {String(l.threshold)}% limit{l.repairDueBy ? ` · repair by ${dateText(ymd(l.repairDueBy))}` : ''}</Meta></div>
            {l.status === 'repair_due' ? <ActionButton op="resolveLeakRate" vars={{ evaluationId: l.id, to: 'repaired_verified', expectedVersion: l.version }} ask="Repair and leak test done: note" paths={paths}>Repaired and verified</ActionButton> : null}</Row>
        )) : <Empty>No appliances near their leak limit.</Empty>}
      </Section>
      <Section title={`Log · ${entries.length}`} aside={csv('/api/refrigerant-log/csv')}>
        {entries.length ? entries.map((e: any) => <Row key={e.id}><span className="min-w-0 flex-1 truncate font-medium">{label(e.kind)} · {String(e.quantityLb)} lb {e.refrigerantType}</span><Meta>{e.technician?.displayName}{e.job ? ` · ${e.job.ref}` : ''}{e.equipment ? ` · ${e.equipment.modelNumber}` : ''}{e.cylinder ? ` · ${e.cylinder.serialOrTag}` : ''}</Meta><Meta>{e.occurredAt.toISOString().slice(0, 10)}</Meta></Row>) : <Empty>No entries.</Empty>}
      </Section>
    </Page>
  );
}

export async function LiensPage() {
  await gate('canManageInvoices', 'canManageAccounting');
  const rows = await lienList(keystoneContext.prisma as never);
  const paths = ['/dashboard/platform/liens'];
  return (
    <Page title="Liens">
      <Section title={`Watching · ${rows.length}`}>
        <Meta>Dates follow the Texas rule in the lien policy pack. This is a reminder list, not legal advice, and nothing is filed from here.</Meta>
        {rows.length ? rows.map((r: any) => (
          <Row key={r.id}>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-medium">Job {r.job?.ref}</span><Status value={r.status} /><Meta>{r.invoice?.ref}</Meta></div>
              <Meta>Affidavit due {dateText(r.affidavitDueOn)} · {r.daysLeft >= 0 ? `${r.daysLeft} days left` : `${-r.daysLeft} days past`}</Meta>
              <div className="flex flex-wrap gap-2">
                <ActionButton op="advanceLien" vars={{ lienId: r.id, to: 'affidavit_filed', expectedVersion: r.version }} confirm="You filed the affidavit yourself?" paths={paths}>Mark affidavit filed</ActionButton>
                <ActionButton op="advanceLien" vars={{ lienId: r.id, to: 'released', expectedVersion: r.version }} paths={paths}>Paid: release</ActionButton>
              </div>
            </div>
          </Row>
        )) : <Empty>No liens being watched.</Empty>}
      </Section>
    </Page>
  );
}
