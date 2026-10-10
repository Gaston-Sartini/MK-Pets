# MK-Pets — auditoría y plan a producción

Fecha: 2026-10-09 · Rama con los arreglos: `fix/produccion-hardening`

---

## 1. Dónde está el proyecto hoy

| Pieza | Estado |
|---|---|
| Tienda (catálogo, carrito, checkout) | Funciona en local. En el sitio publicado (`mk-pets.netlify.app`) **no se pueden crear pedidos**: la variable `DATABASE_URL` de Netlify apunta a un host que solo responde por IPv6. |
| Base de datos (Supabase) | Activa. 22 productos reales, 7 categorías, 10 pedidos de prueba. Ya protegida (ver §2). |
| Panel admin | Login funciona. Crear productos/categorías estaba roto; ya arreglado. Falta probarlo logueado (ver §5, paso 1). |
| MercadoPago | Código listo y testeado con mocks. **Nunca se probó contra MercadoPago real**: `MP_WEBHOOK_SECRET` está vacío. |
| Chat vendedor | Estaba caído (los modelos de IA de los flujos fueron retirados). Reemplazado por un motor dentro del sitio, probado con Groq. |
| WhatsApp de pedido | El flujo de n8n está activo en tu PC, pero la sesión de WhatsApp en Evolution API está **desconectada** (`close`): hoy no sale ningún mensaje. |
| Dominio `mk-pets.com.ar` | No resuelve. Está en la config pero no está registrado o no apunta a Netlify. |
| GitHub | Repo **público**. `main` está 8 commits atrás de la rama `feat/mk-pets-chat`. El workflow semanal "SRE Checks" falla desde julio. |

---

## 2. Qué se arregló en esta pasada

Todo está en la rama `fix/produccion-hardening` (commit `db719a5`) y en dos migraciones ya aplicadas a Supabase (`supabase/migrations/`).

### Seguridad (lo grave)

1. **La base estaba abierta a internet.** RLS apagado + la anon key commiteada en un repo público (`Productos/seed_products.py`): cualquiera podía leer los pedidos con nombre, dirección y teléfono, cambiar precios y borrar productos. Ahora hay RLS con políticas: el público solo lee el catálogo, el admin escribe, los pedidos no son legibles sin sesión de admin. Verificado desde afuera con la misma anon key.
2. **El bucket de imágenes dejaba subir y borrar a cualquiera.** Ahora solo el admin.
3. **Cualquiera podía ser admin.** El panel aceptaba a cualquier usuario de Supabase Auth y el registro está abierto. Ahora exige `app_metadata.role = 'admin'`; tu usuario ya lo tiene.
4. **Se podía pagar $1 por cualquier pedido.** El monto que se le pasaba a MercadoPago venía del navegador. Ahora sale de la base, y además se verifica que lo pagado cubra el total antes de confirmar.
5. **El webhook de MercadoPago nunca habría funcionado.** Verificaba una firma con un esquema que MP no usa, así que rechazaba todas las notificaciones reales: los pagos no se habrían confirmado nunca.
6. **Números de pedido adivinables** (4 dígitos por día) que daban acceso a datos personales. Ahora llevan 8 caracteres aleatorios.

### Bugs funcionales

- Crear un producto o categoría desde el panel fallaba (la base no generaba el `id`), y **editar un producto con variantes le borraba las variantes**.
- El stock se descontaba al comprar pero nunca volvía: ni al cancelar, ni al modificar el pedido, ni cuando alguien abandonaba el pago de MercadoPago. Ahora vuelve en los tres casos (los pedidos MP impagos se cancelan solos a las 2 h).
- Precios con doble signo (`$$4.800`) en la página del pedido, en "modificar pedido" y en el resumen del checkout.
- El estado "En camino" nunca se mostraba al cliente (el código buscaba `DELIVERING`, la base guarda `SHIPPED`).
- Las horas del panel de pedidos salían corridas 3 horas.
- El WhatsApp le pedía transferencia bancaria también a quien pagaba con MercadoPago.
- El chat agregaba al carrito productos con variantes sin variante, y el pedido después fallaba.
- 7 de 37 tests fallaban. Ahora hay 90 y pasan todos.

### Lo que NO pude verificar

- **El panel admin logueado.** No tengo tu contraseña. Probé las políticas de la base simulando un admin y un usuario común (el admin crea/edita/borra, el común no), pero no hice click en la interfaz.
- **MercadoPago real.** Los tests usan respuestas simuladas.
- **El envío real de WhatsApp.** La sesión está desconectada y no quise mandar mensajes desde tu número.

---

## 3. Honestidad brutal

**Lo bueno.** El diseño visual, la marca y el flujo de compra están bien resueltos. La estructura del código es ordenada. El catálogo ya tiene productos reales. La idea de "vendedor con IA + confirmación por WhatsApp" es un diferencial real para una tienda chica.

**Lo malo.**

- **Se construyó de afuera hacia adentro.** Hay runbook de SRE, presupuesto de Lighthouse, cuatro workflows de CI y 150 KB de documentos de diseño, pero la tienda publicada no podía tomar un pedido y la base estaba abierta. Varios comentarios en el código decían `SECURITY:` sobre controles que no funcionaban.
- **Nunca se hizo una compra real de punta a punta.** Los 10 pedidos son de prueba, todos menos uno con pago al recibir. El único de MercadoPago quedó cancelado.
- **La arquitectura no se podía poner en producción.** El chat y el WhatsApp dependían de n8n y Evolution corriendo en tu PC con un túnel ngrok. Con la PC apagada, ni chat ni WhatsApp.
- **Demasiadas piezas para lo que hace.** n8n ×2, Typebot (4 contenedores, sin uso), Evolution, Postgres, Redis, TTS, tres versiones del flujo de chat. El chat son ~300 líneas de código; el WhatsApp es un POST.
- **El contenido está a medias.** 21 de 22 productos no tienen descripción, todos tienen una sola foto, ninguno tiene precio "antes" (así que "Ver ofertas" no devuelve nada), y las categorías Ropa y Juguetes están vacías.

**Riesgos que siguen abiertos.**

- **WhatsApp por Evolution API no es oficial.** Usa el protocolo de WhatsApp Web. Meta puede banear el número sin aviso. Para confirmaciones a clientes que acaban de comprar el riesgo es bajo, pero no uses el número personal ni el principal del negocio sin tener un plan B.
- **Supabase Free pausa el proyecto tras 7 días sin actividad y no tiene backups.** Para una tienda con pedidos reales, perder la base es perder el negocio.
- **Falta lo legal de una tienda argentina:** botón de arrepentimiento, términos y condiciones, política de privacidad, datos fiscales en el pie. No es opcional (Defensa del Consumidor).
- **Sin costo de envío ni zonas.** Hoy todo es "envío gratis a CABA" y el formulario acepta cualquier dirección.

---

## 4. Arquitectura recomendada

```
Cliente ──> Sitio Next.js (Netlify) ──> Supabase (base + imágenes + login admin)
                    │
                    ├──> API de IA (Groq)            chat vendedor
                    ├──> MercadoPago                 pagos
                    └──> Evolution API (VPS chico)   WhatsApp de pedido
```

n8n queda **fuera del camino crítico**. El sitio ya no lo necesita ni para el chat ni para el WhatsApp. Si más adelante querés automatizaciones (recordatorios, reportes), se agrega en el mismo VPS.

Para arrancar todavía más barato, se puede salir **sin VPS**: la página del pedido ya tiene un botón "Escribinos por WhatsApp" con el número de pedido precargado, que es lo que usa la mayoría de las tiendas chicas. El WhatsApp automático se suma después.

---

## 5. Ruta a producción

Cada paso es chico y deja el proyecto en un estado que funciona. Los marcados **(vos)** necesitan tus cuentas o contraseñas.

### Módulo 0 — Cerrar lo que ya está hecho
1. **(vos)** Entrar a `/admin` en local, crear un producto de prueba con dos variantes, editarlo y borrarlo. Cambiar el estado de un pedido. Es lo único que no pude probar.
2. **(vos)** Supabase → Authentication → Sign In / Providers → desactivar "Allow new users to sign up". Activar "Leaked password protection".
3. Revisar el PR de `fix/produccion-hardening` y mergearlo a `main`.

### Módulo 1 — Que el sitio publicado tome pedidos
4. **(vos)** En Netlify → Environment variables, cambiar `DATABASE_URL` y `DIRECT_URL` al pooler (`aws-1-sa-east-1.pooler.supabase.com`, ver `.env.example`). Copiarlas de Supabase → Connect → Prisma.
5. Cargar en Netlify `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` para el chat.
6. Desplegar y hacer un pedido de prueba con pago al recibir. Verificar `/api/health`.

### Módulo 2 — Dominio
7. **(vos)** Registrar `mk-pets.com.ar` en nic.ar (necesita CUIT/CUIL y clave fiscal).
8. Apuntarlo a Netlify y actualizar `NEXT_PUBLIC_BASE_URL`.

### Módulo 3 — MercadoPago real
9. **(vos)** En Tus integraciones → Webhooks: URL `https://mk-pets.com.ar/api/webhooks/mercadopago`, evento "Pagos". Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
10. Hacer una compra con usuarios de prueba de MP. Verificar que el pedido pase a "Confirmado" solo.
11. Una compra real de monto mínimo y su reembolso.

### Módulo 4 — WhatsApp automático
12. Contratar el VPS, levantar Evolution API con dominio y HTTPS.
13. **(vos)** Escanear el QR con el número de la tienda.
14. Cargar `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `TRANSFER_ALIAS` en Netlify. Pedido de prueba a tu propio número.

### Módulo 5 — Contenido y legales
15. Descripciones y más fotos por producto. Precios "antes" en lo que esté en oferta.
16. Ocultar las categorías vacías o cargarles productos.
17. Páginas de términos, privacidad y botón de arrepentimiento.

### Módulo 6 — Operación
18. Aviso al dueño cuando entra un pedido (WhatsApp o mail al admin).
19. WhatsApp al cliente cuando el pedido pasa a "En camino".
20. Pasar Supabase a Pro cuando haya ventas reales (backups).
21. Monitor de uptime gratuito sobre `/api/health`.

### Más adelante
- Transferencia como medio de pago propio (hoy está mezclada con "efectivo").
- Zonas y costo de envío.
- Búsqueda del chat por similitud cuando el catálogo pase de ~150 productos.
- Limpiar del repo Typebot, los generadores de flujos y los documentos viejos.

---

## 6. Servicios y costos

Precios consultados el 2026-10-09. Verificá cada uno antes de contratar; varios cambiaron este año.

| Servicio | Para qué | Plan | Costo/mes |
|---|---|---|---|
| Netlify | Hosting del sitio | Free: 300 créditos/mes. Un deploy a producción gasta 15; 1 GB de tráfico, 20. **Si se acaban, el sitio se pausa.** | USD 0 |
| | | Personal: 1.000 créditos | USD 9 |
| Supabase | Base, imágenes, login | Free: 500 MB, se pausa tras 7 días sin uso, sin backups | USD 0 |
| | | Pro: backups diarios, no se pausa | USD 25 |
| Groq | IA del chat | Developer (pago por uso). `gpt-oss-120b`: USD 0,15 / 0,60 por millón de tokens | ~USD 0,45 cada 1.000 mensajes |
| VPS | Evolution API | 2 vCPU / 4 GB. Hetzner CX23 figuraba a ~EUR 5,49 pero con stock limitado; alternativas similares en Contabo, Hostinger u OVH | USD 5–8 |
| Dominio .com.ar | | nic.ar, pago anual (~ARS 8.500/año según prensa de julio; confirmar en nic.ar) | < USD 1 |
| MercadoPago | Cobros | Comisión por venta, sin fijo | — |

**Escenarios**

- **Mínimo para lanzar:** Netlify Free + Supabase Free + Groq + dominio, WhatsApp con el botón manual. **~USD 1–2/mes.**
- **Recomendado:** lo anterior + VPS para el WhatsApp automático. **~USD 7–10/mes.**
- **Con ventas reales:** + Supabase Pro + Netlify Personal. **~USD 40–45/mes.**

### Sobre la API de IA

Medido en este proyecto: cada mensaje del chat usa ~1.900 tokens de entrada y ~250 de salida.

- **Groq gratis:** 8.000 tokens por minuto. Son ~4 mensajes por minuto para toda la tienda; por eso lo sentías limitado. El plan Developer sube a 250.000 por minuto y con este uso cuesta centavos.
- **Gemini:** tu clave hoy responde "créditos de prepago agotados" (HTTP 402). Google pasó a un esquema de prepago. Los modelos Flash-Lite actuales cuestan USD 0,25–0,30 / 1,50–2,50 por millón: entre 2 y 4 veces más que Groq para este uso.
- **Claude Haiku 5.5:** USD 0,10 / 0,50 por millón (hasta 100.000 tokens por pedido). Para este uso da ~USD 0,32 cada 1.000 mensajes contra ~USD 0,45 de Groq: un 30 % menos, pero la diferencia son centavos. Los créditos de la API se cargan aparte de la suscripción de claude.ai. Requiere sumar el SDK de Anthropic a `engine.ts`.

Recomendación: **Groq Developer con `openai/gpt-oss-120b`**. En las pruebas respondió en ~1,3 s, recomendó el producto correcto y solo agregó al carrito cuando se lo pidieron. El modelo de 20b cuesta la mitad, pero en la primera prueba recomendó un alimento genérico habiendo uno para castrados y agregó al carrito sin que se lo pidieran. Eso fue antes de afinar las instrucciones y no lo volví a probar después, así que no está descartado.

El motor habla con cualquier API compatible con OpenAI: cambiar de proveedor es cambiar tres variables de entorno. Esto importa porque los proveedores retiran modelos seguido — así se cayó el chat.

---

## 7. Variables de entorno de producción

Ver `.env.example`. Las que hay que cargar en Netlify:

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_BASE_URL`, `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_REASONING_EFFORT`, y para WhatsApp `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `TRANSFER_ALIAS`.

`SESSION_SECRET` ya no se usa.

---

## 8. Actualización del 2026-10-09 (segunda pasada)

Decisiones tomadas: se va por el escenario **recomendado** (Netlify + Supabase + Groq + VPS para WhatsApp) y **MercadoPago queda apagado** por la comisión.

Hecho en esta pasada:

- **Transferencia** es un medio de pago propio. El pedido queda "Esperando el pago", muestra monto y alias, y un botón para mandar el comprobante por WhatsApp. El admin marca "pago recibido" y eso confirma el pedido.
- **MercadoPago apagado** con `NEXT_PUBLIC_ENABLE_MERCADOPAGO`. Todo el código sigue ahí y testeado: se prende con una variable.
- **Avisos por WhatsApp al cliente** cuando el admin marca el pago, pasa el pedido a preparación, en camino, entregado o lo cancela. Aviso opcional al dueño por cada pedido nuevo (`OWNER_WHATSAPP`).
- **Panel:** "Mi cuenta → cambiar contraseña", menú usable en celular.
- **Tienda:** las categorías vacías no se muestran; página de botón de arrepentimiento.
- **Netlify:** variables de producción cargadas (base por el pooler, Supabase, IA, alias). Node 22.
- **CI:** los workflows estaban rotos desde siempre (Node 20, secrets que no existían). Arreglados y simplificados.
- **VPS:** `infra/evolution/` tiene el compose de producción, la guía paso a paso y la página para vincular el teléfono.

Del plan original quedan resueltos los módulos 0 y 1. El módulo 3 (MercadoPago) queda en pausa.

Pendiente del lado del dueño:

1. Cambiar la contraseña del admin (Mi cuenta).
2. Pasar Groq al plan Developer (pago por uso): con el gratis el chat atiende ~4 mensajes por minuto.
3. Decidir qué número manda los WhatsApp. Conviene el de la tienda, no uno personal.
4. Contratar el VPS y seguir `infra/evolution/README.md`.
5. Registrar el dominio.
6. Cargar descripciones, más fotos y precios "antes".
7. Términos y condiciones y política de privacidad (necesitan razón social y CUIT).

## Fuentes de precios

- Groq: https://console.groq.com/docs/models
- Gemini: https://ai.google.dev/gemini-api/docs/pricing
- Claude: https://platform.claude.com/docs/en/about-claude/pricing
- Netlify: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- Supabase: https://supabase.com/pricing
- Hetzner (suba 2026): https://findstack.com/resources/hetzner-price-increase-2026
- Dominios .ar: https://www.iprofesional.com/tecnologia/397387-cual-es-el-costo-de-registrar-un-dominio-en-internet-en-argentina
