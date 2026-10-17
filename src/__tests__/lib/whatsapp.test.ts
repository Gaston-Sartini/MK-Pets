import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendWhatsApp, whatsAppHealth, manualWhatsAppLink } from '@/lib/whatsapp'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('WhatsApp (Evolution API)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.EVOLUTION_API_URL  = 'https://evolution.test'
    process.env.EVOLUTION_API_KEY  = 'test-key'
    process.env.EVOLUTION_INSTANCE = 'mi-bot'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.EVOLUTION_API_URL
  })

  it('manda el texto y devuelve true', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { key: { id: 'x' } }))
    expect(await sendWhatsApp('11 5555-0000', 'hola')).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://evolution.test/message/sendText/mi-bot')
    expect(JSON.parse(init.body)).toEqual({ number: '5491155550000', text: 'hola' })
  })

  it('si Evolution rechaza (sesión caída) no reintenta', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { status: 400, response: { message: ['Error: Connection Closed'] } }))
    expect(await sendWhatsApp('1155550000', 'hola')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('si no contesta a tiempo, reintenta una vez', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('TimeoutError: The operation was aborted due to timeout'))
      .mockResolvedValueOnce(json(201, {}))
    expect(await sendWhatsApp('1155550000', 'hola')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('si la imagen falla, manda igual el texto', async () => {
    fetchMock
      .mockResolvedValueOnce(json(400, { response: { message: ['no se pudo bajar la imagen'] } }))
      .mockResolvedValueOnce(json(201, {}))
    expect(await sendWhatsApp('1155550000', 'hola', {}, { imageUrl: 'https://x/img.png' })).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toContain('/message/sendMedia/')
    expect(fetchMock.mock.calls[1][0]).toContain('/message/sendText/')
  })

  it('el chequeo detecta la conexión muerta aunque el estado diga "open"', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { instance: { instanceName: 'mi-bot', state: 'open' } }))
      .mockResolvedValueOnce(json(400, { response: { message: ['Connection Closed'] } }))
    const health = await whatsAppHealth()
    expect(health.ok).toBe(false)
    expect(health.detail).toContain('Connection Closed')
  })

  it('el chequeo da bien con la conexión viva', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { instance: { state: 'open' } }))
      .mockResolvedValueOnce(json(200, [{ exists: false }]))
    expect(await whatsAppHealth()).toEqual({ ok: true, detail: 'Conectado' })
  })

  it('el chequeo avisa si hay que volver a vincular el teléfono', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { instance: { state: 'close' } }))
    const health = await whatsAppHealth()
    expect(health.ok).toBe(false)
    expect(health.detail).toContain('vincular')
  })

  it('arma el link para mandarlo a mano', () => {
    expect(manualWhatsAppLink('11 5555-0000', 'Hola ¿todo bien?')).toBe('https://wa.me/5491155550000?text=Hola%20%C2%BFtodo%20bien%3F')
  })
})
