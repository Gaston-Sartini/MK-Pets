/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production'

// Extra origins that need to be allowed through CSP. These come from env vars
// because they vary per deployment (self-hosted Typebot can live anywhere).
const typebotOrigin = process.env.NEXT_PUBLIC_TYPEBOT_URL || ''

// In dev, Next.js needs 'unsafe-eval' for HMR and ws: for the dev websocket.
// In prod we keep a strict CSP.
const scriptSrcParts = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://sdk.mercadopago.com',
  'https://cdn.jsdelivr.net',         // Typebot embed JS lives here
  ...(typebotOrigin ? [typebotOrigin] : []),
]
const connectSrcParts = [
  "'self'",
  ...(isDev ? ['ws:', 'http://localhost:*'] : []),
  'https://api.mercadopago.com',
  'https://cdn.jsdelivr.net',
  ...(typebotOrigin ? [typebotOrigin] : []),
]
const frameSrcParts = [
  'https://www.mercadopago.com',
  'https://www.mercadopago.com.ar',
  ...(typebotOrigin ? [typebotOrigin] : []),
]

const scriptSrc  = `script-src ${scriptSrcParts.join(' ')}`
const connectSrc = `connect-src ${connectSrcParts.join(' ')}`
const frameSrc   = `frame-src ${frameSrcParts.join(' ')}`

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      connectSrc,
      frameSrc,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const config = {
  env: {
    NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? '',
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.com' },
    ],
  },

  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  experimental: {
    optimizePackageImports: ['lucide-react', 'zustand'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default config
