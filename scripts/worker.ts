import { PrismaClient } from '@prisma/client'
import { runWorkerPass } from '../features/keystone/services/worker'
import { recordHeartbeat } from '../features/keystone/services/workerHeartbeat'
import { setTelephony, twilioTelephony } from '../features/integrations/telephony'

// `npm run worker` runs one pass (for cron); `npm run worker -- --loop` keeps going every 15 s and
// never exits on a failed pass (the live start command runs it beside the web server). Each pass
// leaves a heartbeat row that /api/health reports.
const INTERVAL_MS = 15_000

async function main() {
  const prisma = new PrismaClient({ log: [] })
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    setTelephony(twilioTelephony({ accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }))
  }
  const loop = process.argv.includes('--loop')
  try {
    do {
      try {
        const result = await runWorkerPass(prisma)
        console.log(JSON.stringify({ at: new Date().toISOString(), ...result }))
        await recordHeartbeat(prisma, { ok: true, result })
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : 'unknown error'
        console.error('worker pass failed:', message)
        await recordHeartbeat(prisma, { ok: false, error: message }).catch(() => undefined)
        if (!loop) throw error
      }
      if (loop) await new Promise(resolve => setTimeout(resolve, INTERVAL_MS))
    } while (loop)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error('worker failed:', error instanceof Error ? error.message.slice(0, 300) : 'unknown error')
  process.exit(1)
})
