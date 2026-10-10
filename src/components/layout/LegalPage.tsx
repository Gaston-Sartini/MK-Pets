import Link from 'next/link'

/** Marco común de las páginas legales: título, fecha de vigencia y secciones. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mk-light py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-card shadow-card p-6 md:p-10">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-mk-dark">{title}</h1>
        <p className="text-sm text-mk-mid mt-1 mb-8">Última actualización: {updated}</p>

        <div className="space-y-7 text-mk-dark text-[15px] leading-relaxed
                        [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mb-2
                        [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mt-2
                        [&_a]:text-mk-orange-dark [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>

        <Link href="/" className="btn-ghost w-full text-center block mt-10">Volver a la tienda</Link>
      </article>
    </div>
  )
}
