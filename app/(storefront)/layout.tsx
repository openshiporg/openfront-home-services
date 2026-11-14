import type { Metadata } from 'next'
import { Manrope, Tektur } from 'next/font/google'
import { Footer, Header } from '@/features/storefront/components/Shell'
import { getCompany, servedPlaces } from '@/features/storefront/lib/data'

const body = Manrope({ subsets: ['latin'], variable: '--font-sf' })
const logo = Tektur({ subsets: ['latin'], variable: '--font-sf-logo', weight: ['400', '500'] })

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompany()
  const places = servedPlaces(company)
  return {
    title: { default: `${company.name}: book a visit`, template: `%s · ${company.name}` },
    description: `Heating and cooling, plumbing and electrical${places ? ` in ${places}` : ''}. Book an arrival window online${company.phone ? ` or call ${company.phone}` : ''}.`,
  }
}

/** The customer site: white, charcoal type, one safety orange. Light only, whatever the office theme is. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${body.variable} ${logo.variable} flex min-h-screen flex-col bg-white font-[family-name:var(--font-sf)] text-[#1f2326] antialiased [color-scheme:light]`}>
      <a href="#sf-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[5px] focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:shadow">Skip to the page</a>
      <Header />
      <main id="sf-main" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
