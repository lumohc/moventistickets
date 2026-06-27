import CartButton from '@/components/CartButton'

export default function EventosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CartButton />
    </>
  )
}
