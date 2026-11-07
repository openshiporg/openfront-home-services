import { PrismaClient } from '@prisma/client'
import { runWorkerPass } from '../features/keystone/services/worker'
import { setTelephony, twilioTelephony } from '../features/integrations/telephony'

// `npm run worker` runs one pass (for cron); `npm run worker -- --loop` keeps going every 15 s.
async function main() {
  const prisma = new PrismaClient()
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    setTelephony(twilioTelephony({ accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }))
  }
  const loop = process.argv.includes('--loop')
  try {
    do {
      const result = await runWorkerPass(prisma)
      console.log(JSON.stringify({ at: new Date().toISOString(), ...result }))
      if (loop) await new Promise(resolve => setTimeout(resolve, 15_000))
    } while (loop)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error('worker failed:', error instanceof Error ? error.message.slice(0, 300) : 'unknown error')
  process.exit(1)
})
