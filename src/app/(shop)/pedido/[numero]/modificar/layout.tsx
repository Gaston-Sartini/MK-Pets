import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Modificar pedido',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ModificarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
