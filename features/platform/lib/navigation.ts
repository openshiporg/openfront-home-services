import {
  Bot, BookOpenCheck, Boxes, CalendarClock, ClipboardCheck, ClipboardList, Contact, CreditCard, FileText, Gauge, HardHat, LucideIcon,
  Megaphone, PhoneCall, Wallet, Landmark, Calculator, Repeat, Scale, Settings, Smartphone, Tags, Truck, Users, Wrench,
} from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  color: string
  description: string
  icon: LucideIcon
  group?: string
  /** Role permission needed to open the screen; without it the link is hidden and the route is a 404. */
  requires?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

/**
 * Dashboard screens (BUILD-PLAN §2). Each route is a thin wrapper in app/dashboard/(admin)/platform
 * over a feature slice in features/platform/<slice>. Every planned screen is listed; a screen shows
 * in the menu once its phase ships (SHIPPED_ROUTES).
 */
export const platformNavItems: PlatformNavItem[] = [
  { title: 'Today', href: '/platform/today', color: 'blue', description: 'Booked vs capacity, calls, unassigned visits, techs, revenue and open approvals.', icon: Gauge, group: 'standalone' },

  { title: 'Leads', href: '/platform/leads', color: 'amber', description: 'Inbox with response timers, source and disposition.', icon: Megaphone, group: 'calls' },
  { title: 'Calls', href: '/platform/calls', color: 'amber', description: 'Call log with recordings and transcripts, AI and human.', icon: PhoneCall, group: 'calls' },
  { title: 'Book a job', href: '/platform/book', color: 'amber', description: 'Customer and location, job type, arrival window, confirm.', icon: CalendarClock, group: 'calls' },

  { title: 'Dispatch board', href: '/platform/dispatch', color: 'green', description: 'Arrival windows by technician; assign, reassign, recommendations.', icon: Truck, group: 'dispatch' },
  { title: 'Jobs', href: '/platform/jobs', color: 'green', description: 'Jobs, visits, timeline and work lines.', icon: Wrench, group: 'dispatch' },

  { title: 'Customers', href: '/platform/customers', color: 'cyan', description: 'Customers, contacts, service locations and consent.', icon: Contact, group: 'customers' },

  { title: 'Estimates', href: '/platform/estimates', color: 'violet', description: 'Good/better/best options, presentation and versions.', icon: FileText, group: 'sales' },
  { title: 'Cancellations', href: '/platform/cancellations', color: 'violet', description: 'Cancellation notices with cancel-by countdown.', icon: Scale, group: 'sales' },
  { title: 'Price book', href: '/platform/pricebook', color: 'violet', description: 'Categories, items, markup tables and publishing.', icon: Tags, group: 'sales' },

  { title: 'Invoices', href: '/platform/invoices', color: 'emerald', description: 'Invoices, payments, batches and AR.', icon: CreditCard, group: 'billing' },
  { title: 'Payments', href: '/platform/payments', color: 'emerald', description: 'Daily batches by tender, deposits and unknown results.', icon: Wallet, group: 'billing' },
  { title: 'Financing', href: '/platform/financing', color: 'emerald', description: 'Records of lender offers, status and payouts.', icon: Landmark, group: 'billing' },
  { title: 'Accounting', href: '/platform/accounting', color: 'emerald', description: 'AR periods and the accounting export.', icon: Calculator, group: 'billing' },
  { title: 'Memberships', href: '/platform/memberships', color: 'emerald', description: 'Members, what is left on each plan, and standing today.', icon: Repeat, group: 'memberships', requires: 'canSellMemberships' },
  { title: 'Membership plans', href: '/platform/membership-plans', color: 'emerald', description: 'Plans, prices, what each includes, and publishing.', icon: Tags, group: 'memberships', requires: 'canManageMemberships' },
  { title: 'Due for service', href: '/platform/due-for-service', color: 'emerald', description: 'Call list of visits members and agreements are owed.', icon: CalendarClock, group: 'memberships', requires: 'canSellMemberships' },
  { title: 'Renewals', href: '/platform/renewals', color: 'emerald', description: 'Memberships ending soon, with the message to send and a CSV.', icon: ClipboardList, group: 'memberships', requires: 'canSellMemberships' },
  { title: 'Billing runs', href: '/platform/billing-runs', color: 'emerald', description: 'Charge the month\'s membership payments with one button.', icon: CreditCard, group: 'memberships', requires: 'canManageMemberships' },
  { title: 'Service agreements', href: '/platform/agreements', color: 'emerald', description: 'Planned maintenance for commercial customers.', icon: FileText, group: 'memberships', requires: 'canManageMemberships' },

  { title: 'Equipment', href: '/platform/equipment', color: 'orange', description: 'Installed equipment, warranty registrations and claims.', icon: HardHat, group: 'operations' },
  { title: 'Inventory', href: '/platform/inventory', color: 'orange', description: 'Warehouse and truck stock, replenishment and purchase orders.', icon: Boxes, group: 'operations' },
  { title: 'Policies', href: '/platform/policies', color: 'orange', description: 'Jurisdiction policy packs, versions and sources.', icon: Scale, group: 'operations' },

  { title: 'Technicians', href: '/platform/team', color: 'pink', description: 'Technicians, credentials, skills, shifts and on-call.', icon: Users, group: 'team' },
  { title: 'Field app', href: '/field/today', color: 'pink', description: "A technician's day on a phone: visits, status, checklist, photos.", icon: Smartphone, group: 'team' },

  { title: 'Agents', href: '/platform/agents', color: 'slate', description: 'Agent grants, autonomy, kill switch and action review.', icon: Bot, group: 'admin' },
  { title: 'Approvals', href: '/platform/approvals', color: 'slate', description: 'Maker-checker requests waiting for a second person.', icon: ClipboardCheck, group: 'admin' },
  { title: 'Tasks', href: '/platform/tasks', color: 'slate', description: 'Work queues: follow-ups, overdue registrations, exceptions.', icon: ClipboardList, group: 'admin' },
  { title: 'Audit log', href: '/platform/audit', color: 'slate', description: 'Hash-chained audit events and chain verification.', icon: BookOpenCheck, group: 'admin', requires: 'canReadAudit' },
  { title: 'Settings', href: '/platform/settings', color: 'slate', description: 'Company, licences, branches, business units, calendars and approval policies.', icon: Settings, group: 'admin' },
]

/** Routes that exist in this build. Others stay out of the menu until their phase ships. */
export const SHIPPED_ROUTES = new Set<string>([
  // Phase 0: the spine
  '/platform/approvals', '/platform/tasks', '/platform/audit', '/platform/settings', '/platform/policies',
  // Phase 1: CRM, booking, dispatch, field
  '/platform/today', '/platform/leads', '/platform/calls', '/platform/book', '/platform/dispatch', '/platform/jobs',
  '/platform/customers', '/platform/team', '/field/today',
  // Phase 2: price book, estimates, cancellation rights
  '/platform/estimates', '/platform/cancellations', '/platform/pricebook',
  // Phase 3: invoices, payments, financing, accounting
  '/platform/invoices', '/platform/payments', '/platform/financing', '/platform/accounting',
  // Phase 4: memberships, billing runs, renewals, service agreements
  '/platform/memberships', '/platform/membership-plans', '/platform/due-for-service', '/platform/renewals', '/platform/billing-runs', '/platform/agreements',
])

const shipped = platformNavItems.filter(item => SHIPPED_ROUTES.has(item.href))

export const platformStandaloneItems = shipped.filter(item => item.group === 'standalone')

const GROUPS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: 'calls', title: 'Calls & Leads', icon: PhoneCall },
  { id: 'dispatch', title: 'Dispatch', icon: Truck },
  { id: 'customers', title: 'Customers', icon: Contact },
  { id: 'sales', title: 'Sales', icon: FileText },
  { id: 'billing', title: 'Billing', icon: CreditCard },
  { id: 'memberships', title: 'Memberships', icon: Repeat },
  { id: 'operations', title: 'Operations', icon: HardHat },
  { id: 'team', title: 'Team', icon: Users },
  { id: 'admin', title: 'Admin', icon: Settings },
]

export const platformNavGroups: PlatformNavGroup[] = GROUPS
  .map(group => ({ ...group, items: shipped.filter(item => item.group === group.id) }))
  .filter(group => group.items.length > 0)

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return shipped.map(item => ({ ...item, href: `${basePath}${item.href}` }))
}
