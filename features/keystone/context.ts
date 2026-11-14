import { getContext } from '@keystone-6/core/context'
import config from './index'
import { type Context } from '.keystone/types'
import * as PrismaModule from "@prisma/client";

// Making sure multiple prisma clients are not created during hot reloading
export const keystoneContext: Context =
  (globalThis as any).keystoneContext ?? getContext(config, PrismaModule);

// Cached in production too: every route bundle that imports this file would otherwise build its own client and its own pool,
// and each pool holds open connections (the database ran out of them once).
(globalThis as any).keystoneContext = keystoneContext;