-- ══════════════════════════════════════════════════════════════════════════════
-- Moventis Tickets — v6: cupons de desconto + configuração de pagamento
-- Execute no SQL Editor do Supabase (project myvupvoowdjhqotvxcaj)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Novos métodos de pagamento ─────────────────────────────────────────────
-- Adiciona credit_card e debit_card ao enum (ADD VALUE é idempotente via IF NOT EXISTS)
alter type payment_method_t add value if not exists 'credit_card';
alter type payment_method_t add value if not exists 'debit_card';

-- ── 2. Cupons de desconto ──────────────────────────────────────────────────────
create table coupons (
  id           uuid          primary key default uuid_generate_v4(),
  code         text          not null unique,     -- código digitado no checkout (case-insensitive)
  type         text          not null             -- 'percent' | 'fixed'
                check (type in ('percent', 'fixed')),
  value        numeric(10,2) not null             -- percentual (0-100) ou valor fixo em R$
                check (value > 0),
  valid_from   timestamptz,                       -- null = sem restrição de início
  valid_until  timestamptz,                       -- null = sem data de validade
  max_uses     integer,                           -- null = ilimitado
  use_count    integer       not null default 0,
  -- Vendedor/afiliado (pode ser um ator, professor, escola, etc.)
  seller_name  text,                              -- null = cupom institucional sem afiliado
  seller_email text,
  is_active    boolean       not null default true,
  notes        text,                              -- anotação interna
  created_at   timestamptz   not null default now()
);

create index idx_coupons_code on coupons(lower(code));

-- ── 3. Registro de uso de cupom (1 por pedido) ────────────────────────────────
create table coupon_uses (
  id              uuid          primary key default uuid_generate_v4(),
  coupon_id       uuid          not null references coupons(id),
  order_id        uuid          not null references orders(id),
  discount_amount numeric(10,2) not null,   -- valor efetivamente descontado neste pedido
  created_at      timestamptz   not null default now(),
  unique (order_id)                          -- 1 cupom por pedido
);

create index idx_coupon_uses_coupon on coupon_uses(coupon_id);

-- ── 4. Colunas extras em orders (cupom aplicado) ──────────────────────────────
alter table orders
  add column if not exists coupon_code     text,          -- código do cupom, se usado
  add column if not exists coupon_discount numeric(10,2) not null default 0;
                                                           -- desconto total concedido

-- ── 5. Configuração global de métodos de pagamento ────────────────────────────
-- Permite ao admin ligar/desligar métodos e ajustar taxas pela tela, sem tocar no código.
create table payment_method_configs (
  id          uuid           primary key default uuid_generate_v4(),
  method      text           not null unique,  -- 'pix' | 'credit_card' | 'debit_card'
  is_enabled  boolean        not null default true,
  fee_kind    text           not null          -- 'fixed' | 'percent_grossup'
               check (fee_kind in ('fixed', 'percent_grossup')),
  fee_amount  numeric(10,6)  not null,         -- R$ para fixed; taxa decimal para percent
  label       text           not null,         -- label exibido no checkout (ex.: "PIX")
  created_at  timestamptz    not null default now()
);

-- Valores padrão idênticos ao pricing.ts atual:
insert into payment_method_configs (method, is_enabled, fee_kind, fee_amount, label) values
  ('pix',         true, 'fixed',          2.0,    'PIX'),
  ('credit_card', true, 'percent_grossup', 0.0498, 'Cartão de Crédito'),
  ('debit_card',  true, 'percent_grossup', 0.027,  'Cartão de Débito')
on conflict (method) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Cupons e configs: somente service_role (admins) — sem exposição pública.
alter table coupons                  enable row level security;
alter table coupon_uses              enable row level security;
alter table payment_method_configs   enable row level security;
