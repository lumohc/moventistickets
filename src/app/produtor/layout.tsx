import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal do Produtor — Lumo Tickets',
}

export default function ProdutorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
