import { normalizeArgPhone } from '@/lib/phone'
import { isWhatsAppConfigured, whatsAppHealth } from '@/lib/whatsapp'

/**
 * Vincular el teléfono que manda los WhatsApp de la tienda (Evolution API),
 * desde el panel. Antes había que correr scripts en la PC
 * (infra/evolution/reset-instance.mjs y qr-server.mjs).
 *
 * Para vincular otro teléfono hay que empezar de cero: se cierra la sesión, se
 * borra la instancia y se crea una limpia. Con una instancia que arrastra una
 * sesión vieja, WhatsApp rechaza la vinculación ("No se pudo vincular el
 * dispositivo").
 */

const instance = () => process.env.EVOLUTION_INSTANCE ?? 'mi-bot'

async function evolution(method: string, path: string, body?: unknown, timeoutMs = 15_000) {
  const res = await fetch(`${process.env.EVOLUTION_API_URL!.replace(/\/+$/, '')}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY ?? '' },
    body:    body === undefined ? undefined : JSON.stringify(body),
    signal:  AbortSignal.timeout(timeoutMs),
    cache:   'no-store',
  })
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) as any }
}

export interface LinkStatus {
  configured:  boolean
  /** open = vinculado; connecting = esperando que escaneen; close = sin teléfono */
  state:       'open' | 'connecting' | 'close' | 'unknown'
  /** Si la conexión anda de verdad (puede decir "open" y estar caída por dentro). */
  working:     boolean
  detail:      string
  number:      string | null
  profileName: string | null
}

export async function getLinkStatus(): Promise<LinkStatus> {
  const empty = { number: null, profileName: null }
  if (!isWhatsAppConfigured()) return { configured: false, state: 'unknown', working: false, detail: 'WhatsApp no está configurado', ...empty }
  try {
    const { data } = await evolution('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instance())}`)
    const found = (Array.isArray(data) ? data : []).find((i: any) => (i.name ?? i.instance?.instanceName) === instance())
    if (!found) return { configured: true, state: 'close', working: false, detail: 'No hay ningún teléfono vinculado', ...empty }

    const raw   = String(found.connectionStatus ?? found.instance?.status ?? 'unknown')
    const state = (['open', 'connecting', 'close'].includes(raw) ? raw : 'unknown') as LinkStatus['state']
    const jid   = String(found.ownerJid ?? found.instance?.owner ?? '')
    const base  = { configured: true, state, number: jid ? jid.split('@')[0] : null, profileName: found.profileName ?? null }

    if (state !== 'open') {
      return { ...base, working: false, detail: state === 'connecting' ? 'Esperando que escaneen el QR' : 'No hay ningún teléfono vinculado' }
    }
    const health = await whatsAppHealth()
    return { ...base, working: health.ok, detail: health.detail }
  } catch (err) {
    return { configured: true, state: 'unknown', working: false, detail: `El servidor de WhatsApp no responde (${String(err).slice(0, 80)})`, ...empty }
  }
}

/** Desvincula el teléfono actual y deja una instancia limpia, lista para vincular otro. */
export async function resetInstance(): Promise<{ ok: boolean; error?: string }> {
  const name = instance()
  const exists = async () => {
    const { data } = await evolution('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`)
    return (Array.isArray(data) ? data : []).some((i: any) => (i.name ?? i.instance?.instanceName) === name)
  }

  if (await exists()) {
    // El logout falla si la sesión ya estaba cerrada: no importa, se borra igual.
    await evolution('DELETE', `/instance/logout/${name}`).catch(() => null)
    await evolution('DELETE', `/instance/delete/${name}`).catch(() => null)
    for (let i = 0; i < 8 && await exists(); i++) await new Promise(r => setTimeout(r, 1000))
    if (await exists()) return { ok: false, error: 'No se pudo borrar la sesión anterior. Probá de nuevo en un minuto.' }
  }

  const created = await evolution('POST', '/instance/create', { instanceName: name, integration: 'WHATSAPP-BAILEYS', qrcode: true }, 25_000)
  if (!created.ok) return { ok: false, error: 'No se pudo preparar la vinculación. Probá de nuevo en un minuto.' }
  return { ok: true }
}

export interface LinkCode {
  /** Imagen del QR (data:image/png;base64,…) */
  qr:          string | null
  /** Código de 8 letras para "Vincular con el número de teléfono" (si se pidió con un número) */
  pairingCode: string | null
}

/** QR (o código) para vincular. Vence a los ~40 segundos: el panel lo vuelve a pedir. */
export async function getLinkCode(phone?: string): Promise<LinkCode & { error?: string }> {
  const query = phone ? `?number=${normalizeArgPhone(phone)}` : ''
  const { ok, data } = await evolution('GET', `/instance/connect/${instance()}${query}`, undefined, 25_000)
  if (!ok) return { qr: null, pairingCode: null, error: 'No se pudo generar el código. Tocá "Empezar de nuevo".' }
  return { qr: data?.base64 ?? null, pairingCode: data?.pairingCode ?? null }
}
