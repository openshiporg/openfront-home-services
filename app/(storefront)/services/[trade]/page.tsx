import { TradeScreen } from '@/features/storefront/screens'
import { TRADE_COPY, tradeBySlug } from '@/features/storefront/lib/data'

export async function generateMetadata({ params }: { params: Promise<{ trade: string }> }) {
  const trade = tradeBySlug((await params).trade)
  return { title: trade ? TRADE_COPY[trade].name : 'Services' }
}

export default async function Page({ params }: { params: Promise<{ trade: string }> }) {
  return <TradeScreen slug={(await params).trade} />
}
