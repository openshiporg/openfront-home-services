import { PayScreen } from '@/features/storefront/screens'

export const metadata = { title: 'Your invoice', robots: { index: false, follow: false } }

const NOTICES: Record<string, string> = {
  paid: 'Payment received. Thank you.',
  unfinished: 'The card page was not finished, so nothing was charged.',
  mismatch: 'The card payment does not match this invoice. Please call us so we can check it.',
  filing: 'Your card was charged, but we could not file the payment yet. You will not be charged again; the office will finish it.',
  unread: 'We could not read the card page. If you were charged, this page will show it shortly; otherwise try again.',
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ result?: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase()
  const result = (await searchParams).result
  return <PayScreen code={code} notice={typeof result === 'string' ? NOTICES[result] : undefined} />
}
