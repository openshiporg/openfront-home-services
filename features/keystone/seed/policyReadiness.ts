import type { Db } from '../lib/db'
import { POLICY_PACKS, versionsOf } from './policyPacks'

/**
 * Every policy pack, version and binding the product needs, checked against the database. A sale,
 * a notice or a contact-hours check fails closed (POLICY_MISSING) without them, so the release step
 * loads them (npm run policies:ensure) and /api/health refuses to report healthy while any is absent.
 */
export async function missingPolicies(db: Db): Promise<string[]> {
  const missing: string[] = []
  const bindings = await db.policyBinding.findMany({ where: { id: { in: POLICY_PACKS.map(p => p.binding.id) }, status: 'active' }, select: { id: true } })
  const versions = await db.policyVersion.findMany({ where: { id: { in: POLICY_PACKS.flatMap(p => versionsOf(p).map(v => v.id)) }, status: 'active' }, select: { id: true } })
  const haveBinding = new Set(bindings.map(b => b.id))
  const haveVersion = new Set(versions.map(v => v.id))
  for (const pack of POLICY_PACKS) {
    if (!haveBinding.has(pack.binding.id)) missing.push(`${pack.code}: no active binding`)
    for (const v of versionsOf(pack)) if (!haveVersion.has(v.id)) missing.push(`${pack.code}: version ${v.versionNumber} missing`)
  }
  return missing
}
