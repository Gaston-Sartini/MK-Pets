/**
 * Genera el JSON del workflow n8n "Typebot IA MK-Pets (Groq Agent)".
 * Ejecutar: `node generate_n8n.js`  →  docs/chat/n8n-typebot-flow.json
 *
 * Diseño (sin tool-calling, sin fetch en Code node):
 *
 *   Webhook (POST /mk-pets-chat)
 *      → Code "Detect Intent"     (decide rpcName + rpcBody)
 *      → HTTP Request "Supabase RPC"   (POST con apikey, body dinámico)
 *      → Code "Compose Context"   (normaliza products, arma payload p/ agente)
 *      → AI Agent (Groq gpt-oss-20b, sin tools, JSON response_format)
 *      → Code "Parse JSON"        (anti markdown-fences, valida cards)
 *      → Respond to Webhook
 */
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ctttonxivmozsqegzotb.supabase.co';

// ─────────────────────────────────────────────────────────────────────────────
//  SYSTEM PROMPT — el agente sólo formatea JSON. La lógica de catálogo es JS.
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos el Vendedor Estrella de MK-Pets (tienda de mascotas, Buenos Aires).

# TAREA
Recibís un objeto con userMessage (lo que dijo el cliente) y context (intent + productos REALES traídos de la base). Devolvés SIEMPRE un único JSON con esta forma exacta:

{
  "reply": "1-2 líneas, tono argentino, máx un emoji",
  "cards": [
    {
      "productId": "<id real del contexto>",
      "variantLabel": null,
      "name": "<name real>",
      "image": "<image del contexto o ''>",
      "slug": "<slug real>",
      "unitPrice": <basePrice número>,
      "originalPrice": <originalPrice o null>,
      "badge": "<NUEVO|OFERTA|MÁS VENDIDO|null>",
      "stock": <stock número>,
      "ctaLabel": "Agregar al carrito",
      "ctaAction": "addToCart"
    }
  ],
  "suggestions": ["Sugerencia 1", "Sugerencia 2"]
}

# REGLAS DURAS
- Salida = SOLO el JSON. Sin markdown, sin code fences, sin texto antes/después.
- Máximo 3 cards. cards SIEMPRE existe (puede ser []).
- Nunca inventes. Sólo usá productos del context. Si context.products está vacío y el intent era search/category/promos, devolvé cards=[] con reply tipo "Eso justo no tengo 😕 contame qué buscás".
- badge mapping ESTRICTO: "new"→"NUEVO", "sale"→"OFERTA", "hot"→"MÁS VENDIDO", null→null.
- reply NO repite nombre/precio (ya están en la card).

# COMPORTAMIENTO POR INTENT
- intent="search" con exact disponible → 1 card de exact. Reply tipo "Sí, lo tengo ✅".
- intent="search" con exact=null pero alternatives → 1 card de alternatives[0]. Reply "Ese no tengo 😕 pero te queda este parecido:".
- intent="search" sin nada → cards=[]. Reply "Eso no tengo, ¿qué tipo de mascota?".
- intent="promos" → 1–3 cards de products. Reply "Estas son las que más están saliendo 🔥".
- intent="category" → 1–3 cards de products. Reply "Estos están saliendo mucho 🐾".
- intent="chat" → cards=[]. Reply corto y suggestions con disparadores de catálogo.

# UPSELL
Si el primer product tiene variants[] con clara ventaja de precio/kg en otra variante → devolvés 2 cards y reply "Llevando el de Xkg te sale más barato por kilo 👇".

# TONO
Argentino, cálido, directo. Vos en lugar de tú. Cero formalismos.`;

// ─────────────────────────────────────────────────────────────────────────────
//  CODE NODE 1 — Detect Intent
//  No hace HTTP. Solo decide qué RPC llamar y con qué body.
//  Para intent=chat, llama top_promos(limit_n=0) para devolver [] sin extra logic.
// ─────────────────────────────────────────────────────────────────────────────
const DETECT_JS = [
  "// Decide qué RPC de Supabase llamar según el mensaje del usuario.",
  "// Output: { message, sessionId, intent, detectedCategory, rpcName, rpcBody }",
  "",
  "const item      = $input.first().json;",
  "const message   = (item.body && item.body.message)   || item.message   || '';",
  "const sessionId = (item.body && item.body.sessionId) || item.sessionId || 'anon';",
  "const lower     = String(message).toLowerCase().trim();",
  "",
  "const CATEGORY_KEYWORDS = {",
  "  gatos:    [/\\bgat[oa]s?\\b/, /\\bmichi/, /\\bfelin/],",
  "  perros:   [/\\bperr[oa]s?\\b/, /\\bcachorr/],",
  "  snacks:   [/\\bsnacks?\\b/, /\\bgalletit/, /\\bpremio/],",
  "  humedos:  [/\\bh[úu]med/, /\\blat[ai]\\b/, /\\bsachet/],",
  "  higiene:  [/\\bhigien/, /\\bshampoo/, /\\bjab[óo]n/, /\\barena\\b/],",
  "  ropa:     [/\\bropa\\b/, /\\bcampera/, /\\bsweater/],",
  "  juguetes: [/\\bjuguet/, /\\bpelota/, /\\bvarita/],",
  "};",
  "",
  "const PROMO_RX    = /(oferta|promo|promoci|rebaja|liquidaci|descuento)/i;",
  "const GREETING_RX = /^(hola|buen[ao]s|qu[eé] tal|hey\\b|hi\\b|saludos|holis|holaa+|che\\b)/i;",
  "const BRAND_RX    = /\\b(royal\\s*canin|pro\\s*plan|whiskas|pedigree|temptations|purina|eukanuba|dog\\s*chow|excellent|old\\s*prince|sieger|pipicat|dentastix|nutro|hills|hill[s']?|advance)\\b/i;",
  "const SIZE_RX     = /\\d+\\s*(kg|gr|g|ml|l)\\b/i;",
  "",
  "let intent = 'chat';",
  "let detectedCategory = null;",
  "",
  "// 1) promos antes que category (porque \"ofertas para perro\" es promos)",
  "if (PROMO_RX.test(lower)) {",
  "  intent = 'promos';",
  "} else {",
  "  // 2) categoría",
  "  for (const [slug, regexes] of Object.entries(CATEGORY_KEYWORDS)) {",
  "    if (regexes.some(rx => rx.test(lower))) {",
  "      detectedCategory = slug;",
  "      intent = 'category';",
  "      break;",
  "    }",
  "  }",
  "  // 3) si menciona marca/medida, preferimos search (más específico)",
  "  if (BRAND_RX.test(lower) || SIZE_RX.test(lower)) intent = 'search';",
  "  // 4) saludo si match al inicio y mensaje corto sin keywords antes",
  "  else if (intent === 'chat' && GREETING_RX.test(lower) && lower.length < 30) intent = 'chat';",
  "  // 5) cualquier otro mensaje no-vacío de >2 chars → search por defecto",
  "  else if (intent === 'chat' && lower.length > 2 && !GREETING_RX.test(lower)) intent = 'search';",
  "}",
  "",
  "// Determinar qué RPC y body",
  "let rpcName, rpcBody;",
  "// Limpiar stopwords para que la RPC no busque \"busco royal canin\" entero",
  "function cleanQuery(s) {",
  "  return String(s)",
  "    .toLowerCase()",
  "    .replace(/[¿?¡!.,;:]+/g, ' ')",
  "    .replace(/\\b(busco|busca|tenes|ten[ée]s|tienen|hay|me|gustar[íi]a|querr[íi]a|quiero|necesito|queria|quería|por\\s*favor|porfa|para|de|del|la|el|los|las|un|una|y|o|que|qu[eé])\\b/g, ' ')",
  "    .replace(/\\s+/g, ' ').trim();",
  "}",
  "",
  "if (intent === 'promos') {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 6 };",
  "} else if (intent === 'category') {",
  "  rpcName = 'products_by_category';",
  "  rpcBody = { category_slug: detectedCategory, limit_n: 6 };",
  "} else if (intent === 'search') {",
  "  const q = cleanQuery(message) || message;",
  "  rpcName = 'search_product_with_alternatives';",
  "  rpcBody = { query: q };",
  "} else {",
  "  // chat: igual hacemos una llamada barata que devuelve [] para no romper la cadena",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 0 };",
  "}",
  "",
  "return [{ json: { message, sessionId, intent, detectedCategory, rpcName, rpcBody } }];",
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
//  CODE NODE 2 — Compose Context
//  Toma el response del HTTP + el output del Detect, normaliza productos.
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_JS = [
  "// Combina el output del Detect y la respuesta del HTTP Request.",
  "// Aplana variantes y deja solo campos que la card necesita.",
  "",
  "const all     = $input.all();",
  "const wrapper = all[0] ? all[0].json : null;",
  "// El HTTP Request usa fullResponse, así que la data está en .body. Si por alguna",
  "// razón viene el body directo (futuro toggle), aceptamos ambos casos.",
  "const httpRes = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'body') ? wrapper.body : wrapper;",
  "const detect  = $('Detect Intent').first().json;",
  "",
  "function compactProduct(p) {",
  "  if (!p || !p.id) return null;",
  "  return {",
  "    productId:     p.id,",
  "    name:          p.name,",
  "    slug:          p.slug,",
  "    basePrice:     Number(p.basePrice),",
  "    originalPrice: p.originalPrice == null ? null : Number(p.originalPrice),",
  "    stock:         Number(p.stock || 0),",
  "    badge:         p.badge || null,",
  "    image:         Array.isArray(p.images) && p.images[0] ? p.images[0] : '',",
  "    isFeatured:    !!p.isFeatured,",
  "    variants:      Array.isArray(p.variants) ? p.variants.map(v => ({",
  "      label: v.label, price: Number(v.price), stock: Number(v.stock || 0),",
  "      originalPrice: v.originalPrice == null ? null : Number(v.originalPrice)",
  "    })) : [],",
  "  };",
  "}",
  "",
  "let products = [];",
  "let exact = null;",
  "let alternatives = [];",
  "",
  "if (detect.intent === 'search') {",
  "  exact        = httpRes && httpRes.exact ? compactProduct(httpRes.exact) : null;",
  "  alternatives = httpRes && Array.isArray(httpRes.alternatives)",
  "    ? httpRes.alternatives.map(compactProduct).filter(Boolean) : [];",
  "  products = exact ? [exact, ...alternatives.slice(0, 2)] : alternatives.slice(0, 3);",
  "} else if (detect.intent === 'chat') {",
  "  products = [];",
  "} else {",
  "  // promos | category: el response es un array de productos",
  "  const arr = Array.isArray(httpRes) ? httpRes : [];",
  "  products = arr.slice(0, 3).map(compactProduct).filter(Boolean);",
  "}",
  "",
  "return [{",
  "  json: {",
  "    message:          detect.message,",
  "    sessionId:        detect.sessionId,",
  "    intent:           detect.intent,",
  "    detectedCategory: detect.detectedCategory,",
  "    products,",
  "    exact,",
  "    alternatives,",
  "  }",
  "}];",
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
//  CODE NODE 3 — Parse JSON del agente (robusto)
// ─────────────────────────────────────────────────────────────────────────────
const PARSE_JS = [
  "const raw = $json.output ?? $json.text ?? $json.message ?? $json;",
  "",
  "function extractJson(input) {",
  "  if (typeof input !== 'string') return input;",
  "  let s = input.trim();",
  "  const tickRe = new RegExp('^' + String.fromCharCode(96).repeat(3) + '(?:json)?\\\\s*([\\\\s\\\\S]*?)\\\\s*' + String.fromCharCode(96).repeat(3) + '\\\\s*$', 'i');",
  "  const m = s.match(tickRe);",
  "  if (m) s = m[1].trim();",
  "  try { return JSON.parse(s); } catch (_) {}",
  "  const start = s.indexOf('{');",
  "  if (start === -1) return null;",
  "  let depth = 0, inStr = false, esc = false;",
  "  for (let i = start; i < s.length; i++) {",
  "    const c = s[i];",
  "    if (esc) { esc = false; continue; }",
  "    if (c === '\\\\') { esc = true; continue; }",
  "    if (c === '\"') inStr = !inStr;",
  "    if (inStr) continue;",
  "    if (c === '{') depth++;",
  "    else if (c === '}') {",
  "      depth--;",
  "      if (depth === 0) {",
  "        try { return JSON.parse(s.slice(start, i + 1)); } catch (_) { return null; }",
  "      }",
  "    }",
  "  }",
  "  return null;",
  "}",
  "",
  "const parsed = extractJson(raw) || {};",
  "const ok = (c) => c && typeof c.productId === 'string' && typeof c.name === 'string' && typeof c.slug === 'string' && typeof c.unitPrice === 'number';",
  "",
  "const cards = Array.isArray(parsed.cards)",
  "  ? parsed.cards.filter(ok).slice(0, 3).map(c => ({",
  "      productId:     c.productId,",
  "      variantLabel:  c.variantLabel == null ? null : c.variantLabel,",
  "      name:          c.name,",
  "      image:         typeof c.image === 'string' ? c.image : '',",
  "      slug:          c.slug,",
  "      unitPrice:     c.unitPrice,",
  "      originalPrice: typeof c.originalPrice === 'number' ? c.originalPrice : null,",
  "      badge:         ['NUEVO','OFERTA','MÁS VENDIDO'].includes(c.badge) ? c.badge : null,",
  "      stock:         typeof c.stock === 'number' ? c.stock : 0,",
  "      ctaLabel:      typeof c.ctaLabel === 'string' ? c.ctaLabel : 'Agregar al carrito',",
  "      ctaAction:     c.ctaAction === 'openProduct' ? 'openProduct' : 'addToCart',",
  "      productUrl:    '/producto/' + c.slug,",
  "    }))",
  "  : [];",
  "",
  "return [{ json: {",
  "  reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Decime un poco más, ¿qué buscás?',",
  "  cards,",
  "  suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(s => typeof s === 'string' && s.trim()).slice(0, 3) : [],",
  "}}];",
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
//  Workflow
// ─────────────────────────────────────────────────────────────────────────────
const workflow = {
  name: 'Typebot IA MK-Pets (Groq Agent)',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'mk-pets-chat',
        responseMode: 'responseNode',
        options: {},
      },
      id: 'webhook-1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [-400, 0],
      webhookId: '9eab0db3-8a3d-4505-8fe6-e4137f427b89',
    },

    {
      parameters: { jsCode: DETECT_JS },
      id: 'code-detect',
      name: 'Detect Intent',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-180, 0],
    },

    {
      parameters: {
        method: 'POST',
        url: `=${SUPABASE_URL}/rest/v1/rpc/{{ $json.rpcName }}`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'apikey',        value: '={{ $env.SUPABASE_ANON_KEY }}' },
            { name: 'Authorization', value: '=Bearer {{ $env.SUPABASE_ANON_KEY }}' },
            { name: 'Content-Type',  value: 'application/json' },
            { name: 'Prefer',        value: 'return=representation' },
          ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.rpcBody) }}',
        options: {
          response: {
            response: {
              neverError:    true,
              fullResponse:  true,
              responseFormat: 'json',
            },
          },
        },
      },
      id: 'http-rpc',
      name: 'Supabase RPC',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [40, 0],
    },

    {
      parameters: { jsCode: COMPOSE_JS },
      id: 'code-compose',
      name: 'Compose Context',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, 0],
    },

    {
      parameters: {
        promptType: 'define',
        text: '={{ JSON.stringify({\n  userMessage: $json.message,\n  context: {\n    intent: $json.intent,\n    detectedCategory: $json.detectedCategory,\n    products: $json.products,\n    exact: $json.exact,\n    alternatives: $json.alternatives\n  }\n}, null, 2) }}',
        options: { systemMessage: SYSTEM_PROMPT },
      },
      id: 'agent-1',
      name: 'AI Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.6,
      position: [500, 0],
    },

    {
      parameters: {
        model: 'openai/gpt-oss-20b',
        options: { temperature: 0.3, responseFormat: 'json_object' },
      },
      id: 'model-1',
      name: 'Groq Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [500, 260],
      credentials: { groqApi: { id: 'CYZbXLPJGbNDHfrX', name: 'Groq account' } },
    },

    {
      parameters: {
        sessionIdType: 'customKey',
        sessionKey: '={{ $(\'Webhook\').item.json.body?.sessionId ?? $(\'Webhook\').item.json.sessionId ?? "anon" }}',
        contextWindowLength: 6,
      },
      id: 'memory-1',
      name: 'Window Buffer Memory',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.2,
      position: [680, 260],
    },

    {
      parameters: { jsCode: PARSE_JS },
      id: 'code-parse',
      name: 'Parse JSON',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [800, 0],
    },

    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: {},
      },
      id: 'respond-1',
      name: 'Respond to Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1020, 0],
    },
  ],

  connections: {
    Webhook:                { main:             [[{ node: 'Detect Intent',       type: 'main',             index: 0 }]] },
    'Detect Intent':        { main:             [[{ node: 'Supabase RPC',        type: 'main',             index: 0 }]] },
    'Supabase RPC':         { main:             [[{ node: 'Compose Context',     type: 'main',             index: 0 }]] },
    'Compose Context':      { main:             [[{ node: 'AI Agent',            type: 'main',             index: 0 }]] },
    'AI Agent':             { main:             [[{ node: 'Parse JSON',          type: 'main',             index: 0 }]] },
    'Groq Chat Model':      { ai_languageModel: [[{ node: 'AI Agent',            type: 'ai_languageModel', index: 0 }]] },
    'Window Buffer Memory': { ai_memory:        [[{ node: 'AI Agent',            type: 'ai_memory',        index: 0 }]] },
    'Parse JSON':           { main:             [[{ node: 'Respond to Webhook', type: 'main',             index: 0 }]] },
  },

  settings: { executionOrder: 'v1' },
};

const outFile = path.join(__dirname, 'docs', 'chat', 'n8n-typebot-flow.json');
fs.writeFileSync(outFile, JSON.stringify(workflow, null, 2));
console.log('Workflow JSON regenerated (HTTP-Request design): ' + outFile);
