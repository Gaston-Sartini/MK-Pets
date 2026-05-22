/**
 * Genera el JSON del workflow n8n "Typebot IA MK-Pets v2 (Conversacional)".
 * Output: docs/chat/n8n-typebot-flow-v2.json
 *
 * v2.2 — Mejoras sobre v2.1:
 *   - Sin HTTP "Get Catalog": el catálogo va embebido en el system prompt del
 *     Understand (las 7 categorías de MK-Pets no cambian). Ahorra ~150ms +
 *     ~300 tokens por turno.
 *   - Rotación explícita de aperturas: el Code "Build Compose Input" trackea
 *     las últimas 3 aperturas usadas por sessionId vía staticData del
 *     workflow y le pasa al LLM la lista ya FILTRADA de aperturas válidas.
 *     Resultado: variación garantizada al 100%, no depende de la temperatura.
 *
 * Diseño:
 *
 *   Webhook (POST /mk-pets-chat-v2)
 *      → Build Understand Input  (Code: arma input compacto)
 *      → AI Agent "Understand"   (Groq llama-3.1-8b-instant, json_object)
 *      → Decide RPC              (Code: rpcName + rpcBody)
 *      → HTTP Request "Supabase RPC"
 *      → Build Compose Input     (Code: cards + apertura sugerida)
 *      → AI Agent "Compose Reply"(Groq llama-3.3-70b-versatile, json_object)
 *      → Assemble Final          (Code: junta reply + cards + actualiza
 *                                 cache de aperturas usadas)
 *      → Respond to Webhook
 */
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ctttonxivmozsqegzotb.supabase.co';

// ─────────────────────────────────────────────────────────────────────────────
//  Catálogo HARDCODED para el LLM Understand.
//  Las 7 categorías de MK-Pets no cambian; si agregás una nueva, regenerá el
//  workflow y reimportá. Los ejemplos de productos sirven solo como hint
//  semántico para que el LLM sepa qué hay en cada slug.
// ─────────────────────────────────────────────────────────────────────────────
const CATALOG_HINT = `gatos = Royal Canin, Pro Plan Castrado
perros = Pro Plan Razas Medianas, Pedigree Carne, Eukanuba
snacks = Dentastix, Temptations
humedos = Whiskas Atún, Pedigree Húmedo Pollo
higiene = Pipicat Arena, Shampoo Neutro
ropa = (sin productos por ahora)
juguetes = Pelota Goma, Varita Plumas para Gatos`;

// ─────────────────────────────────────────────────────────────────────────────
//  Lista de aperturas que rotan. El Code envía al LLM solo aperturas NO usadas
//  en los últimos 3 turnos de esa session.
// ─────────────────────────────────────────────────────────────────────────────
const OPENINGS = [
  'Este te va a copar 👌',
  'Mirá, te tiro uno que anda bárbaro',
  'Justo tenemos este, está saliendo bocha',
  'Encontré esto, es furor 🔥',
  'Tengo este re bueno',
  'Andá probando este, va a fondo',
  'Te traigo dos opciones bárbaras',
  'Este es uno de los que más vuelan',
  'Probá con este, no falla',
  'Hay este que es un golazo',
  'Cae bien este 👇',
  'Tenemos este de la línea premium',
  'Te dejo este, es de los mejores',
  'Este lo recomiendo siempre',
  'Andá con este que es lo más',
];

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt — Understand
// ─────────────────────────────────────────────────────────────────────────────
const UNDERSTAND_PROMPT = `Clasificás mensajes de un chat de tienda de mascotas. Devolvés SIEMPRE un JSON con esta forma exacta:

{"intent":"search|category|promos|chat","category_slug":"gatos|perros|snacks|humedos|higiene|ropa|juguetes|null","search_query":"<keywords sin stopwords>","reasoning":"<1 línea>"}

REGLA DE ORO: preferí "search" sobre "category" siempre que puedas inferir KEYWORDS específicas. "category" solo cuando el cliente quiere ver una VITRINA general sin pista de qué busca.

Catálogo (slug = ejemplos de productos):
${CATALOG_HINT}

Decisión por intent:

1) "chat" si es saludo/charla/agradecimiento/off-topic ("hola","gracias","todo bien","cuanto cuesta el envio","como va eso"). search_query:"", category_slug:null.

2) "promos" si pide ofertas/promos/rebajas/liquidaciones. Si menciona categoría seteala. Si no, category_slug:null. search_query:"".

3) "search" (PREFERIDO cuando hay pistas): el cliente dice marca, formato, atributo, problema, parte del cuerpo, acción.
   Mapeos típicos a search_query:
   - "baño/bañar/lavar/pelo/champu" → search_query:"shampoo"
   - "arena/sanitaria" → search_query:"arena"
   - "jugar/aburrido/morder" → search_query:"juguete pelota varita"
   - "abrigo/ropa/frío" → search_query:"campera ropa"
   - "dientes/sarro" → search_query:"dentastix"
   - "gordito/sobrepeso" → search_query:"castrado"
   - "premio/galletita/snack" → category="snacks"
   - "humedo/lata/sachet" → search_query:"humedo"
   IMPORTANTE: si el cliente menciona un atributo Y la mascota, search_query DEBE incluir el atributo pero NO la mascota (la mascota la mapeás a category_slug). Ej: "shampoo perro" → search_query:"shampoo", category_slug:"higiene".

4) "category" SOLO en casos genéricos sin más data:
   - "que tenes para gato" → gatos
   - "mostrame perros" → perros
   - "que hay de juguetes" → juguetes
   - "comida para perro" / "alimento perro" → perros (no especifica marca/kilo)

Continuación (mensajes cortos en una conversación con turnos previos):
- "si dale", "ese va", "agregalo", "lo quiero" → intent:"chat" (confirma compra).
- "otra opción", "mostrame más", "tenes algo distinto" → intent:"search" usando la query previa relevante.
- "mas chico", "mas grande", "otra marca" → intent:"search" usando la query previa con ese modifier.

search_query reglas:
- Máximo 4 palabras.
- NUNCA incluye: "para","de","el","la","los","las","perro","gato","perros","gatos","mi","tu","busco","quiero","tenés","tiene","necesito".
- Solo sustantivos relevantes Y marcas conocidas (royal, pedigree, whiskas, pro plan, pipicat, eukanuba, purina, dentastix).

category_slug VÁLIDOS: gatos, perros, snacks, humedos, higiene, ropa, juguetes. Nada más.

Salida = SOLO el JSON. Sin markdown, sin texto extra.`;

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt — Compose Reply
//  Nota: la apertura específica viene en el INPUT (no en este system prompt),
//  porque la elige el Code de rotación.
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_PROMPT = `Sos el Vendedor Estrella de MK-Pets, tienda de mascotas en Buenos Aires. Cálido, argentino, copado. Hablás de vos.

Input que te llega (JSON string): { userMessage, understanding, products[], suggestedOpening }.

OUTPUT (SOLO este JSON, sin markdown):
{"reply":"<1-2 líneas naturales argentinas>","suggestions":["<resp1>","<resp2>"]}

# Cómo responder

## Si products tiene cards:
1. ARRANCÁ tu reply con la frase EXACTA del campo suggestedOpening (o algo MUY parecido). No inventes una apertura diferente. Si suggestedOpening es null o vacío, usá una breve neutra.
2. Después de la apertura, podés mencionar el producto con su nombre real si suma contexto (no obligatorio).
3. Cerrá con UNA pregunta de vendedor (variable):
   - "¿Te sirve?"
   - "¿Te lo agrego?"
   - "¿Va por ahí?"
   - "¿Para qué edad/talla?"
   - "¿Querés que te muestre otro?"
   - "¿Algo más?"
   - "¿Cuánto pesa?"
   - "¿Lo querés ahora?"
4. suggestions = 2 respuestas POSIBLES del cliente a tu pregunta (no etiquetas genéricas):
   - "¿Te lo agrego?" → ["Sí, dale","Mostrame otra opción"]
   - "¿Cuánto pesa?" → ["Es chiquito","Pesa más de 10kg"]
   - "¿Para qué edad?" → ["Cachorro","Adulto"]

## Si products está VACÍO ([])
NUNCA digas "no hay". Empatizá + pedí más data útil.
Variá entre:
- "Uy, ese justo no me queda 😕 contame un poco más"
- "Mmm, así no encuentro nada. ¿Es para perro o gato?"
- "No te puedo asegurar eso. ¿Tenés algún producto en mente?"
suggestions con disparadores específicos a la consulta.

## Si understanding.intent === "chat" (saludo, charla, off-topic)
NO menciones productos.
- Saludo ("hola","todo bien?"): variá entre "Re bien, acá pa' ayudarte 🐾 ¿qué necesitás?" / "Hola! ¿qué andás buscando?" / "Buenas! contame qué hay"
- Agradecimiento ("gracias"): "De nada, cuando quieras 🐾" / "Dale, a las órdenes" / "Para eso estamos"
- Off-topic ("que hora es","y el clima?"): respondé corto/amable + redirigí: "Andá a saber, igual contame qué buscás para tu mascota"
- Pregunta abierta ("recomendas?"): pedí contexto: "Dale, contame qué mascota tenés y para qué"
- Confirma compra ("si dale","agregalo"): "Listo, te lo sumo al carrito 🛒. ¿Algo más?"
suggestions con disparadores REALES de catálogo: ["Alimento perro","Ver ofertas","Algo para gato","Snacks","Juguetes","Arena gato","Shampoo"].

# Reglas DURAS
- 1-2 líneas. La card ya muestra nombre y precio.
- NO repitas el nombre del producto más de UNA vez.
- NO listes precios en el reply.
- NO inventes productos que no están en "products".
- NO uses "Estimado", "Cordialmente", "Saludos cordiales".
- Emoji: máximo 1 por mensaje.
- PROHIBIDO: "Mirá, tengo esto que te puede venir 👇" (es plantilla, suena a bot).`;

// ─────────────────────────────────────────────────────────────────────────────
//  Code nodes
// ─────────────────────────────────────────────────────────────────────────────

const BUILD_UNDERSTAND_INPUT = [
  "// Input compacto al LLM Understand: solo el mensaje del cliente.",
  "// El catálogo está hardcoded en el system prompt → ahorra tokens y latencia.",
  "const wh = $input.first().json;",
  "const message = (wh.body && wh.body.message) || wh.message || '';",
  "const sessionId = (wh.body && wh.body.sessionId) || wh.sessionId || 'anon';",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId,",
  "    understandInput: 'Mensaje del cliente: \"' + message + '\"',",
  "  }",
  "}];",
].join('\n');

const PARSE_UNDERSTANDING = [
  "const raw = $json.output ?? $json.text ?? $json;",
  "let u;",
  "try { u = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { u = {}; }",
  "",
  "const intent = ['search','category','promos','chat'].includes(u.intent) ? u.intent : 'chat';",
  "const categorySlug = ['gatos','perros','snacks','humedos','higiene','ropa','juguetes'].includes(u.category_slug) ? u.category_slug : null;",
  "const searchQuery = typeof u.search_query === 'string' ? u.search_query.trim() : '';",
  "",
  "const detect = $('Build Understand Input').first().json;",
  "const { message, sessionId } = detect;",
  "",
  "let rpcName, rpcBody;",
  "if (intent === 'promos') {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 6, category_slug: categorySlug };",
  "} else if (intent === 'category' && categorySlug) {",
  "  rpcName = 'products_by_category';",
  "  rpcBody = { category_slug: categorySlug, limit_n: 6 };",
  "} else if (intent === 'search') {",
  "  rpcName = 'search_product_with_alternatives';",
  "  rpcBody = { query: searchQuery || message };",
  "} else {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 0, category_slug: null };",
  "}",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId, intent, categorySlug, searchQuery,",
  "    rpcName, rpcBody,",
  "    understanding: { intent, category_slug: categorySlug, search_query: searchQuery, reasoning: u.reasoning || '' },",
  "  }",
  "}];",
].join('\n');

// Cada Code node con rotación necesita conocer la lista; pasamos el JSON como
// constante embebida.
const OPENINGS_JSON = JSON.stringify(OPENINGS);

const BUILD_COMPOSE_INPUT = [
  "// Toma el response del Supabase RPC, arma cards normalizadas y elige",
  "// una apertura ROTATIVA: las últimas 3 aperturas usadas por esa session",
  "// se excluyen del pool, garantizando variación al 100%.",
  "const all = $input.all();",
  "const wrapper = all[0] ? all[0].json : null;",
  "const body = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'body') ? wrapper.body : wrapper;",
  "const detect = $('Decide RPC').first().json;",
  "",
  "function compact(p) {",
  "  if (!p || !p.id) return null;",
  "  return {",
  "    productId: p.id, name: p.name, slug: p.slug,",
  "    basePrice: Number(p.basePrice),",
  "    originalPrice: p.originalPrice == null ? null : Number(p.originalPrice),",
  "    stock: Number(p.stock || 0),",
  "    badge: p.badge || null,",
  "    image: Array.isArray(p.images) && p.images[0] ? p.images[0] : '',",
  "    isFeatured: !!p.isFeatured,",
  "    variants: Array.isArray(p.variants) ? p.variants.map(v => ({",
  "      label: v.label, price: Number(v.price), stock: Number(v.stock || 0),",
  "      originalPrice: v.originalPrice == null ? null : Number(v.originalPrice),",
  "    })) : [],",
  "  };",
  "}",
  "",
  "let products = [];",
  "if (detect.intent === 'search') {",
  "  const exact = body && body.exact ? compact(body.exact) : null;",
  "  const alts  = body && Array.isArray(body.alternatives) ? body.alternatives.map(compact).filter(Boolean) : [];",
  "  products = exact ? [exact, ...alts.slice(0, 2)] : alts.slice(0, 3);",
  "} else if (detect.intent === 'chat') {",
  "  products = [];",
  "} else {",
  "  const arr = Array.isArray(body) ? body : [];",
  "  products = arr.slice(0, 3).map(compact).filter(Boolean);",
  "}",
  "",
  "const BADGE_MAP = { new: 'NUEVO', sale: 'OFERTA', hot: 'MÁS VENDIDO' };",
  "const cards = products.map(p => ({",
  "  productId: p.productId,",
  "  variantLabel: null,",
  "  name: p.name,",
  "  image: p.image,",
  "  slug: p.slug,",
  "  unitPrice: p.basePrice,",
  "  originalPrice: p.originalPrice,",
  "  badge: BADGE_MAP[p.badge] || null,",
  "  stock: p.stock,",
  "  ctaLabel: 'Agregar al carrito',",
  "  ctaAction: 'addToCart',",
  "  productUrl: '/producto/' + p.slug,",
  "}));",
  "",
  "// Rotación de aperturas vía staticData del workflow.",
  "// Pool: lista hardcoded. Excluimos las últimas 3 usadas en esa session.",
  "const ALL_OPENINGS = " + OPENINGS_JSON + ";",
  "const sd = $getWorkflowStaticData('global');",
  "sd.openingHistory = sd.openingHistory || {};",
  "const usedRecently = sd.openingHistory[detect.sessionId] || [];",
  "const available = ALL_OPENINGS.filter(o => !usedRecently.includes(o));",
  "const pool = available.length ? available : ALL_OPENINGS; // fallback si por algún motivo se agotó",
  "const suggestedOpening = pool[Math.floor(Math.random() * pool.length)];",
  "",
  "// Persistimos la elección en staticData. El Assemble Final la confirmará",
  "// después de que el LLM efectivamente la use (igual la guardamos acá por",
  "// si el LLM falla; mejor evitar repetir aunque sea ya).",
  "const nextHistory = [suggestedOpening, ...usedRecently].slice(0, 3);",
  "sd.openingHistory[detect.sessionId] = nextHistory;",
  "",
  "const composeInput = {",
  "  userMessage: detect.message,",
  "  understanding: detect.understanding,",
  "  products: products.map(p => ({ name: p.name, slug: p.slug, price: p.basePrice, badge: p.badge })),",
  "  suggestedOpening,",
  "};",
  "",
  "return [{",
  "  json: { ...detect, cards, composeInput, suggestedOpening }",
  "}];",
].join('\n');

const ASSEMBLE_FINAL = [
  "const raw = $json.output ?? $json.text ?? $json;",
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
  "      if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch (_) { return null; } }",
  "    }",
  "  }",
  "  return null;",
  "}",
  "",
  "let r = (typeof raw === 'string' ? extractJson(raw) : raw) || {};",
  "if (typeof r === 'string') r = extractJson(r) || {};",
  "const ctx = $('Build Compose Input').first().json;",
  "",
  "let reply = (typeof r.reply === 'string' && r.reply.trim())",
  "  ? r.reply.trim()",
  "  : '¿Querés que te muestre algo en particular? 🐾';",
  "",
  "// Sanity check: si el LLM ignoró la apertura sugerida y empezó con",
  "// 'Mirá, tengo esto que te puede venir' (frase prohibida), reescribimos.",
  "const FORBIDDEN = /^[¡]?[mM]ir[aá],?\\s+tengo esto/;",
  "if (FORBIDDEN.test(reply) && ctx.suggestedOpening && Array.isArray(ctx.cards) && ctx.cards.length) {",
  "  reply = ctx.suggestedOpening + '. ¿Te sirve?';",
  "}",
  "",
  "const suggestions = Array.isArray(r.suggestions)",
  "  ? r.suggestions.filter(s => typeof s === 'string' && s.trim()).slice(0, 3)",
  "  : [];",
  "",
  "return [{",
  "  json: {",
  "    reply,",
  "    cards: Array.isArray(ctx.cards) ? ctx.cards : [],",
  "    suggestions,",
  "    _meta: {",
  "      intent: ctx.intent,",
  "      category_slug: ctx.categorySlug,",
  "      reasoning: ctx.understanding && ctx.understanding.reasoning,",
  "      suggestedOpening: ctx.suggestedOpening,",
  "    }",
  "  }",
  "}];",
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
//  Workflow
// ─────────────────────────────────────────────────────────────────────────────
const supabaseHeaders = {
  parameters: [
    { name: 'apikey',        value: '={{ $env.SUPABASE_ANON_KEY }}' },
    { name: 'Authorization', value: '=Bearer {{ $env.SUPABASE_ANON_KEY }}' },
    { name: 'Content-Type',  value: 'application/json' },
    { name: 'Prefer',        value: 'return=representation' },
  ],
};

const httpOpts = {
  response: {
    response: { neverError: true, fullResponse: true, responseFormat: 'json' },
  },
};

const workflow = {
  name: 'Typebot IA MK-Pets v2 (Conversacional)',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'mk-pets-chat-v2',
        responseMode: 'responseNode',
        options: {},
      },
      id: 'webhook-1',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [-700, 0],
      webhookId: 'mkp-v2-webhook-9eab0db3',
    },

    {
      parameters: { jsCode: BUILD_UNDERSTAND_INPUT },
      id: 'code-build-understand',
      name: 'Build Understand Input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-480, 0],
    },

    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.understandInput }}',
        options: { systemMessage: UNDERSTAND_PROMPT },
      },
      id: 'agent-understand',
      name: 'AI Agent Understand',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.6,
      position: [-260, 0],
    },

    {
      parameters: {
        model: 'llama-3.1-8b-instant',
        options: { temperature: 0.1, responseFormat: 'json_object' },
      },
      id: 'model-understand',
      name: 'Groq Model Understand',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [-260, 260],
      credentials: { groqApi: { id: 'CYZbXLPJGbNDHfrX', name: 'Groq account' } },
    },

    {
      parameters: {
        sessionIdType: 'customKey',
        sessionKey: '={{ $(\'Webhook\').item.json.body?.sessionId ?? \'anon\' }}',
        contextWindowLength: 6,
      },
      id: 'memory-understand',
      name: 'Memory Understand',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.2,
      position: [-140, 260],
    },

    {
      parameters: { jsCode: PARSE_UNDERSTANDING },
      id: 'code-parse-understand',
      name: 'Decide RPC',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-40, 0],
    },

    {
      parameters: {
        method: 'POST',
        url: `=${SUPABASE_URL}/rest/v1/rpc/{{ $json.rpcName }}`,
        sendHeaders: true,
        headerParameters: supabaseHeaders,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.rpcBody) }}',
        options: httpOpts,
      },
      id: 'http-rpc',
      name: 'Supabase RPC',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [180, 0],
    },

    {
      parameters: { jsCode: BUILD_COMPOSE_INPUT },
      id: 'code-build-compose',
      name: 'Build Compose Input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [400, 0],
    },

    {
      parameters: {
        promptType: 'define',
        text: '={{ JSON.stringify($json.composeInput) }}',
        options: { systemMessage: COMPOSE_PROMPT },
      },
      id: 'agent-compose',
      name: 'AI Agent Compose Reply',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.6,
      position: [620, 0],
    },

    {
      parameters: {
        model: 'llama-3.3-70b-versatile',
        options: { temperature: 0.7, responseFormat: 'json_object' },
      },
      id: 'model-compose',
      name: 'Groq Model Compose',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [620, 260],
      credentials: { groqApi: { id: 'CYZbXLPJGbNDHfrX', name: 'Groq account' } },
    },

    {
      parameters: {
        sessionIdType: 'customKey',
        sessionKey: '={{ $(\'Webhook\').item.json.body?.sessionId ?? \'anon\' }}-compose',
        contextWindowLength: 6,
      },
      id: 'memory-compose',
      name: 'Memory Compose',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.2,
      position: [740, 260],
    },

    {
      parameters: { jsCode: ASSEMBLE_FINAL },
      id: 'code-assemble',
      name: 'Assemble Final',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [860, 0],
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
      position: [1080, 0],
    },
  ],

  connections: {
    Webhook:                  { main:             [[{ node: 'Build Understand Input',  type: 'main',             index: 0 }]] },
    'Build Understand Input': { main:             [[{ node: 'AI Agent Understand',     type: 'main',             index: 0 }]] },
    'AI Agent Understand':    { main:             [[{ node: 'Decide RPC',              type: 'main',             index: 0 }]] },
    'Groq Model Understand':  { ai_languageModel: [[{ node: 'AI Agent Understand',    type: 'ai_languageModel', index: 0 }]] },
    'Memory Understand':      { ai_memory:        [[{ node: 'AI Agent Understand',    type: 'ai_memory',        index: 0 }]] },
    'Decide RPC':             { main:             [[{ node: 'Supabase RPC',            type: 'main',             index: 0 }]] },
    'Supabase RPC':           { main:             [[{ node: 'Build Compose Input',     type: 'main',             index: 0 }]] },
    'Build Compose Input':    { main:             [[{ node: 'AI Agent Compose Reply',  type: 'main',             index: 0 }]] },
    'AI Agent Compose Reply': { main:             [[{ node: 'Assemble Final',          type: 'main',             index: 0 }]] },
    'Groq Model Compose':     { ai_languageModel: [[{ node: 'AI Agent Compose Reply', type: 'ai_languageModel', index: 0 }]] },
    'Memory Compose':         { ai_memory:        [[{ node: 'AI Agent Compose Reply', type: 'ai_memory',        index: 0 }]] },
    'Assemble Final':         { main:             [[{ node: 'Respond to Webhook',     type: 'main',             index: 0 }]] },
  },

  settings: { executionOrder: 'v1' },
};

const outFile = path.join(__dirname, 'docs', 'chat', 'n8n-typebot-flow-v2.json');
fs.writeFileSync(outFile, JSON.stringify(workflow, null, 2));
console.log('Workflow v2.2 JSON regenerated: ' + outFile);
console.log('Nodes:', workflow.nodes.map(n => n.name).join(' → '));
