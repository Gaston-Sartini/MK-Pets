export function ShippingBanner() {
  return (
    <div className="bg-mk-navy text-white py-4 px-4" role="complementary" aria-label="Información de envío">
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center
                      justify-center gap-3 sm:gap-8 text-sm font-body">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🚚</span>
          <span><strong>Envío gratis</strong> a CABA en todos los pedidos</span>
        </div>
        <div className="hidden sm:block w-px h-5 bg-white/20" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span aria-hidden="true">📞</span>
          <span>Consultas: <strong>11 6669 8395</strong></span>
        </div>
        <div className="hidden sm:block w-px h-5 bg-white/20" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span aria-hidden="true">💬</span>
          <a
            href="https://wa.me/5491166698395"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline transition-all"
          >
            Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
