import type { Actor } from '../lib/actor'
import type { Db } from '../lib/db'
import { actorFor } from './actorFor'
import { op } from './op'
import { advanceTimedStates } from '../services/maintenance'
import * as warranty from '../services/warranty'
import * as inventory from '../services/inventory'
import * as purchasing from '../services/purchasing'
import * as compliance from '../services/compliance'
import { PHASE5 } from '../domain/phase5Commands'

const MODULES: Record<string, Record<string, unknown>> = { warranty, inventory, purchasing, compliance }

const bind = (module: string, fn: string) =>
  op(async (_root: unknown, args: Record<string, unknown>, context: { session: unknown; prisma: Db }) => {
    const { now: _ignored, ...clean } = args
    const actor: Actor = await actorFor(context)
    await advanceTimedStates(context.prisma)
    const run = MODULES[module]?.[fn] as ((db: Db, actor: Actor, args: Record<string, unknown>) => Promise<unknown>) | undefined
    if (!run) throw new Error(`Unknown command ${module}.${fn}`)
    return run(context.prisma, actor, clean)
  })

/* Equipment, warranty, stock, purchasing, permits, refrigerant and liens (Phase 5), built from phase5Spec. Every mutation takes an idempotency key. */
export const phase5TypeDefs = `
  type Mutation {
${Object.entries(PHASE5).map(([name, [, , args]]) => `    ${name}(${[...Object.entries(args).map(([k, t]) => `${k}: ${t}`), 'idempotencyKey: String!'].join(', ')}): JSON`).join('\n')}
  }
`

export const phase5Resolvers = { Mutation: Object.fromEntries(Object.entries(PHASE5).map(([name, [module, fn]]) => [name, bind(module, fn)])) }
