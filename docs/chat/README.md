# Chat MK-Pets — guía de implementación

Stack: **Typebot (self-hosted) → Webhook → n8n (Groq + Supabase) → Frontend**.

```
Usuario en la web
   │ escribe en el chat (Typebot bubble embedido en /(shop)/layout.tsx)
   ▼
Typebot bubble
   │ POST /webhook/mk-pets-chat   { message, sessionId }
   ▼
n8n flow "Typebot IA MK-Pets (Groq Agent)":
   ┌──────────────────────────────────────────────────────────────┐
   │ Webhook                                                       │
   │   ↓                                                           │
   │ Detect Intent (Code JS)                                       │
   │   • clasifica intent: chat | search | category | promos      │
   │   • limpia stopwords ("busco", "tenes", "para", ...)         │
   │   • decide rpcName + rpcBody                                  │
   │   ↓                                                           │
   │ Supabase RPC (HTTP Request)                                   │
   │   • POST /rest/v1/rpc/<rpcName> con apikey + body            │
   │   • neverError + fullResponse                                 │
   │   ↓                                                           │
   │ Compose Context (Code JS)                                     │
   │   • normaliza productos (basePrice→number, etc.)             │
   │   • arma { userMessage, context: { intent, products, … } }  │
   │   ↓                                                           │
   │ AI Agent (Groq gpt-oss-20b, response_format=json_object)      │
   │   • + Window Buffer Memory (session por sessionId)            │
   │   • genera JSON con { reply, cards[], suggestions[] }         │
   │   ↓                                                           │
   │ Parse JSON (Code JS)                                          │
   │   • extrae JSON aunque venga con markdown fences              │
   │   • valida cards (productId, name, slug, unitPrice)           │
   │   • mapea badge a UPPER (NUEVO/OFERTA/MÁS VENDIDO)           │
   │   ↓                                                           │
   │ Respond to Webhook (JSON)                                     │
   └──────────────────────────────────────────────────────────────┘
   ▼
Typebot recibe { reply, cards[], suggestions[] }
   │ ejecuta bloque "Custom Code" → renderiza cards
   ▼
Usuario clickea "Agregar al carrito"
   │ window.parent.MKPets.addToCart(card) (bridge en ChatBridge.tsx)
   ▼
Carrito Zustand actualizado sin recargar 🐾
```

## Por qué este diseño

La arquitectura inicial usaba **AI Agent con HTTP Request Tools** (formato OpenAI tool calling). Eso falla con Groq por dos razones:

1. **Llama-3.3-70b en Groq** emite tool calls en formato legacy `<function=…>{…}</function>` en vez del JSON estándar — Groq rechaza con `tool_use_failed`.
2. **El generador de schema** de n8n para tools v1.1 con `placeholderDefinitions` y `$fromAI` no siempre interpola correctamente con modelos vía Groq.

Solución actual: **el LLM no llama tools**. Un Code JS clasifica intent y arma la query, un HTTP Request normal pega a Supabase, y el agente sólo formatea el JSON final. Resultado: 0% errores `tool_use_failed`, latencia ≤ 1.5 s en cache caliente.

## Archivos del proyecto involucrados

| Archivo | Para qué sirve |
|---|---|
| `src/lib/chat-types.ts` | Contrato TS compartido entre el bridge y el chat |
| `src/components/chat/ChatBridge.tsx` | Registra `window.MKPets` con `addToCart` y `openProduct` |
| `src/components/chat/TypebotBubble.tsx` | Carga el bubble de Typebot vía CDN |
| `src/app/(shop)/layout.tsx` | Monta ambos componentes en toda la tienda |
| `.env.local` | `NEXT_PUBLIC_TYPEBOT_URL`, `NEXT_PUBLIC_TYPEBOT_FLOW`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `next.config.mjs` | CSP autoriza el host de Typebot, jsdelivr, supabase |
| `infra/n8n/docker-compose.yml` | Levanta n8n en `:5678` con `SUPABASE_*` env |
| `infra/typebot/docker-compose.yml` | Levanta Typebot builder `:8080` + viewer `:8081` |
| `docs/chat/n8n-typebot-flow.json` | Workflow listo para importar a n8n |
| `docs/chat/n8n-system-prompt.md` | System prompt del agente (formateador JSON) |
| `docs/chat/n8n-tools.md` | Doc del flow (nodos, RPCs, payload, errores comunes) |
| `docs/chat/supabase-functions.sql` | RPCs `search_product_with_alternatives`, `top_promos`, `products_by_category` |
| `docs/chat/typebot-custom-code.html` | Bloque para Typebot que renderiza las cards |
| `generate_n8n.js` | **Source of truth** del workflow JSON — re-correr para cambios |

## Setup rápido (todo en local con Docker)

### 1) Supabase: instalar las RPCs

Pegá el contenido de `docs/chat/supabase-functions.sql` en el SQL Editor de Supabase y corré. Crea:
- `search_product_with_alternatives(query)` — match exacto, fallback por palabra, alternatives de misma categoría
- `top_promos(limit_n)` — productos con `originalPrice` o `badge='sale'`
- `products_by_category(category_slug, limit_n)` — mejores por categoría

### 2) n8n: importar el workflow

```bash
cd infra/n8n
docker compose up -d         # levanta n8n en http://localhost:5678
docker cp ../../docs/chat/n8n-typebot-flow.json n8n:/tmp/flow.json
docker exec n8n n8n import:workflow --input=/tmp/flow.json
docker exec n8n n8n update:workflow --id=nrrrtxr1AcdWEj9d --active=true
docker exec n8n n8n publish:workflow --id=nrrrtxr1AcdWEj9d
docker restart n8n
```

Luego en n8n UI (http://localhost:5678):
1. Abrí el workflow "Typebot IA MK-Pets (Groq Agent)".
2. En el nodo **Groq Chat Model**: si la credential `Groq account` no está, creá una nueva con tu `GROQ_API_KEY` (ver Groq Cloud Console).
3. El workflow ya viene activo después del `update:workflow --active=true`.

### 3) Variables de entorno

`infra/n8n/docker-compose.yml` lee del shell:
```bash
export SUPABASE_URL=https://ctttonxivmozsqegzotb.supabase.co
export SUPABASE_ANON_KEY=eyJhbGciOi…
export N8N_ENCRYPTION_KEY=<32 bytes random>
```

`.env.local` del Next.js:
```
NEXT_PUBLIC_TYPEBOT_URL=http://localhost:8081
NEXT_PUBLIC_TYPEBOT_FLOW=<id que te da Typebot al publicar>
```

### 4) Typebot: armar el flow

Detalle paso a paso en `infra/typebot/SETUP.md`. Resumen:
1. Levantá Typebot: `cd infra/typebot && docker compose up -d`.
2. Crea cuenta en http://localhost:8080.
3. Flow: Start → Text input (`{{userMessage}}`) → HTTP Request → Text bubble (`{{chatResponse.reply}}`) → Code (pegás `typebot-custom-code.html`) → loop al Text input.
4. En el HTTP Request usá `http://host.docker.internal:5678/webhook/mk-pets-chat` (porque Typebot está en otro container).

## Cómo probar end-to-end (curl)

```bash
# Saludo
curl -s -X POST http://localhost:5678/webhook/mk-pets-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hola","sessionId":"test-1"}' | jq .

# Búsqueda exacta
curl -s -X POST http://localhost:5678/webhook/mk-pets-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"busco royal canin","sessionId":"test-2"}' | jq .

# Categoría
curl -s -X POST http://localhost:5678/webhook/mk-pets-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"qué tenés para perro","sessionId":"test-3"}' | jq .

# Promos
curl -s -X POST http://localhost:5678/webhook/mk-pets-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"qué ofertas tenés","sessionId":"test-4"}' | jq .
```

Respuesta esperada (shape):
```json
{
  "reply": "Sí, lo tengo ✅",
  "cards": [
    {
      "productId": "c48d…",
      "variantLabel": null,
      "name": "Royal Canin Gato Adulto 7.5kg",
      "image": "",
      "slug": "royal-canin-gato-adulto-75kg",
      "unitPrice": 18500,
      "originalPrice": null,
      "badge": "MÁS VENDIDO",
      "stock": 15,
      "ctaLabel": "Agregar al carrito",
      "ctaAction": "addToCart",
      "productUrl": "/producto/royal-canin-gato-adulto-75kg"
    }
  ],
  "suggestions": ["…", "…"]
}
```

## Errores comunes y troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `404 webhook not registered` | Workflow no activo | `n8n update:workflow --id=… --active=true && n8n publish:workflow && docker restart n8n` |
| Body vacío con HTTP 200 | El último nodo no fue `Respond to Webhook` | Revisar `executionId` en SQLite: error en algún nodo intermedio |
| `tool_use_failed: missing properties` | Llama 3.3 emite formato legacy de tool calls | Cambiar modelo a `openai/gpt-oss-20b` o mantener este diseño sin tools |
| `401 Invalid API Key` (Groq) | Credential vieja en n8n | Reimportar con: `n8n import:credentials --input=cred.json` |
| `fetch is not defined` en Code node | n8n VM no expone fetch | Usar HTTP Request node (este flow ya lo hace) |
| Cards no renderizan en Typebot | Bloque "Custom Code" no procesa `{{chatResponse}}` | Verificar que la variable se setea desde el HTTP Request block |
| Imagen vacía en card | `images[]` del producto está vacío | El custom-code ya falla silenciosamente; subir imagen en `/admin/productos/[id]` |
| Click no agrega al carrito | `window.parent.MKPets` undefined | Abrir DevTools → `window.MKPets` debe existir; si no, hay error en ChatBridge |

## Workflow JSON: source of truth

El archivo `docs/chat/n8n-typebot-flow.json` se **regenera** corriendo `node generate_n8n.js`. **No edites el JSON a mano** — editá `generate_n8n.js` (es JS con comentarios) y regeneralo. Después:

```bash
node generate_n8n.js
docker cp docs/chat/n8n-typebot-flow.json n8n:/tmp/flow.json
docker exec n8n n8n import:workflow --input=/tmp/flow.json
docker exec n8n n8n update:workflow --id=nrrrtxr1AcdWEj9d --active=true
docker exec n8n n8n publish:workflow --id=nrrrtxr1AcdWEj9d
docker restart n8n
```
