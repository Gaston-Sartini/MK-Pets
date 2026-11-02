import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { mergeHero, type HeroContent } from '@/lib/site-content'

/**
 * Ajustes del sitio guardados en la tabla SiteSetting (clave → JSON). Si una
 * clave no está guardada, o la base no responde, se usa el valor de fábrica:
 * la tienda nunca queda sin portada. Solo para el servidor.
 */

export async function getSetting(key: string): Promise<unknown> {
  try {
    const rows = await prisma.$queryRaw<{ value: unknown }[]>`select value from public."SiteSetting" where key = ${key}`
    return rows[0]?.value ?? null
  } catch (err) {
    logger.warn('SiteSetting read failed', { key, error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value)
  await prisma.$executeRaw`
    insert into public."SiteSetting" (key, value, "updatedAt") values (${key}, ${json}::jsonb, now())
    on conflict (key) do update set value = excluded.value, "updatedAt" = now()`
}

export async function getHeroContent(): Promise<HeroContent> {
  return mergeHero(await getSetting('hero'))
}
