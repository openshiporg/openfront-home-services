import Link from 'next/link'
import { container, PageTitle, primaryButton, quietButton } from '@/features/storefront/components/Shell'

export default function NotFound() {
  return (
    <>
      <PageTitle title="We could not find that page" lead="The link may be old, or the code may have a typo." />
      <div className={`${container} mt-6 flex flex-wrap gap-3`}>
        <Link href="/book" className={primaryButton}>Book a visit</Link>
        <Link href="/sign-in" className={quietButton}>Open a visit, invoice or membership</Link>
      </div>
    </>
  )
}
