import { describe, it, expect } from 'vitest'
import { DEFAULT_HERO, heroSchema, mergeHero, autoHeroDescription } from '@/lib/site-content'

describe('Portada editable', () => {
  it('sin nada guardado, queda la de fábrica', () => {
    expect(mergeHero(null)).toEqual(DEFAULT_HERO)
    expect(mergeHero(undefined)).toEqual(DEFAULT_HERO)
  })

  it('lo guardado pisa solo lo que trae', () => {
    const hero = mergeHero({ tagline: 'Nueva frase' })
    expect(hero.tagline).toBe('Nueva frase')
    expect(hero.title).toBe(DEFAULT_HERO.title)
    expect(hero.badges).toHaveLength(4)
  })

  it('un dato roto no rompe la portada', () => {
    expect(mergeHero({ badges: 'no es una lista' })).toEqual(DEFAULT_HERO)
    expect(mergeHero('cualquier cosa')).toEqual(DEFAULT_HERO)
  })

  it('valida lo que manda el panel', () => {
    expect(heroSchema.safeParse(DEFAULT_HERO).success).toBe(true)
    expect(heroSchema.safeParse({ ...DEFAULT_HERO, title: '' }).success).toBe(false)
    expect(heroSchema.safeParse({ ...DEFAULT_HERO, title: 'a\nb\nc\nd' }).success).toBe(false)
    expect(heroSchema.safeParse({ ...DEFAULT_HERO, badges: Array(7).fill({ icon: '⭐', text: 'x' }) }).success).toBe(false)
  })

  it('solo acepta imágenes subidas desde el panel', () => {
    const img = (url: string) => heroSchema.safeParse({ ...DEFAULT_HERO, image: { url, width: 1200, height: 800 } }).success
    expect(img('https://ctttonxivmozsqegzotb.supabase.co/storage/v1/object/public/products/2026-11/a.jpg')).toBe(true)
    expect(img('/assets/hero-main.png')).toBe(true)
    expect(img('https://otro-sitio.com/foto.jpg')).toBe(false)
    expect(img('javascript:alert(1)')).toBe(false)
  })

  it('la descripción vacía se arma con lo que se vende', () => {
    expect(autoHeroDescription('Alimentos y snacks')).toBe('Alimentos y snacks para perros y gatos con envío gratis a CABA.')
  })
})
