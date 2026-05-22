# Chat MK-Pets — v2 (Conversacional)

Versión mejorada del bot que reemplaza el routing por regex (v1) por un módulo de comprensión LLM y una respuesta conversacional en lugar de texto plantilla.

> El v1 sigue activo en paralelo en `/webhook/mk-pets-chat`. El v2 vive en `/webhook/mk-pets-chat-v2`. Cambiás cuál usa el sitio con la env var `CHAT_VERSION=v1|v2`.

## Arquitectura

```
Webhook (POST /mk-pets-chat-v2)
   │
   ▼
HTTP Request "Get Catalog"
   • RPC categories_with_sample() → [{ slug, name, emoji, sample_products[] }]
   • Le da al LLM contexto sobre qué hay en cada categoría
   │
   ▼
Code "Build Understand Input"
   • Empaqueta { userMessage, catalog } para el LLM
   │
   ▼
AI Agent "Understand"   ←─ Memory Understand (sessionId)
   • Groq gpt-oss-20b · response_format: json_object
   • Devuelve { intent, category_slug, search_query, reasoning }
   │
   ▼
Code "Decide RPC"
   • Mapea intent → rpcName + rpcBody
   │
   ▼
HTTP Request "Supabase RPC"
   • Llama a search_product_with_alternatives | top_promos | products_by_category
   │
   ▼
Code "Compose Context"
   • Compacta productos + arma cards finales para el frontend
   │
   ▼
AI Agent "Compose Reply"   ←─ Memory Compose (sessionId-compose)
   • Groq gpt-oss-20b · response_format: json_object
   • Devuelve { reply, suggestions } conversacional argentino
   │
   ▼
Code "Assemble Final"
   • Junta reply (del LLM) + cards (del Code anterior) + meta
   │
   ▼
Respond to Webhook → { reply, cards[], suggestions[], _meta }
```

## Mejoras vs v1

| Aspecto | v1 | v2 |
|---|---|---|
| Routing intent | Regex sobre keywords | LLM con contexto del catálogo |
| Mapeo problema→categoría | No funciona ("pelo perro" → falla) | LLM lo deduce ("pelo" → higiene) |
| Promos filtradas | No | Sí (top_promos acepta category_slug) |
| Reply | Texto plantilla por intent | LLM conversacional argentino |
| Saludo | "Sí, lo tengo" (busca producto) | "Re bien, acá para ayudarte 🐾" |
| Follow-up | Suggestions etiquetas genéricas | Preguntas de vendedor real |
| Latencia | ~1.5 s | ~2.3 s (1 LLM call extra) |
| Costo Groq | ~700 tokens | ~1500 tokens |

## Casos verificados

| Input | Intent | Cards | Reply |
|---|---|---|---|
| "hola todo bien?" | chat | [] | "Re bien, acá esperando para ayudarte 🐾 ¿qué andás buscando para tu mascota?" |
| "tenes algo para el pelo de mi perro" | search/higiene | Shampoo Neutro | "Mirá, tengo esto que te puede venir 👇 ¿Te sirve este?" |
| "que arena recomendas" | search/higiene | Arena Pipicat | "Mirá, tengo esto que te puede venir 👇" |
| "ofertas en humedo gato" | promos/humedos | Whiskas (badge OFERTA) | "Estas son las que están volando esta semana 🔥 ¿Querés que te lo mande hoy?" |

## Cómo testear sin frontend

```bash
# Saludo conversacional
curl -X POST http://localhost:5678/webhook/mk-pets-chat-v2 \
  -H "Content-Type: application/json" \
  -d '{"message":"hola todo bien?","sessionId":"test"}'

# Problema→categoría
curl -X POST http://localhost:5678/webhook/mk-pets-chat-v2 \
  -H "Content-Type: application/json" \
  -d '{"message":"tenes algo para el pelo de mi perro","sessionId":"test"}'
```

## Cómo cambiar entre v1 y v2

En `.env.local`:
```
CHAT_VERSION=v2     # default · LLM conversacional
# CHAT_VERSION=v1   # regex routing, sin LLM understand
```

Reiniciar el dev server después de cambiar.

## Cómo regenerar el workflow

```bash
node generate_n8n_v2.js
docker cp docs/chat/n8n-typebot-flow-v2.json n8n:/tmp/flow-v2.json
docker exec n8n n8n import:workflow --input=/tmp/flow-v2.json
docker exec n8n n8n update:workflow --id=MkPetsV2ChatFlow --active=true
docker exec n8n n8n publish:workflow --id=MkPetsV2ChatFlow
docker restart n8n
```

## Caveats conocidos

- **Memoria separada Understand/Compose**: usamos `sessionKey` distinto (`<id>` vs `<id>-compose`) para que el Compose Reply no vea los JSON internos del Understand. Trade-off: el Understand no recuerda exactamente qué se le mostró al cliente — sólo recuerda los mensajes de él.
- **Dependencia del catálogo**: si en runtime no hay productos en una categoría, el LLM Understand puede aún elegirla. La RPC devuelve `[]` y el Compose Reply lo maneja con empatía ("ese justo no me queda").
- **Costo**: 2 LLM calls por mensaje vs 1 en v1. Para volumen alto, considerar cachear el catálogo (cambia poco) y/o downsize el modelo del Understand a `llama-3.1-8b-instant`.
