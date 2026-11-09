import { permissionNames, type Permission } from '../access'

/**
 * Summit Plumbing & Air (BUILD-PLAN §5). Every name, number and licence is fictional; phone
 * numbers are 512-555-01xx and email addresses are @summitplumbingair.com. Ids are deterministic (`seed_…`)
 * so loading twice changes nothing.
 */

export const COMPANY = {
  legalName: 'Summit Plumbing & Air LLC',
  displayName: 'Summit Plumbing & Air',
  homeTimeZone: 'America/Chicago',
  currencyCode: 'USD',
  defaultCountry: 'US',
}

type RoleSeed = { id: string; name: string; description: string; permissions: Permission[] }

const BASE: Permission[] = ['canAccessDashboard', 'canSeeOtherPeople']
const all = (except: Permission[]) => permissionNames.filter(name => !except.includes(name))

export const ROLES: RoleSeed[] = [
  { id: 'seed_role_ai_agent', name: 'AI Agent', description: 'Least privilege for AI agents. Holds no permission: an agent acts only through its tool grants, and never sees cost or margin.', permissions: [] },
  { id: 'seed_role_owner', name: 'Owner', description: 'Everything except break-glass. Break-glass is never on a default role.', permissions: all(['canBreakGlass']) },
  { id: 'seed_role_gm', name: 'General Manager', description: 'Runs the shop day to day and approves money and policy changes.', permissions: all(['canBreakGlass', 'canManageRoles', 'canRunPayroll']) },
  { id: 'seed_role_csr', name: 'CSR', description: 'Answers calls, books jobs, takes payments and sells memberships.', permissions: [...BASE, 'canManageCustomers', 'canReadCustomerPII', 'canManageLeads', 'canBook', 'canViewBoard', 'canTakePayments', 'canSellMemberships', 'canOfferFinancing', 'canSendMessages'] },
  { id: 'seed_role_dispatcher', name: 'Dispatcher', description: 'Owns the board: assigns, reassigns and overbooks within limits.', permissions: [...BASE, 'canManageCustomers', 'canReadCustomerPII', 'canRevealAccessSecret', 'canBook', 'canOverbook', 'canDispatch', 'canViewBoard', 'canSendMessages'] },
  { id: 'seed_role_technician', name: 'Technician', description: 'Works assigned visits in the field app: estimates, payments, equipment and refrigerant entries.', permissions: ['canAccessDashboard', 'canWorkVisits', 'canRevealAccessSecret', 'canPresentEstimates', 'canSellEstimates', 'canTakePayments', 'canOfferFinancing', 'canSellMemberships', 'canManageEquipment', 'canManageRefrigerant'] },
  { id: 'seed_role_comfort_advisor', name: 'Comfort Advisor', description: 'Replacement sales: presents good/better/best options and financing.', permissions: [...BASE, 'canManageCustomers', 'canReadCustomerPII', 'canViewBoard', 'canPresentEstimates', 'canSellEstimates', 'canTakePayments', 'canOfferFinancing', 'canSellMemberships'] },
  { id: 'seed_role_service_manager', name: 'Service Manager', description: 'Runs the service department: discounts, overbooks, timesheets, warranty and the price book draft.', permissions: [...BASE, 'canManageCustomers', 'canReadCustomerPII', 'canBook', 'canDispatch', 'canViewBoard', 'canApproveOverbook', 'canApproveDiscounts', 'canManagePriceBook', 'canManageEquipment', 'canSubmitWarrantyClaims', 'canManagePermits', 'canApproveTimesheets', 'canReadAudit'] },
  { id: 'seed_role_install_manager', name: 'Install Manager', description: 'Runs installs: permits, purchasing and install crews.', permissions: [...BASE, 'canManageCustomers', 'canReadCustomerPII', 'canViewBoard', 'canDispatch', 'canApproveDiscounts', 'canManageEquipment', 'canSubmitWarrantyClaims', 'canManagePermits', 'canManageRefrigerant', 'canPurchase', 'canApproveTimesheets'] },
  { id: 'seed_role_warehouse', name: 'Warehouse', description: 'Receives, counts and replenishes trucks.', permissions: ['canAccessDashboard', 'canManageInventory', 'canPurchase', 'canReceive'] },
  { id: 'seed_role_accounting', name: 'Accounting', description: 'Invoices, payments, AR, refunds and the accounting export.', permissions: [...BASE, 'canReadCustomerPII', 'canManageInvoices', 'canPostInvoices', 'canTakePayments', 'canManagePayments', 'canIssueRefunds', 'canApproveRefunds', 'canApproveCredits', 'canApproveWriteOff', 'canManageAccounting', 'canCloseAr', 'canApprovePurchases', 'canReadAudit'] },
  { id: 'seed_role_payroll', name: 'Payroll Admin', description: 'Timesheets, pay plans and pay periods.', permissions: [...BASE, 'canApproveTimesheets', 'canManagePayPlans', 'canRunPayroll', 'canReadPay'] },
  { id: 'seed_role_marketing', name: 'Marketing', description: 'Campaigns, tracking numbers and message templates.', permissions: [...BASE, 'canManageLeads', 'canManageCampaigns', 'canRunCampaigns', 'canManageTemplates', 'canSendMessages'] },
  { id: 'seed_role_customer', name: 'Customer', description: 'Customer portal API only; no dashboard.', permissions: [] },
  { id: 'seed_role_payer_contact', name: 'Payer Contact', description: 'Third-party payer portal API only (home warranty, property managers); no dashboard.', permissions: [] },
]

export type StaffSeed = { id: string; name: string; email: string; title: string; phone: string; roleId: string }

export const STAFF: StaffSeed[] = [
  { id: 'seed_user_whitfield', name: 'Dana Whitfield', email: 'dana.whitfield@summitplumbingair.com', title: 'Owner', phone: '+15125550101', roleId: 'seed_role_owner' },
  { id: 'seed_user_ortega', name: 'Marcus Ortega', email: 'marcus.ortega@summitplumbingair.com', title: 'General Manager', phone: '+15125550102', roleId: 'seed_role_gm' },
  { id: 'seed_user_raman', name: 'Priya Raman', email: 'priya.raman@summitplumbingair.com', title: 'Customer Service Representative', phone: '+15125550103', roleId: 'seed_role_csr' },
  { id: 'seed_user_mendoza', name: 'Luis Mendoza', email: 'luis.mendoza@summitplumbingair.com', title: 'Customer Service Representative', phone: '+15125550104', roleId: 'seed_role_csr' },
  { id: 'seed_user_tran', name: 'Kelsey Tran', email: 'kelsey.tran@summitplumbingair.com', title: 'Customer Service Representative', phone: '+15125550105', roleId: 'seed_role_csr' },
  { id: 'seed_user_brooks', name: 'Andre Brooks', email: 'andre.brooks@summitplumbingair.com', title: 'Dispatcher', phone: '+15125550106', roleId: 'seed_role_dispatcher' },
  { id: 'seed_user_reyes', name: 'Tomás Reyes', email: 'tomas.reyes@summitplumbingair.com', title: 'Warehouse Lead', phone: '+15125550107', roleId: 'seed_role_warehouse' },
  { id: 'seed_user_cole', name: 'Hannah Cole', email: 'hannah.cole@summitplumbingair.com', title: 'Accountant', phone: '+15125550108', roleId: 'seed_role_accounting' },
  { id: 'seed_user_kim', name: 'Rachel Kim', email: 'rachel.kim@summitplumbingair.com', title: 'Comfort Advisor', phone: '+15125550109', roleId: 'seed_role_comfort_advisor' },
]

export const BRAND = { id: 'seed_brand_summit', name: 'Summit Plumbing & Air', phone: '+15125550100', email: 'service@summitplumbingair.com', website: 'https://summitplumbingair.com' }

export const LICENSES = [
  { id: 'seed_license_acr', trade: 'hvac', jurisdictionCode: 'US-TX', issuer: 'TDLR', licenseNumber: 'TACLA00098765E', licenseClass: 'A', endorsements: ['environmental_air'], responsibleName: 'Dana Whitfield' },
  { id: 'seed_license_rmp', trade: 'plumbing', jurisdictionCode: 'US-TX', issuer: 'TSBPE', licenseNumber: 'RMP-00045678', licenseClass: 'Responsible Master Plumber', endorsements: [], responsibleName: 'Ray Castillo' },
  { id: 'seed_license_tecl', trade: 'electrical', jurisdictionCode: 'US-TX', issuer: 'TDLR', licenseNumber: 'TECL-00034567', licenseClass: 'Electrical Contractor', endorsements: [], responsibleName: 'Grace Bennett' },
] as const

export const BRANCH = {
  id: 'seed_branch_austin', name: 'Austin', code: 'AUS', timeZone: 'America/Chicago',
  line1: '4100 Industrial Blvd', city: 'Austin', region: 'TX', postalCode: '78744', country: 'US', lat: '30.209500', lng: '-97.738100',
}

export const BUSINESS_UNITS = [
  { id: 'seed_bu_hvac_service', name: 'HVAC Service', code: 'HVAC-SVC', trade: 'hvac', kind: 'service', revenueAccountCode: '4010' },
  { id: 'seed_bu_hvac_install', name: 'HVAC Install', code: 'HVAC-INS', trade: 'hvac', kind: 'install', revenueAccountCode: '4020' },
  { id: 'seed_bu_plumbing_service', name: 'Plumbing Service', code: 'PLB-SVC', trade: 'plumbing', kind: 'service', revenueAccountCode: '4110' },
  { id: 'seed_bu_electrical', name: 'Electrical', code: 'ELE-SVC', trade: 'electrical', kind: 'service', revenueAccountCode: '4210' },
] as const

export const SERVICE_AREAS = [
  { id: 'seed_area_austin', name: 'Austin core', travelZone: 'standard', zips: ['78701', '78702', '78703', '78704', '78705', '78721', '78722', '78723', '78741', '78744', '78745', '78746', '78748', '78749', '78751', '78756', '78757', '78758', '78759'] },
  { id: 'seed_area_north', name: 'Round Rock, Pflugerville & Cedar Park', travelZone: 'standard', zips: ['78613', '78660', '78664', '78665', '78681', '78717', '78727', '78728', '78729', '78750'] },
  { id: 'seed_area_extended', name: 'Extended (trip fee applies)', travelZone: 'extended', zips: ['78610', '78620', '78626', '78628', '78633', '78634', '78641', '78652', '78653', '78737', '78738', '78739'] },
] as const

/** Days the shop is closed beyond Sundays: the six major holidays (company decision, not law). */
export const COMPANY_CLOSED_HOLIDAYS = ["New Year's Day", 'Memorial Day', 'Independence Day', 'Labor Day', 'Thanksgiving Day', 'Christmas Day']

export type ApprovalPolicySeed = { action: string; description: string; requiredPermission: Permission; expiresAfterMinutes: number; thresholdMinor?: bigint }

export const APPROVAL_POLICIES: ApprovalPolicySeed[] = [
  { action: 'company.controls', description: 'Change the company-wide discount, refund and purchase-order approval thresholds.', requiredPermission: 'canApprovePolicies', expiresAfterMinutes: 1440 },
  { action: 'policy.publish', description: 'Publish a jurisdiction policy version (cancellation rights, tax, licensing, contact hours).', requiredPermission: 'canApprovePolicies', expiresAfterMinutes: 7 * 1440 },
  { action: 'role.assign_approval', description: 'Give a person a role that can approve.', requiredPermission: 'canManageRoles', expiresAfterMinutes: 1440 },
  { action: 'agent_grant.activate', description: 'Activate a tool grant for an AI agent.', requiredPermission: 'canApproveAgentGrants', expiresAfterMinutes: 1440 },
  { action: 'booking.overbook', description: 'Book past a window\'s capacity.', requiredPermission: 'canApproveOverbook', expiresAfterMinutes: 60 },
  { action: 'customer.merge', description: 'Merge two customer records.', requiredPermission: 'canApproveMerges', expiresAfterMinutes: 1440 },
  { action: 'estimate.discount', description: 'Apply a discount above the seller\'s limit.', requiredPermission: 'canApproveDiscounts', expiresAfterMinutes: 240 },
  { action: 'cancellation.start_override', description: 'Start work the buyer can still cancel, before the cooling-off window closes.', requiredPermission: 'canApprovePolicies', expiresAfterMinutes: 240 },
  { action: 'pricebook.publish', description: 'Publish a price book version.', requiredPermission: 'canApprovePriceBook', expiresAfterMinutes: 7 * 1440 },
  { action: 'invoice.write_off', description: 'Write off an invoice balance.', requiredPermission: 'canApproveWriteOff', expiresAfterMinutes: 1440 },
  { action: 'credit.issue', description: 'Issue a customer credit.', requiredPermission: 'canApproveCredits', expiresAfterMinutes: 1440 },
  { action: 'refund.issue', description: 'Refund a payment above the refund threshold.', requiredPermission: 'canApproveRefunds', expiresAfterMinutes: 1440, thresholdMinor: 50000n },
  { action: 'purchase_order.submit', description: 'Submit a purchase order above the PO threshold.', requiredPermission: 'canApprovePurchases', expiresAfterMinutes: 1440, thresholdMinor: 250000n },
  { action: 'stock.variance', description: 'Post a cycle-count variance.', requiredPermission: 'canApproveStockVariance', expiresAfterMinutes: 1440 },
  { action: 'warranty.write_off', description: 'Write off an unrecovered warranty claim.', requiredPermission: 'canApproveWarrantyWriteOff', expiresAfterMinutes: 1440 },
  { action: 'pay_plan.publish', description: 'Publish a pay plan version.', requiredPermission: 'canApprovePayPlans', expiresAfterMinutes: 1440 },
  { action: 'pay_period.approve', description: 'Approve a calculated pay period for export.', requiredPermission: 'canApprovePayPeriods', expiresAfterMinutes: 1440 },
  { action: 'ar_period.close', description: 'Close an AR period.', requiredPermission: 'canApproveArClose', expiresAfterMinutes: 1440 },
  { action: 'campaign.send', description: 'Send a marketing campaign.', requiredPermission: 'canApproveCampaigns', expiresAfterMinutes: 1440 },
]
