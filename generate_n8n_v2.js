/**
 * Genera el JSON del workflow n8n "Typebot IA MK-Pets v2 (Conversacional)".
 * Output: docs/chat/n8n-typebot-flow-v2.json
 *
 * Diferencias vs v1:
 *   - 2 llamadas a LLM (en vez de detección por regex):
 *       Understand → decide intent + qué consultar en Supabase
 *       Compose Reply → arma respuesta conversacional argentina
 *   - Memory compartida entre Understand y Compose (mismo sessionId)
 *   - Para "Hola todo bien?" no llama RPC — responde conversacional
 *   - Para "ofertas en humedo gato" filtra promos por categoría
 *   - Webhook path: /webhook/mk-pets-chat-v2 (el v1 sigue intacto)
 *
 * Diseño:
 *
 *   Webhook (POST /mk-pets-chat-v2)
 *      → HTTP Request "Get Catalog"  (categorías + sample de productos)
 *      → Build Understand Input      (Code: arma el prompt con catálogo)
 *      → AI Agent "Understand"       (Groq json_object → decide intent)
 *           ↑ Memory Understand
 *      → Decide RPC                  (Code: rpcName + rpcBody)
 *      → HTTP Request "Supabase RPC"
 *      → Compose Context             (Code: normaliza products + cards)
 *      → AI Agent "Compose Reply"    (Groq json_object → reply + suggestions)
 *           ↑ Memory Compose (mismo sessionId)
 *           ↑ Groq Chat Model (compartido)
 *      → Assemble Final              (Code: junta reply + cards)
 *      → Respond to Webhook
 */
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ctttonxivmozsqegzotb.supabase.co';

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt — Understand (no se ve nunca al cliente)
// ─────────────────────────────────────────────────────────────────────────────
const UNDERSTAND_PROMPT = `Sos el módulo de comprensión semántica de un asistente de ventas para MK-Pets, tienda de mascotas en Buenos Aires.

Tu única tarea es leer el mensaje del cliente Y el catálogo (categorías + productos disponibles) y decidir qué información debe traer la siguiente etapa.

Catálogo y mensaje vienen en el campo "userInput" como JSON.

Devolvés SIEMPRE un único JSON con esta forma exacta:

{
  "needs_search": true|false,
  "intent": "search" | "category" | "promos" | "chat",
  "category_slug": "<gatos|perros|snacks|humedos|higiene|ropa|juguetes|null>",
  "search_query": "<string corto con palabras CLAVE; sin stopwords>",
  "reasoning": "<una línea explicando por qué elegiste esto>"
}

# Reglas
- Si el mensaje es saludo, charla, pregunta abierta sin pedir producto ("hola", "todo bien?", "gracias", "que onda"): intent="chat", needs_search=false, category_slug=null, search_query="".
- Si pide ofertas/promos: intent="promos". Si menciona categoría dentro de "promos" (ej "ofertas en humedos") seteá category_slug. Si no, null.
- Si pide algo de una categoría sin marca específica ("algo para gato", "alimento de perro"): intent="category", category_slug=el slug.
- Si pide algo específico (marca, kilo, atributo): intent="search", search_query=palabras clave que matchean nombres del catálogo.
- Importante: Cuando el cliente describe un PROBLEMA, deducí la categoría:
    "algo para el pelo de mi perro" → category_slug="higiene", search_query="shampoo perro"
    "que arena recomendas" → category_slug="higiene", search_query="arena" (o intent="search")
    "limpieza" → category_slug="higiene"
    "que jueguen" → category_slug="juguetes"
- Slugs válidos (lower case, exacto): gatos, perros, snacks, humedos, higiene, ropa, juguetes.
- search_query: máx 4 palabras, sin "para", "de", "el", "la", "tenés", "buscar". Solo sustantivos relevantes y marcas.

# Ejemplos
Entrada: { "userMessage": "hola todo bien?", "catalog": {...} }
Salida: {"needs_search":false,"intent":"chat","category_slug":null,"search_query":"","reasoning":"Es un saludo, no pide producto."}

Entrada: { "userMessage": "tenes algo para el pelo de mi perro" }
Salida: {"needs_search":true,"intent":"search","category_slug":"higiene","search_query":"shampoo perro","reasoning":"'Pelo' implica higiene (shampoo); especifica perro."}

Entrada: { "userMessage": "que arena recomendas" }
Salida: {"needs_search":true,"intent":"search","category_slug":"higiene","search_query":"arena","reasoning":"Arena es subcategoría de higiene; sin filtro extra."}

Entrada: { "userMessage": "ofertas en humedo gato" }
Salida: {"needs_search":true,"intent":"promos","category_slug":"humedos","search_query":"","reasoning":"Pide promos filtradas por categoría humedos."}

Entrada: { "userMessage": "que tenes para gato" }
Salida: {"needs_search":true,"intent":"category","category_slug":"gatos","search_query":"","reasoning":"Pide vitrina por categoría gatos."}

NO devuelvas markdown, texto extra, code fences. SOLO el JSON.`;

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt — Compose Reply (lo que llega al cliente)
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_PROMPT = `Sos el Vendedor Estrella de MK-Pets, tienda de mascotas en Buenos Aires. Cálido, argentino, copado. Hablás de vos, sin formalismos.

# Tu rol
Hablar con el cliente como si fueras el vendedor del local. Acompañarlo a elegir lo mejor para su mascota y, sin presionar, ayudarlo a cerrar la compra.

# Input
Recibís un objeto con:
- userMessage: lo que dijo el cliente.
- understanding: { intent, category_slug, search_query } — análisis previo.
- products: array de productos REALES que ya buscamos en la base.

# Output (SIEMPRE este formato exacto, sin markdown ni texto extra)
{
  "reply": "1-3 líneas conversacionales, tono argentino, con seguimiento natural.",
  "suggestions": ["Pregunta o opción 1", "Pregunta o opción 2"]
}

# Cómo conversar (importantísimo)
- intent="chat" (saludo, charla): NO menciones productos. Saludá normal, contale qué podés hacer ("re bien, acá para ayudarte a elegir lo mejor para tu mascota 🐾 ¿qué andás buscando?"). suggestions con disparadores como ["Alimento para perro","Ver ofertas","Algo para gato"].
- intent="search" o "category" con products no vacío: arrancá comentando lo que encontraste ("Mirá, tengo esto que te puede venir 👇"), después de mostrar las cards (el frontend las dibuja) cerrá con una pregunta de vendedor: "¿Te sirve este?", "¿Más opciones?", "¿Para qué edad?", "¿Cuánto pesa tu gato?". Las suggestions deben ser respuestas naturales a esa pregunta (ej: ["Sí, ese va","Mostrame otra opción"]).
- intent="promos" con products: comentá la promo con onda ("Estas son las que están volando esta semana 🔥"). Cerrá con "¿Querés que te lo mande hoy?" o "¿Algo más?". Suggestions tipo ["Sí, agregalo","Ver más ofertas"].
- products vacío (no encontré nada): NUNCA digas solo "no hay". Empatizá ("Uy, ese justo no me queda 😕"), preguntá para entender ("¿Tu mascota es perro o gato?", "¿Sabés qué marca usás?"). suggestions con disparadores específicos.
- Multi-turno: si el cliente ya dijo en mensajes previos que tiene un gato pequeño, NO vuelvas a preguntar. Usá la memoria.

# Tono
- Argentino auténtico ("dale", "copado", "te queda", "andá a saber"). NO uses "che" en cada mensaje, sólo natural.
- Cero formalismos ("Estimado", "Cordialmente" → PROHIBIDO).
- Emoji moderado: máximo 1 por mensaje, sólo si suma calidez.
- Reply corto. Nunca repetir nombre/precio (los muestra la card).

# Ejemplos

userMessage: "hola todo bien?"
intent: "chat", products: []
→ {"reply":"Re bien, acá esperando para ayudarte 🐾 ¿qué andás buscando para tu mascota?","suggestions":["Alimento para perro","Algo para gato","Ver ofertas"]}

userMessage: "tenes algo para el pelo de mi perro"
intent: "search", category_slug: "higiene", products: [Shampoo Neutro]
→ {"reply":"Para el pelo te recomiendo este shampoo, anda re bien 🐾","suggestions":["¿Pelo largo o corto?","Mostrame otra opción"]}

userMessage: "que arena recomendas"
products: [Arena Pipicat 10kg]
→ {"reply":"La Pipicat es la que más sale, atrapa olor y rinde un montón 👇","suggestions":["Te la agrego","¿Hay más chica?"]}

userMessage: "gracias"
intent: "chat"
→ {"reply":"De nada, cualquier cosa avisame 🐾","suggestions":["Ver ofertas","Seguir mirando"]}

NUNCA repitas el nombre de los productos que ya están en cards. NUNCA listes precios. NUNCA inventes productos que no están en products.`;

// ─────────────────────────────────────────────────────────────────────────────
//  Code nodes
// ─────────────────────────────────────────────────────────────────────────────

const BUILD_UNDERSTAND_INPUT = [
  "// Toma el catálogo (categorías + sample de productos) y arma el input",
  "// que recibirá el AI Agent 'Understand'.",
  "const all = $input.all();",
  "const catalogResp = all[0] ? all[0].json : null;",
  "const wh = $('Webhook').first().json;",
  "const message = (wh.body && wh.body.message) || wh.message || '';",
  "const sessionId = (wh.body && wh.body.sessionId) || wh.sessionId || 'anon';",
  "",
  "// fullResponse → catalog viene en .body (la RPC devolvió [cat, cat, ...])",
  "const wrapper = catalogResp && Object.prototype.hasOwnProperty.call(catalogResp, 'body') ? catalogResp.body : catalogResp;",
  "const categories = Array.isArray(wrapper) ? wrapper : [];",
  "",
  "// Lista compacta de marcas detectadas en los nombres de productos",
  "// (lo derivamos del sample de products que vino dentro de cada category)",
  "const brandSet = new Set();",
  "for (const c of categories) {",
  "  for (const p of (c.sample_products || [])) {",
  "    const words = (p.name || '').toLowerCase().split(/[^a-zñáéíóú0-9]+/i);",
  "    for (const w of words) {",
  "      if (w.length >= 3 && !/^\\d+/.test(w)) brandSet.add(w);",
  "    }",
  "  }",
  "}",
  "",
  "const catalogCompact = {",
  "  categories: categories.map(c => ({",
  "    slug: c.slug, name: c.name, emoji: c.emoji,",
  "    sample: (c.sample_products || []).slice(0, 4).map(p => p.name)",
  "  })),",
  "};",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId,",
  "    understandInput: { userMessage: message, catalog: catalogCompact },",
  "  }",
  "}];",
].join('\n');

const PARSE_UNDERSTANDING = [
  "// Toma la salida del AI Agent 'Understand' (JSON con intent/category/search_query)",
  "// y arma el rpcName + rpcBody para la siguiente HTTP Request.",
  "const raw = $json.output ?? $json.text ?? $json;",
  "let u;",
  "try { u = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { u = {}; }",
  "",
  "const intent = ['search','category','promos','chat'].includes(u.intent) ? u.intent : 'chat';",
  "const categorySlug = ['gatos','perros','snacks','humedos','higiene','ropa','juguetes'].includes(u.category_slug) ? u.category_slug : null;",
  "const searchQuery = typeof u.search_query === 'string' ? u.search_query.trim() : '';",
  "",
  "const detect = $('Build Understand Input').first().json;",
  "const message = detect.message;",
  "const sessionId = detect.sessionId;",
  "",
  "// Decidir RPC. Si intent=chat → llamamos a top_promos(0) que devuelve [] (no",
  "// rompe la cadena y no contamina al Compose Reply).",
  "let rpcName, rpcBody;",
  "if (intent === 'promos') {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 6, category_slug: categorySlug };",
  "} else if (intent === 'category' && categorySlug) {",
  "  rpcName = 'products_by_category';",
  "  rpcBody = { category_slug: categorySlug, limit_n: 6 };",
  "} else if (intent === 'search') {",
  "  rpcName = 'search_product_with_alternatives';",
  "  // Preferimos el search_query del LLM; si vino vacío, usamos message",
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

const COMPOSE_CONTEXT = [
  "// Recibe el response de Supabase RPC y arma:",
  "//   - products[] normalizados (para cards finales)",
  "//   - composeInput JSON listo para el AI Agent 'Compose Reply'",
  "const all = $input.all();",
  "const wrapper = all[0] ? all[0].json : null;",
  "const body = wrapper && Object.prototype.hasOwnProperty.call(wrapper, 'body') ? wrapper.body : wrapper;",
  "const detect = $('Decide RPC').first().json;",
  "",
  "function compact(p) {",
  "  if (!p || !p.id) return null;",
  "  return {",
  "    productId: p.id,",
  "    name: p.name,",
  "    slug: p.slug,",
  "    basePrice: Number(p.basePrice),",
  "    originalPrice: p.originalPrice == null ? null : Number(p.originalPrice),",
  "    stock: Number(p.stock || 0),",
  "    badge: p.badge || null,",
  "    image: Array.isArray(p.images) && p.images[0] ? p.images[0] : '',",
  "    isFeatured: !!p.isFeatured,",
  "    description: typeof p.description === 'string' ? p.description.slice(0, 100) : null,",
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
  "// Construir las cards finales (badge en MAYÚSCULAS para el frontend)",
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
  "// Input para Compose Reply (qué le contamos al LLM)",
  "const composeInput = {",
  "  userMessage: detect.message,",
  "  understanding: detect.understanding,",
  "  // Lista corta de los productos que se van a mostrar; el LLM puede mencionarlos",
  "  // por nombre si querés, pero ya están en las cards visualmente.",
  "  products: products.map(p => ({ name: p.name, slug: p.slug, price: p.basePrice, badge: p.badge })),",
  "};",
  "",
  "return [{",
  "  json: { ...detect, cards, composeInput }",
  "}];",
].join('\n');

const ASSEMBLE_FINAL = [
  "// Toma el reply conversacional del Compose Reply y lo une con las cards",
  "// que ya generamos en Compose Context. Output final del workflow.",
  "const raw = $json.output ?? $json.text ?? $json;",
  "let r;",
  "try { r = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { r = {}; }",
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
  "r = (typeof r === 'string' ? extractJson(r) : r) || {};",
  "const ctx = $('Compose Context').first().json;",
  "",
  "const reply = (typeof r.reply === 'string' && r.reply.trim())",
  "  ? r.reply.trim()",
  "  : '¿Querés que te muestre algo en particular? 🐾';",
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
  "    }",
  "  }",
  "}];",
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
//  Necesitamos primero crear una RPC categories_with_sample en Supabase para
//  que el LLM vea de qué se trata cada categoría. Pero como ya tenemos las
//  RPCs base, lo hacemos en el primer HTTP Request usando un SQL inline?
//  Mejor: agregamos una RPC chiquita.
// ─────────────────────────────────────────────────────────────────────────────

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
      parameters: {
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/rpc/categories_with_sample`,
        sendHeaders: true,
        headerParameters: supabaseHeaders,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={}',
        options: httpOpts,
      },
      id: 'http-catalog',
      name: 'Get Catalog',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [-480, 0],
    },

    {
      parameters: { jsCode: BUILD_UNDERSTAND_INPUT },
      id: 'code-build-understand',
      name: 'Build Understand Input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-260, 0],
    },

    {
      parameters: {
        promptType: 'define',
        text: '={{ JSON.stringify($json.understandInput) }}',
        options: { systemMessage: UNDERSTAND_PROMPT },
      },
      id: 'agent-understand',
      name: 'AI Agent Understand',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.6,
      position: [-60, 0],
    },

    {
      parameters: {
        model: 'openai/gpt-oss-20b',
        options: { temperature: 0.2, responseFormat: 'json_object' },
      },
      id: 'model-1',
      name: 'Groq Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [-60, 260],
      credentials: { groqApi: { id: 'CYZbXLPJGbNDHfrX', name: 'Groq account' } },
    },

    {
      parameters: {
        sessionIdType: 'customKey',
        sessionKey: '={{ $(\'Webhook\').item.json.body?.sessionId ?? \'anon\' }}',
        contextWindowLength: 8,
      },
      id: 'memory-understand',
      name: 'Memory Understand',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.2,
      position: [60, 260],
    },

    {
      parameters: { jsCode: PARSE_UNDERSTANDING },
      id: 'code-parse-understand',
      name: 'Decide RPC',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [180, 0],
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
      position: [400, 0],
    },

    {
      parameters: { jsCode: COMPOSE_CONTEXT },
      id: 'code-compose-context',
      name: 'Compose Context',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [620, 0],
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
      position: [840, 0],
    },

    {
      parameters: {
        sessionIdType: 'customKey',
        // Memoria SEPARADA para el Compose: mismo sessionId pero distinto namespace,
        // así no se mezclan los JSON internos del Understand con el contexto natural.
        sessionKey: '={{ $(\'Webhook\').item.json.body?.sessionId ?? \'anon\' }}-compose',
        contextWindowLength: 8,
      },
      id: 'memory-compose',
      name: 'Memory Compose',
      type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      typeVersion: 1.2,
      position: [960, 260],
    },

    {
      parameters: { jsCode: ASSEMBLE_FINAL },
      id: 'code-assemble',
      name: 'Assemble Final',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1080, 0],
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
      position: [1300, 0],
    },
  ],

  connections: {
    Webhook:                  { main:             [[{ node: 'Get Catalog',              type: 'main',             index: 0 }]] },
    'Get Catalog':            { main:             [[{ node: 'Build Understand Input',   type: 'main',             index: 0 }]] },
    'Build Understand Input': { main:             [[{ node: 'AI Agent Understand',      type: 'main',             index: 0 }]] },
    'AI Agent Understand':    { main:             [[{ node: 'Decide RPC',               type: 'main',             index: 0 }]] },
    'Groq Chat Model':        { ai_languageModel: [
                                  [{ node: 'AI Agent Understand',     type: 'ai_languageModel', index: 0 }],
                                  [{ node: 'AI Agent Compose Reply',  type: 'ai_languageModel', index: 0 }],
                                ] },
    'Memory Understand':      { ai_memory:        [[{ node: 'AI Agent Understand',      type: 'ai_memory',        index: 0 }]] },
    'Decide RPC':             { main:             [[{ node: 'Supabase RPC',             type: 'main',             index: 0 }]] },
    'Supabase RPC':           { main:             [[{ node: 'Compose Context',          type: 'main',             index: 0 }]] },
    'Compose Context':        { main:             [[{ node: 'AI Agent Compose Reply',   type: 'main',             index: 0 }]] },
    'AI Agent Compose Reply': { main:             [[{ node: 'Assemble Final',           type: 'main',             index: 0 }]] },
    'Memory Compose':         { ai_memory:        [[{ node: 'AI Agent Compose Reply',   type: 'ai_memory',        index: 0 }]] },
    'Assemble Final':         { main:             [[{ node: 'Respond to Webhook',       type: 'main',             index: 0 }]] },
  },

  settings: { executionOrder: 'v1' },
};

const outFile = path.join(__dirname, 'docs', 'chat', 'n8n-typebot-flow-v2.json');
fs.writeFileSync(outFile, JSON.stringify(workflow, null, 2));
console.log('Workflow v2 JSON regenerated: ' + outFile);
console.log('Nodes:', workflow.nodes.map(n => n.name).join(' → '));
