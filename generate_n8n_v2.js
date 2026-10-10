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

{"intent":"search|category|promos|chat|add_to_cart|follow_up","category_slug":"gatos|perros|snacks|humedos|higiene|ropa|juguetes|null","search_query":"<keywords sin stopwords>","add_to_cart_hint":"<palabra clave del producto a agregar, o vacío>","reasoning":"<1 línea>"}

REGLA DE ORO: preferí "search" sobre "category" cuando puedas inferir KEYWORDS específicas. "category" SOLO cuando el cliente quiere una VITRINA general.

Catálogo (slug = ejemplos de productos):
${CATALOG_HINT}

Te llega también el contexto previo (lastShownProducts, lastBotQuestion) cuando hay turnos previos. Usalo para no romper el hilo.

Decisión por intent:

1) "chat" — saludo/charla/agradecimiento/off-topic ("hola","gracias","todo bien","cuanto cuesta el envio","como va eso"). search_query:"", category_slug:null, add_to_cart_hint:"".

2) "promos" — ofertas/promos/rebajas/liquidaciones. Si menciona categoría seteala.

3) "add_to_cart" — el cliente PIDE agregar un producto al carrito.
   Patrones de frase típicos:
   - "dale agregalo" / "agregalo" / "sumalo" / "lo quiero" → agrega el ÚLTIMO producto mostrado.
   - "agregame X" / "sumame X" / "dale y X también" / "quiero X tambien" → agrega el producto que matchea X.
   - Para add_to_cart, llená add_to_cart_hint con la palabra clave que identifica al producto que pide
     (ej "varita","pelota","shampoo","whiskas","royal","pipicat"). Si solo dice "agregalo" sin
     especificar, add_to_cart_hint:"_last" (palabra reservada para "el último mostrado").
   - NO uses add_to_cart si no hay productos mostrados antes (no hay nada que agregar).
     En ese caso devolvé intent="chat" pidiendo qué busca.

4) "follow_up" — el cliente responde a una PREGUNTA que el bot le hizo en el turno anterior.
   Detectás esto cuando lastBotQuestion existe Y el mensaje del cliente es una respuesta natural a esa pregunta.
   Ejemplos:
   - bot pregunta "¿Para qué edad?" → cliente dice "Cachorro"/"Adulto"/"Senior"
   - bot pregunta "¿Cuánto pesa?" → cliente dice "5 kilos"/"chiquito"
   - bot pregunta "¿Es perro o gato?" → cliente dice "perro"/"gato"
   En follow_up, search_query debe COMBINAR la query previa con el modifier que dijo el cliente.
   Ej: prev query="varita", bot preguntó "¿para qué edad?", cliente dice "cachorro" → search_query:"varita cachorro".
   category_slug puede mantenerse si era relevante.

5) "search" (preferido cuando hay pistas): marca, formato, atributo, problema, parte del cuerpo, acción.
   Mapeos típicos:
   - "baño/bañar/lavar/pelo/champu" → search_query:"shampoo", category_slug:"higiene"
   - "arena/sanitaria" → search_query:"arena", category_slug:"higiene"
   - "jugar/aburrido/morder" → search_query:"juguete pelota varita", category_slug:"juguetes"
   - "abrigo/ropa/frío" → category_slug:"ropa"
   - "dientes/sarro" → search_query:"dentastix", category_slug:"snacks"
   - "premio/galletita/snack" → category_slug:"snacks"
   - "humedo/lata/sachet" → search_query:"humedo", category_slug:"humedos"
   Si el cliente menciona atributo + mascota, search_query lleva el atributo Y category_slug la mascota.
   Ej: "shampoo perro" → search_query:"shampoo", category_slug:"higiene".

6) "category" SOLO en casos genéricos sin más data:
   - "que tenes para gato" → gatos
   - "comida para perro" → perros
   - "que hay de juguetes" → juguetes

search_query reglas:
- Máximo 4 palabras.
- NUNCA incluye: "para","de","el","la","los","las","perro","gato","perros","gatos","mi","tu","busco","quiero","tenés","tiene","necesito".
- Solo sustantivos relevantes Y marcas (royal, pedigree, whiskas, pro plan, pipicat, eukanuba, purina, dentastix, temptations).

category_slug VÁLIDOS: gatos, perros, snacks, humedos, higiene, ropa, juguetes. Nada más.

Salida = SOLO el JSON. Sin markdown, sin texto extra.`;

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt — Compose Reply
//  Nota: la apertura específica viene en el INPUT (no en este system prompt),
//  porque la elige el Code de rotación.
// ─────────────────────────────────────────────────────────────────────────────
const COMPOSE_PROMPT = `Sos el Vendedor Estrella de MK-Pets, tienda de mascotas en Buenos Aires. Cálido, argentino, copado. Hablás de vos.

Input que te llega (JSON string): { userMessage, understanding, products[], suggestedOpening, pendingActions[] }.

OUTPUT (SOLO este JSON, sin markdown):
{"reply":"<1-2 líneas naturales argentinas>","suggestions":["<resp1>","<resp2>"]}

# Cómo responder

## Si pendingActions[] tiene acciones (el backend ya agregó cosas al carrito)
PRIORIDAD MÁXIMA. Confirmá la acción + pregunta de upsell. Variá:
- "Listo, te sumé la <Name> al carrito 🛒. ¿Algo más?"
- "Dale, te lo agregué 👌. ¿Algo más para tu mascota?"
- "Ya te lo sumé. ¿Querés algo para acompañar?"
- "Listo! ¿Algo más o vamos al checkout?"
NO menciones productos como cards porque cards va vacío.
suggestions tipo: ["Algo más para acompañar","Ir al carrito"] o ["Sí, mostrame snacks","No, gracias"].

## Si products tiene cards (sin pendingActions):
1. ARRANCÁ tu reply con la frase EXACTA del campo suggestedOpening (o casi idéntica).
2. Podés mencionar el producto con su nombre real si suma contexto.
3. Cerrá con UNA pregunta de vendedor variable:
   - "¿Te sirve?" / "¿Te lo agrego?" / "¿Va por ahí?" / "¿Querés que te muestre otro?"
   - Si hay pista del problema: "¿Para qué edad?" / "¿Cuánto pesa?" / "¿Pelo largo o corto?"
4. suggestions = 2 respuestas POSIBLES del cliente a tu pregunta:
   - "¿Te lo agrego?" → ["Sí, agregalo","Mostrame otra opción"]
   - "¿Cuánto pesa?" → ["Es chiquito","Pesa más de 10kg"]
   - "¿Para qué edad?" → ["Cachorro","Adulto"]

## Si products está VACÍO Y NO hay pendingActions
NUNCA digas "no hay". Empatizá + pedí más data útil. Variá entre:
- "Uy, ese justo no me queda 😕 contame un poco más"
- "Mmm, así no encuentro nada. ¿Es para perro o gato?"
- "No te puedo asegurar eso. ¿Tenés algún producto en mente?"
suggestions con disparadores específicos a la consulta.

## Si understanding.intent === "chat"
NO menciones productos.
- Saludo: "Re bien, acá pa' ayudarte 🐾 ¿qué necesitás?" / "Hola! ¿qué andás buscando?" / "Buenas! contame"
- Agradecimiento: "De nada, cuando quieras 🐾" / "Dale, a las órdenes"
- Off-topic: respondé corto/amable + redirigí: "Andá a saber, contame qué buscás para tu mascota"
- Pregunta abierta: pedí contexto: "Dale, contame qué mascota tenés y para qué"
suggestions con disparadores reales: ["Alimento perro","Ver ofertas","Snacks","Juguetes","Arena","Shampoo"].

# Reglas DURAS
- 1-2 líneas. La card ya muestra nombre y precio.
- NO listes precios en el reply.
- NO inventes productos que no están en "products" ni en "pendingActions".
- NO uses "Estimado", "Cordialmente", "Saludos cordiales".
- Emoji: máximo 1 por mensaje.
- PROHIBIDO: "Mirá, tengo esto que te puede venir 👇" (suena a bot).`;

// ─────────────────────────────────────────────────────────────────────────────
//  Code nodes
// ─────────────────────────────────────────────────────────────────────────────

const BUILD_UNDERSTAND_INPUT = [
  "// Input compacto al LLM Understand: el mensaje del cliente + contexto",
  "// (productos mostrados recientemente y última pregunta del bot).",
  "// El catálogo está hardcoded en el system prompt → ahorra tokens.",
  "const wh = $input.first().json;",
  "const message = (wh.body && wh.body.message) || wh.message || '';",
  "const sessionId = (wh.body && wh.body.sessionId) || wh.sessionId || 'anon';",
  "",
  "const sd = $getWorkflowStaticData('global');",
  "sd.shownProducts = sd.shownProducts || {};",
  "sd.botQuestions  = sd.botQuestions  || {};",
  "",
  "const shown        = sd.shownProducts[sessionId] || [];",
  "const lastQuestion = sd.botQuestions[sessionId]  || '';",
  "",
  "// Resumen para el LLM (solo nombres + index, evita tokens innecesarios)",
  "const shownSummary = shown.length",
  "  ? shown.map((p, i) => (i + 1) + '. ' + p.name).join('; ')",
  "  : '(ninguno todavía)';",
  "",
  "const lines = [",
  "  'Mensaje del cliente: \"' + message + '\"',",
  "  'Productos mostrados en turnos recientes: ' + shownSummary,",
  "];",
  "if (lastQuestion) lines.push('Última pregunta que hizo el bot: \"' + lastQuestion + '\"');",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId,",
  "    understandInput: lines.join('\\n'),",
  "    shownProducts: shown,",
  "    lastBotQuestion: lastQuestion,",
  "  }",
  "}];",
].join('\n');

const PARSE_UNDERSTANDING = [
  "const raw = $json.output ?? $json.text ?? $json;",
  "let u;",
  "try { u = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { u = {}; }",
  "",
  "const validIntents = ['search','category','promos','chat','add_to_cart','follow_up'];",
  "const intent = validIntents.includes(u.intent) ? u.intent : 'chat';",
  "const categorySlug = ['gatos','perros','snacks','humedos','higiene','ropa','juguetes'].includes(u.category_slug) ? u.category_slug : null;",
  "const searchQuery = typeof u.search_query === 'string' ? u.search_query.trim() : '';",
  "const addToCartHint = typeof u.add_to_cart_hint === 'string' ? u.add_to_cart_hint.trim() : '';",
  "",
  "const detect = $('Build Understand Input').first().json;",
  "const { message, sessionId, shownProducts, lastBotQuestion } = detect;",
  "",
  "// Decide qué RPC llamar.",
  "// add_to_cart NO llama RPC (no se busca nada nuevo, se agrega un producto ya visto).",
  "// follow_up reuse search con la query combinada del Understand.",
  "let rpcName, rpcBody;",
  "if (intent === 'add_to_cart') {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 0, category_slug: null };",
  "} else if (intent === 'promos') {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 6, category_slug: categorySlug };",
  "} else if (intent === 'category' && categorySlug) {",
  "  rpcName = 'products_by_category';",
  "  rpcBody = { category_slug: categorySlug, limit_n: 6 };",
  "} else if (intent === 'search' || intent === 'follow_up') {",
  "  rpcName = 'search_product_with_alternatives';",
  "  rpcBody = { query: searchQuery || message };",
  "} else {",
  "  rpcName = 'top_promos';",
  "  rpcBody = { limit_n: 0, category_slug: null };",
  "}",
  "",
  "return [{",
  "  json: {",
  "    message, sessionId, intent, categorySlug, searchQuery, addToCartHint,",
  "    rpcName, rpcBody,",
  "    shownProducts, lastBotQuestion,",
  "    understanding: { intent, category_slug: categorySlug, search_query: searchQuery, add_to_cart_hint: addToCartHint, reasoning: u.reasoning || '' },",
  "  }",
  "}];",
].join('\n');

// Cada Code node con rotación necesita conocer la lista; pasamos el JSON como
// constante embebida.
const OPENINGS_JSON = JSON.stringify(OPENINGS);

const BUILD_COMPOSE_INPUT = [
  "// Toma el response del Supabase RPC, arma cards normalizadas, elige",
  "// apertura rotativa y resuelve add_to_cart contra productos previos.",
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
  "  };",
  "}",
  "",
  "let products = [];",
  "if (detect.intent === 'add_to_cart' || detect.intent === 'chat') {",
  "  products = []; // no se buscan productos nuevos",
  "} else if (detect.intent === 'search' || detect.intent === 'follow_up') {",
  "  const exact = body && body.exact ? compact(body.exact) : null;",
  "  const alts  = body && Array.isArray(body.alternatives) ? body.alternatives.map(compact).filter(Boolean) : [];",
  "  products = exact ? [exact, ...alts.slice(0, 2)] : alts.slice(0, 3);",
  "} else {",
  "  const arr = Array.isArray(body) ? body : [];",
  "  products = arr.slice(0, 3).map(compact).filter(Boolean);",
  "}",
  "",
  "const BADGE_MAP = { new: 'NUEVO', sale: 'OFERTA', hot: 'MÁS VENDIDO' };",
  "const cards = products.map(p => ({",
  "  productId: p.productId, variantLabel: null,",
  "  name: p.name, image: p.image, slug: p.slug,",
  "  unitPrice: p.basePrice, originalPrice: p.originalPrice,",
  "  badge: BADGE_MAP[p.badge] || null, stock: p.stock,",
  "  ctaLabel: 'Agregar al carrito', ctaAction: 'addToCart',",
  "  productUrl: '/producto/' + p.slug,",
  "}));",
  "",
  "// ── ROTACIÓN DE APERTURAS ───────────────────────────────────────────",
  "const ALL_OPENINGS = " + OPENINGS_JSON + ";",
  "const sd = $getWorkflowStaticData('global');",
  "sd.openingHistory = sd.openingHistory || {};",
  "sd.shownProducts  = sd.shownProducts  || {};",
  "const usedRecently = sd.openingHistory[detect.sessionId] || [];",
  "const available = ALL_OPENINGS.filter(o => !usedRecently.includes(o));",
  "const pool = available.length ? available : ALL_OPENINGS;",
  "const suggestedOpening = pool[Math.floor(Math.random() * pool.length)];",
  "if (cards.length) {",
  "  sd.openingHistory[detect.sessionId] = [suggestedOpening, ...usedRecently].slice(0, 3);",
  "}",
  "",
  "// ── ADD-TO-CART RESOLVER ────────────────────────────────────────────",
  "// Si el cliente pidió agregar algo, lo matcheamos contra los productos",
  "// mostrados en turnos previos (los del staticData) por:",
  "//   1) hint exacto del LLM (palabra clave: 'varita','pelota',etc.)",
  "//   2) o '_last' → el primero de la lista (más reciente)",
  "// El resultado va en actions[]; el frontend lo ejecuta sin click.",
  "const actions = [];",
  "if (detect.intent === 'add_to_cart') {",
  "  const previous = detect.shownProducts || [];",
  "  const hintRaw = (detect.addToCartHint || '').toLowerCase().trim();",
  "  let target = null;",
  "  if (hintRaw === '_last' || hintRaw === '') {",
  "    target = previous[0] || null;",
  "  } else {",
  "    // Buscar el primer producto cuyo nombre contenga alguna palabra del hint",
  "    const hintWords = hintRaw.split(/\\s+/).filter(w => w.length >= 3);",
  "    for (const p of previous) {",
  "      const n = (p.name || '').toLowerCase();",
  "      if (hintWords.some(w => n.includes(w))) { target = p; break; }",
  "    }",
  "    // Fallback al último mostrado si el hint no matcheó",
  "    if (!target) target = previous[0] || null;",
  "  }",
  "  if (target) {",
  "    actions.push({",
  "      type: 'addToCart',",
  "      productId: target.productId,",
  "      name: target.name,",
  "      image: target.image || '',",
  "      slug: target.slug,",
  "      unitPrice: Number(target.unitPrice),",
  "      variantLabel: null,",
  "    });",
  "  }",
  "}",
  "",
  "// ── TRACKING DE PRODUCTOS MOSTRADOS ─────────────────────────────────",
  "// Actualizamos shownProducts ANTES de pasar al Compose, pero solo",
  "// merge: si en este turno hay cards nuevas, las pusheamos al frente y",
  "// truncamos a 5. Si no hay cards (chat/add_to_cart), no tocamos.",
  "if (cards.length) {",
  "  const compactCards = cards.map(c => ({",
  "    productId: c.productId, name: c.name, slug: c.slug,",
  "    image: c.image, unitPrice: c.unitPrice,",
  "  }));",
  "  const prev = sd.shownProducts[detect.sessionId] || [];",
  "  // Dedupe por productId",
  "  const seen = new Set(compactCards.map(c => c.productId));",
  "  const merged = [...compactCards, ...prev.filter(p => !seen.has(p.productId))];",
  "  sd.shownProducts[detect.sessionId] = merged.slice(0, 5);",
  "}",
  "",
  "const composeInput = {",
  "  userMessage: detect.message,",
  "  understanding: detect.understanding,",
  "  products: products.map(p => ({ name: p.name, slug: p.slug, price: p.basePrice, badge: p.badge })),",
  "  suggestedOpening,",
  "  // Si vamos a ejecutar acciones, le decimos al LLM para que la copy lo refleje",
  "  pendingActions: actions.length ? actions.map(a => ({ type: a.type, name: a.name })) : [],",
  "};",
  "",
  "return [{",
  "  json: { ...detect, cards, actions, composeInput, suggestedOpening }",
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
  "// Si el LLM ignoró la apertura sugerida y arrancó con la frase prohibida",
  "const FORBIDDEN = /^[¡]?[mM]ir[aá],?\\s+tengo esto/;",
  "if (FORBIDDEN.test(reply) && ctx.suggestedOpening && Array.isArray(ctx.cards) && ctx.cards.length) {",
  "  reply = ctx.suggestedOpening + '. ¿Te sirve?';",
  "}",
  "",
  "// Si vamos a ejecutar acciones (add to cart) pero el LLM no lo mencionó,",
  "// reemplazamos el reply por una confirmación natural.",
  "const actions = Array.isArray(ctx.actions) ? ctx.actions : [];",
  "if (actions.length) {",
  "  const names = actions.map(a => a.name).join(' y ');",
  "  // Si el reply no menciona 'sum'/'agreg'/'list', forzamos confirmación",
  "  if (!/sum[ée]|agreg[ué]|list[oa]|ya te lo|al carrito/i.test(reply)) {",
  "    reply = 'Listo, te sumé ' + names + ' al carrito 🛒. ¿Algo más?';",
  "  }",
  "}",
  "",
  "const suggestions = Array.isArray(r.suggestions)",
  "  ? r.suggestions.filter(s => typeof s === 'string' && s.trim()).slice(0, 3)",
  "  : [];",
  "",
  "// Persistimos la última pregunta del bot para que el siguiente turno la use",
  "const sd = $getWorkflowStaticData('global');",
  "sd.botQuestions = sd.botQuestions || {};",
  "const questionMatch = reply.match(/[¿\\?][^?]+[\\?]/);",
  "if (questionMatch) {",
  "  sd.botQuestions[ctx.sessionId] = questionMatch[0].trim();",
  "} else {",
  "  // Limpiamos si no hubo pregunta",
  "  sd.botQuestions[ctx.sessionId] = '';",
  "}",
  "",
  "return [{",
  "  json: {",
  "    reply,",
  "    cards: Array.isArray(ctx.cards) ? ctx.cards : [],",
  "    suggestions,",
  "    actions, // ← clave nueva: el frontend ejecuta esto sin click",
  "    _meta: {",
  "      intent: ctx.intent,",
  "      category_slug: ctx.categorySlug,",
  "      reasoning: ctx.understanding && ctx.understanding.reasoning,",
  "      suggestedOpening: ctx.suggestedOpening,",
  "      addToCartHint: ctx.addToCartHint,",
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
