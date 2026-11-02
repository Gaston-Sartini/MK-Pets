'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfirm } from '@/components/admin/ConfirmDialog'

interface Status {
  configured:  boolean
  state:       'open' | 'connecting' | 'close' | 'unknown'
  working:     boolean
  detail:      string
  number:      string | null
  profileName: string | null
  owner:       string | null
}

type Step = 'idle' | 'resetting' | 'linking' | 'done'
type Method = 'qr' | 'code'

const QR_REFRESH_MS = 30_000
const POLL_MS       = 3_000

/** 5491123456789 → +54 9 11 2345-6789 */
function pretty(number: string | null): string {
  if (!number) return '—'
  const m = number.match(/^549(11)(\d{4})(\d{4})$/)
  return m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : `+${number}`
}

const card  = 'bg-white rounded-xl border border-gray-200 p-5'
const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange'

async function post(body: Record<string, unknown>) {
  const res  = await fetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'No se pudo completar')
  return data
}

export function WhatsAppLink() {
  const [status, setStatus]   = useState<Status | null>(null)
  const [step, setStep]       = useState<Step>('idle')
  const [method, setMethod]   = useState<Method>('qr')
  const [qr, setQr]           = useState<string | null>(null)
  const [phone, setPhone]     = useState('')
  const [pairing, setPairing] = useState<string | null>(null)
  const [owner, setOwner]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const { confirm, dialog }   = useConfirm()
  const ownerTouched = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/whatsapp', { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return null
    const data: Status = await res.json()
    setStatus(data)
    if (!ownerTouched.current && data.owner) setOwner(pretty(data.owner))
    return data
  }, [])

  useEffect(() => { load() }, [load])

  const fetchQr = useCallback(async () => {
    try {
      const data = await post({ action: 'code' })
      setQr(data.qr)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el QR')
    }
  }, [])

  // Mientras se vincula: mirar cada 3 s si ya escanearon, y renovar el QR antes de que venza
  useEffect(() => {
    if (step !== 'linking') return
    const poll = setInterval(async () => {
      const data = await load()
      if (data?.state === 'open') { setStep('done'); setQr(null); setPairing(null) }
    }, POLL_MS)
    const refresh = method === 'qr' ? setInterval(fetchQr, QR_REFRESH_MS) : null
    return () => { clearInterval(poll); if (refresh) clearInterval(refresh) }
  }, [step, method, load, fetchQr])

  async function start() {
    const linked = status?.state === 'open'
    if (linked) {
      const ok = await confirm({
        title:        '¿Desvincular el teléfono actual?',
        detail:       `Hoy los WhatsApp salen desde ${pretty(status?.number ?? null)}. Desde este momento y hasta que vincules el teléfono nuevo, los clientes no reciben avisos. Tené el teléfono nuevo a mano antes de seguir.`,
        confirmLabel: 'Sí, desvincular',
        danger:       true,
      })
      if (!ok) return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setStep('resetting')
    try {
      await post({ action: 'reset' })
      setStep('linking')
      setMethod('qr')
      setPairing(null)
      await fetchQr()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar')
      setStep('idle')
    } finally {
      setBusy(false)
    }
  }

  async function askPairingCode() {
    setBusy(true)
    setError('')
    try {
      const data = await post({ action: 'code', phone })
      setPairing(data.pairingCode)
      if (!data.pairingCode) setError('WhatsApp no dio un código. Probá con el QR, o tocá "Empezar de nuevo".')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código')
    } finally {
      setBusy(false)
    }
  }

  async function saveOwner() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await post({ action: 'owner', phone: owner })
      ownerTouched.current = false
      setOwner(pretty(data.owner))
      setNotice('Listo: los avisos de la tienda van a llegar a ese número.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className="text-sm text-mk-mid">Consultando WhatsApp…</p>

  if (!status.configured) {
    return <div className={card}><p className="text-sm">WhatsApp no está configurado en este sitio (falta EVOLUTION_API_URL).</p></div>
  }

  const sameNumber = status.number && status.owner && status.number === status.owner

  return (
    <div className="space-y-6 max-w-3xl">
      {dialog}

      {/* ESTADO */}
      <section className={card}>
        <h2 className="font-display font-bold text-base text-mk-dark mb-2">Teléfono que envía los mensajes</h2>
        {status.state === 'open' && status.working && (
          <p className="text-sm text-green-700">✅ Conectado: los WhatsApp salen desde <strong>{pretty(status.number)}</strong>{status.profileName ? ` (${status.profileName})` : ''}.</p>
        )}
        {status.state === 'open' && !status.working && (
          <p className="text-sm text-red-700">⚠️ Figura vinculado ({pretty(status.number)}), pero no está enviando: {status.detail}. Suele arreglarse solo en unos minutos; si sigue así, pedile a Claude que revise WhatsApp.</p>
        )}
        {status.state !== 'open' && (
          <p className="text-sm text-red-700">⚠️ {status.detail}. Mientras no haya un teléfono vinculado, los clientes no reciben avisos.</p>
        )}
      </section>

      {/* VINCULAR */}
      <section className={card}>
        <h2 className="font-display font-bold text-base text-mk-dark mb-1">
          {status.state === 'open' ? 'Pasar los mensajes a otro teléfono' : 'Vincular un teléfono'}
        </h2>
        <p className="text-sm text-mk-mid mb-4">
          Los mensajes van a salir desde el WhatsApp del teléfono que vincules, como en WhatsApp Web. Ese teléfono tiene que tener internet,
          al menos de vez en cuando.
        </p>

        {(step === 'idle' || step === 'resetting') && (
          <button type="button" onClick={start} disabled={busy}
                  className="px-5 py-2.5 rounded-lg bg-mk-orange text-white font-bold disabled:opacity-60">
            {step === 'resetting' ? 'Preparando…' : status.state === 'open' ? 'Desvincular el actual y vincular otro' : 'Empezar'}
          </button>
        )}

        {step === 'linking' && (
          <div className="space-y-4">
            <div className="flex gap-2" role="tablist">
              <button type="button" role="tab" aria-selected={method === 'qr'} onClick={() => { setMethod('qr'); fetchQr() }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${method === 'qr' ? 'bg-mk-dark text-white' : 'border border-gray-300'}`}>
                Con QR
              </button>
              <button type="button" role="tab" aria-selected={method === 'code'} onClick={() => setMethod('code')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${method === 'code' ? 'bg-mk-dark text-white' : 'border border-gray-300'}`}>
                Con código (si estás en el mismo celular)
              </button>
            </div>

            {method === 'qr' && (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-64 h-64 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- el QR llega como data: URL y vence cada 30 s */}
                  {qr ? <img src={qr} alt="Código QR para vincular WhatsApp" className="w-full h-full" /> : <span className="text-sm text-mk-mid">Generando QR…</span>}
                </div>
                <ol className="text-sm text-mk-dark list-decimal pl-5 space-y-1.5">
                  <li>Abrí WhatsApp en el teléfono nuevo.</li>
                  <li>Tocá <strong>⋮</strong> (Android) o <strong>Configuración</strong> (iPhone) → <strong>Dispositivos vinculados</strong>.</li>
                  <li>Tocá <strong>Vincular un dispositivo</strong> y apuntá la cámara a este QR.</li>
                  <li>Listo: esta página se actualiza sola cuando queda vinculado.</li>
                  <li className="text-mk-mid">El QR se renueva solo cada 30 segundos.</li>
                </ol>
              </div>
            )}

            {method === 'code' && (
              <div className="space-y-3">
                <p className="text-sm text-mk-dark">Sirve cuando tenés el panel abierto en el mismo celular que querés vincular (no podés escanear tu propia pantalla).</p>
                <div className="flex flex-wrap gap-2">
                  <input className={`${input} w-56`} value={phone} onChange={e => setPhone(e.target.value)}
                         placeholder="11 2345-6789" aria-label="Número del teléfono que vas a vincular" inputMode="tel" />
                  <button type="button" onClick={askPairingCode} disabled={busy || phone.trim().length < 8}
                          className="px-4 py-2 rounded-lg bg-mk-orange text-white text-sm font-bold disabled:opacity-60">
                    {busy ? 'Pidiendo…' : 'Pedir código'}
                  </button>
                </div>
                {pairing && (
                  <>
                    <p className="font-mono text-3xl font-bold tracking-[0.3em] text-mk-dark">{pairing}</p>
                    <ol className="text-sm text-mk-dark list-decimal pl-5 space-y-1.5">
                      <li>En WhatsApp: <strong>⋮</strong> o <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong>.</li>
                      <li>Abajo de la cámara, tocá <strong>Vincular con el número de teléfono</strong>.</li>
                      <li>Escribí el código de arriba. Si vence, pedí otro.</li>
                    </ol>
                  </>
                )}
              </div>
            )}

            <button type="button" onClick={start} disabled={busy} className="text-sm text-gray-500 underline">
              Empezar de nuevo
            </button>
          </div>
        )}

        {step === 'done' && (
          <p className="text-sm text-green-700">✅ ¡Vinculado! Desde ahora los WhatsApp salen desde {pretty(status.number)}.</p>
        )}
      </section>

      {/* NÚMERO DE LA TIENDA */}
      <section className={card}>
        <h2 className="font-display font-bold text-base text-mk-dark mb-1">Número que recibe los avisos de la tienda</h2>
        <p className="text-sm text-mk-mid mb-3">Pedidos nuevos, pedidos que el cliente cambió o canceló, y productos con poco stock.</p>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} w-56`} value={owner} inputMode="tel" aria-label="Número que recibe los avisos"
                 onChange={e => { ownerTouched.current = true; setOwner(e.target.value) }} />
          <button type="button" onClick={saveOwner} disabled={busy || owner.trim().length < 8}
                  className="px-4 py-2 rounded-lg bg-mk-orange text-white text-sm font-bold disabled:opacity-60">Guardar</button>
        </div>
        {sameNumber && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Es el mismo número que envía los mensajes: WhatsApp no avisa de los mensajes que uno se manda a sí mismo
            (quedan en el chat “Tú”). Conviene poner otro número, por ejemplo el de quien prepara los pedidos.
          </p>
        )}
      </section>

      {error  && <p role="alert"  className="text-sm text-mk-error">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    </div>
  )
}
