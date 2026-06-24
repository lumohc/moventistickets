# Fase 0 (Fundação) — Resumo do que foi feito

Branch: `feat/fase-0-fundacao` · base: `main`.

## Entregue

### 1. Auditoria
- `docs/auditoria-fase0.md` — app Next.js função por função (✅/⚠️/❌) contra o fluxo.
- Achados principais: cálculo de taxa espalhado, cartão sem gross-up, QR não assinado,
  e o deploy de produção atrás do GitHub.

### 2. Motor financeiro único (`src/lib/pricing.ts`)
- Fonte da verdade do dinheiro. Funções puras e testadas.
- Taxa de serviço = max(R$5, 10% da face), **por ingresso**.
- Taxa de processamento **por pedido**: PIX R$2 fixo; **cartão 4,98% com GROSS-UP**
  (incide sobre o total, não só a face — corrige prejuízo da Moventis).
- Líquido do produtor = `faceTotal`, sem taxa embutida.
- Config de taxa **por método** (extensível para Stripe).
- `src/lib/fees.ts` agora **delega** para o `pricing` (uma fonte só); checkout,
  seat-add-to-cart e ticket-geral seguem funcionando.

### 3. Segurança base
- **QR assinado** (`src/lib/ticket-signing.ts`): HMAC-SHA256, formato `MVT:<id>.<assinatura>`,
  comparação timing-safe. A emissão (`orders.ts`) já gera o QR assinado.
- **Webhook**: comparação de token em tempo constante, mantendo fail-closed.
  (A confirmação de pagamento já era só pelo webhook, com conferência de valor — `a71d505`.)
- **Idempotência na compra**: `seat-add-to-cart` devolve o mesmo pedido se o
  `reservation_token` já gerou um — clique duplo não duplica.
- **Papéis e permissões** (`src/lib/roles.ts`): modelo papéis × capacidades.
  Produtor só vê; operação é da Moventis (admin/equipe/bilheteiro).

### Testes
- `npm test` → **31 testes passando** (pricing 15, ticket-signing 6, roles 10).
- `npx tsc --noEmit` limpo. Build de produção passa.

## Critério de aceite da Fase 0

| Item | Status |
|---|---|
| Lista de auditoria entregue | ✅ |
| Testes do motor financeiro (incl. gross-up cartão) | ✅ |
| Webhook só confirma com token válido; compra só pelo webhook | ✅ no código · ⚠️ falta deploy |
| Compra dupla não duplica | ✅ (clique duplo) · 🔜 backstop por unique constraint no banco |
| QR com assinatura verificável | ✅ (requer `TICKET_SIGNING_SECRET` setado) |
| Produtor não acessa operações sensíveis | ✅ modelo+testes · 🔜 aplicar guardas nas rotas |

## Pendências da Fabíola (parte manual — não faço por você)
1. **Rotacionar o token do Asaas** e confirmar a URL do webhook no painel.
   (A URL eu já corrigi hoje: estava duplicada + com eventos errados.)
2. **Definir `TICKET_SIGNING_SECRET`** no ambiente (Vercel → Environment Variables).
   Gere um valor forte: `openssl rand -hex 32`. Sem ele, o QR sai sem assinatura.
3. **Deploy de produção** — o build passou; produção está rodando código antigo.
   Recomendo também **conectar o Git ao Vercel** (deploy automático).

## Próximos passos técnicos (fases seguintes / follow-up)
- Aplicar as guardas de papel (`assertCan`) nas rotas de admin/produtor e **mover/
  proteger o check-in** (hoje está sob `/produtor`).
- Idempotência mais forte: `unique` no banco como backstop (migration p/ a Fabíola rodar).
- Fluxo de **pagamento por cartão** (o motor já calcula; falta a integração).
- Fase 1 (Locais + editor de mapa) é o próximo bloco do roadmap.
