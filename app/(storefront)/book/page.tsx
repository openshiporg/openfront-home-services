import { BookScreen } from '@/features/storefront/screens'

export const metadata = { title: 'Book a visit' }

export default async function Page({ searchParams }: { searchParams: Promise<{ trade?: string; job?: string }> }) {
  const { trade, job } = await searchParams
  return <BookScreen trade={typeof trade === 'string' ? trade : undefined} job={typeof job === 'string' ? job : undefined} />
}
