import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProductForm from '@/components/admin/ProductForm'

export default function NuevoProductoPage() {
  return (
    <div>
      <Link href="/admin/productos"
        className="inline-flex items-center gap-2 text-mk-mid hover:text-mk-dark text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a productos
      </Link>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">Nuevo producto</h1>
      <ProductForm />
    </div>
  )
}
