# n8n — flow y nodos del chat MK-Pets

> **Importante:** el flow NO usa `AI Tools` (HTTP Request Tools del LangChain). El LLM solo formatea la respuesta final como JSON. La lógica de "qué buscar en la BD" vive en un Code JS y un HTTP Request normal. Razones del cambio en `README.md` ("Por qué este diseño").

## Nodos del workflow

```
Webhook  →  Detect Intent  →  Supabase RPC  →  Compose Context  →  AI Agent  →  Parse JSON  →  Respond
                                                                       ↑   ↑
                                                                       │   └─ Window Buffer Memory
                                                                       └───── Groq Chat Model
```

### 1) Webhook
- **HTTP method:** `POST`
- **Path:** `mk-pets-chat`
- **Response Mode:** `responseNode` (lo cierra el `Respond to Webhook`)
- URL pública: `http://localhost:5678/webhook/mk-pets-chat`

### 2) Detect Intent (Code node)
Decide qué RPC llamar y con qué body. Output:
```json
{
  "message":          "<lo que dijo el cliente>",
  "sessionId":        "<id>",
  "intent":           "search | category | promos | chat",
  "detectedCategory": "gatos | perros | … | null",
  "rpcName":          "search_product_with_alternatives | top_promos | products_by_category",
  "rpcBody":          { "query": "…" }  // varía según intent
}
```

Heurística de intent:
- `oferta|promo|rebaja|liquidaci|descuento` → **promos**
- regex de categoría (gato/perro/snack/húmedo/higiene/ropa/juguete) → **category**
- mención de marca (royal canin, pro plan, whiskas, …) o medida (`15kg`, `500ml`) → **search**
- saludo al inicio + mensaje corto → **chat**
- default cuando el mensaje tiene >2 chars → **search**

Para `intent=chat` el código igual setea `rpcName=top_promos`, `rpcBody={limit_n:0}`. La RPC devuelve `[]` y el flow no se rompe.

### 3) Supabase RPC (HTTP Request node)
- **Method:** `POST`
- **URL:** `={{ "https://ctttonxivmozsqegzotb.supabase.co/rest/v1/rpc/" + $json.rpcName }}`
- **Headers:**
  - `apikey: {{ $env.SUPABASE_ANON_KEY }}`
  - `Authorization: Bearer {{ $env.SUPABASE_ANON_KEY }}`
  - `Content-Type: application/json`
  - `Prefer: return=representation`
- **Body:** `={{ JSON.stringify($json.rpcBody) }}`
- **Response options:** `neverError: true`, `fullResponse: true`, `responseFormat: 'json'`

`fullResponse` es **clave**: cuando la RPC devuelve `[]`, n8n sin `fullResponse` lo interpreta como "0 items" y **detiene el flow**. Con `fullResponse`, siempre hay 1 item con `{ body, statusCode, headers }`.

### 4) Compose Context (Code node)
Lee `$json.body` (response de la RPC) y `$('Detect Intent').first().json` (para sacar el intent original). Aplana productos y arma:
```json
{
  "message":          "...",
  "sessionId":        "...",
  "intent":           "...",
  "detectedCategory": "...",
  "products":         [ /* up to 3 compacted */ ],
  "exact":            { … } | null,
  "alternatives":     [ … ]
}
```

Cada producto compactado:
```ts
{
  productId:     string,
  name:          string,
  slug:          string,
  basePrice:     number,
  originalPrice: number | null,
  stock:         number,
  badge:         "new" | "sale" | "hot" | null,   // sin mapear todavía
  image:         string,                          // primer URL o ""
  isFeatured:    boolean,
  variants:      [{ label, price, stock, originalPrice }]
}
```

### 5) AI Agent
- **Tipo:** `@n8n/n8n-nodes-langchain.agent` v1.6
- **promptType:** `define`
- **text:** un `JSON.stringify` con `{ userMessage, context: { intent, detectedCategory, products, exact, alternatives } }`
- **systemMessage:** ver `n8n-system-prompt.md`

### 6) Groq Chat Model
- **Modelo:** `openai/gpt-oss-20b`
- **Temperature:** `0.3`
- **Response format:** `json_object` (Groq garantiza JSON puro, sin markdown)
- **Credentials:** `groqApi` → tu API key (`gsk_…`)

Por qué `gpt-oss-20b`:
- **Llama-3.3-70b-versatile** emite tool calls legacy `<function=…>{…}</function>` que Groq rechaza con `tool_use_failed`. Aunque acá no usamos tools, igual probamos modelos: gpt-oss-20b es el más estable para JSON estricto.
- Alternativas si hay rate limit: `qwen/qwen3-32b`, `moonshotai/kimi-k2-instruct`, `openai/gpt-oss-120b`.

### 7) Window Buffer Memory
- **sessionIdType:** `customKey`
- **sessionKey:** `{{ $('Webhook').item.json.body?.sessionId ?? 'anon' }}`
- **contextWindowLength:** `6` (3 mensajes user + 3 assistant)

### 8) Parse JSON (Code node)
Robusto contra:
- JSON puro
- JSON envuelto en ```` ```json … ``` ```` fences
- JSON suelto en medio de texto (busca primera `{...}` balanceada)
- Output ya parseado (object)

Valida cada card (productId/name/slug/unitPrice tipados), trunca a 3, normaliza badge a UPPER, y agrega `productUrl: "/producto/<slug>"` para fallback (si la card no renderiza, el link sigue siendo clickeable).

### 9) Respond to Webhook
- **respondWith:** `json`
- **responseBody:** `={{ $json }}`

## Variables de entorno necesarias en n8n

```yaml
SUPABASE_URL:      https://ctttonxivmozsqegzotb.supabase.co
SUPABASE_ANON_KEY: eyJhbGci…
N8N_ENCRYPTION_KEY: <32 bytes random — mantiene credentials encriptadas>
```

Ya están en `infra/n8n/docker-compose.yml`.

## Credencial Groq (cómo registrarla)

UI: Settings → Credentials → New → "Groq Account" → pegar `gsk_…`.

CLI (si querés sobreescribir programáticamente):
```bash
cat > /tmp/groq-cred.json <<EOF
[
  {
    "id": "CYZbXLPJGbNDHfrX",
    "name": "Groq account",
    "type": "groqApi",
    "data": { "apiKey": "gsk_TU_API_KEY" }
  }
]
EOF
docker cp /tmp/groq-cred.json n8n:/tmp/groq-cred.json
docker exec n8n n8n import:credentials --input=/tmp/groq-cred.json
docker restart n8n
```

## Payload de Typebot → n8n

```json
POST /webhook/mk-pets-chat
{
  "message":   "busco royal canin",
  "sessionId": "result-id-generado-por-typebot"
}
```

## Payload de n8n → Typebot

```json
{
  "reply":       "Sí, lo tengo ✅",
  "cards": [
    {
      "productId":     "c48d35371cd99b757c4bb2de",
      "variantLabel":  null,
      "name":          "Royal Canin Gato Adulto 7.5kg",
      "image":         "",
      "slug":          "royal-canin-gato-adulto-75kg",
      "unitPrice":     18500,
      "originalPrice": null,
      "badge":         "MÁS VENDIDO",
      "stock":         15,
      "ctaLabel":      "Agregar al carrito",
      "ctaAction":     "addToCart",
      "productUrl":    "/producto/royal-canin-gato-adulto-75kg"
    }
  ],
  "suggestions": ["Más alimentos para gatos", "Accesorios para gatos"]
}
```

## Cómo regenerar el JSON del workflow

```bash
node generate_n8n.js          # source of truth es generate_n8n.js
docker cp docs/chat/n8n-typebot-flow.json n8n:/tmp/flow.json
docker exec n8n n8n import:workflow --input=/tmp/flow.json
docker exec n8n n8n update:workflow --id=nrrrtxr1AcdWEj9d --active=true
docker exec n8n n8n publish:workflow --id=nrrrtxr1AcdWEj9d
docker restart n8n
```

## Cómo inspeccionar ejecuciones con error

```bash
docker exec n8n node -e "
  const s = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3');
  const db = new s.Database('/home/node/.n8n/database.sqlite');
  db.all('SELECT id, status FROM execution_entity ORDER BY id DESC LIMIT 5',
    (e, rows) => { console.log(rows); db.close(); }
  );
"
```
