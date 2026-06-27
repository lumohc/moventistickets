import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso — Moventis',
  description: 'Termos e condições de uso da plataforma Moventis.',
}

const C = {
  bg: '#F4F3EC', surface: '#FFFFFF', border: '#D8DACF',
  text: '#1A211B', muted: 'rgba(26,33,27,0.55)', green: '#1F6B4E',
}

export default function TermosPage() {
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
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 12 }}>Termos de Uso</h1>
          <p style={{ fontSize: '0.95rem', color: C.muted, lineHeight: 1.7 }}>
            Leia com atenção antes de utilizar a plataforma Moventis.
          </p>
        </div>

        <article style={{ lineHeight: 1.8 }}>
          <Section title="1. Quem somos">
            <p>A <strong>Moventis Tickets</strong> é uma plataforma digital de venda de ingressos online operada pela <strong>MOVENTIS LTDA</strong>, pessoa jurídica de direito privado com sede em Florianópolis/SC. A Moventis conecta compradores de ingressos a produtores culturais, facilitando o acesso a eventos de teatro, dança, música e outras manifestações culturais em Santa Catarina.</p>
            <p style={{ marginTop: 12 }}>A Moventis atua como <strong>intermediadora tecnológica</strong>: organiza a infraestrutura de vendas, emissão de ingressos e processamento de pagamentos, mas não é responsável pela realização, qualidade, segurança ou cancelamento dos eventos anunciados — responsabilidade esta exclusiva do <strong>produtor do evento</strong>.</p>
          </Section>

          <Section title="2. Aceitação dos Termos">
            <p>Ao acessar o site, realizar uma compra, cadastrar-se como produtor ou utilizar qualquer funcionalidade da plataforma, você declara ter lido, compreendido e concordado com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p>
            <p style={{ marginTop: 12 }}>Estes Termos se aplicam a dois perfis de usuário:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}><strong>Comprador</strong>: pessoa que adquire ingressos para eventos publicados na plataforma.</li>
              <li><strong>Produtor</strong>: pessoa física ou jurídica que cadastra e vende ingressos para seus próprios eventos por meio da plataforma.</li>
            </ul>
          </Section>

          <Section title="3. Cadastro e responsabilidade pelas informações">
            <p>Para comprar ingressos, são solicitados nome completo, CPF e e-mail. Para cadastrar-se como produtor, são exigidos dados adicionais de identificação e bancários.</p>
            <p style={{ marginTop: 12 }}>Você é responsável pela veracidade, exatidão e atualização de todas as informações fornecidas. O fornecimento de dados falsos ou de terceiros sem autorização pode implicar responsabilização civil e criminal.</p>
            <p style={{ marginTop: 12 }}>A Moventis se reserva o direito de suspender ou encerrar contas com indícios de uso fraudulento, sem aviso prévio.</p>
          </Section>

          <Section title="4. Compra de ingressos">
            <SubTitle>4.1 Processo de compra</SubTitle>
            <p>A compra é concluída após o pagamento confirmado. Enquanto o pagamento estiver pendente, os assentos ficam reservados por até <strong>15 minutos</strong>. Após esse prazo sem confirmação, a reserva é liberada automaticamente.</p>

            <SubTitle>4.2 Ingresso digital</SubTitle>
            <p>Após a confirmação do pagamento, o ingresso digital com QR code exclusivo é enviado para o e-mail informado na compra. O QR code é individual por assento e serve como único documento de acesso ao evento. Guarde-o com segurança — a Moventis não se responsabiliza por ingressos compartilhados indevidamente.</p>

            <SubTitle>4.3 Taxas</SubTitle>
            <p>Além do valor de face do ingresso (definido pelo produtor), a Moventis cobra:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}><strong>Taxa de serviço</strong>: o maior valor entre R$ 5,00 e 10% do valor do ingresso, por ingresso adquirido;</li>
              <li style={{ marginBottom: 4 }}><strong>Taxa de pagamento PIX</strong>: R$ 2,00 por pedido;</li>
              <li><strong>Taxa de pagamento cartão de crédito</strong>: 4,98% sobre o total do pedido.</li>
            </ul>
            <p style={{ marginTop: 12 }}>As taxas são exibidas de forma clara antes da confirmação da compra e <strong>não são reembolsáveis</strong>, salvo nos casos previstos na cláusula 5.</p>

            <SubTitle>4.4 Direito de arrependimento</SubTitle>
            <p>Nos termos do artigo 49 do Código de Defesa do Consumidor, o comprador pode cancelar a compra realizada remotamente em até <strong>7 dias corridos</strong> da data da compra, desde que o evento ainda não tenha ocorrido. Nesse caso, o valor de face do ingresso será reembolsado. As taxas de serviço e de pagamento não são reembolsáveis.</p>
            <p style={{ marginTop: 12 }}>O pedido de arrependimento deve ser feito por e-mail para <strong>contato@moventistickets.com.br</strong> com o número do pedido.</p>
          </Section>

          <Section title="5. Cancelamento, alteração e reembolso">
            <SubTitle>5.1 Cancelamento pelo produtor</SubTitle>
            <p>Se o evento for cancelado pelo produtor, o comprador tem direito ao reembolso integral do valor pago, incluindo taxas. A Moventis fará o reembolso em até <strong>10 dias úteis</strong> após a confirmação do cancelamento pelo produtor.</p>

            <SubTitle>5.2 Alteração de data ou local</SubTitle>
            <p>Alterações de data, horário ou local do evento são de responsabilidade exclusiva do produtor. Em caso de alteração substancial (mais de 30 dias de antecipação ou mudança de cidade), o comprador poderá solicitar reembolso do valor de face em até <strong>7 dias</strong> após a comunicação oficial da alteração.</p>

            <SubTitle>5.3 Evento realizado normalmente</SubTitle>
            <p>Não haverá reembolso por desistência do comprador após o prazo de arrependimento, por atraso de início, por questões técnicas do evento ou por insatisfação com o conteúdo artístico.</p>
          </Section>

          <Section title="6. Responsabilidades do produtor">
            <p>O produtor cadastrado na plataforma é o único responsável por:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>a realização, qualidade e segurança do evento;</li>
              <li style={{ marginBottom: 4 }}>a comunicação de alterações ou cancelamentos ao público;</li>
              <li style={{ marginBottom: 4 }}>o cumprimento das normas locais de alvará, segurança, capacidade e acessibilidade;</li>
              <li style={{ marginBottom: 4 }}>o reembolso aos compradores em caso de cancelamento;</li>
              <li style={{ marginBottom: 4 }}><strong>chargebacks e contestações de pagamento</strong>: caso um comprador conteste a cobrança junto à operadora de cartão ou banco, a responsabilidade financeira pela devolução e pelas tarifas de chargeback é integralmente do produtor. A Moventis poderá debitar esses valores do saldo a repassar ao produtor;</li>
              <li>qualquer dano causado a participantes, visitantes ou terceiros no evento.</li>
            </ul>
          </Section>

          <Section title="7. Repasse ao produtor">
            <p>A Moventis realiza o repasse dos valores arrecadados (valor de face, descontadas as taxas da plataforma) ao produtor mediante os prazos e condições acordados no momento do cadastro. O repasse está condicionado à ausência de chargebacks pendentes, disputas em aberto ou suspeitas de fraude.</p>
          </Section>

          <Section title="8. Proibições">
            <p>É vedado ao usuário (comprador ou produtor):</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>utilizar a plataforma para fins ilegais ou fraudulentos;</li>
              <li style={{ marginBottom: 4 }}>revender ingressos com sobrepreço ("cambismo") por meio da plataforma;</li>
              <li style={{ marginBottom: 4 }}>falsificar, duplicar ou compartilhar QR codes de ingressos;</li>
              <li style={{ marginBottom: 4 }}>interferir no funcionamento técnico da plataforma;</li>
              <li style={{ marginBottom: 4 }}>cadastrar eventos fictícios ou enganosos;</li>
              <li>violar direitos de propriedade intelectual de terceiros.</li>
            </ul>
            <p style={{ marginTop: 12 }}>O descumprimento pode resultar em suspensão de conta, estorno de valores e responsabilização legal.</p>
          </Section>

          <Section title="9. Propriedade intelectual">
            <p>Todo o conteúdo da plataforma Moventis — marca, logotipo, layout, código-fonte, funcionalidades, textos e imagens — é de propriedade da MOVENTIS LTDA ou de seus licenciantes. É proibida a reprodução, cópia ou uso sem autorização prévia por escrito.</p>
          </Section>

          <Section title="10. Limitação de responsabilidade">
            <p>A Moventis não se responsabiliza por:</p>
            <ul style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ marginBottom: 4 }}>falhas no evento causadas pelo produtor;</li>
              <li style={{ marginBottom: 4 }}>danos decorrentes de caso fortuito ou força maior;</li>
              <li style={{ marginBottom: 4 }}>falhas temporárias de servidores ou sistemas de terceiros;</li>
              <li>uso indevido de ingressos por terceiros após o envio ao e-mail cadastrado.</li>
            </ul>
            <p style={{ marginTop: 12 }}>A responsabilidade total da Moventis perante o comprador, em qualquer hipótese, limita-se ao valor pago pelo ingresso.</p>
          </Section>

          <Section title="11. Alterações nos Termos">
            <p>A Moventis pode atualizar estes Termos a qualquer momento. Alterações relevantes serão comunicadas por e-mail ou aviso no site com antecedência mínima de <strong>10 dias</strong>. O uso continuado da plataforma após esse prazo implica aceitação dos novos termos.</p>
          </Section>

          <Section title="12. Foro">
            <p>Estes Termos são regidos pelas leis brasileiras. Eventuais disputas serão resolvidas preferencialmente por mediação e, caso necessário, pelo foro da comarca de <strong>Florianópolis/SC</strong>, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          </Section>

          <Section title="13. Contato">
            <p><strong>MOVENTIS LTDA</strong><br />
            contato@moventistickets.com.br<br />
            Florianópolis/SC — Brasil</p>
          </Section>

          {/* Aviso */}
          <div style={{ marginTop: 48, padding: '16px 20px', background: 'rgba(31,107,78,0.06)', border: '1px solid rgba(31,107,78,0.20)', borderRadius: 10, fontSize: '0.82rem', color: C.muted, lineHeight: 1.6 }}>
            ⚠️ Este documento deve ser revisado por advogado responsável antes de qualquer uso oficial ou publicação definitiva.
          </div>

          {/* Links */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <a href="/privacidade" style={{ fontSize: '0.875rem', color: C.green, textDecoration: 'none', fontWeight: 600 }}>→ Política de Privacidade</a>
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
