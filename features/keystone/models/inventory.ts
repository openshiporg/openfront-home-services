import { list } from '@keystone-6/core'
import { calendarDay, checkbox, integer, json, relationship, text, timestamp } from '@keystone-6/core/fields'
import { fixedChoice, lifecycle, minor, qty, systemText, versionField } from './domainFields'
import { governed } from './listAccess'
import { purchaseCost, rowAccess } from './fieldAccess'
import { trackingFields } from './trackingFields'

/*
 * Inventory and purchasing (SCHEMA §12, STATE-MACHINES §13). Stock is movement-only: StockMovement rows are append-only (database
 * trigger) and StockLevel is a cache that only applyStockMovement writes; a verify job proves level = sum of movements. A truck may go
 * negative (the company control allowNegativeTruckStock) and is flagged, never blocked in the field. Nothing is emailed: a purchase order
 * is a PDF-ready record staff send themselves and mark sent. Unit costs follow the purchasing-cost rule on read, filter and order.
 */

export const MOVEMENT_TYPES = ['receipt', 'transfer_out', 'transfer_in', 'consume_job', 'return_job', 'adjust', 'count_variance', 'rma_out', 'scrap', 'refrigerant_charge', 'refrigerant_recover'] as const
export const LOCATION_KINDS = ['warehouse', 'truck', 'job_site', 'in_transit', 'rma_staging', 'scrap'] as const
export const PO_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'acknowledged', 'partially_received', 'received', 'billed', 'closed', 'cancelled'] as const

/** Warehouse staff and the people who plan, buy and read the books see stock; a technician sees their own truck only. */
export const STOCK_READ = ['canManageInventory', 'canPurchase', 'canReceive', 'canApprovePurchases', 'canApproveStockVariance', 'canManageAccounting', 'canDispatch'] as const
const myTruck = (userId: string) => ({ location: { employee: { user: { id: { equals: userId } } } } })
const BUY = ['canPurchase', 'canApprovePurchases', 'canManageAccounting', 'canReceive'] as const

export const Item = list({
  // A catalogue: no per-row owner. Anyone who stocks, buys, claims or works a visit may look an item up; nobody writes it through the API.
  access: governed([...STOCK_READ, 'canManageEquipment', 'canSubmitWarrantyClaims', 'canWorkVisits']),
  ui: { labelField: 'sku', listView: { initialColumns: ['sku', 'name', 'kind', 'baseUom', 'trackSerial'] } },
  fields: {
    sku: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    kind: fixedChoice(['part', 'material', 'equipment', 'refrigerant', 'consumable'], 'part'),
    trackSerial: checkbox({ defaultValue: false }),
    trackLot: checkbox({ defaultValue: false }),
    baseUom: relationship({ ref: 'UnitOfMeasure' }),
    defaultSupplier: relationship({ ref: 'Supplier' }),
    standardCostMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    pricebookItemKeys: json({ isFilterable: false, isOrderable: false } as never),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const ItemUomConversion = list({
  access: governed([...STOCK_READ]),
  ui: { labelField: 'factor' },
  fields: {
    item: relationship({ ref: 'Item' }),
    fromUom: relationship({ ref: 'UnitOfMeasure' }),
    toUom: relationship({ ref: 'UnitOfMeasure' }),
    factor: qty({ required: true }),
    ...trackingFields,
  },
})

export const StockLocation = list({
  access: rowAccess(STOCK_READ, userId => ({ employee: { user: { id: { equals: userId } } } })),
  ui: { labelField: 'name', listView: { initialColumns: ['code', 'name', 'kind', 'branch', 'employee', 'active'] } },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),
    kind: fixedChoice(LOCATION_KINDS, 'warehouse'),
    branch: relationship({ ref: 'Branch' }),
    employee: relationship({ ref: 'Employee' }),
    active: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

/** A cache. Only applyStockMovement writes it, under the lock stock:{location}:{item}. */
export const StockLevel = list({
  access: rowAccess(STOCK_READ, myTruck),
  ui: { labelField: 'onHand', listView: { initialColumns: ['location', 'item', 'onHand', 'reserved', 'negativeSince'] } },
  fields: {
    location: relationship({ ref: 'StockLocation' }),
    item: relationship({ ref: 'Item' }),
    onHand: qty(),
    reserved: qty(),
    negativeSince: timestamp(),
    ...trackingFields,
  },
})

/** Append-only (database trigger). A correction is a new row with `reverses`. */
export const StockMovement = list({
  access: rowAccess(STOCK_READ, myTruck),
  ui: { labelField: 'type', listView: { initialColumns: ['type', 'item', 'location', 'quantity', 'job', 'occurredAt'] } },
  fields: {
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: () => false }, isFilterable: false, isOrderable: false } as never),
    type: fixedChoice(MOVEMENT_TYPES, 'adjust'),
    item: relationship({ ref: 'Item' }),
    location: relationship({ ref: 'StockLocation' }),
    quantity: qty({ required: true }),
    uom: relationship({ ref: 'UnitOfMeasure' }),
    baseQuantity: qty({ required: true }),
    unitCostMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    job: relationship({ ref: 'Job' }),
    workLine: relationship({ ref: 'WorkLine' }),
    receipt: relationship({ ref: 'Receipt' }),
    transferGroup: text({ isIndexed: true }),
    serializedUnit: relationship({ ref: 'SerializedUnit' }),
    reason: text(),
    reverses: relationship({ ref: 'StockMovement' }),
    actor: relationship({ ref: 'User' }),
    occurredAt: timestamp(),
    clientRecordedAt: timestamp(),
    ...trackingFields,
  },
})

export const StockReservation = list({
  access: rowAccess(STOCK_READ, userId => ({ job: { visits: { some: { assignments: { some: { active: { equals: true }, employee: { user: { id: { equals: userId } } } } } } } } })),
  ui: { labelField: 'status', listView: { initialColumns: ['item', 'location', 'quantity', 'job', 'status', 'expiresAt'] } },
  fields: {
    item: relationship({ ref: 'Item' }),
    location: relationship({ ref: 'StockLocation' }),
    quantity: qty({ required: true }),
    job: relationship({ ref: 'Job' }),
    workLine: relationship({ ref: 'WorkLine' }),
    status: lifecycle(['reserved', 'fulfilled', 'released', 'expired']),
    expiresAt: timestamp(),
    version: versionField(),
    ...trackingFields,
  },
})

export const MinMaxRule = list({
  access: governed([...STOCK_READ]),
  ui: { labelField: 'min', listView: { initialColumns: ['location', 'item', 'min', 'max', 'reorderFrom', 'supplier'] } },
  fields: {
    location: relationship({ ref: 'StockLocation' }),
    item: relationship({ ref: 'Item' }),
    min: qty({ required: true }),
    max: qty({ required: true }),
    reorderFrom: relationship({ ref: 'StockLocation' }),
    supplier: relationship({ ref: 'Supplier' }),
    ...trackingFields,
  },
})

export const ReplenishmentRequest = list({
  access: rowAccess(STOCK_READ, myTruck),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'location', 'status', 'proposedBy', 'purchaseOrder'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    location: relationship({ ref: 'StockLocation' }),
    lines: json({ isFilterable: false, isOrderable: false } as never),
    status: lifecycle(['proposed', 'approved', 'picking', 'transferred', 'ordered', 'closed', 'rejected']),
    proposedBy: systemText(),
    purchaseOrder: relationship({ ref: 'PurchaseOrder' }),
    transferGroup: systemText(),
    version: versionField(),
    ...trackingFields,
  },
})

export const CycleCount = list({
  access: governed([...STOCK_READ]),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'location', 'status', 'varianceMinor'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    location: relationship({ ref: 'StockLocation' }),
    status: lifecycle(['planned', 'counting', 'submitted', 'approved', 'posted']),
    /** [{ itemId, expected, counted }] */
    lines: json({ isFilterable: false, isOrderable: false } as never),
    varianceMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    approval: relationship({ ref: 'ApprovalRequest' }),
    version: versionField(),
    ...trackingFields,
  },
})

export const SerializedUnit = list({
  access: governed([...STOCK_READ, 'canManageEquipment']),
  ui: { labelField: 'serialNumber', listView: { initialColumns: ['item', 'serialNumber', 'status', 'location', 'installedEquipment'] } },
  fields: {
    item: relationship({ ref: 'Item' }),
    serialNumber: text({ validation: { isRequired: true } }),
    status: lifecycle(['in_stock', 'reserved', 'installed', 'rma', 'scrapped']),
    location: relationship({ ref: 'StockLocation' }),
    installedEquipment: relationship({ ref: 'InstalledEquipment' }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Supplier = list({
  access: governed([...BUY, 'canManageInventory', 'canSubmitWarrantyClaims']),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'kind', 'accountNumber', 'orderMethod'] } },
  fields: {
    name: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    kind: fixedChoice(['supply_house', 'distributor', 'manufacturer', 'other'], 'supply_house'),
    accountNumber: text(),
    branchContact: text(),
    orderMethod: fixedChoice(['email_pdf', 'api', 'edi', 'punchout', 'phone'], 'phone'),
    adapterKey: text(),
    ...trackingFields,
  },
})

export const SupplierItem = list({
  access: governed([...BUY]),
  ui: { labelField: 'supplierSku', listView: { initialColumns: ['supplier', 'supplierSku', 'item', 'costMinor', 'effectiveOn'] } },
  fields: {
    supplier: relationship({ ref: 'Supplier' }),
    item: relationship({ ref: 'Item' }),
    supplierSku: text({ validation: { isRequired: true } }),
    costMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    uom: relationship({ ref: 'UnitOfMeasure' }),
    effectiveOn: calendarDay(),
    ...trackingFields,
  },
})

export const PurchaseOrder = list({
  access: governed([...BUY, 'canManageInventory']),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'supplier', 'status', 'totalMinor', 'createdAt'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    supplier: relationship({ ref: 'Supplier' }),
    shipTo: relationship({ ref: 'StockLocation' }),
    job: relationship({ ref: 'Job' }),
    status: lifecycle(PO_STATUSES),
    totalMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    approval: relationship({ ref: 'ApprovalRequest' }),
    externalOrderNumber: systemText(),
    lines: relationship({ ref: 'PurchaseOrderLine.po', many: true }),
    version: versionField(),
    ...trackingFields,
  },
})

export const PurchaseOrderLine = list({
  access: governed([...BUY, 'canManageInventory']),
  ui: { labelField: 'supplierSku', listView: { initialColumns: ['po', 'item', 'quantity', 'receivedQuantity', 'unitCostMinor'] } },
  fields: {
    po: relationship({ ref: 'PurchaseOrder.lines' }),
    item: relationship({ ref: 'Item' }),
    supplierSku: text(),
    quantity: qty({ required: true }),
    uom: relationship({ ref: 'UnitOfMeasure' }),
    unitCostMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    receivedQuantity: qty(),
    job: relationship({ ref: 'Job' }),
    ...trackingFields,
  },
})

/** Append-only (database trigger). Each receipt writes `receipt` movements. */
export const Receipt = list({
  access: governed([...BUY, 'canManageInventory']),
  ui: { labelField: 'receivedAt', listView: { initialColumns: ['po', 'receivedAt', 'receivedBy'] } },
  fields: {
    po: relationship({ ref: 'PurchaseOrder' }),
    lines: json({ isFilterable: false, isOrderable: false } as never),
    receivedAt: timestamp(),
    receivedBy: relationship({ ref: 'User' }),
    packingSlip: relationship({ ref: 'Media' }),
    overReceiptApproval: relationship({ ref: 'ApprovalRequest' }),
    ...trackingFields,
  },
})

export const VendorBill = list({
  access: governed(['canPurchase', 'canApprovePurchases', 'canManageAccounting', 'canManageInvoices']),
  ui: { labelField: 'billNumber', listView: { initialColumns: ['billNumber', 'supplier', 'po', 'totalMinor', 'matchStatus'] } },
  fields: {
    supplier: relationship({ ref: 'Supplier' }),
    po: relationship({ ref: 'PurchaseOrder' }),
    billNumber: text({ validation: { isRequired: true } }),
    totalMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    matchStatus: lifecycle(['unmatched', 'matched', 'variance', 'approved_variance']),
    matchDetail: json({ isFilterable: false, isOrderable: false } as never),
    approval: relationship({ ref: 'ApprovalRequest' }),
    version: versionField(),
    ...trackingFields,
  },
})

export const Rma = list({
  access: governed([...BUY, 'canSubmitWarrantyClaims', 'canManageInventory']),
  ui: { labelField: 'ref', listView: { initialColumns: ['ref', 'supplier', 'status', 'creditMinor', 'trackingNumber'] } },
  fields: {
    ref: systemText({ indexed: 'unique', required: true }),
    supplier: relationship({ ref: 'Supplier' }),
    warrantyClaim: relationship({ ref: 'WarrantyClaim' }),
    lines: json({ isFilterable: false, isOrderable: false } as never),
    status: lifecycle(['requested', 'shipped', 'credited', 'rejected']),
    creditMinor: minor({ defaultValue: 0n, ...purchaseCost }),
    trackingNumber: text(),
    version: versionField(),
    ...trackingFields,
  },
})

void integer
