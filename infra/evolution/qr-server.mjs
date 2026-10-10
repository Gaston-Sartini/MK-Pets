// Página local para vincular WhatsApp con Evolution API escaneando el QR.
//
// El QR de WhatsApp vence cada ~30 segundos, así que una imagen guardada no
// sirve: esta página lo vuelve a pedir sola hasta que la sesión queda conectada.
// La API key nunca llega al navegador; las llamadas a Evolution se hacen acá.
//
// Uso (PowerShell, desde la raíz del repo):
//   $env:EVOLUTION_API_URL="http://localhost:8085"; $env:EVOLUTION_API_KEY="<tu key>"
//   node infra/evolution/qr-server.mjs
// y abrir http://localhost:8099
import http from 'node:http'

const API      = (process.env.EVOLUTION_API_URL || 'http://localhost:8085').replace(/\/+$/, '')
const KEY      = process.env.EVOLUTION_API_KEY || ''
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'mi-bot'
const PORT     = Number(process.env.QR_PORT) || 8099

if (!KEY) {
  console.error('Falta EVOLUTION_API_KEY')
  process.exit(1)
}

async function evolution(path) {
  const res = await fetch(`${API}${path}`, { headers: { apikey: KEY }, signal: AbortSignal.timeout(15000) })
  return res.json()
}

async function status() {
  const state = (await evolution(`/instance/connectionState/${INSTANCE}`))?.instance?.state ?? 'desconocido'
  if (state === 'open') return { state }
  // Pedir /connect devuelve el QR vigente (y arranca la conexión si estaba cerrada)
  const qr = await evolution(`/instance/connect/${INSTANCE}`)
  return { state, qr: qr?.base64 ?? null }
}

const PAGE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vincular WhatsApp · MK-Pets</title>
<style>
  body{font-family:system-ui,sans-serif;background:#fff7ed;color:#1f2937;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
  main{background:#fff;border-radius:16px;padding:28px;max-width:420px;text-align:center;box-shadow:0 4px 24px #0001}
  h1{font-size:1.3rem;margin:0 0 8px} ol{text-align:left;font-size:.92rem;line-height:1.5;padding-left:20px}
  img{width:280px;height:280px;margin:12px auto;display:block} #ok{font-size:3rem} .muted{color:#6b7280;font-size:.85rem}
</style></head><body><main>
  <h1>Vincular WhatsApp (${INSTANCE})</h1>
  <div id="content"><p class="muted">Cargando…</p></div>
</main>
<script>
  const el = document.getElementById('content')
  async function tick() {
    try {
      const s = await (await fetch('/status')).json()
      if (s.state === 'open') {
        el.innerHTML = '<div id="ok">✅</div><p><strong>WhatsApp conectado.</strong></p><p class="muted">Ya podés cerrar esta página.</p>'
        return
      }
      el.innerHTML = s.qr
        ? '<ol><li>Abrí WhatsApp en el celular.</li><li>Menú → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong>.</li><li>Escaneá este código.</li></ol><img alt="Código QR de WhatsApp" src="' + s.qr + '"><p class="muted">Se actualiza solo. Estado: ' + s.state + '</p>'
        : '<p class="muted">Esperando el código… (estado: ' + s.state + ')</p>'
    } catch (e) {
      el.innerHTML = '<p class="muted">No pude hablar con Evolution API. ¿Está levantado?</p>'
    }
    setTimeout(tick, 8000)
  }
  tick()
</script></body></html>`

http.createServer(async (req, res) => {
  if (req.url === '/status') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(await status()))
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ state: 'error' }))
    }
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(PAGE)
}).listen(PORT, '127.0.0.1', () => console.log(`Abrí http://localhost:${PORT} para vincular WhatsApp`))
