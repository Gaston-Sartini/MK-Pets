# 🐾 MK-Pets — Cómo arrancar todo después de reiniciar la PC

Guía rápida para encender el sitio en local. Tomate 2 minutos.

---

## 1. Abrí Docker Desktop

- Buscá **Docker Desktop** en el menú inicio y abrilo.
- Esperá ~30 segundos a que arranque (el icono de la ballena queda fijo, sin animación).
- **No hace falta hacer nada más en Docker.** Los containers de n8n y typebot tienen `restart: unless-stopped`, o sea que se prenden solos apenas Docker esté listo.

## 2. Abrí una terminal en la carpeta del proyecto

```powershell
cd D:\MK-Pets
```

## 3. Verificá que los containers estén arriba

```powershell
docker ps
```

Tenés que ver estos 5 containers en estado `Up`:

| Container | Para qué |
|---|---|
| `n8n` | El cerebro del chat |
| `typebot-builder` | (no se usa, ignoralo) |
| `typebot-viewer` | (no se usa, ignoralo) |
| `typebot-db` | (no se usa, ignoralo) |
| `typebot-mailpit` | (no se usa, ignoralo) |

> Si los containers **NO** aparecen (raro, sólo si los apagaste a propósito), levantalos a mano:
> ```powershell
> docker compose -f infra/n8n/docker-compose.yml up -d
> docker compose -f infra/typebot/docker-compose.yml up -d
> ```

## 4. Levantá el sitio Next.js

```powershell
npm run dev
```

Esperá hasta ver algo así:

```
▲ Next.js 15.5.27
- Local:  http://localhost:3000
✓ Ready in 2s
```

⚠️ **Dejá esa terminal abierta.** Si la cerrás se baja el sitio. Si querés liberar la terminal pero dejar el sitio corriendo, abrí otra ventana de PowerShell para los siguientes comandos.

## 5. Abrí en el browser

| URL | Para qué |
|---|---|
| **http://localhost:3000** | 🐾 **El sitio de la tienda** (lo que vas a usar 99% del tiempo) |
| http://localhost:5678 | Panel de n8n (solo si querés ver los logs del bot o editarlo) |
| http://localhost:8080 | Builder de Typebot (no se usa, podés ignorarlo) |

---

## ✅ Checks rápidos si algo no anda

| Síntoma | Comando para diagnosticar |
|---|---|
| El chat dice "Tuve un problemita 😕" | `docker ps` → verificá que `n8n` esté `Up` |
| Sitio no carga en `:3000` | Mirá la terminal de `npm run dev` — buscá líneas en rojo |
| Verificar que n8n responde | `curl http://localhost:5678/healthz` → tiene que devolver `{"status":"ok"}` |
| Verificar el bot end-to-end | ver bloque más abajo ⬇️ |

### Verificar el bot end-to-end (pegar todo en la terminal)

```powershell
curl -X POST http://localhost:3000/api/chat `
  -H "Content-Type: application/json" `
  -d '{\"message\":\"busco royal canin\",\"sessionId\":\"test\"}'
```

Te tiene que devolver un JSON con `"reply": "Sí, lo tengo ✅"` y una card de Royal Canin.

---

## 🛑 Para apagar todo (cuando termines de usar)

### Si solo querés frenar el sitio
- `Ctrl + C` en la terminal donde corrió `npm run dev`.
- Listo. Docker queda abierto pero el sitio se apaga.

### Si querés cerrar todo
- `Ctrl + C` en la terminal del sitio.
- Cerrá **Docker Desktop**. Los containers se pausan automáticamente; cuando vuelvas a abrir Docker, retoman solos sin perder datos.

### Si querés bajar containers (pero dejar Docker abierto)
```powershell
docker compose -f infra/n8n/docker-compose.yml down
docker compose -f infra/typebot/docker-compose.yml down
```
Esto los apaga sin perder datos (todo lo importante está en volumes persistidos).

---

## 🆘 Si algo se rompe mal

Restartar todo desde cero:

```powershell
cd D:\MK-Pets

# Restartar n8n (sin perder workflows)
docker restart n8n

# Restartar typebot
docker restart typebot-db typebot-builder typebot-viewer

# Volver a levantar el sitio
npm run dev
```

Si tras eso sigue roto: cerrá Docker Desktop completo, esperá 10 segundos, abrilo de nuevo. Cuando los containers estén `Up`, hacé `npm run dev`.

---

## 🔀 Cambiar versión del bot del chat

Hay 2 versiones del flujo n8n corriendo en paralelo:

| Versión | Routing | Reply | Webhook path |
|---|---|---|---|
| **v1** | Regex sobre keywords | Plantilla por intent | `/mk-pets-chat` |
| **v2** | LLM Understand + catálogo | Conversacional argentino | `/mk-pets-chat-v2` |

El sitio usa **v2 por default**. Para cambiar editá `.env.local`:

```
CHAT_VERSION=v2    # ← default, conversacional
# CHAT_VERSION=v1  # ← más rápido pero menos smart
```

Y reiniciá el dev server (`Ctrl + C` y `npm run dev`).

## 📚 Más info

- Arquitectura v1 completa: [`docs/chat/README.md`](docs/chat/README.md)
- Arquitectura v2 (mejorado): [`docs/chat/README-v2.md`](docs/chat/README-v2.md)
- Cómo está armado el bot de n8n: [`docs/chat/n8n-tools.md`](docs/chat/n8n-tools.md)
- Cómo regenerar el workflow: `node generate_n8n.js` (v1) o `node generate_n8n_v2.js` (v2)

---

**Último update:** 2026-05-22
