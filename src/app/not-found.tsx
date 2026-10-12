import Link from 'next/link'
import { whatsappLink } from '@/lib/shop'

export const metadata = { title: 'No encontramos esa página' }

/** Página 404: reemplaza la de fábrica, que está en inglés y no tiene cómo volver a la tienda. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-mk-light flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-card shadow-card p-8 text-center">
        <p className="text-5xl mb-4" aria-hidden>🐾</p>
        <h1 className="font-display font-bold text-2xl text-mk-dark mb-2">No encontramos esa página</h1>
        <p className="font-body text-mk-mid mb-6">
          Puede que el producto ya no esté disponible o que el link esté mal escrito.
        </p>
        <Link href="/productos" className="btn-primary w-full text-center block mb-3">
          Ver todos los productos
        </Link>
        <a
          href={whatsappLink('Hola! Estaba buscando algo en la tienda y no lo encontré.')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost w-full text-center block"
        >
          Consultar por WhatsApp
        </a>
      </div>
    </main>
  )
}
