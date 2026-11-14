import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import { advanceTimedStates } from '../services/maintenance'
import * as labour from '../services/labour'
import { PHASE6 } from '../domain/phase6Commands'

const MODULES: Record<string, Record<string, unknown>> = { labour }

const bind = (module: string, fn: string) =>
  op(async (_root: unknown, args: Record<string, unknown>, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args
    const actor: Actor = await actorFor(context)
    await advanceTimedStates(context.prisma)
    const run = MODULES[module]?.[fn] as ((db: Db, actor: Actor, args: Record<string, unknown>) => Promise<unknown>) | undefined
    if (!run) throw new Error(`Unknown command ${module}.${fn}`)
    return run(context.prisma, actor, clean)
  })

/* Timesheets, pay plans, credit splits and pay periods (Phase 6), built from PHASE6. Every mutation takes an idempotency key. */
export const phase6TypeDefs = `
  type Mutation {
${Object.entries(PHASE6).map(([name, [, , args]]) => `    ${name}(${[...Object.entries(args).map(([k, t]) => `${k}: ${t}`), 'idempotencyKey: String!'].join(', ')}): JSON`).join('\n')}
  }
`

export const phase6Resolvers = { Mutation: Object.fromEntries(Object.entries(PHASE6).map(([name, [module, fn]]) => [name, bind(module, fn)])) }
