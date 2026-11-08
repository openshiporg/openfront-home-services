/** Dollars typed by a person ("1,295.00", "$89") → whole cents as a string. Anything else is returned as typed for the server to reject. */
export function centsFromDollars(text: string) {
  const t = text.replace(/[$,\s]/g, '')
  const m = /^(\d{1,11})(?:\.(\d{1,2}))?$/.exec(t)
  return m ? `${m[1]}${(m[2] ?? '').padEnd(2, '0')}`.replace(/^0+(?=\d)/, '') : t
}

/** Whole percent with up to two decimals ("15", "7.5") → basis points; null when it isn't one. */
export function bpsFromPercent(text: string) {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim())
  if (!m) return null
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return bps <= 10_000 ? bps : null
}
