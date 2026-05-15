import type { Metadata } from 'next'
import { Nunito, Inter } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'MK-Pets — Todo para tu mascota', template: '%s | MK-Pets' },
  description: 'Alimentos, snacks, higiene, ropa y juguetes para tu mascota con envío gratis a CABA. Tu mascota, nuestra prioridad 🐾',
  keywords: ['mascotas', 'alimento para gatos', 'alimento para perros', 'snacks mascotas', 'CABA', 'envío gratis'],
  openGraph: {
    title: 'MK-Pets — Todo para tu mascota',
    description: 'Tu mascota, nuestra prioridad 🐾 Envío gratis a CABA.',
    url: 'https://mkpets.com.ar',
    siteName: 'MK-Pets',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_AR',
    type: 'website',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-mk-white text-mk-dark min-h-screen">
        {children}
      </body>
    </html>
  )
}
