# Setup Typebot — guía para Gastón

> Esto te toma 15–20 minutos la primera vez. Después no tocás más nada.

## Lo que ya está hecho (no toques)

- ✅ `docker-compose.yml` con los 3 servicios (DB + builder + viewer)
- ✅ `.env` con secrets random ya generados
- ✅ Tu email de admin (`gaston.sartini@gmail.com`) precargado
- ✅ El proyecto MK-Pets ya tiene el bridge JS, el componente `<TypebotBubble>`, y la CSP autoriza `localhost:8081`
- ✅ Las funciones SQL en Supabase ya están vivas (`search_product_with_alternatives`, `top_promos`, `products_by_category`)

---

## Lo que tenés que hacer vos

### 1️⃣ Levantar Typebot con Docker (1 comando)

Abrí una terminal en `D:\MK-Pets\infra\typebot\` y corré:

```bash
docker compose up -d
```

Esperá ~30 segundos a que los 3 contenedores arranquen. Para confirmar:

```bash
docker compose ps
```

Tenés que ver `typebot-db`, `typebot-builder` y `typebot-viewer` los tres en `running`.

**Si algo falla:** `docker compose logs typebot-builder` te muestra el error.

### 2️⃣ Crear tu cuenta de admin en Typebot

1. Abrí http://localhost:8080 en el browser.
2. Clickeás **"Sign up"**.
3. Email: `gaston.sartini@gmail.com` (el mismo que pusimos en `.env`).
4. Contraseña: la que quieras.
5. Listo, entrás al builder.

### 3️⃣ Crear el flow del chat (5 clicks)

Dentro del builder:

1. Clic en **"+ Create a typebot"** → **"Start from scratch"**.
2. Nombrá el flow: `mk-pets-vendedor`.
3. Vas a ver una pantalla con un bloque "Start". Ahora vamos a armar este flow simple:

```
[Start]
   ↓
[Bubble: "¡Hola! 🐾 ¿Qué buscás para tu mascota?"]
   ↓
[Input: Text → guarda en {{userMessage}}]
   ↓
[Integration: HTTP Request → tu n8n]
   ↓
[Bubble: muestra {{chatResponse.reply}}]
   ↓
[Code: pegás docs/chat/typebot-custom-code.html]
   ↓
[Jump back to Input ↑]
```

**Detalle de cada bloque:**

**Bloque "Text input":**
- Drag and drop "Text" desde el menú lateral (sección "Inputs").
- En el campo "Variable to save answer", elegí `+ Create new variable` → nombre: `userMessage`.

**Bloque "HTTP Request":**
- Drag and drop desde "Integrations" → "HTTP request".
- URL: `http://host.docker.internal:5678/webhook/mk-pets-chat`
  - (Si tu n8n NO está en Docker en la misma máquina, usá `http://localhost:5678/...`)
- Method: `POST`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
  ```json
  { "message": "{{userMessage}}", "sessionId": "{{Result ID}}" }
  ```
- En **"Save in variables"**: variable `chatResponse` → response body.

**Bloque "Text" (mostrar reply):**
- Drag "Text" desde "Bubbles".
- Contenido: `{{chatResponse.reply}}`

**Bloque "Code" (renderizar cards):**
- Drag "Code" desde "Bubbles" (también puede llamarse "Custom code" o "Script" según versión).
- Pegá el contenido completo de `docs/chat/typebot-custom-code.html`.

**Loop:**
- Después del bloque Code, conectá la flecha de vuelta al bloque "Text input" para que el chat siga conversando.

**Publicar:**
- Arriba a la derecha del builder: botón **"Publish"** (naranja). Esto activa el flow para que el bubble lo consuma.
- Anotá la URL del bot. La vas a ver arriba en formato `http://localhost:8081/<algun-id>`. El **id final del path** es lo que va en tu `.env.local` como `NEXT_PUBLIC_TYPEBOT_FLOW`.

### 4️⃣ Configurar las env vars en tu Next.js

Editá `D:\MK-Pets\.env.local` y agregá:

```
NEXT_PUBLIC_TYPEBOT_URL=http://localhost:8081
NEXT_PUBLIC_TYPEBOT_FLOW=<el-id-que-anotaste>
```

**Reiniciá el dev server** (`Ctrl+C` y `npm run dev` de nuevo).

### 5️⃣ Configurar el flow de n8n

En tu n8n (http://localhost:5678):

1. **New workflow** → llamalo `mk-pets-chat`.
2. Agregá un nodo **Webhook**:
   - Method: `POST`
   - Path: `mk-pets-chat`
   - Response Mode: `Last Node`
   - Copiá la URL que n8n te muestra (la "Test URL") — esa va en el HTTP Request de Typebot.
3. Agregá un nodo **AI Agent** (OpenAI o Anthropic, lo que prefieras):
   - **System Message:** pegá el contenido de `docs/chat/n8n-system-prompt.md` (la parte adentro del code block `system prompt`).
   - **Prompt (Define):** `{{ $json.body.message }}`
4. Agregá las **tools** al AI Agent (los detalles están en `docs/chat/n8n-tools.md`):
   - HTTP Request Tool → `search_product` (URL del rpc de Supabase).
   - HTTP Request Tool → `top_promos`.
   - HTTP Request Tool → `products_by_category`.
   - En cada tool: header `apikey` + `Authorization: Bearer <tu SUPABASE_ANON_KEY>`.
5. Agregá un nodo **Code** después del AI Agent — pegá el snippet de validación que está en `docs/chat/n8n-tools.md` (sección "Code node — post-procesar la salida del agente").
6. **Activate** el workflow (toggle arriba a la derecha).

### 6️⃣ Probar end-to-end

1. Abrí la tienda: http://localhost:3000
2. A los ~5 segundos aparece la burbuja naranja abajo a la derecha.
3. Clickeala. Aparece el chat con el saludo.
4. Escribí: `busco royal canin`
5. Tiene que devolverte una card con el "Royal Canin Gato Adulto 7.5kg" (que ya está en tu DB).
6. Clickeás **"Agregar al carrito"** → toast verde, drawer del carrito se abre, el producto adentro 🐾

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| La burbuja no aparece | env vars no seteadas o dev server no reiniciado | Verificá `.env.local`, reiniciá `npm run dev` |
| "Connection refused" desde Typebot a n8n | Typebot en Docker no resuelve `localhost` | Usá `http://host.docker.internal:5678/...` en el HTTP Request de Typebot |
| El agente devuelve markdown en vez de JSON | Falta el Code node de validación | Pegá el snippet de `n8n-tools.md` después del AI Agent |
| "CSP violation" en la consola del browser | Falta autorizar el dominio de Typebot en CSP | Ya está autorizado vía `NEXT_PUBLIC_TYPEBOT_URL`. Verificá que esté en `.env.local` |
| Card sin imagen | El producto no tiene imágenes cargadas | Subí imágenes desde `/admin/productos/[id]` |
| Click en "Agregar al carrito" no hace nada | `window.parent.MKPets` undefined | Abrí DevTools → Console → tipeá `window.MKPets` — debería existir. Si no, hay un error de hidratación en el shop layout |

## Comandos útiles

```bash
# Parar Typebot
cd D:\MK-Pets\infra\typebot && docker compose down

# Parar Y borrar la DB (empezar de cero)
docker compose down -v

# Ver logs en vivo
docker compose logs -f typebot-builder

# Actualizar a la última versión de Typebot
docker compose pull && docker compose up -d
```
