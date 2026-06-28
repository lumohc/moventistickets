import type { Metadata, Viewport } from 'next'
import './globals.css'
import './seat-picker.css'

export const metadata: Metadata = {
  title: 'Moventis Tickets — O movimento dos grandes eventos',
  description: 'O movimento dos grandes eventos. Compre ingressos online com escolha de assento — teatro, dança, música e mais. Pagamento por PIX ou cartão, com QR seguro no seu celular.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1F6B4E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        {/* svg-pan-zoom: necessário pro zoom (+/−), pinch no celular e arrastar o mapa.
            Servido local; carrega antes do seat-picker (defer roda em ordem). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/svg-pan-zoom.min.js" defer />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/seat-picker-lumo.js?v=13" defer />
      </body>
    </html>
  )
}
