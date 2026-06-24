# Auditoria — Fase 0 (Fundação)

> Comparação **função por função** do app atual (Next.js, `lumotickets/` → moventistickets.com.br)
> contra `moventis-tickets-fluxo-e-requisitos.md` e os invariantes do roadmap.
> Legenda: ✅ funciona · ⚠️ funciona mal / incompleto · ❌ falta.
>
> Base: leitura do código em 2026-06-23 (branch `feat/fase-0-fundacao`). Itens marcados
> _(inferido)_ foram avaliados pela estrutura/rotas, não por leitura linha a linha.

---

## Resumo executivo

O núcleo de compra→PIX→ingresso **existe e está razoavelmente sólido** na lógica, mas tem
**três problemas que tocam dinheiro** e precisam da Fase 0 pra fechar:

1. **Cálculo de taxa espalhado** em 4+ lugares (`fees.ts`, `seat-add-to-cart`, `ticket-geral`,
   `payment/pix`, front) — viola o invariante "um único motor financeiro". → **motor `pricing`**.
2. **Cartão sem gross-up:** `fees.ts → paymentFee('card')` cobra `subtotal * 4,98%`, mas o
   Asaas cobra 4,98% sobre o **total** (face + serviço + a própria taxa). Hoje a Moventis
   **recupera de menos** em todo pedido no cartão. → corrigido no `pricing`.
3. **QR não assinado:** o ingresso é `MVT:<uuid>`; o check-in valida só o número, não uma
   assinatura. Print duplicado passaria. → **QR assinado (HMAC)**.

Segurança do pagamento já avançou (webhook com token + confirmação só por webhook + valor
conferido — commit `a71d505`), mas **isso ainda não está no ar** (deploy do Vercel está
atrás — ver seção Deploy).

---

## 1. Compra / checkout

| Função | Status | Observação |
|---|---|---|
| Página pública do evento | ✅ | `/eventos/[slug]`, `/eventos/allegro-vivace`, `/eventos/pedro-ivo` |
| Seleção de assento (mapa) | ✅ | `seat-map` + front com zoom/pinch (commit `9ad34b1`) |
| Reserva com TTL | ⚠️ | `seat-reserve` checa reserva+vendido antes de inserir, mas **não é atômico** (janela de corrida) e cai em "sucesso otimista" se o Supabase falhar. Garantia real = unique index em `tickets`. |
| Cronômetro visível de reserva | ⚠️ _(inferido)_ | TTL existe no back (`expires_at`); confirmar countdown na tela de checkout |
| Ingresso geral (sem assento) | ✅ | `ticket-geral` cria pedido com `qty` |
| Checkout em 1 página | ⚠️ _(inferido)_ | `/checkout` existe; validar que é tela única conforme Fase 2 |
| Dados mínimos + CPF condicional (estrangeiro) | ❌ | requisito da Fase 2; hoje o fluxo pede CPF. Sem seletor "não tenho CPF/passaporte" |
| Compra sem senha (convidado) | ⚠️ _(inferido)_ | confirmar; conta criada "por trás" não vista |
| Entrega por e-mail **ou** WhatsApp (escolha) | ❌ | só e-mail hoje (`lib/email.ts`); WhatsApp não implementado |

## 2. Pagamento

| Função | Status | Observação |
|---|---|---|
| PIX via Asaas (cobrança + QR) | ✅ | `lib/asaas.ts` + `payment/pix` |
| Valor sempre do servidor (`order.total`) | ✅ | corrigido em `a71d505` (antes aceitava total do cliente) ⚠️ **não está no ar** |
| PIX idempotente (reusa cobrança válida) | ✅ | `a71d505` ⚠️ não no ar |
| Sem fallback mock em produção | ✅ | `a71d505` ⚠️ não no ar |
| Cartão | ❌ | não há fluxo de cartão implementado (só PIX) |
| **Gross-up do cartão** | ❌ | `fees.ts` cobra 4,98% do subtotal, não do total → **prejuízo por pedido** |
| Stripe (internacional) | ❌ | Fase 7 |

## 3. Motor financeiro (invariante nº 1)

| Função | Status | Observação |
|---|---|---|
| Taxa de serviço = max(R$5, 10% face) por ingresso | ✅ | `fees.ts → serviceFee` correto |
| Taxa de processamento PIX R$2/pedido | ✅ | `fees.ts → paymentFee('pix')` |
| Taxa de processamento cartão 4,98% **com gross-up** | ❌ | sem gross-up (ver acima) |
| **Cálculo num único módulo** | ⚠️ | `fees.ts` existe, mas a conta é refeita em `seat-add-to-cart`, `ticket-geral`, `payment/pix` e no front → fonte da verdade fragmentada |
| Líquido do produtor = `face_total` isolado | ✅ _(inferido)_ | `orders.face_total` separado de taxas |

→ **Ação Fase 0:** módulo `pricing` único, com gross-up e testes; rotas passam a chamá-lo.

## 4. Emissão & entrega do ingresso

| Função | Status | Observação |
|---|---|---|
| Emissão só após pagamento confirmado | ✅ | `confirmOrderAndIssueTickets` (`orders.ts`) |
| Emite ingresso ANTES de marcar pago (não deixa pago sem ingresso) | ✅ | `a71d505` ⚠️ não no ar |
| Idempotência da emissão | ✅ | checa `tickets` por `order_id` antes de inserir |
| E-mail com QR | ✅ | `lib/email.ts` (SMTP Hostinger / Resend) |
| Entrega por WhatsApp | ❌ | não implementado |
| Reenvio do ingresso (1 clique) | ❌ _(inferido)_ | não localizado |

## 5. Confirmação / webhook (invariante nº 8)

| Função | Status | Observação |
|---|---|---|
| Webhook como única fonte de verdade | ✅ | `payment/webhook` chama `confirmOrderAndIssueTickets` |
| Token assinado (rejeita sem token) | ✅ | `a71d505` valida `asaas-access-token` (fail-closed) ⚠️ **não no ar** |
| Confere valor pago vs `order.total` | ✅ | `a71d505` ⚠️ não no ar |
| Idempotência (evento repetido) | ✅ | via status `paid` + checagem de tickets |
| Config do webhook no painel Asaas | ✅ | **corrigido hoje** (URL estava duplicada + eventos errados) |

## 6. Idempotência da compra (invariante de segurança)

| Função | Status | Observação |
|---|---|---|
| Clique duplo não duplica cobrança | ⚠️ | PIX é idempotente por pedido (`a71d505`), mas a **criação do pedido** (`seat-add-to-cart`/`ticket-geral`) não tem chave de idempotência — 2 cliques = 2 pedidos. |
| Unique contra dupla-venda do assento | ✅ _(inferido)_ | unique index `tickets(event, seat)` citado em `orders.ts` — confirmar no schema |

→ **Ação Fase 0:** chave de idempotência por tentativa de compra na criação do pedido.

## 7. QR / segurança do ingresso

| Função | Status | Observação |
|---|---|---|
| QR no ingresso | ✅ | `qr_code = MVT:<uuid>` |
| **QR assinado/verificável** | ❌ | sem assinatura; check-in confiaria só no número |

→ **Ação Fase 0:** HMAC sobre o ingresso; check-in valida assinatura.

## 8. Painel do produtor (requisito crítico de lançamento)

| Função | Status | Observação |
|---|---|---|
| Telas existem | ✅ _(inferido)_ | `/produtor/dashboard`, `/eventos`, `/eventos/[id]`, `/vendas`, `/financeiro` |
| "Você recebe" = líquido em destaque | ⚠️ _(inferido)_ | confirmar que o número grande é o líquido, taxas à parte |
| Quem comprou / tipo / forma de pagamento | ⚠️ _(inferido)_ | `/vendas` existe; validar conteúdo |
| Gráficos de vendas/arrecadação | ⚠️ _(inferido)_ | confirmar |
| Exportação (borderô) | ❌ _(inferido)_ | não localizado |

## 9. Check-in (Fase 4, mas QR é Fase 0)

| Função | Status | Observação |
|---|---|---|
| Tela de check-in | ⚠️ _(inferido)_ | existe em `/produtor/eventos/[id]/checkin` — **mas está sob `produtor`** |
| Valida assinatura do QR | ❌ | depende do QR assinado (Fase 0) |
| Offline-first / multi-operador / busca manual | ❌ | Fase 4 |

## 10. Autonomia admin + PDV (invariantes 2 e 3)

| Função | Status | Observação |
|---|---|---|
| Painel admin | ✅ _(inferido)_ | `/admin` (eventos, financeiro, pedidos, produtores) |
| Operações por tela (cancelar, bloquear poltrona, cortesia, reembolso, trocar titular, reenviar) | ❌ _(inferido)_ | não localizadas — Fase 5 |
| PDV / balcão | ❌ | não existe — Fase 5 |

## 11. Papéis & permissões (invariante nº 3)

| Função | Status | Observação |
|---|---|---|
| Auth de produtor (login/senha) | ✅ _(inferido)_ | `/produtor/login`, recuperação de senha |
| Auth de admin | ✅ _(inferido)_ | `schema-v4-admins.sql`, `/admin` |
| Modelo de papéis (admin/equipe/bilheteiro/produtor/comprador) | ⚠️ | sem camada de papéis explícita unificada |
| **Check-in/operações restritas à Moventis (não produtor)** | ⚠️ | check-in está sob `/produtor/...` → revisar contra invariante nº 3 |

→ **Ação Fase 0:** base de papéis + helper de autorização.

---

## Deploy (achado de hoje — fora do código, mas crítico)

- `moventistickets.com.br` aponta pro deploy de 22/06 22:54, que roda código **anterior** a
  `a71d505`. Logo, os ✅ marcados "não no ar" (valor do servidor, sem mock, token do webhook,
  emite-antes-de-pagar) **ainda não estão valendo em produção**.
- Projeto Vercel **não é git-connected** → deploy é manual; por isso ficou atrás.
- **Ação:** redeploy de `origin/main` (build local passou) + considerar conectar o Git.

## Pendências que dependem da Fabíola
- **Rotacionar o token do Asaas** e configurar a **URL do webhook** no painel (parte manual).
- Definir variável de ambiente do **segredo de assinatura do QR** (a Fase 0 cria o código;
  o valor é segredo — não vai pro Git).
