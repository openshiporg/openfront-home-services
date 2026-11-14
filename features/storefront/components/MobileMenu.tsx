'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Phone, X } from 'lucide-react'

type Item = { href: string; label: string; sub?: boolean }

export function MobileMenu({ links, phone, phoneHref }: { links: Item[]; phone: string; phoneHref: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [seen, setSeen] = useState(pathname)
  if (seen !== pathname) { setSeen(pathname); setOpen(false) }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="sf-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(v => !v)} className="-mr-2 flex size-11 items-center justify-center">
        {open ? <X className="size-7" strokeWidth={2.5} /> : <Menu className="size-7" strokeWidth={2.5} />}
      </button>
      {open ? (
        <nav id="sf-menu" aria-label="Main" className="absolute inset-x-0 top-[60px] z-40 border-b border-[#d9dcdf] bg-white px-4 pb-5 shadow-[0_12px_24px_rgba(31,35,38,0.12)]">
          <ul>
            {links.map(l => (
              <li key={l.href} className="border-b border-[#eceef0]">
                <Link href={l.href} onClick={() => setOpen(false)} className={`flex min-h-12 items-center ${l.sub ? 'pl-5 text-[16px] text-[#3d4347]' : 'text-[18px] font-bold'}`}>{l.label}</Link>
              </li>
            ))}
          </ul>
          {phone ? <a href={phoneHref} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-[5px] border border-[#1f2326] text-[17px] font-bold"><Phone className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />{phone}</a> : null}
        </nav>
      ) : null}
    </div>
  )
}
