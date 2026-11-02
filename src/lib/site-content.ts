import { z } from 'zod'

/**
 * Lo que el dueño puede cambiar del sitio desde el panel: tipos, valores de
 * fábrica y validación. Sin acceso a la base, para que también lo use la vista
 * previa del panel (en el navegador). Leer y guardar: site-settings.ts.
 */

export interface HeroImage { url: string; width: number; height: number }

export interface HeroContent {
  tagline:     string
  /** Una línea por renglón (el título de fábrica va en dos). */
  title:       string
  highlight:   string
  /** Vacío = se arma solo con las categorías que tienen productos. */
  description: string
  badges:      { icon: string; text: string }[]
  /** null = la imagen de fábrica (/assets/hero-main.png). */
  image:       HeroImage | null
  imageAlt:    string
}

export const DEFAULT_HERO: HeroContent = {
  tagline:     'Tu mascota, nuestra prioridad 🐾',
  title:       'Todo para tu\nmascota',
  highlight:   'en un solo lugar',
  description: '',
  badges: [
    { icon: '🚚', text: 'Envío gratis a CABA' },
    { icon: '🔒', text: 'Compra segura' },
    { icon: '💬', text: 'Atención personalizada' },
    { icon: '⭐', text: 'Productos 100% originales' },
  ],
  image:    null,
  imageAlt: 'Gatos, perros y productos MK-Pets — alimentos, snacks y más',
}

export const DEFAULT_HERO_IMAGE: HeroImage = { url: '/assets/hero-main.png', width: 1536, height: 1024 }

/** Texto que va cuando la descripción queda vacía. `offer` sale de describeCatalogTitle. */
export const autoHeroDescription = (offer: string) => `${offer} para perros y gatos con envío gratis a CABA.`

// Las fotos se suben al almacenamiento de Supabase del proyecto (ver /api/admin/upload)
const imageUrl = z.string().trim().max(1000).refine(
  url => url.startsWith('/assets/') || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url),
  'La imagen tiene que estar subida desde el panel',
)

export const heroSchema = z.object({
  tagline:     z.string().trim().max(80),
  title:       z.string().trim().min(1, 'El título no puede quedar vacío').max(80)
                 .refine(t => t.split('\n').length <= 3, 'El título puede tener hasta 3 renglones'),
  highlight:   z.string().trim().max(60),
  description: z.string().trim().max(220),
  badges:      z.array(z.object({
    icon: z.string().trim().max(8),
    text: z.string().trim().min(1, 'Cada garantía necesita un texto').max(40),
  })).max(6, 'Hasta 6 garantías'),
  image: z.object({
    url:    imageUrl,
    width:  z.number().int().min(100).max(10_000),
    height: z.number().int().min(100).max(10_000),
  }).nullable(),
  imageAlt: z.string().trim().min(3, 'Describí la imagen (sirve para buscadores y lectores de pantalla)').max(150),
})

/** Lo guardado encima de lo de fábrica: un dato roto o faltante no rompe la portada. */
export function mergeHero(saved: unknown): HeroContent {
  const parsed = heroSchema.partial().safeParse(saved)
  if (!parsed.success) return DEFAULT_HERO
  const value = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))
  return { ...DEFAULT_HERO, ...value } as HeroContent
}
