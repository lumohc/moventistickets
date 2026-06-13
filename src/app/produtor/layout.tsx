import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal do Produtor — Moventis',
}

export default function ProdutorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
