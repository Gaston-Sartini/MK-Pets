import Image from 'next/image'
import Link from 'next/link'

const TRUST_BADGES = [
  { icon: '🚚', text: 'Envío gratis a CABA' },
  { icon: '🔒', text: 'Compra segura' },
  { icon: '💬', text: 'Atención personalizada' },
  { icon: '⭐', text: 'Productos 100% originales' },
]

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-mk-light">
      {/* PATAS DECORATIVAS */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none" aria-hidden="true">
        <span className="absolute top-4 left-8 text-7xl rotate-12">🐾</span>
        <span className="absolute top-16 right-24 text-5xl -rotate-6">🐾</span>
        <span className="absolute bottom-8 left-1/3 text-6xl rotate-3">🐾</span>
        <span className="absolute top-1/2 right-10 text-4xl -rotate-12">🐾</span>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-8 py-10 md:py-14 lg:py-20">

          {/* TEXTO */}
          <div className="flex-1 text-center md:text-left order-2 md:order-1">

            {/* TAGLINE — Brand Guardian: va arriba del H1 */}
            <p className="font-display font-bold text-mk-orange text-sm uppercase tracking-widest mb-3">
              Tu mascota, nuestra prioridad 🐾
            </p>

            <h1 className="font-display font-extrabold text-mk-dark leading-tight mb-2
                           text-4xl sm:text-5xl lg:text-6xl">
              Todo para tu<br />mascota
            </h1>

            <p className="font-display font-bold text-mk-orange text-2xl sm:text-3xl mb-5">
              en un solo lugar
            </p>

            <p className="font-body text-mk-mid text-base md:text-lg mb-7 max-w-md mx-auto md:mx-0">
              Alimentos, snacks, higiene, ropa y juguetes para perros y gatos
              con envío gratis a CABA.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-6">
              <Link href="/productos" className="btn-primary text-center py-3.5 px-8 text-lg">
                Ver productos
              </Link>
              <a
                href="https://wa.me/5491166698395"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2
                           bg-[#25D366] text-white font-display font-bold
                           px-8 py-3.5 rounded-pill text-lg
                           hover:bg-[#128C7E] transition-colors duration-200"
              >
                💬 WhatsApp
              </a>
            </div>

            {/* TRUST BADGES — Brand Guardian: los 4 obligatorios */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2
                            justify-center md:justify-start">
              {TRUST_BADGES.map(badge => (
                <div key={badge.text} className="trust-badge">
                  <span aria-hidden="true">{badge.icon}</span>
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* IMAGEN HERO */}
          <div className="flex-1 flex justify-center order-1 md:order-2">
            <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg">
              <Image
                src="/assets/hero-main.webp"
                alt="Gatos, perros y productos MK-Pets — alimentos, snacks y más"
                width={600}
                height={450}
                className="w-full h-auto object-contain drop-shadow-xl"
                priority
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
