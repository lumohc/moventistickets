import type { Metadata, Viewport } from 'next'
import './globals.css'
import './seat-picker.css'

export const metadata: Metadata = {
  title: 'Moventis',
  description: 'Compra de ingressos online com escolha de assento. Teatro, dança, música e mais em Santa Catarina.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4F6654',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/seat-picker-lumo.js?v=11" defer />
      </body>
    </html>
  )
}
