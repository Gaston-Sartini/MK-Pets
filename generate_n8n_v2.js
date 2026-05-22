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
const UNDERSTAND_PROMPT = `Clasificás mensajes de un chat de tienda de mascotas. Devolvés SIEMPRE un JSON con esta forma exacta:

{"intent":"search|category|promos|chat","category_slug":"gatos|perros|snacks|humedos|higiene|ropa|juguetes|null","search_query":"<keywords sin stopwords>","reasoning":"<1 línea>"}

REGLA DE ORO: preferí "search" sobre "category" siempre que puedas inferir KEYWORDS específicas. "category" solo cuando el cliente quiere ver una VITRINA general sin pista de qué busca.

Decisión por intent:

1) "chat" si es saludo/charla/agradecimiento/off-topic ("hola","gracias","todo bien","cuanto cuesta el envio","como va eso"). search_query:"", category_slug:null.

2) "promos" si pide ofertas/promos/rebajas/liquidaciones. Si menciona categoría seteala. Si no, category_slug:null. search_query:"".

3) "search" (PREFERIDO cuando hay pistas): el cliente dice marca, formato, atributo, problema, parte del cuerpo, acción.
   Mapeos típicos a search_query:
   - "baño/bañar/lavar/pelo/champu" → "shampoo"
   - "arena/sanitaria/baño del gato (suciedad)" → "arena"
   - "jugar/aburrido/morder" → "juguete pelota varita"
   - "abrigo/ropa/frío" → "campera ropa"
   - "dientes/sarro" → "dentastix snack"
   - "gordito/sobrepeso" → "castrado dieta"
   - "premio/galletita/snack" → "snacks"
   - "comer/comida/croquetas/alimento balanceado" → category con slug correcto
   - "humedo/lata/sachet" → "humedo"
   IMPORTANTE: si el cliente menciona un atributo Y la mascota, search_query DEBE incluir el atributo pero NO la mascota (la mascota la mapeás a category_slug). Ej: "shampoo perro" → search_query:"shampoo", category_slug:"higiene".

4) "category" SOLO en casos genéricos sin más data:
   - "que tenes para gato" → gatos
   - "mostrame perros" → perros
   - "que hay de juguetes" → juguetes
   - "comida para perro" / "alimento perro" → perros (porque no especifica marca/kilo)

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
//  System prompt — Compose Reply (lo que llega al cliente)
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_PROMPT = `Sos el Vendedor Estrella de MK-Pets, tienda de mascotas en Buenos Aires. Cálido, argentino, copado. Hablás de vos.

Input que te llega: { userMessage, understanding, products[] }.

OUTPUT (SOLO este JSON, sin markdown):
{"reply":"<1-2 líneas naturales argentinas>","suggestions":["<resp1>","<resp2>"]}

# Cómo responder

## Si products tiene cards: arrancá CON VARIACIÓN OBLIGATORIA
PROHIBIDO usar siempre la misma apertura. Cada turno, ELEGÍ AL AZAR (no la primera) una de estas opciones, y NO repitas la misma que usaste en el turno anterior si la podés ver en el historial:
1. "Este te va a copar 👌"
2. "Mirá, te tiro uno que anda bárbaro"
3. "Justo tenemos este, está saliendo bocha"
4. "Encontré esto, es furor 🔥"
5. "Tengo este re bueno"
6. "Andá probando este, va a fondo"
7. "Te traigo dos opciones bárbaras"
8. "Este es uno de los que más vuelan"
9. "Probá con este, no falla"
10. "Hay este que es un golazo"
11. "Cae bien este 👇"
12. "Tenemos este de la línea premium"
13. "Te dejo este, es de los mejores"
14. "Este lo recomiendo siempre"
15. "Andá con este que es lo más"

NUNCA uses "Mirá, tengo esto que te puede venir". Está PROHIBIDA esa frase, suena a chatbot.

Después de la apertura, una pregunta de cierre VARIABLE:
- "¿Te sirve?"
- "¿Te lo agrego?"
- "¿Va por ahí?"
- "¿Para qué edad/talla?"
- "¿Querés que te muestre otro?"
- "¿Algo más?"
- "¿Es para tu perro o para regalo?"
- "¿Cuánto pesa?"
- "¿Lo querés ahora?"

suggestions = 2 respuestas POSIBLES del cliente a tu pregunta (no etiquetas genéricas):
- Si preguntaste "¿Te lo agrego?" → ["Sí, dale","Mostrame otra opción"]
- Si preguntaste "¿Cuánto pesa?" → ["Es chiquito","Pesa más de 10kg"]

## Si products está VACÍO ([])
NUNCA digas "no hay". Empatizá + pedí más data útil.
Variaciones:
- "Uy, ese justo no me queda 😕 contame un poco más"
- "Mmm, así no encuentro nada. ¿Es para perro o gato?"
- "No te puedo asegurar eso. ¿Tenés algún producto en mente?"

suggestions con guidance específica.

## Si intent="chat" (saludo, charla, off-topic)
NO menciones productos.
- Saludo: "Re bien, acá pa' ayudarte 🐾 ¿qué necesitás?" / "Hola! ¿qué andás buscando?" / "Buenas! contame qué hay"
- Agradecimiento ("gracias"): "De nada, cuando quieras 🐾" / "Dale, a las órdenes" / "Para eso estamos"
- Off-topic ("que hora es"): respondé corto/amable + redirigí a lo de la tienda: "Andá a saber, igual contame qué buscás para tu mascota"
- Pregunta abierta ("recomendas?"): pedí contexto: "Dale, contame qué mascota tenés y para qué"

suggestions con disparadores REALES de catálogo: ["Alimento perro","Ver ofertas","Algo para gato","Snacks","Juguetes","Arena gato","Shampoo"].

# Reglas DURAS
- 1-2 líneas, NUNCA más. La card ya muestra nombre y precio.
- NO repitas nombres de productos en el reply (excepto si querés enfatizar marca puntual, máximo 1 vez).
- NO listes precios.
- NO inventes productos que no están en "products".
- NO uses "Estimado", "Cordialmente", "Saludos cordiales".
- Emoji: máximo 1 por mensaje.
- Si el cliente confirma compra ("dale agregalo", "sí va"), respondé "Listo, te lo sumo al carrito 🛒. ¿Algo más?".
- Si ya pasaron varios turnos hablando del mismo producto, no vuelvas a preguntar lo mismo.`;

// ─────────────────────────────────────────────────────────────────────────────
//  Code nodes
// ─────────────────────────────────────────────────────────────────────────────

const BUILD_UNDERSTAND_INPUT = [
  "// Toma el catálogo y arma un input mínimo para el LLM Understand.",
  "// Mantenemos pocos tokens para esquivar el rate limit TPM de Groq.",
  "const all = $input.all();",
  "const catalogResp = all[0] ? all[0].json : null;",
  "const wh = $('Webhook').first().json;",
  "const message = (wh.body && wh.body.message) || wh.message || '';",
  "const sessionId = (wh.body && wh.body.sessionId) || wh.sessionId || 'anon';",
  "",
  "const wrapper = catalogResp && Object.prototype.hasOwnProperty.call(catalogResp, 'body') ? catalogResp.body : catalogResp;",
  "const categories = Array.isArray(wrapper) ? wrapper : [];",
  "",
  "// Catálogo súper compacto: una línea por categoría con 2 ejemplos cortos.",
  "// Eso le alcanza al modelo para mapear keywords → slug.",
  "const catalogLines = categories.map(c => {",
  "  const ex = (c.sample_products || []).slice(0, 2).map(p => p.name).join(' / ');",
  "  return c.slug + ' = ' + (ex || c.name);",
  "}).join('\\n');",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId,",
  "    // Input pasado al Understand (string, no JSON, ahorra ~30% tokens)",
  "    understandInput: 'Mensaje del cliente: \"' + message + '\"\\n\\nCatálogo (slug = ejemplos):\\n' + catalogLines,",
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
        text: '={{ $json.understandInput }}',
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
        // Llama 3.1 8B instant: TPM 30k (vs 8k de gpt-oss-20b), respuesta más rápida,
        // suficiente para clasificar intent. JSON estricto vía prompt.
        model: 'llama-3.1-8b-instant',
        options: { temperature: 0.1, responseFormat: 'json_object' },
      },
      id: 'model-understand',
      name: 'Groq Model Understand',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [-60, 260],
      credentials: { groqApi: { id: 'CYZbXLPJGbNDHfrX', name: 'Groq account' } },
    },

    {
      parameters: {
        // llama-3.3-70b-versatile: TPM 30k (vs 8k de gpt-oss-20b) y mejor
        // calidad conversacional en español que el 8b. Sin tool calls aquí
        // (sólo JSON), entonces el bug legacy de llama-3.3 con tools no aplica.
        model: 'llama-3.3-70b-versatile',
        options: { temperature: 0.95, responseFormat: 'json_object' },
      },
      id: 'model-compose',
      name: 'Groq Model Compose',
      type: '@n8n/n8n-nodes-langchain.lmChatGroq',
      typeVersion: 1,
      position: [840, 260],
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
    'Groq Model Understand':  { ai_languageModel: [[{ node: 'AI Agent Understand',     type: 'ai_languageModel', index: 0 }]] },
    'Groq Model Compose':     { ai_languageModel: [[{ node: 'AI Agent Compose Reply',  type: 'ai_languageModel', index: 0 }]] },
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
