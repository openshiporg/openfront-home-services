// Runs the timers (lapsed holds, due price-book versions, expired estimates and notices) inside the
// production web process, so no separate worker or cron service exists. Each step is an idempotent
// command, so replicas can run it side by side.
const INTERVAL_MS = 30_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return
  const globalState = globalThis as unknown as { homeServicesMaintenanceLoop?: boolean }
  if (globalState.homeServicesMaintenanceLoop) return
  globalState.homeServicesMaintenanceLoop = true

  const [{ PrismaClient }, { runMaintenancePass }] = await Promise.all([
    import('@prisma/client'),
    import('./features/keystone/services/maintenance'),
  ])
  const prisma = new PrismaClient({ log: [] })
  let running = false
  const pass = async () => {
    if (running) return
    running = true
    try {
      await runMaintenancePass(prisma)
    } catch (error) {
      console.error(JSON.stringify({ component: 'maintenance', status: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : 'unknown error' }))
    } finally {
      running = false
    }
  }
  setInterval(() => { void pass() }, INTERVAL_MS).unref?.()
  setTimeout(() => { void pass() }, 10_000).unref?.()
}
