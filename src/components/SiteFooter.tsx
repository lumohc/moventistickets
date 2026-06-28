import { QrCode, CreditCard } from 'lucide-react'

const ES = '#1F6B4E', ESD = '#175840', LINHO = '#F4F3EC', ARGILA = '#C29A74'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 9 }
const head: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ARGILA, marginBottom: 4 }
const link: React.CSSProperties = { color: 'rgba(244,243,236,0.85)', textDecoration: 'none', fontSize: '0.85rem' }

/** Rodapé institucional (marketplace): colunas + pagamento + redes + linha legal. */
export default function SiteFooter() {
  return (
    <footer style={{ background: ES, color: LINHO, marginTop: 48 }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 22 }}>
          {/* Marca */}
          <div style={col}>
            <img src="/moventis-wordmark-mono-linho.svg" alt="Moventis" style={{ height: 24, marginBottom: 6 }} />
            <p style={{ fontSize: '0.8rem', color: 'rgba(244,243,236,0.7)', lineHeight: 1.6, margin: 0 }}>
              Ingressos para eventos em Santa Catarina.
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

        {/* Linha legal */}
        <div style={{ borderTop: `1px solid ${ESD}`, marginTop: 20, padding: '12px 0 16px', fontSize: '0.74rem', color: 'rgba(244,243,236,0.6)', lineHeight: 1.6 }}>
          © 2026 Moventis · Pedro Neves Araujo (MEI) · CNPJ 61.153.718/0001-02 · Florianópolis/SC
        </div>
      </div>
    </footer>
  )
}
