# Plan de mejoras — a partir de la auditoría del 12/10/2026

Todo lo que salió en `AUDITORIA-2026-10-12.md`, ordenado en etapas. Se publica en dos tandas para no gastar un despliegue por cada cosa: primero todas las mejoras (etapas 1 a 7), después la migración de Next.js (etapa 8), que es la más delicada y conviene que vaya sola.

Estado: ⬜ pendiente · ✅ hecho y publicado (12/10/2026) · ⏸ espera un dato o una decisión

## Etapa 1 — Cliente: comprar más fácil

| | Mejora |
|---|---|
| ✅ | Búsqueda que mira nombre, descripción y categoría, tolera errores de tipeo y entiende sinónimos ("arena" encuentra las piedritas) |
| ✅ | Página "Seguí tu pedido": se ingresa el número y se ve el pedido. Link en el encabezado y el pie |
| ✅ | Recorrido del pedido en su página: recibido → confirmado → preparando → en camino → entregado |
| ✅ | Selector de barrio de CABA en el checkout |
| ✅ | El checkout recuerda nombre, dirección y teléfono en el dispositivo |
| ✅ | "Agregar" ya no abre el carrito cada vez: avisa y actualiza el contador |
| ✅ | El cliente puede cancelar su pedido mientras se pueda modificar |
| ✅ | La ficha avisa cuando quedan pocas unidades |
| ⏸ | Mostrar el titular junto al alias de transferencia (falta el nombre) |

## Etapa 2 — Dueño: panel

| | Mejora |
|---|---|
| ✅ | Aumento masivo de precios por categoría o marca, con vista previa |
| ✅ | Resumen de ventas en el Dashboard: hoy, 7 días, 30 días y productos más vendidos |
| ✅ | Buscador y filtros en productos y pedidos |
| ✅ | Pedidos por transferencia sin pagar hace más de 24 h, resaltados |
| ✅ | Estados solo hacia adelante, sin mensajes repetidos al cliente |
| ✅ | Confirmaciones propias en vez del cuadro del navegador |
| ✅ | Imprimir un pedido y exportar la lista a planilla |
| ✅ | Botones de categorías con nombre para lectores de pantalla |

## Etapa 3 — Avisos a la tienda

| | Mejora |
|---|---|
| ✅ | Aviso de pedido nuevo a la tienda (número cargado el 12/10) |
| ✅ | Aviso cuando el cliente modifica o cancela su pedido |
| ✅ | Aviso cuando un producto queda con poco stock |

## Etapa 4 — Seguridad

| | Mejora |
|---|---|
| ✅ | Límites de uso guardados en la base (hoy son aproximados) |
| ✅ | La sesión del panel en una cookie que el navegador no puede leer |
| ✅ | Verificar por contenido, no por nombre, que lo que se sube es una imagen |
| ⏸ | Contraseña del panel y verificación de contraseñas filtradas (son de tu lado) |

## Etapa 5 — Velocidad, buscadores y accesibilidad

| | Mejora |
|---|---|
| ✅ | Que la portada no "salte" al cargar en el celular. La foto principal no reservaba su lugar: medía 20 px hasta cargar y después empujaba todo el texto 230 px. Ahora ocupa su tamaño desde el primer momento |
| ✅ | Imagen de vista previa al compartir más liviana |
| ✅ | Nombres para los botones que solo tienen ícono |
| ✅ | Medición de visitas propia, sin cookies ni servicios externos |

## Etapa 6 — Limpieza

| | Mejora |
|---|---|
| ✅ | Las garantías ("envío gratis", "compra segura"…) una sola vez por página |
| ✅ | Un solo menú de categorías en la página de productos |
| ✅ | Sacar los restos de Typebot y n8n del código |
| ✅ | Ordenar los archivos sueltos de la raíz del proyecto |

## Etapa 7 — Infraestructura

| | Mejora |
|---|---|
| ✅ | Copia de seguridad semanal automática de la base, cifrada |
| ✅ | Aviso si el sitio se cae (chequeo cada 30 minutos) |

## Etapa 8 — Migración de Next.js

| | Mejora |
|---|---|
| ✅ | Pasar de Next.js 14 a una versión con soporte: quedó en Next.js 15.5 con React 19. Se probó entero en local antes de publicar: todas las páginas, un pedido completo (crear, modificar, cancelar), el panel (estados, pago, alta/edición/baja de producto) y el chat |

Quedan avisos de seguridad solo en herramientas que no se publican con el sitio (las de pruebas y la de Prisma para armar la base). No afectan a la tienda; se actualizan cuando haga falta tocar esas herramientas.

## Cómo quedó cada cosa, en una línea

- **Búsqueda:** `src/lib/search.ts`. Para sumar sinónimos, agregar palabras a la lista `SYNONYMS`.
- **Seguimiento:** página `/seguimiento`, con link en el encabezado y el pie.
- **Barrios:** lista en `src/lib/barrios.ts`.
- **Aumento de precios:** panel → Precios. La cuenta está en `src/lib/pricing.ts`.
- **Ventas y visitas:** panel → Dashboard. Las visitas se guardan en la tabla `PageView` (fecha, página y cantidad; nada personal).
- **Estados del pedido:** reglas en `src/lib/order-status.ts`.
- **Avisos a la tienda:** `notifyOwner` en `src/lib/whatsapp.ts`; van al número de `OWNER_WHATSAPP`.
- **Copias de seguridad:** `docs/COPIAS-DE-SEGURIDAD.md`.
- **Aviso de caída:** `.github/workflows/uptime.yml`, cada 30 minutos.
- **Vistas previas de Netlify:** ya no se generan solas (gastaban créditos); solo si a un pull request se le pone la etiqueta `preview`.

## Lo que no entra en este plan

- **Dominio propio:** hay que comprarlo.
- **Descripciones de productos:** necesitan los datos reales de cada envase.
- **Segundo usuario del panel y segundo factor:** se crea desde Supabase cuando haga falta.
- **Contraste del naranja de la marca:** es una decisión de diseño.
- **Sumar productos a un pedido ya hecho:** se resuelve mejor haciendo un pedido nuevo; lo que sí se agrega es poder cancelar.
- **Vencimiento automático de transferencias impagas:** cancelar solo un pedido que quizás ya se pagó es peor que dejarlo; por eso se resaltan y decide el dueño.
