// Borra la instancia de WhatsApp en Evolution y crea una limpia.
//
// Hace falta antes de volver a vincular un teléfono: si la instancia arrastra
// datos de una sesión anterior, WhatsApp rechaza la vinculación con "No se pudo
// vincular el dispositivo".
//
// Uso (PowerShell, desde la raíz del repo):
//   $env:EVOLUTION_API_URL="https://..."; node --env-file=infra/evolution/.env infra/evolution/reset-instance.mjs
const API      = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
const KEY      = process.env.EVOLUTION_API_KEY || ''
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'mi-bot'

if (!API || !KEY) {
  console.error('Faltan EVOLUTION_API_URL o EVOLUTION_API_KEY')
  process.exit(1)
}

const headers = { apikey: KEY, 'Content-Type': 'application/json' }
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, { method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(40000) })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const names = async () => {
  const { data } = await call('GET', '/instance/fetchInstances')
  return (Array.isArray(data) ? data : []).map(i => i.name)
}

if ((await names()).includes(INSTANCE)) {
  // El logout falla si la sesión ya estaba cerrada: no importa, se borra igual.
  await call('DELETE', `/instance/logout/${INSTANCE}`).catch(() => null)
  await call('DELETE', `/instance/delete/${INSTANCE}`)
  for (let i = 0; i < 15 && (await names()).includes(INSTANCE); i++) {
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  if ((await names()).includes(INSTANCE)) {
    console.error(`No se pudo borrar la instancia "${INSTANCE}"`)
    process.exit(1)
  }
  console.log(`Instancia "${INSTANCE}" borrada`)
}

const created = await call('POST', '/instance/create', { instanceName: INSTANCE, integration: 'WHATSAPP-BAILEYS', qrcode: true })
if (created.status >= 300) {
  console.error('No se pudo crear la instancia:', JSON.stringify(created.data).slice(0, 300))
  process.exit(1)
}
console.log(`Instancia "${INSTANCE}" creada limpia. Ahora corré qr-server.mjs y escaneá el QR.`)
