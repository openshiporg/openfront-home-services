/*
 * The Phase 5 commands (equipment, warranty, stock, purchasing, permits, refrigerant, liens) as plain data: the GraphQL schema and the
 * dashboard's command table are both built from this, so they cannot drift apart. Every command takes an idempotency key.
 * Each entry is [service module, function, arguments].
 */
type Args = Record<string, string>

/** The only values decideReplenishment accepts; the Replenishment screen sends these. */
export const REPLENISHMENT_DECISIONS = ['approve', 'reject'] as const

export const PHASE5: Record<string, [string, string, Args]> = {
  // Equipment and warranty
  recordEquipment: ['warranty', 'recordEquipment', { locationId: 'ID!', manufacturer: 'String!', modelNumber: 'String!', serialNumber: 'String!', kind: 'String', applianceClass: 'String', tonnage: 'String', refrigerantType: 'String', refrigerantChargeLb: 'String', installDate: 'String', manufactureDate: 'String', locationInHome: 'String', installedByJobId: 'ID', source: 'String' }],
  recordEquipmentReading: ['warranty', 'recordReading', { equipmentId: 'ID!', visitId: 'ID', kind: 'String!', value: 'String!', unit: 'String' }],
  retireEquipment: ['warranty', 'replaceEquipment', { equipmentId: 'ID!', replacedById: 'ID', status: 'String!', expectedVersion: 'Int!' }],
  ensureWarrantyRegistration: ['warranty', 'ensureRegistrationFor', { equipmentId: 'ID!' }],
  markWarrantyRegistrationSubmitted: ['warranty', 'markRegistrationSubmitted', { registrationId: 'ID!', confirmationNumber: 'String', expectedVersion: 'Int!' }],
  confirmWarrantyRegistration: ['warranty', 'confirmRegistration', { registrationId: 'ID!', confirmationNumber: 'String!', expectedVersion: 'Int!' }],
  openWarrantyClaim: ['warranty', 'openClaim', { equipmentId: 'ID!', jobId: 'ID', draft: 'JSON' }],
  saveWarrantyClaimDraft: ['warranty', 'saveClaimDraft', { claimId: 'ID!', draft: 'JSON!', expectedVersion: 'Int!' }],
  markWarrantyClaimReady: ['warranty', 'markClaimReady', { claimId: 'ID!', expectedVersion: 'Int!' }],
  submitWarrantyClaim: ['warranty', 'submitClaim', { claimId: 'ID!', externalClaimNumber: 'String', lateReason: 'String', expectedVersion: 'Int!' }],
  recordWarrantyClaimNumber: ['warranty', 'recordClaimNumber', { claimId: 'ID!', externalClaimNumber: 'String!' }],
  recordWarrantyClaimDecision: ['warranty', 'recordClaimDecision', { claimId: 'ID!', decision: 'String!', recoveredMinor: 'String', note: 'String', expectedVersion: 'Int!' }],
  settleWarrantyClaim: ['warranty', 'settleClaim', { claimId: 'ID!', evidence: 'String!', expectedVersion: 'Int!' }],
  closeWarrantyClaim: ['warranty', 'closeClaim', { claimId: 'ID!', expectedVersion: 'Int!' }],
  appealWarrantyClaim: ['warranty', 'appealClaim', { claimId: 'ID!', note: 'String!', expectedVersion: 'Int!' }],
  requestWarrantyWriteOff: ['warranty', 'requestClaimWriteOff', { claimId: 'ID!', reason: 'String!' }],
  writeOffWarrantyClaim: ['warranty', 'writeOffClaim', { claimId: 'ID!', requestId: 'ID!', reason: 'String!', expectedVersion: 'Int!' }],
  receiveHomeWarrantyDispatch: ['warranty', 'receiveHomeWarrantyDispatch', { payerId: 'ID!', externalDispatchNumber: 'String!', jobId: 'ID', serviceFeeMinor: 'String' }],
  advanceHomeWarrantyDispatch: ['warranty', 'advanceHomeWarranty', { dispatchId: 'ID!', to: 'String!', authorizedMinor: 'String', note: 'String', expectedVersion: 'Int!' }],

  // Stock
  saveStockItem: ['inventory', 'saveItem', { itemId: 'ID', sku: 'String!', name: 'String!', kind: 'String', baseUom: 'String!', trackSerial: 'Boolean', standardCostMinor: 'String', defaultSupplierId: 'ID' }],
  saveStockLocation: ['inventory', 'saveStockLocation', { code: 'String!', name: 'String!', kind: 'String!', employeeId: 'ID' }],
  consumeStock: ['inventory', 'consumeStock', { itemId: 'ID!', locationId: 'ID!', quantity: 'String!', uom: 'String', jobId: 'ID!', workLineId: 'ID', clientRecordedAt: 'String' }],
  installSerializedUnit: ['inventory', 'installSerializedUnit', { serializedUnitId: 'ID!', equipmentId: 'ID!', jobId: 'ID!' }],
  transferStock: ['inventory', 'transferStock', { itemId: 'ID!', fromLocationId: 'ID!', toLocationId: 'ID!', quantity: 'String!', uom: 'String', serializedUnitId: 'ID' }],
  adjustStock: ['inventory', 'adjustStock', { itemId: 'ID!', locationId: 'ID!', quantity: 'String!', reason: 'String!' }],
  saveMinMaxRule: ['inventory', 'saveMinMaxRule', { locationId: 'ID!', itemId: 'ID!', min: 'String!', max: 'String!', reorderFromId: 'ID', supplierId: 'ID' }],
  proposeReplenishment: ['inventory', 'proposeReplenishment', {}],
  decideReplenishment: ['inventory', 'decideReplenishment', { requestId: 'ID!', decision: 'String!', expectedVersion: 'Int!' }],
  fillReplenishment: ['inventory', 'fillReplenishment', { requestId: 'ID!', expectedVersion: 'Int!' }],
  startCycleCount: ['inventory', 'startCycleCount', { locationId: 'ID!' }],
  submitCycleCount: ['inventory', 'submitCycleCount', { countId: 'ID!', counted: 'JSON!', expectedVersion: 'Int!' }],
  requestCycleCountApproval: ['inventory', 'requestCountApproval', { countId: 'ID!' }],
  postCycleCount: ['inventory', 'postCycleCount', { countId: 'ID!', expectedVersion: 'Int!' }],

  // Purchasing
  openPurchaseOrder: ['purchasing', 'createPurchaseOrder', { supplierId: 'ID!', shipToId: 'ID!', jobId: 'ID', lines: 'JSON!' }],
  submitPurchaseOrder: ['purchasing', 'submitPurchaseOrder', { purchaseOrderId: 'ID!', expectedVersion: 'Int!' }],
  approvePurchaseOrder: ['purchasing', 'approvePurchaseOrder', { purchaseOrderId: 'ID!', expectedVersion: 'Int!' }],
  markPurchaseOrderSent: ['purchasing', 'markPurchaseOrderSent', { purchaseOrderId: 'ID!', externalOrderNumber: 'String', expectedVersion: 'Int!' }],
  cancelPurchaseOrder: ['purchasing', 'cancelPurchaseOrder', { purchaseOrderId: 'ID!', reason: 'String!', expectedVersion: 'Int!' }],
  receivePurchaseOrder: ['purchasing', 'receivePurchaseOrder', { purchaseOrderId: 'ID!', lines: 'JSON!', overReceiptRequestId: 'ID' }],
  requestOverReceipt: ['purchasing', 'requestOverReceipt', { purchaseOrderId: 'ID!', lines: 'JSON!' }],
  recordVendorBill: ['purchasing', 'recordVendorBill', { purchaseOrderId: 'ID!', billNumber: 'String!', totalMinor: 'String!' }],
  requestBillVariance: ['purchasing', 'requestBillVariance', { billId: 'ID!' }],
  acceptBillVariance: ['purchasing', 'acceptBillVariance', { billId: 'ID!', expectedVersion: 'Int!' }],

  // Permits, refrigerant, liens
  openPermit: ['compliance', 'openPermit', { jobId: 'ID!', ahj: 'String!', permitType: 'String!', feeMinor: 'String' }],
  advancePermit: ['compliance', 'advancePermit', { permitId: 'ID!', to: 'String!', externalNumber: 'String', expiresOn: 'String', note: 'String', expectedVersion: 'Int!' }],
  requestInspection: ['compliance', 'requestInspection', { permitId: 'ID!', kind: 'String!', scheduledFor: 'String', inspectorName: 'String' }],
  recordInspectionResult: ['compliance', 'recordInspectionResult', { inspectionId: 'ID!', result: 'String!', notes: 'String', expectedVersion: 'Int!' }],
  reinspect: ['compliance', 'reinspect', { inspectionId: 'ID!', expectedVersion: 'Int!' }],
  completeJob: ['compliance', 'completeJob', { jobId: 'ID!', expectedVersion: 'Int!' }],
  saveRefrigerantCylinder: ['compliance', 'saveCylinder', { serialOrTag: 'String!', refrigerantType: 'String!', kind: 'String', locationId: 'ID', tareLb: 'String' }],
  logRefrigerant: ['compliance', 'logRefrigerant', { kind: 'String!', equipmentId: 'ID', jobId: 'ID', cylinderId: 'ID', refrigerantType: 'String!', quantityLb: 'String!', technicianId: 'ID!', notes: 'String' }],
  resolveLeakRate: ['compliance', 'resolveLeak', { evaluationId: 'ID!', to: 'String!', note: 'String!', expectedVersion: 'Int!' }],
  checkRefrigerantInstall: ['compliance', 'checkRefrigerantInstall', { workLineId: 'ID!', equipmentModelId: 'ID!', stage: 'String!' }],
  trackLien: ['compliance', 'trackLien', { jobId: 'ID!', invoiceId: 'ID', projectClass: 'String' }],
  advanceLien: ['compliance', 'advanceLien', { lienId: 'ID!', to: 'String!', note: 'String', expectedVersion: 'Int!' }],
}

/** Operations the dashboard may call, as { name: { arg: type } }. */
export const PHASE5_OPS: Record<string, Args> = Object.fromEntries(Object.entries(PHASE5).map(([name, [, , args]]) => [name, args]))
