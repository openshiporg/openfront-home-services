/** STOP-family keywords revoke consent before any other processing (I-K2, CTIA). */
export const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']
export const START_WORDS = ['START', 'UNSTOP', 'YES']
export const HELP_WORDS = ['HELP', 'INFO']

export function classifyKeyword(body: string): 'stop' | 'start' | 'help' | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (STOP_WORDS.includes(word)) return 'stop'
  if (START_WORDS.includes(word)) return 'start'
  if (HELP_WORDS.includes(word)) return 'help'
  return null
}
