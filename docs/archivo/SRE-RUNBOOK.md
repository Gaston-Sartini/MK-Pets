# MK-Pets — SRE Runbook
**Versión**: 1.0 · **Fecha**: 2026-05-14

---

## 1. SLOs (Service Level Objectives)

| Servicio | SLI | Target (30 días) | Error budget/mes |
|---------|-----|-----------------|-----------------|
| **Sitio completo** | % requests con HTTP < 500 | **99.5%** | 3.6 horas |
| **Checkout** | % órdenes creadas sin error | **99.9%** | 43 minutos |
| **Webhook MP** | % webhooks procesados en < 5s | **99.0%** | 7.2 horas |
| **Home page** | LCP < 2.5s (p75) | **95%** | — |

> **Regla**: si el error budget del checkout cae bajo 30%, congelar features y priorizar estabilidad.

---

## 2. Monitoreo — UptimeRobot (free tier)

Configurar en https://uptimerobot.com :

| Monitor | URL | Tipo | Intervalo | Alert |
|---------|-----|------|-----------|-------|
| Home | `https://mk-pets.com.ar` | HTTP(s) | 5 min | Email + Telegram |
| Health API | `https://mk-pets.com.ar/api/health` | HTTP(s) keyword `"status":"ok"` | 5 min | Email |
| Checkout | `https://mk-pets.com.ar/checkout` | HTTP(s) | 5 min | Email |
| MP Webhook | `https://mk-pets.com.ar/api/webhooks/mercadopago` | HTTP(s) 405 expected | 15 min | Email |

**Keyword check** para `/api/health`: buscar `"status":"ok"` — falla si la DB cae aunque el servidor esté up.

---

## 3. Alertas por canal

```
UptimeRobot DOWN alert → Email (gaston.sartini@gmail.com)
UptimeRobot DOWN alert → Telegram bot (configurar en UptimeRobot settings)
```

Configurar el bot de Telegram:
1. Crear bot con @BotFather → obtener token
2. En UptimeRobot → My Settings → Alert Contacts → Telegram
3. Pegar el token y el chat ID

---

## 4. Métricas clave a monitorear

### En Netlify Analytics (plan gratuito)
- **Pageviews** por ruta — baseline para detectar anomalías de tráfico
- **Top 404s** — detecta broken links o bots escaneando rutas
- **Bandwidth** — alerta si supera el tier gratuito

### En Supabase Dashboard
- **DB connections** — alerta si supera 80% del límite del plan
- **Query latency** — alerta si p95 > 200ms
- **Storage** — alerta si supera 400MB (límite free: 500MB)

---

## 5. Playbooks de incidentes

### 🔴 Sitio caído (HTTP 5xx en home)

```
1. Verificar status de Netlify: https://www.netlifystatus.com
2. Verificar status de Supabase: https://status.supabase.com
3. Ver logs en Netlify → Functions → health
4. Revisar últimos deploys — ¿hubo deploy en los últimos 30 min?
5. Si sí: rollback desde Netlify UI → Deploys → [último bueno] → Publish deploy
```

### 🟠 Pedidos no se crean (POST /api/pedidos falla)

```
1. Verificar /api/health → si database: error → problema en Supabase
2. Ir a Supabase dashboard → verificar conexiones activas
3. Si hay connection pool exhaustion: pausar y resumir el proyecto en Supabase
4. Verificar variables de entorno en Netlify → no deben haber cambiado
```

### 🟠 Webhooks de MercadoPago no llegan

```
1. Verificar en panel MP: Tus integraciones → Webhooks → Ver intentos
2. Si los intentos existen pero fallan: revisar MP_WEBHOOK_SECRET en Netlify env vars
3. Testear manualmente: MP → Actividad → [pago] → Reenviar notificación
4. Verificar que la URL del webhook sea correcta: https://mk-pets.com.ar/api/webhooks/mercadopago
```

### 🟡 Performance degradada (LCP > 2.5s)

```
1. Verificar Supabase DB latency — si > 100ms: causa probable
2. Verificar si el cache ISR de Next.js se limpió (POST a /_next/revalidate si corresponde)
3. Revisar Netlify CDN cache hit rate
4. Correr Lighthouse desde PageSpeed Insights: https://pagespeed.web.dev/
```

---

## 6. Runbook de deploy

### Deploy normal (merge a main)
```
1. PR abierta → CI corre automáticamente (typecheck + lint + tests + build)
2. Preview de Netlify generada automáticamente
3. Merge aprobado → deploy automático a producción
4. Verificar /api/health post-deploy
5. Navegar home + producto + checkout para smoke test manual
```

### Rollback de emergencia
```
Netlify UI → Deploys → [deploy estable anterior] → Publish deploy
Tiempo estimado: 2 minutos
```

---

## 7. Error budget tracking (manual — mensual)

Al inicio de cada mes, registrar:
- Total de downtime (minutos)
- Total de errores en pedidos (contar en Supabase)
- ¿Se respetó el SLO? ¿Se gastó el error budget?
- Si no: ¿qué cambió? Documentar en este runbook.

---

*MK-Pets SRE Runbook — actualizar ante cada incidente post-mortem*
