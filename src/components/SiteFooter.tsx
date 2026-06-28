import { QrCode, CreditCard } from 'lucide-react'

const ES = '#1F6B4E', ESD = '#175840', LINHO = '#F4F3EC', ARGILA = '#C29A74'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const head: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ARGILA, marginBottom: 2 }
const link: React.CSSProperties = { color: 'rgba(244,243,236,0.85)', textDecoration: 'none', fontSize: '0.85rem' }

/** Rodapé institucional (marketplace): colunas + pagamento + redes + linha legal. */
export default function SiteFooter() {
  return (
    <footer style={{ background: ES, color: LINHO, marginTop: 28 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {/* Marca */}
          <div style={col}>
            <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 22, marginBottom: 4 }} />
            <p style={{ fontSize: '0.8rem', color: 'rgba(244,243,236,0.7)', lineHeight: 1.5, margin: 0 }}>
              Ingressos para os melhores eventos.
            </p>
          </div>

          <div style={col}>
            <span style={head}>Moventis</span>
            <a href="/sobre" style={link}>Sobre nós</a>
            <a href="/ingressos" style={link}>Fale conosco</a>
            <a href="/ingressos" style={link}>Central de ajuda</a>
          </div>

          <div style={col}>
            <span style={head}>Para você</span>
            <a href="/privacidade" style={link}>Política de Privacidade</a>
            <a href="/termos" style={link}>Termos de Uso</a>
            <a href="/termos" style={link}>Reembolso e Troca</a>
            <a href="/privacidade" style={link}>Cookies</a>
            <a href="/termos" style={link}>Meia-entrada</a>
          </div>

          <div style={col}>
            <span style={head}>Para produtores</span>
            <a href="/produtor/login" style={link}>Portal do Produtor</a>
            <a href="/produtor/cadastro" style={link}>Criar evento</a>
          </div>

          <div style={col}>
            <span style={head}>Pagamento</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(244,243,236,0.85)', fontSize: '0.85rem' }}>
              <QrCode size={18} strokeWidth={1.6} /> PIX
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(244,243,236,0.85)', fontSize: '0.85rem' }}>
              <CreditCard size={18} strokeWidth={1.6} /> Cartão
            </span>
            <span style={{ ...head, marginTop: 10 }}>Redes</span>
            <span style={{ display: 'flex', gap: 14 }}>
              <a href="https://instagram.com" aria-label="Instagram" style={{ color: LINHO, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" /></svg>
              </a>
              <a href="https://facebook.com" aria-label="Facebook" style={{ color: LINHO, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
            </span>
          </div>
        </div>

        {/* Linha legal — razão social / CNPJ ficam nos Termos */}
        <div style={{ borderTop: `1px solid ${ESD}`, marginTop: 12, padding: '10px 0 14px', fontSize: '0.74rem', color: 'rgba(244,243,236,0.55)' }}>
          © 2026 Moventis · <a href="/termos" style={{ color: 'rgba(244,243,236,0.7)', textDecoration: 'none' }}>Termos de Uso</a>
        </div>
      </div>
    </footer>
  )
}
