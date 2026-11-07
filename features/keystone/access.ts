// Role permissions (SCHEMA §1.5). Operate and approve permissions come in pairs so one person never
// needs both halves of a control; the separation-of-duties check still blocks self-approval when a
// user happens to hold both.
export const permissionNames = [
  // Starter and fleet-mandatory
  'canSeeOtherPeople', 'canEditOtherPeople', 'canManagePeople', 'canManageRoles', 'canAccessDashboard',
  'canManageOnboarding', 'canManagePayments', 'canIssueRefunds', 'canReadAudit',
  // Company, integrations, policies and operations
  'canManageCompany', 'canManageIntegrations', 'canManagePolicies', 'canApprovePolicies',
  // CRM
  'canManageCustomers', 'canMergeCustomers', 'canApproveMerges', 'canRevealAccessSecret', 'canReadCustomerPII',
  // Demand
  'canManageLeads', 'canManageCampaigns',
  // Booking and dispatch
  'canBook', 'canOverbook', 'canApproveOverbook', 'canDispatch', 'canViewBoard',
  // Field (staff tech app)
  'canWorkVisits', 'canPresentEstimates', 'canSellEstimates',
  // Price book and discounts
  'canManagePriceBook', 'canApprovePriceBook', 'canApproveDiscounts',
  // Billing
  'canManageInvoices', 'canTakePayments', 'canPostInvoices', 'canApproveWriteOff', 'canApproveCredits', 'canApproveRefunds',
  // Financing and memberships
  'canOfferFinancing', 'canManageMemberships', 'canSellMemberships',
  // Equipment and warranty
  'canManageEquipment', 'canSubmitWarrantyClaims', 'canApproveWarrantyWriteOff',
  // Inventory and purchasing
  'canManageInventory', 'canPurchase', 'canReceive', 'canApprovePurchases', 'canApproveStockVariance',
  // Compliance
  'canManagePermits', 'canManageRefrigerant',
  // Labour and pay
  'canApproveTimesheets', 'canManagePayPlans', 'canRunPayroll', 'canApprovePayPlans', 'canApprovePayPeriods', 'canReadPay',
  // Accounting
  'canManageAccounting', 'canCloseAr', 'canApproveArClose',
  // Communications
  'canSendMessages', 'canManageTemplates', 'canRunCampaigns', 'canApproveCampaigns',
  // Agents
  'canManageAgents', 'canApproveAgentGrants',
  // Raw status override. Never seeded on a default role; every use is audited.
  'canBreakGlass',
] as const

export type Permission = typeof permissionNames[number]

/** Permissions that let a user decide someone else's request. Assigning a role holding one of these is maker-checker. */
export const approvalPermissions = permissionNames.filter(name => name.startsWith('canApprove') || name === 'canBreakGlass') as Permission[]

export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email?: string
    kind?: string | null
    accessExpiresAt?: string | null
    role: ({ id: string; name: string } & Record<Permission, boolean>) | null
  }
}

type AccessArgs = { session?: Session | null }

/** Signed in, and not past a time-boxed access window (auditors, temporary administrator users). */
export const isSignedIn = ({ session }: AccessArgs) => {
  if (!session) return false
  const expires = session.data?.accessExpiresAt
  return !expires || Date.parse(expires) > Date.now()
}

export const hasPermission = (session: Session | null | undefined, permission: Permission) =>
  isSignedIn({ session }) && session?.data.role?.[permission] === true

export const permissions = Object.fromEntries(
  permissionNames.map(name => [name, ({ session }: AccessArgs) => hasPermission(session, name)])
) as Record<Permission, (args: AccessArgs) => boolean>

/** Any of the given permissions. */
export const anyOf = (...names: Permission[]) => ({ session }: AccessArgs) => names.some(name => hasPermission(session, name))

/** Only server code (through context.sudo()) may perform the operation. */
export const sys = () => false

export const rules = {
  canReadPeople: ({ session }: AccessArgs) =>
    !isSignedIn({ session }) ? false : session!.data.role?.canSeeOtherPeople || session!.data.role?.canManagePeople ? true : { id: { equals: session!.itemId } },
  canUpdatePeople: ({ session }: AccessArgs) =>
    !isSignedIn({ session }) ? false : session!.data.role?.canEditOtherPeople || session!.data.role?.canManagePeople ? true : { id: { equals: session!.itemId } },
}
