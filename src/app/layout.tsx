import type { Metadata } from 'next'
import { Nunito, Inter } from 'next/font/google'
import { JsonLd } from '@/components/seo/JsonLd'
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

const BASE_URL = 'https://mk-pets.com.ar'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'MK-Pets — Todo para tu mascota',
    template: '%s | MK-Pets',
  },
  description:
    'Alimentos, snacks, higiene, ropa y juguetes para tu mascota con envío gratis a CABA. Tu tienda de mascotas online en Buenos Aires.',
  keywords: [
    'mascotas',
    'alimento para gatos',
    'alimento para perros',
    'snacks mascotas',
    'tienda mascotas Buenos Aires',
    'CABA',
    'envío gratis',
    'marketplace mascotas',
  ],
  openGraph: {
    title: 'MK-Pets — Todo para tu mascota',
    description:
      'Alimentos, snacks, higiene y juguetes para tu mascota. Envío gratis a CABA.',
    url: BASE_URL,
    siteName: 'MK-Pets',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'MK-Pets — Tienda de mascotas en Buenos Aires',
      },
    ],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MK-Pets — Todo para tu mascota',
    description:
      'Alimentos, snacks, higiene y juguetes para tu mascota. Envío gratis a CABA.',
    images: [`${BASE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'manifest', url: '/site.webmanifest' }],
  },
  // Verification tokens — replace with real values from each platform
  verification: {
    google: 'REPLACE_WITH_GOOGLE_SEARCH_CONSOLE_TOKEN',
    // yandex: 'REPLACE_WITH_YANDEX_TOKEN',
    // bing: 'REPLACE_WITH_BING_TOKEN',
  },
  alternates: {
    canonical: BASE_URL,
  },
}

/** Organization schema — sitewide */
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MK-Pets',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    'Marketplace de productos para mascotas en Buenos Aires con envío gratis a CABA.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'hola@mk-pets.com.ar',
    availableLanguage: 'Spanish',
  },
  sameAs: [],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-mk-white text-mk-dark min-h-screen">
        <JsonLd data={organizationSchema} />
        {children}
      </body>
    </html>
  )
}
