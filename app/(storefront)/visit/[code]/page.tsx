import { VisitScreen } from '@/features/storefront/screens'

export const metadata = { title: 'Your visit', robots: { index: false, follow: false } }

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ booked?: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase()
  return <VisitScreen code={code} booked={(await searchParams).booked === '1'} />
}
