/** Display helpers shared by server and client parts of the customer site. */

/** "CT" for America/Chicago: the plain zone name customers say out loud. */
export function zoneLabel(timeZone: string, at: Date = new Date()) {
  try {
    const name = (style: 'shortGeneric' | 'short') => new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''
    const generic = name('shortGeneric')
    return generic && !/GMT/.test(generic) ? generic : name('short')
  } catch { return '' }
}

/** "Tue, Aug 26" for a calendar date (no time zone involved). */
export function dayText(date: string, style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: style, month: style, day: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
}

export function dayHeading(date: string, todayDate: string) {
  const next = new Date(`${todayDate}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const tomorrow = next.toISOString().slice(0, 10)
  return date === todayDate ? `Today, ${dayText(date)}` : date === tomorrow ? `Tomorrow, ${dayText(date)}` : dayText(date, 'long')
}

const split = (minor: string | bigint) => {
  const text = String(minor)
  if (!/^-?\d+$/.test(text)) return null
  const abs = text.replace('-', '').padStart(3, '0')
  return { sign: text.startsWith('-') ? '−' : '', whole: abs.slice(0, -2).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','), cents: abs.slice(-2) }
}

/** Minor units ("8900") to "$89" or "$19.95": whole dollars drop the cents. */
export function dollars(minor: string | bigint) {
  const p = split(minor)
  return p ? `${p.sign}$${p.whole}${p.cents === '00' ? '' : `.${p.cents}`}` : ''
}

/** Always with cents, for invoices. */
export function dollarsExact(minor: string | bigint) {
  const p = split(minor)
  return p ? `${p.sign}$${p.whole}.${p.cents}` : ''
}

export function timeText(iso: string, timeZone: string) {
  return `${new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))} ${zoneLabel(timeZone, new Date(iso))}`
}

/** The exact words next to the text-message box on the booking form (kept with the consent record). */
export const SMS_WORDING = 'Text me about this visit (confirmation and on-the-way). Message and data rates may apply. Reply STOP to end.'
