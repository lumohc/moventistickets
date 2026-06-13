import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './seat-picker.css'

export const metadata: Metadata = {
  title: 'Moventis',
  description: 'Compra de ingressos online',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="/seat-picker-lumo.js?v=2" strategy="afterInteractive" />
      </body>
    </html>
  )
}
