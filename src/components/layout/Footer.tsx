import Link from 'next/link'
import Image from 'next/image'

const CATEGORIES = [
  { label: 'Gatos',    slug: 'gatos',    emoji: '🐱' },
  { label: 'Perros',   slug: 'perros',   emoji: '🐶' },
  { label: 'Snacks',   slug: 'snacks',   emoji: '🍬' },
  { label: 'Higiene',  slug: 'higiene',  emoji: '🧴' },
  { label: 'Juguetes', slug: 'juguetes', emoji: '🎾' },
  { label: 'Ropa',     slug: 'ropa',     emoji: '👕' },
]

const TRUST_BADGES = [
  { icon: '🔒', text: 'Compra Segura' },
  { icon: '🐾', text: 'Protegemos a tu mascota' },
  { icon: '💬', text: 'Atención Personalizada' },
  { icon: '⭐', text: 'Productos 100% Originales' },
]

export function Footer() {
  return (
    <footer className="bg-mk-navy text-white">

      {/* TRUST BADGES STRIP — Brand Guardian: obligatorios */}
      <div className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TRUST_BADGES.map(b => (
              <div key={b.text} className="flex items-center gap-2 text-sm font-body text-white/80">
                <span className="text-lg" aria-hidden="true">{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN FOOTER */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* BRAND */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Image
                src="/logo.png"
                alt="MK-Pets"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
              />
              <span className="font-display font-black text-xl">
                MK-<span className="text-mk-orange">pets</span>
              </span>
            </div>

            {/* Brand Guardian: tagline oficial */}
            <p className="font-display font-bold text-white/90 text-sm mb-2">
              Tu mascota, nuestra prioridad 🐾
            </p>
            <p className="font-body text-white/60 text-sm leading-relaxed">
              Alimentos, snacks, higiene, ropa y juguetes para tu compañero
              con entrega a domicilio en CABA.
            </p>
          </div>

          {/* CONTACTO */}
          <div>
            <h2 className="font-display font-bold text-xs uppercase tracking-widest text-white/40 mb-4">
              Contacto
            </h2>
            <ul className="space-y-2.5 font-body text-sm text-white/80">
              <li>
                <a
                  href="https://wa.me/5491166698395"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span aria-hidden="true">💬</span>
                  WhatsApp: 11 6669 8395
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true">🚚</span>
                Envío gratis a CABA
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true">🕐</span>
                Lun–Sáb 9:00–20:00
              </li>
            </ul>
          </div>

          {/* CATEGORÍAS */}
          <div>
            <h2 className="font-display font-bold text-xs uppercase tracking-widest text-white/40 mb-4">
              Categorías
            </h2>
            <ul className="space-y-1.5 font-body text-sm text-white/80">
              {CATEGORIES.map(cat => (
                <li key={cat.slug}>
                  <Link
                    href={`/productos?cat=${cat.slug}`}
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <span aria-hidden="true">{cat.emoji}</span>
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="border-t border-white/10 mt-8 pt-6
                        flex flex-col sm:flex-row items-center justify-between
                        gap-3 text-xs font-body text-white/40">
          <span>© {new Date().getFullYear()} MK-Pets. Todos los derechos reservados.</span>
          <span>Hecho con 🐾 en Buenos Aires, Argentina</span>
        </div>
      </div>
    </footer>
  )
}
