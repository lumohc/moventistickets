import { redirect } from 'next/navigation'

// Home provisória — redireciona para o evento piloto
// Fase 3: vira marketplace de eventos
export default function Home() {
  redirect('/eventos/allegro-vivace')
}
