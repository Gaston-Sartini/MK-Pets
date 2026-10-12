# Auditoría completa de MK-Pets — 12 de octubre de 2026

Escaneo de punta a punta: cómo se ve, cómo compra un cliente, qué puede hacer el dueño desde el panel, medios de pago, chat, seguridad, velocidad e infraestructura. Todo lo que figura como "probado" se probó de verdad, con pedidos y un producto ficticios.

---

## 1. Resumen en un minuto

**El sitio está sano y se puede vender con él.** La base está bien protegida, los pedidos y el stock funcionan sin errores de cuentas, y el panel hace lo que tiene que hacer. No encontré ninguna forma de que un visitante vea pedidos ajenos, cambie precios o entre al panel.

Lo que sí encontré son **errores que frenaban ventas** (ya corregidos y publicados) y **cosas que faltan para operar cómodo** (necesitan una decisión tuya o trabajo aparte).

### Las cinco cosas más importantes

| # | Qué | Estado |
|---|---|---|
| 1 | **La tienda no recibe aviso cuando entra un pedido.** El WhatsApp le llega al cliente pero no al dueño: falta cargar su número. Hoy se entera solo si abre el panel. | Necesito el número |
| 2 | **El checkout rechazaba teléfonos bien escritos** (`+54 9 11 …`, `011 15 …`) y **mandaba al inicio al recargar la página**. | Corregido |
| 3 | **Next.js (la base del sitio) está en una versión sin soporte.** Lo actualicé a la última de su rama, que cierra parte de las vulnerabilidades conocidas; el resto solo se cierra migrando a la versión 15 o 16. | Parcial: falta migrar |
| 4 | **21 de 22 productos no tienen descripción**, y una foto no coincide con el nombre (ver 4.1). | Depende del contenido |
| 5 | **No hay copia de seguridad propia de la base** ni aviso si el sitio se cae. | Lo puedo automatizar |

---

## 2. Qué probé

| Prueba | Resultado |
|---|---|
| Navegación: portada, categorías, ficha de producto, búsqueda, página inexistente | Funciona. La búsqueda es limitada (ver 4.1) |
| Compra manual por **transferencia** (variante de 7,5 kg) | ✅ Pedido creado, muestra alias e instrucciones |
| Compra manual en **efectivo** (dos productos, cantidades) | ✅ Queda confirmado al instante |
| Compra **armada desde el chat** (recomendación → agregar → checkout) | ✅ |
| Cliente **modifica cantidades** dentro de los 30 minutos | ✅ Recalcula total y stock |
| Formulario con datos inválidos | ✅ Muestra errores claros |
| Panel: **pago recibido → preparando → enviado → entregado** | ✅ |
| Panel: **cancelar** un pedido | ✅ Devuelve el stock exacto |
| Panel: reactivar un pedido cancelado | ✅ Lo impide (correcto) |
| Panel: **crear producto ficticio** con variantes, precio tachado e imagen | ✅ Aparece en tienda, búsqueda y chat |
| Panel: editar, ocultar y **borrar** el producto | ✅ |
| Panel: crear, renombrar y borrar una **categoría**; borrar una con productos | ✅ La segunda la impide |
| Panel: cambio de contraseña con la clave actual equivocada | ✅ Lo rechaza (no cambié la clave real) |
| Intentos de abuso: precio manipulado, cantidad negativa, más stock del que hay, producto oculto, MercadoPago apagado | ✅ Todos rechazados |
| Código malicioso escrito en las notas del pedido | ✅ Se muestra como texto, no se ejecuta |
| Acceso a la base como visitante anónimo | ✅ Solo puede leer el catálogo |
| Panel y sus funciones sin iniciar sesión | ✅ Todo bloqueado |
| Velocidad con Lighthouse (portada y ficha, celular y escritorio) | Ver sección 4.6 |

**Lo que no pude probar hoy:**
- **Envío real de WhatsApp.** Hice los pedidos con el envío apagado para no molestar a nadie. Quedó verificado la semana pasada con pedidos reales.
- **MercadoPago.** Está apagado.
- **Aspecto visual del panel.** Usé tu Chrome con la ventana en segundo plano y no pude sacar capturas; lo revisé por contenido y funciones. Solo vi el Dashboard.
- **Cerrar sesión**, para no cortarte la tuya.

---

## 3. Lo que corregí durante la auditoría (ya publicado)

1. **Teléfono del checkout.** Aceptaba un solo formato. Ahora acepta como lo escribe la gente: `11 2345 6789`, `+54 9 11 2345-6789`, `011 15 2345-6789`, `(11) 2345 6789`.
2. **Recargar el checkout mandaba al inicio**, aunque hubiera productos en el carrito. También pasaba al abrirlo desde un link.
3. **Botón del chat encima de "Ir al checkout".** Al subirlo ayer a 4rem quedó tapando ese botón con el carrito abierto. Ahora se oculta mientras el carrito está abierto, en el checkout y en la página del pedido.
4. **Chat y carrito encimados.** Cuando el vendedor sumaba algo, el carrito se abría debajo del chat. Ahora no se abre solo; "Ir al carrito" cierra el chat y lo muestra.
5. **Links a un dominio que no existe.** Los datos para Google y para la vista previa al compartir apuntaban a `mk-pets.com.ar`, que no está registrado. Ahora usan la dirección real del sitio y se cambian desde una sola variable cuando haya dominio.
6. **Link de WhatsApp del cliente en el panel.** Abría un número incompleto (sin el 54 9). Ahora abre el chat correcto.
7. **Stock en el panel.** La lista de productos y el aviso de "stock bajo" miraban un número general e ignoraban las variantes. Un envase podía quedarse en cero sin que el panel avisara. Ahora muestra cada variante.
8. **Página "no encontrada".** Era la de fábrica, en inglés y sin salida. Ahora está en español con links a la tienda y a WhatsApp.
9. **Fotos huérfanas.** Al borrar un producto sus fotos quedaban guardadas para siempre. Ahora se borran con él.
10. **Ejemplo del teléfono.** El formulario mostraba como ejemplo el número de la tienda, lo que confunde.
11. **Next.js 14.2.18 → 14.2.35.**
12. **Limpieza:** saqué dos componentes que nadie usaba, un video de 1,4 MB y un ícono de 1,7 MB sin uso, y un archivo de configuración duplicado.

---

## 4. Hallazgos por área

### 4.1 Cliente: usabilidad

**Bien**
- El recorrido de compra es corto: producto → carrito → medio de pago → datos → listo. Sin crear cuenta.
- En celular no hay desbordes ni textos cortados. Todas las imágenes tienen descripción.
- La página del pedido por transferencia es clara: monto, alias con botón de copiar, botón para mandar el comprobante.

**A mejorar**

| Hallazgo | Por qué importa |
|---|---|
| **La búsqueda solo mira el nombre.** Buscar "arena" devuelve 2 de los 5 productos que sirven para eso (no encuentra "Piedritas" ni "Bentonita"). | El cliente cree que no hay |
| **No hay dónde consultar un pedido.** Si el cliente pierde el link, no tiene forma de volver a verlo desde el sitio. | Genera consultas por WhatsApp |
| **La página del pedido no muestra el recorrido** (recibido → preparando → en camino → entregado), solo el estado actual. | Tranquiliza y evita preguntas |
| **No se valida la zona de entrega.** La dirección es texto libre: alguien de fuera de CABA puede completar el pedido. | Pedidos que hay que cancelar a mano |
| **El formulario no recuerda al cliente.** En cada compra hay que escribir nombre, dirección y teléfono. | Fricción para el que vuelve |
| **Cada "Agregar" abre el carrito.** Para sumar tres productos hay que cerrarlo dos veces. | Molesto al armar un pedido grande |
| **El cliente no puede cancelar su pedido ni sumarle productos**, solo cambiar cantidades. | Termina escribiendo por WhatsApp |
| **Las fichas no tienen descripción** (21 de 22) ni indican cuánto stock queda. | Menos confianza; el chat tampoco tiene qué contar |
| **La foto de "Old Prince Premium Gatos 1 KG" muestra una bolsa que dice "GATITO".** Si es alimento para gatitos, el nombre está mal y el chat le está diciendo a la gente que no hay alimento para gatitos. | Revisar cuál de los dos está mal |
| El alias de transferencia aparece solo, sin nombre del titular. | Mostrar el titular da confianza antes de transferir |

### 4.2 Dueño: panel de administración

**Bien**
- Entrar es simple y el panel se adapta al celular.
- El flujo de un pedido es claro: marcar pago recibido, cambiar estado, ver detalle, link directo al WhatsApp del cliente.
- Las reglas de negocio están cuidadas: cancelar devuelve stock, un cancelado no se puede reabrir, no se puede borrar un producto con pedidos ni una categoría con productos.
- El alta de productos tiene todo: variantes, precio tachado, hasta 5 fotos, destacado, etiqueta, visible/oculto.

**A mejorar**

| Hallazgo | Por qué importa |
|---|---|
| **No hay aviso de pedido nuevo** (ver 4.3). | Lo más urgente |
| **No hay aumento masivo de precios.** Hay que entrar producto por producto y variante por variante. | Con inflación es la tarea más repetida |
| **No hay resumen de ventas**: cuánto se vendió hoy, esta semana, qué se vende más. | Hoy no se puede saber sin contar a mano |
| **Sin buscador ni filtros** en productos ni en pedidos (por cliente, fecha o número). | Se vuelve incómodo con el volumen |
| **Los pedidos por transferencia impagos no vencen nunca.** Retienen stock hasta que alguien los cancela. | Stock "fantasma" |
| **El dueño no se entera si el cliente modifica el pedido.** | Puede preparar las cantidades viejas |
| **Se puede pasar de cualquier estado a cualquier otro** (por ejemplo de Entregado a Pendiente), y cada paso vuelve a mandar WhatsApp al cliente. | Un clic equivocado manda un mensaje raro |
| Las confirmaciones usan el cuadro del navegador, que no se puede personalizar. | Estético, y me trabó la prueba automática |
| Los botones de editar y borrar categoría son íconos sin texto. | Accesibilidad |
| No se puede imprimir un pedido ni exportar la lista. | Útil para armar y repartir |

### 4.3 Medios de pago y avisos

- **Transferencia:** funciona. El pedido queda "Esperando el pago" hasta que el dueño marca "pago recibido". El comprobante se manda por WhatsApp; el sitio no lo recibe ni lo guarda, lo cual es razonable para este tamaño.
- **Efectivo:** funciona. Queda confirmado al instante.
- **MercadoPago:** apagado. El sitio rechaza bien un intento de usarlo.
- **Aviso al dueño:** el código está listo, pero la variable `OWNER_WHATSAPP` no está cargada en producción. **Hoy ningún pedido le avisa a la tienda.**
- **Número que envía:** sigue siendo tu número personal, como quedó pendiente.

### 4.4 Chat vendedor

Funciona bien y quedó medido aparte (99 % en el banco de pruebas, control automático semanal). En esta auditoría armó un pedido completo sin errores. Los dos problemas que encontré eran de la interfaz (puntos 3 y 4 de la sección 3) y ya están corregidos.

### 4.5 Seguridad

**Bien**
- **Base de datos:** un visitante solo puede leer el catálogo. No puede leer ni tocar pedidos, ni cambiar productos, ni subir archivos. El registro de usuarios nuevos está deshabilitado.
- **Panel:** protegido en tres capas (la página, cada función por separado y la base). Probé saltear la primera con una técnica conocida y no funcionó.
- **Pedidos:** los precios siempre salen de la base, nunca de lo que manda el navegador. El stock se descuenta de forma que dos compras simultáneas no pueden llevarse la misma unidad.
- **Datos personales:** para ver un pedido hace falta su número, que es largo y aleatorio, y hay límite de intentos.
- Cabeceras de seguridad presentes y conexión cifrada obligatoria.

**A mejorar**

| Hallazgo | Riesgo |
|---|---|
| **Next.js 14 ya no recibe todos los parches.** Tras la actualización de hoy siguen abiertos avisos que solo se cierran en la versión 15.5 o 16, dos de ellos marcados como críticos. Uno afecta solo a servidores Windows (no es el caso). El otro afecta al optimizador de imágenes; no verifiqué si en Netlify aplica. | Medio. Hay que migrar |
| **La contraseña del panel** fue pegada en un chat la semana pasada. Si todavía no la cambiaste, cambiala desde "Mi cuenta". | Medio |
| Supabase tiene apagada la verificación de contraseñas filtradas. Se activa desde su panel, en Authentication. | Bajo |
| Los límites de uso se cuentan en memoria. En este tipo de alojamiento son aproximados: frenan un abuso casual, no uno decidido. | Bajo |
| La sesión del panel se guarda en una cookie que el navegador puede leer. Solo sería un problema si alguien lograra inyectar código, y las pruebas de inyección no pasaron. | Bajo |
| Hay un solo usuario administrador y sin segundo factor. | Bajo para este tamaño |
| El tipo de archivo de las fotos se cree por lo que dice el navegador. Solo el admin puede subir. | Bajo |

### 4.6 Velocidad y buscadores

| Página | Celular | Escritorio |
|---|---|---|
| Portada | **79** / 100 | 99 / 100 |
| Ficha de producto | 97 / 100 | — |

Accesibilidad 96, buenas prácticas 100, SEO 100. Es una sola medición por página, no un promedio.

- **La portada en celular "salta" al cargar** (el texto se mueve cuando aparece la imagen). Es lo que le baja la nota y Google lo penaliza. No llegué a la causa exacta.
- La primera respuesta del servidor a veces tarda más de un segundo (el sitio "se despierta").
- La imagen de vista previa al compartir pesa 0,9 MB; conviene bajarla a menos de 300 KB para que WhatsApp la muestre siempre.
- **Contraste:** el naranja de la marca sobre fondo claro, y el blanco sobre naranja, no llegan al mínimo recomendado para texto chico (51 elementos). Es una decisión de marca.
- 14 botones de la portada no tienen nombre para lectores de pantalla.
- **No hay medición de visitas.** No se sabe cuánta gente entra ni qué mira.
- **No hay dominio propio.** Con `mk-pets.netlify.app` funciona, pero un `.com.ar` da más confianza y posiciona mejor.

### 4.7 Infraestructura

| Pieza | Dónde | Estado |
|---|---|---|
| Sitio | Netlify | Bien. Cada publicación gasta créditos |
| Base de datos y fotos | Supabase | Bien. Sin avisos graves del analizador |
| WhatsApp | Google Cloud (gratis) | Funcionando. Pendiente ver la primera factura |
| IA del chat | Groq | Bien. Centavos por conversación |
| Publicación | GitHub Actions | Bien: verifica antes de publicar |
| Control del vendedor | GitHub Actions | Automático, semanal |

**Lo que falta**
- **Copia de seguridad.** No verifiqué qué plan de Supabase tenés; en el gratuito no hay copias descargables. Si la base se rompe, se pierden productos y pedidos.
- **Aviso de caída.** Hay un chequeo de salud una vez por semana. Si el sitio se cae un martes, nadie se entera hasta el lunes.
- **Registro de errores.** Si algo falla en producción, queda en los registros de Netlify y nadie lo mira.

---

## 5. Qué agregaría, en orden

**Imprescindible**
1. Cargar el número del dueño para que le llegue cada pedido.
2. Copia de seguridad automática semanal de la base.
3. Aviso automático si el sitio se cae.
4. Cargar descripciones y revisar la foto del punto 4.1.

**Muy útil**
5. **Aumento masivo de precios** por categoría o marca, con vista previa antes de aplicar.
6. **Resumen de ventas** en el Dashboard: hoy, semana, mes y productos más vendidos.
7. **"Seguí tu pedido"**: una página donde se ingresa el número, con el recorrido completo.
8. **Buscador que encuentre más**: por categoría y descripción, tolerante a errores de tipeo.
9. **Recordar los datos del cliente** en su dispositivo y botón de "repetir pedido".
10. **Selector de barrio** de CABA en el checkout, en vez de texto libre.
11. Vencimiento y recordatorio de pedidos por transferencia impagos.
12. Aviso al dueño cuando un producto queda con poco stock.
13. Buscador y filtros en el panel.

**Más adelante**
14. Medición de visitas.
15. Dominio propio.
16. Migración a Next.js 15 o 16.
17. Imprimir pedido y exportar a planilla.
18. "Avisame cuando vuelva" en productos sin stock.
19. Segundo usuario para el panel.

---

## 6. Qué sacaría

- **Las garantías repetidas.** "Envío gratis", "Compra segura", "Atención personalizada" y "Productos 100% originales" aparecen tres veces en una misma página (portada, ficha y pie).
- **El doble menú de categorías** en la página de productos: está en la barra de arriba y otra vez como botones debajo.
- **Los restos de sistemas viejos** en el código: Typebot, n8n y el camino alternativo del chat. No se usan y complican el mantenimiento. MercadoPago lo dejaría, porque puede volver.
- **Archivos sueltos en la raíz del proyecto:** cinco documentos de diseño viejos, tres generadores de n8n y Typebot, un video, dos accesos directos. No afectan al sitio, pero confunden.
- **Las categorías "Ropa" y "Juguetes"**, que existen vacías. No molestan (no se muestran), pero si no van a usarse pronto se pueden borrar.

---

## 7. Qué necesito de vos

1. **El número de WhatsApp de la tienda** que tiene que recibir los pedidos.
2. Confirmar si **"Old Prince Premium Gatos 1 KG" es para gatitos**.
3. Si ya **cambiaste la contraseña** del panel.
4. Qué hacer con los **tres pedidos de prueba** (ver abajo).

---

## 8. Datos de prueba que quedaron

- **Tres pedidos cancelados** a nombre de "PRUEBA Auditoria …": `MKP-20261012-VEG5R5DW`, `MKP-20261012-AXQBGZ6W` y `MKP-20261012-ZZ2GH98Q`. No los borré: borrar pedidos es definitivo y prefiero que lo decidas vos.
- El **stock quedó igual que antes** de empezar (verificado producto por producto).
- El producto ficticio, su foto y la categoría de prueba **ya están borrados**.
