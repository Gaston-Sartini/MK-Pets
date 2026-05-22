import { Navbar } from '@/components/layout/Navbar'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ToastContainer } from '@/components/ui/Toast'
import ChatBridge from '@/components/chat/ChatBridge'
import MKPetsChat from '@/components/chat/MKPetsChat'
import { getCategories } from '@/lib/queries'

// Always read fresh categories so admin deletions/additions reflect immediately.
export const revalidate = 60

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories().catch(() => [])

  return (
    <>
      {/* WCAG 2.4.1 — Skip navigation link (visible on focus, screen-reader friendly) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]
                   focus:bg-mk-orange focus:text-white focus:px-4 focus:py-2 focus:rounded-card
                   focus:font-bold focus:shadow-card"
      >
        Saltar al contenido principal
      </a>

      <Navbar categories={categories} />
      <CartDrawer />
      <ToastContainer />

      {/* landmark: main — required for screen reader navigation */}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      {/* Chat: bridge expone window.MKPets (uso programático opcional);
          MKPetsChat es el chat propio que llama a /api/chat → n8n. */}
      <ChatBridge />
      <MKPetsChat />
    </>
  )
}
