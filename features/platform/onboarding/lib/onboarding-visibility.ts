/** The sidebar card is for an empty company: hidden once setup is finished or dismissed, or once the company has staff. */
export function shouldShowOnboardingCard(input: {
  canManageOnboarding?: boolean | null
  onboardingStatus?: string | null
  menuItemsCount?: number | null
}): boolean {
  if (!input.canManageOnboarding) return false
  if (input.onboardingStatus === "completed" || input.onboardingStatus === "dismissed") return false
  if (typeof input.menuItemsCount === "number" && input.menuItemsCount > 0) return false
  return true
}
