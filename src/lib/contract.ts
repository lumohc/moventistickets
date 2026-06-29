/**
 * Fonte versionada dos contratos do produtor (clickwrap). O texto renderizado
 * (com os dados preenchidos) é o que vira snapshot + hash no aceite — reprodutível.
 * Trocar a versão → exige novo aceite nos próximos eventos.
 *
 * `render` é PURO (só strings) — pode rodar no client (exibir) e no server
 * (gerar o snapshot/hash). O hash em si fica no endpoint (node:crypto).
 */

export type ContractModel = 'A' | 'B'

export const CONTRACT_VERSIONS: Record<ContractModel, string> = {
  A: 'A-v1-2026-06',
  B: 'B-v2-2026-06',   // v2: equipe presencial a partir de 100 ingressos vendidos online
}

export interface ContractModelMeta {
  model: ContractModel
  label: string
  available: boolean
  note?: string
}

export const CONTRACT_MODELS: ContractModelMeta[] = [
  { model: 'B', label: 'Modelo B — Repasse pós-evento', available: true },
  { model: 'A', label: 'Modelo A — Split 80/20', available: false, note: 'Em breve — requer conta de recebimento' },
]

export interface ContractFillData {
  producerName: string
  producerDoc: string
  eventName: string
  eventDate: string   // já formatada (ex.: "12 de julho de 2026")
  acceptedAt?: string // ex.: "28/06/2026 17:40" — opcional (preenchido no aceite)
}

const CONTRACT_B_TEMPLATE = `# Contrato de Intermediação de Venda de Ingressos — Modelo B (Repasse Pós-Evento)

**Contratada (intermediadora):** Pedro Neves Araujo (MEI), operando a marca Moventis, CNPJ 61.153.718/0001-02, com sede em Rua Teodoro Sampaio, 1656, ap. 4 — Pinheiros, São Paulo/SP, CEP 05406-100 ("Moventis").

**Contratante (produtor):** {{PRODUCER_NAME}}, CPF/CNPJ {{PRODUCER_DOC}} ("Produtor").

**Evento:** {{EVENT_NAME}} — {{EVENT_DATE}}.

As partes celebram este contrato de intermediação de venda de ingressos com repasse pós-evento, nos termos abaixo.

## 1. Objeto
A Moventis disponibiliza ao Produtor uma plataforma tecnológica para venda de ingressos, processamento de pagamentos e emissão de ingressos. A Moventis atua exclusivamente como intermediadora e facilitadora; não é a organizadora nem a vendedora do evento.

## 2. Responsabilidades do Produtor
O Produtor é o único responsável pelo evento, incluindo: realização, data, local, horário, programação, elenco, classificação indicativa, alvarás e licenças, segurança no local, veracidade das informações cadastradas, e cumprimento da legislação aplicável (inclusive meia-entrada e acessibilidade).

## 3. Responsabilidades da Moventis
Fornecer a plataforma de venda, processar pagamentos pelos provedores (Asaas/Stripe), emitir os ingressos com QR Code assinado e disponibilizar o painel de acompanhamento.

Atendimento presencial (equipe Moventis):
O atendimento presencial da equipe Moventis (bilheteiro e staff de portaria) é oferecido a partir de 100 (cem) ingressos vendidos online. Abaixo desse volume, o atendimento presencial fica a cargo do Produtor.
a) A partir de 100 ingressos vendidos online, a Moventis disponibiliza 1 (um) bilheteiro para atendimento e venda no balcão (PDV) no dia do evento.
b) A Moventis disponibiliza Staff de portaria para atendimento ao público e leitura de ingressos (check-in), dimensionado em no máximo 250 ingressos por pessoa (até 250 → 1; 251–500 → 2; 501–750 → 3; +1 a cada 250), apurado 48 (quarenta e oito) horas antes do evento. Alternativamente, o Produtor pode fornecer a própria equipe para a leitura dos ingressos, sem qualquer custo adicional.
c) Eventos de até 2 (duas) horas de duração não geram custo para o Produtor: o atendimento da equipe Moventis (bilheteiro e staff de portaria), incluídas 1 (uma) hora antes e 1 (uma) hora depois, é custeado pela Moventis.
d) Em eventos de maior duração, o Produtor paga, por colaborador, descontado do repasse, conforme a duração do evento: acima de 2h e até 4h: R$ 100,00; acima de 4h e até 8h (diária — teto): R$ 150,00; acima de 8h: R$ 150,00 + R$ 35,00 por hora adicional.
e) Os valores previsíveis (eventos longos / festivais) são estimados e informados ao Produtor com antecedência, antes da confirmação do evento.

## 4. Remuneração da Moventis (taxa de serviço)
A Moventis é remunerada pela Taxa de serviço, cobrada do comprador, por cima do valor do ingresso, no valor do maior entre R$ 5,00 e 10% do valor do ingresso (face), por ingresso. A Taxa de processamento também é repassada ao comprador. O Produtor não paga essas taxas.

## 5. Recebimento e repasse pós-evento
5.1. A Moventis recebe os valores das vendas e os mantém até o repasse.
5.2. O Produtor recebe o valor de face líquido (sem as taxas), repassado em até 3 (três) dias úteis após a realização do evento, já deduzidos os reembolsos, estornos e contestações ocorridos até o repasse.
5.3. O repasse é feito para a conta indicada pelo Produtor no cadastro.

## 6. Reembolsos, estornos e chargebacks
6.1. Reembolsos por cancelamento do evento ou arrependimento no prazo legal são integrais ao comprador, conforme a Política de Cancelamento e Reembolso da Moventis, e são deduzidos do valor a repassar.
6.2. Chargebacks ou contestações posteriores ao repasse, decorrentes do evento, serão ressarcidos pelo Produtor em até 5 (cinco) dias úteis do aviso, autorizada a compensação com valores futuros.

## 7. Cancelamento do evento
Em caso de cancelamento, o Produtor comunicará a Moventis imediatamente; os valores ainda retidos serão destinados ao reembolso integral dos compradores, e eventual diferença será ressarcida pelo Produtor.

## 8. Dados pessoais (LGPD)
Compartilhamento limitado ao necessário para realizar o evento e o check-in, vedado uso diverso sem base legal.

## 9. Propriedade intelectual
A plataforma, marca e sistema da Moventis são de sua titularidade. O conteúdo do evento é do Produtor, que garante deter os direitos necessários.

## 10. Vigência e rescisão
Vigora a partir da aceitação eletrônica e enquanto houver evento ativo, podendo ser rescindido por qualquer parte mediante aviso, preservadas as obrigações financeiras pendentes.

## 11. Foro
Fica eleito o foro da comarca de São Paulo/SP.

## 12. Assinatura eletrônica e evidências
12.1. Este contrato é celebrado por assinatura eletrônica, mediante aceite ativo do Produtor no momento do envio do cadastro do evento. Não é possível enviar o evento sem o aceite.
12.2. A validade da assinatura eletrônica decorre do art. 10, §2º, da MP 2.200-2/2001 e dos arts. 104 e 107 do Código Civil (forma livre).
12.3. A Moventis registra e conserva, como prova do aceite: data e hora, endereço IP e dispositivo/navegador, identificação do Produtor (nome, CPF/CNPJ e conta), o evento vinculado, a versão do contrato e o conteúdo integral (e o hash) do documento na data do aceite.
12.4. A cada nova versão do contrato, é exigido novo aceite; os aceites anteriores permanecem válidos para os eventos a que se vincularam.
12.5. O Produtor pode obter a cópia do contrato aceito (com seus dados, data/hora e versão) no painel do produtor e por e-mail.

---
Aceite eletrônico em: {{ACCEPTED_AT}}
`

/** Texto limpo pra exibir/imprimir (tira marcadores de markdown). */
export function contractToPlain(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim()
}

/** Renderiza o contrato do modelo escolhido com os dados preenchidos. */
export function renderContract(model: ContractModel, data: ContractFillData): string {
  // Hoje só o B está operante; A cai no mesmo texto até ser liberado.
  const tpl = CONTRACT_B_TEMPLATE
  return tpl
    .replaceAll('{{PRODUCER_NAME}}', data.producerName || '—')
    .replaceAll('{{PRODUCER_DOC}}', data.producerDoc || '—')
    .replaceAll('{{EVENT_NAME}}', data.eventName || '—')
    .replaceAll('{{EVENT_DATE}}', data.eventDate || 'a definir')
    .replaceAll('{{ACCEPTED_AT}}', data.acceptedAt || '—')
}
