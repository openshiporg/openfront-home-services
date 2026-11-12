import { exportCsv, toCsv } from '@/features/keystone/lib/csvRoute'
import { registrationList } from '@/features/keystone/services/warranty'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => exportCsv(request, '/api/warranty-registrations/csv', ['canManageEquipment', 'canSubmitWarrantyClaims'], 'warranty-registrations.csv', async db => {
  const rows = await registrationList(db)
  return toCsv([['Registration', 'Status', 'Deadline', 'Days left', 'Maker', 'Model', 'Serial', 'Address'], ...rows.map(r => [r.ref, r.effectiveStatus, r.deadline, r.daysLeft, r.equipment?.manufacturer, r.equipment?.modelNumber, r.equipment?.serialNumber, `${r.equipment?.location?.address1 ?? ''}, ${r.equipment?.location?.city ?? ''}`])])
})
