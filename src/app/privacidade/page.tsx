import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Moventis',
  description: 'Como a Moventis coleta, usa e protege seus dados pessoais.',
}

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E',
}

export default function PrivacidadePage() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/moventis-wordmark.svg" alt="Moventis" style={{ height: 44 }} />
        </a>
        <a href="/eventos" style={{ fontSize: '0.85rem', color: C.muted, textDecoration: 'none' }}>← Voltar</a>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: '0.75rem', color: C.green, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Última atualização: junho de 2026</p>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 12 }}>Política de Privacidade</h1>
          <p style={{ fontSize: '0.95rem', color: C.muted, lineHeight: 1.7 }}>
            Como coletamos, usamos e protegemos seus dados pessoais na plataforma Moventis, em conformidade com a LGPD.
          </p>
        </div>

        <article style={{ lineHeight: 1.8 }}>
          <Section title="1. Introdução">
            <p>A <strong>MOVENTIS LTDA</strong>, operadora da plataforma <strong>Moventis Tickets</strong> (moventistickets.com.br), trata seus dados pessoais com responsabilidade, transparência e em conformidade com a <strong>Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)</strong> e demais normas aplicáveis.</p>
            <p style={{ marginTop: 12 }}>Esta Política descreve quais dados coletamos, por que coletamos, como usamos, com quem compartilhamos e quais são seus direitos.</p>
          </Section>

          <Section title="2. Dados que coletamos">
            <SubTitle>2.1 Compradores de ingressos</SubTitle>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>Nome completo</li>
              <li style={{ marginBottom: 4 }}>CPF</li>
              <li style={{ marginBottom: 4 }}>Endereço de e-mail</li>
              <li style={{ marginBottom: 4 }}>Dados de pagamento (processados diretamente pelo gateway Asaas — a Moventis não armazena dados de cartão)</li>
              <li>Histórico de pedidos e ingressos</li>
            </ul>

            <SubTitle>2.2 Produtores cadastrados</SubTitle>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>Nome completo ou razão social</li>
              <li style={{ marginBottom: 4 }}>CPF ou CNPJ</li>
              <li style={{ marginBottom: 4 }}>E-mail e telefone</li>
              <li style={{ marginBottom: 4 }}>Dados bancários para repasse (agência, conta, chave PIX)</li>
              <li>Dados dos eventos cadastrados</li>
            </ul>

            <SubTitle>2.3 Dados coletados automaticamente</SubTitle>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>Endereço IP</li>
              <li style={{ marginBottom: 4 }}>Tipo de navegador e dispositivo</li>
              <li style={{ marginBottom: 4 }}>Páginas acessadas e tempo de navegação</li>
              <li>Cookies de sessão (veja seção 7)</li>
            </ul>
          </Section>

          <Section title="3. Como usamos seus dados">
            <p>Utilizamos seus dados para:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>processar e confirmar a compra de ingressos;</li>
              <li style={{ marginBottom: 4 }}>enviar o ingresso digital com QR code por e-mail;</li>
              <li style={{ marginBottom: 4 }}>realizar o check-in no evento (validação do QR code);</li>
              <li style={{ marginBottom: 4 }}>efetuar repasses financeiros aos produtores;</li>
              <li style={{ marginBottom: 4 }}>prevenir fraudes e chargebacks;</li>
              <li style={{ marginBottom: 4 }}>cumprir obrigações legais e fiscais;</li>
              <li style={{ marginBottom: 4 }}>enviar comunicações sobre pedidos, alterações ou cancelamentos de eventos;</li>
              <li>com seu consentimento explícito: enviar novidades e promoções da plataforma.</li>
            </ul>
            <p style={{ marginTop: 12, fontWeight: 600 }}>Não vendemos seus dados a terceiros. Não utilizamos seus dados para fins diferentes dos descritos acima sem novo consentimento.</p>
          </Section>

          <Section title="4. Base legal para o tratamento">
            <p>O tratamento de dados na Moventis é fundamentado nas seguintes bases legais da LGPD:</p>
            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(31,107,78,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700 }}>Finalidade</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700 }}>Base legal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Processar a compra', 'Execução de contrato (art. 7º, V)'],
                    ['Emitir e enviar ingressos', 'Execução de contrato (art. 7º, V)'],
                    ['Prevenção a fraudes', 'Legítimo interesse (art. 7º, IX)'],
                    ['Cumprimento fiscal', 'Obrigação legal (art. 7º, II)'],
                    ['Marketing e novidades', 'Consentimento (art. 7º, I)'],
                  ].map(([fin, base], i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(26,33,27,0.02)' }}>
                      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: 'rgba(26,33,27,0.75)' }}>{fin}</td>
                      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: 'rgba(26,33,27,0.75)' }}>{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="5. Compartilhamento de dados">
            <p>Seus dados podem ser compartilhados com:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 10 }}><strong>Asaas Pagamentos S.A.</strong>: para processamento de pagamentos via PIX e cartão. A Asaas possui sua própria Política de Privacidade e é certificada PCI-DSS;</li>
              <li style={{ marginBottom: 10 }}><strong>Produtor do evento</strong>: nome e e-mail do comprador podem ser compartilhados com o produtor responsável pelo evento adquirido, para fins de check-in e comunicação;</li>
              <li><strong>Autoridades públicas</strong>: quando exigido por lei, ordem judicial ou regulamentação aplicável.</li>
            </ul>
            <p style={{ marginTop: 12 }}>Não compartilhamos dados com anunciantes, corretoras, seguradoras ou outras empresas para fins comerciais.</p>
          </Section>

          <Section title="6. Retenção dos dados">
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(31,107,78,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700 }}>Categoria</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700 }}>Prazo de retenção</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Dados de compra e ingressos', '5 anos (obrigação fiscal)'],
                    ['Dados de cadastro de produtor', 'Enquanto a conta estiver ativa + 5 anos'],
                    ['Dados de pagamento', 'Conforme política da Asaas'],
                    ['Logs de acesso', '6 meses (Marco Civil da Internet)'],
                    ['Dados para marketing', 'Até o cancelamento do consentimento'],
                  ].map(([cat, prazo], i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(26,33,27,0.02)' }}>
                      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: 'rgba(26,33,27,0.75)' }}>{cat}</td>
                      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, color: 'rgba(26,33,27,0.75)' }}>{prazo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12 }}>Após o prazo, os dados são anonimizados ou excluídos de forma segura.</p>
          </Section>

          <Section title="7. Cookies">
            <p>Utilizamos cookies essenciais para o funcionamento da plataforma (manutenção de sessão, segurança). Não utilizamos cookies de rastreamento publicitário de terceiros.</p>
            <p style={{ marginTop: 12 }}>Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar o funcionamento do site.</p>
          </Section>

          <Section title="8. Segurança">
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>conexão criptografada via HTTPS (TLS);</li>
              <li style={{ marginBottom: 4 }}>armazenamento em servidores seguros (Supabase — AWS);</li>
              <li style={{ marginBottom: 4 }}>acesso restrito aos dados por equipe autorizada;</li>
              <li>não armazenamento de dados de cartão de crédito.</li>
            </ul>
            <p style={{ marginTop: 12 }}>Nenhum sistema é 100% inviolável. Em caso de incidente de segurança que possa afetar seus dados, você será notificado conforme exigido pela LGPD.</p>
          </Section>

          <Section title="9. Seus direitos (LGPD, art. 18)">
            <p>Você tem direito a:</p>
            <ol style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}><strong>Confirmar</strong> a existência de tratamento dos seus dados;</li>
              <li style={{ marginBottom: 4 }}><strong>Acessar</strong> os dados que temos sobre você;</li>
              <li style={{ marginBottom: 4 }}><strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados;</li>
              <li style={{ marginBottom: 4 }}><strong>Anonimizar, bloquear ou eliminar</strong> dados desnecessários ou tratados em desconformidade;</li>
              <li style={{ marginBottom: 4 }}><strong>Portabilidade</strong> dos dados a outro fornecedor;</li>
              <li style={{ marginBottom: 4 }}><strong>Revogar o consentimento</strong> para tratamentos baseados em consentimento;</li>
              <li style={{ marginBottom: 4 }}><strong>Opor-se</strong> a tratamentos baseados em legítimo interesse;</li>
              <li><strong>Ser informado</strong> sobre com quem compartilhamos seus dados.</li>
            </ol>
            <p style={{ marginTop: 12 }}>Para exercer seus direitos, envie e-mail para <strong>privacidade@moventistickets.com.br</strong> com o assunto "Direitos LGPD" e seu CPF. Responderemos em até <strong>15 dias úteis</strong>.</p>
          </Section>

          <Section title="10. Dados de menores de idade">
            <p>A plataforma é destinada a maiores de 18 anos. Não coletamos dados de menores de forma intencional. Caso identifiquemos dados de menor cadastrado sem autorização do responsável legal, procederemos com a exclusão imediata.</p>
          </Section>

          <Section title="11. Encarregado de Dados (DPO)">
            <p>Nossa encarregada de proteção de dados pode ser contatada pelo e-mail <strong>privacidade@moventistickets.com.br</strong>.</p>
          </Section>

          <Section title="12. Alterações nesta Política">
            <p>Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível em <strong>moventistickets.com.br/privacidade</strong>, com a data da última atualização. Alterações relevantes serão comunicadas por e-mail.</p>
          </Section>

          <Section title="13. Contato">
            <p><strong>MOVENTIS LTDA</strong><br />
            privacidade@moventistickets.com.br<br />
            contato@moventistickets.com.br<br />
            Florianópolis/SC — Brasil</p>
          </Section>

          {/* Aviso */}
          <div style={{ marginTop: 48, padding: '16px 20px', background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.20)', borderRadius: 10, fontSize: '0.82rem', color: C.muted, lineHeight: 1.6 }}>
            ⚠️ Este documento deve ser revisado por advogado responsável antes de qualquer uso oficial ou publicação definitiva.
          </div>

          {/* Links */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <a href="/termos" style={{ fontSize: '0.875rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>→ Termos de Uso</a>
            <a href="/eventos" style={{ fontSize: '0.875rem', color: C.muted, textDecoration: 'none' }}>← Voltar para eventos</a>
          </div>
        </article>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: C.muted }}>
          © 2026 Moventis · <a href="/termos" style={{ color: C.green, textDecoration: 'none' }}>Termos</a> · <a href="/privacidade" style={{ color: C.green, textDecoration: 'none' }}>Privacidade</a>
        </p>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: '1.1rem', fontWeight: 700, color: '#1A211B',
        letterSpacing: '-0.02em', marginBottom: 14,
        paddingBottom: 10, borderBottom: '1px solid #D8DACF',
      }}>{title}</h2>
      <div style={{ fontSize: '0.93rem', color: 'rgba(26,33,27,0.75)', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A211B', marginTop: 20, marginBottom: 8 }}>
      {children}
    </h3>
  )
}
