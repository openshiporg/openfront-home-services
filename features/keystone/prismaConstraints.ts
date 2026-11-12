/**
 * Compound uniques Keystone can't express on a field (SCHEMA G9; openfront-convenience pattern).
 * Partial uniques, CHECK constraints and triggers live in raw-SQL migrations instead.
 */
export const COMPOUND_UNIQUES: Record<string, string[]> = {
  CalendarException: ['@@unique([calendarId, date], map: "CalendarException_calendar_date_key")'],
  ProviderObservation: [
    '@@unique([source, externalId], map: "ProviderObservation_source_external_key")',
    '@@unique([source, contentHash], map: "ProviderObservation_source_hash_key")',
  ],
  ExternalId: ['@@unique([system, subjectType, externalId], map: "ExternalId_system_subject_external_key")'],
  DocumentVersion: ['@@unique([documentId, versionNumber], map: "DocumentVersion_document_number_key")'],
  PolicyVersion: ['@@unique([packId, versionNumber], map: "PolicyVersion_pack_number_key")'],
  PolicyBinding: ['@@unique([packId, scope, scopeValue], map: "PolicyBinding_pack_scope_key")'],
  RoleLimit: ['@@unique([roleId, kind], map: "RoleLimit_role_kind_key")'],
  // Phase 1: CRM, booking and dispatch
  ContactPoint: ['@@unique([contactId, kind, value], map: "ContactPoint_contact_kind_value_key")'],
  ArrivalWindow: ['@@unique([businessUnitId, date, startsAt], map: "ArrivalWindow_bu_date_start_key")'],
  ArrivalWindowTemplate: ['@@unique([businessUnitId, weekday, startLocal], map: "ArrivalWindowTemplate_bu_day_start_key")'],
  ShiftTemplate: ['@@unique([employeeId, weekday], map: "ShiftTemplate_employee_day_key")'],
  Shift: ['@@unique([employeeId, date, kind], map: "Shift_employee_date_kind_key")'],
  CapacityPlan: ['@@unique([businessUnitId, date], map: "CapacityPlan_bu_date_key")'],
  Visit: ['@@index([status, plannedStart], map: "Visit_status_planned_idx")'],
  // Phase 2: price book, estimates and cancellation rights
  PriceBookVersion: ['@@unique([priceBookId, versionNumber], map: "PriceBookVersion_book_number_key")'],
  PriceBookItem: ['@@unique([priceBookVersionId, itemKey], map: "PriceBookItem_version_key_key")'],
  PriceBookCategory: ['@@unique([priceBookVersionId, categoryKey], map: "PriceBookCategory_version_key_key")'],
  EstimateVersion: ['@@unique([estimateId, versionNumber], map: "EstimateVersion_estimate_number_key")'],
  // Phase 5: stock, serial numbers, supplier catalogues
  StockLevel: ['@@unique([locationId, itemId], map: "StockLevel_location_item_key")'],
  SerializedUnit: ['@@unique([itemId, serialNumber], map: "SerializedUnit_item_serial_key")'],
  SupplierItem: ['@@unique([supplierId, supplierSku], map: "SupplierItem_supplier_sku_key")'],
  ItemUomConversion: ['@@unique([itemId, fromUomId, toUomId], map: "ItemUomConversion_item_from_to_key")'],
  MinMaxRule: ['@@unique([locationId, itemId], map: "MinMaxRule_location_item_key")'],
}

export function addDatabaseConstraints(schema: string): string {
  for (const [modelName, directives] of Object.entries(COMPOUND_UNIQUES)) {
    const pattern = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`)
    const model = schema.match(pattern)?.[0]
    if (!model) throw new Error(`Generated Prisma schema is missing ${modelName}`)
    const missing = directives.filter(directive => !model.includes(directive))
    if (!missing.length) continue
    schema = schema.replace(model, model.replace(/\n\}$/, `\n${missing.map(directive => `  ${directive}`).join('\n')}\n}`))
  }
  return schema
}
