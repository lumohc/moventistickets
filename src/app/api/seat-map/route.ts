import { NextRequest, NextResponse } from 'next/server'

// Dados estáticos do evento Allegro Vivace — conectar ao Supabase na Fase 1
const ALLEGRO_VIVACE = {
  product_id: 1,
  event_id: 1,
  event_name: 'Allegro Vivace',
  product_name: 'Allegro Vivace',
  currency_symbol: 'R$',
  ttl_seconds: 600,
  venue_id: 'teatro-alvaro-de-carvalho',
  seat_model: { id: 1, name: 'Teatro Álvaro de Carvalho' },
  variation_lookup: {
    'plateia|inteira':      { variation_id: 1, price: 80 },
    'plateia|meia-entrada': { variation_id: 2, price: 40 },
    'balcao|inteira':       { variation_id: 3, price: 60 },
    'balcao|meia-entrada':  { variation_id: 4, price: 30 },
    'frisa_fe|inteira':     { variation_id: 5, price: 80 },
    'frisa_fe|meia-entrada':{ variation_id: 6, price: 40 },
    'frisa_fd|inteira':     { variation_id: 7, price: 80 },
    'frisa_fd|meia-entrada':{ variation_id: 8, price: 40 },
  },
  // seats array vazio = todos disponíveis (Supabase vai preencher vendidos/reservados)
  seats: [
    { id: '', group_id: 'plateia',  group_name: 'Plateia (Térreo)',        price_full: 80, price_half: 40, variation_full_id: 1, variation_half_id: 2, status: 'available', reserved_by: '' },
    { id: '', group_id: 'frisa_fe', group_name: 'Frisa Esquerda (2º Piso)',price_full: 80, price_half: 40, variation_full_id: 5, variation_half_id: 6, status: 'available', reserved_by: '' },
    { id: '', group_id: 'frisa_fd', group_name: 'Frisa Direita (2º Piso)', price_full: 80, price_half: 40, variation_full_id: 7, variation_half_id: 8, status: 'available', reserved_by: '' },
    { id: '', group_id: 'balcao',   group_name: 'Balcão (3º Piso)',        price_full: 60, price_half: 30, variation_full_id: 3, variation_half_id: 4, status: 'available', reserved_by: '' },
  ],
}

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')

  // Por ora só temos o evento 1
  if (productId !== '1') {
    return NextResponse.json({ status: 'error', message: 'Evento não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ status: 'success', data: ALLEGRO_VIVACE })
}
