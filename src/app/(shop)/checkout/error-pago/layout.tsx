import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Error en el pago',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ErrorPagoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
