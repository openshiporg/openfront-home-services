import { REPLENISHMENT_DECISIONS } from '@/features/keystone/domain/phase5Commands';

/*
 * Reads for the Phase 5 screens a technician can open. Every read goes through GraphQL as the signed-in person (the page passes `q`,
 * a test passes a Keystone context bound to a session), so the list rules apply exactly as they do to the API and to MCP queryData:
 * a technician sees their own truck only, and equipment and addresses only at homes of their own jobs. Never read these with the
 * unscoped Prisma client.
 */

export type Query = <T = any>(query: string, variables?: Record<string, unknown>) => Promise<T>;

type Equipment = { id: string; ref: string; manufacturer: string; modelNumber: string; serialNumber: string; kind: string; installDate: string | null; refrigerantType: string; location: { id: string; address1: string; city: string; customer: { displayName: string } | null } | null };

export async function loadEquipment(query: Query) {
  const d = await query<{ installedEquipments: Equipment[]; serviceLocations: { id: string; address1: string; city: string }[] }>(`
    query {
      installedEquipments(where: { status: { equals: "active" } }, orderBy: [{ installDate: desc }], take: 300) {
        id ref manufacturer modelNumber serialNumber kind installDate refrigerantType location { id address1 city customer { displayName } }
      }
      serviceLocations(orderBy: [{ address1: asc }], take: 100) { id address1 city }
    }`);
  const ids = d.installedEquipments.map(e => e.id);
  const coverage = ids.length
    ? (await query<{ warrantyCoverages: { kind: string; endsOn: string | null; equipment: { id: string } | null }[] }>(`
        query($ids: [ID!]) { warrantyCoverages(where: { equipment: { id: { in: $ids } } }) { kind endsOn equipment { id } } }`, { ids })).warrantyCoverages
    : [];
  return {
    equipment: d.installedEquipments.map(e => ({ ...e, coverage: coverage.filter(c => c.equipment?.id === e.id) })),
    locations: d.serviceLocations,
  };
}

type Level = { id: string; onHand: string; negativeSince: string | null; location: { id: string } | null; item: { id: string; sku: string; name: string } | null };

export async function loadInventory(query: Query, { kind, forms = false }: { kind?: 'warehouse' | 'truck'; forms?: boolean } = {}) {
  const where = { active: { equals: true }, ...(kind ? { kind: { equals: kind } } : {}) };
  const d = await query<{ stockLocations: { id: string; code: string; name: string; kind: string }[]; stockLevels: Level[] }>(`
    query($where: StockLocationWhereInput!) {
      stockLocations(where: $where, orderBy: [{ code: asc }]) { id code name kind }
      stockLevels(where: { location: $where }, take: 3000) { id onHand negativeSince location { id } item { id sku name } }
    }`, { where });
  const extra = forms
    ? await query<{ items: { id: string; sku: string; name: string; trackSerial: boolean }[]; serializedUnits: { id: string; serialNumber: string; item: { id: string; sku: string } | null; location: { name: string } | null }[] }>(`
        query {
          items(where: { active: { equals: true } }, orderBy: [{ name: asc }], take: 300) { id sku name trackSerial }
          serializedUnits(where: { status: { equals: "in_stock" } }, take: 300) { id serialNumber item { id sku } location { name } }
        }`)
    : { items: [], serializedUnits: [] };
  return { locations: d.stockLocations, levels: d.stockLevels, items: extra.items, units: extra.serializedUnits };
}

/** A truck the viewer may read (their own, or any for stock staff); null otherwise, which the page turns into a 404. */
export async function loadTruck(query: Query, id: string) {
  const d = await query<{ stockLocation: { id: string; name: string; kind: string; employee: { displayName: string } | null } | null; stockLevels: Level[]; stockMovements: { id: string; type: string; baseQuantity: string; occurredAt: string; item: { name: string } | null }[] }>(`
    query($id: ID!) {
      stockLocation(where: { id: $id }) { id name kind employee { displayName } }
      stockLevels(where: { location: { id: { equals: $id } } }, take: 500) { id onHand negativeSince location { id } item { id sku name } }
      stockMovements(where: { location: { id: { equals: $id } } }, orderBy: [{ occurredAt: desc }], take: 40) { id type baseQuantity occurredAt item { name } }
    }`, { id });
  if (!d.stockLocation || d.stockLocation.kind !== 'truck') return null;
  return { truck: d.stockLocation, levels: d.stockLevels, moves: d.stockMovements };
}

/** The variables the Replenishment screen's Approve and Reject buttons send: the exact words decideReplenishment accepts. */
export const replenishmentDecision = (r: { id: string; version: number }, decision: (typeof REPLENISHMENT_DECISIONS)[number]) => ({ requestId: r.id, decision, expectedVersion: r.version });
