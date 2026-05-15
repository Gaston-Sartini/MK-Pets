# GitHub Secrets requeridos

Configurar en: **Settings → Secrets and variables → Actions**

## Secrets (encriptados)

| Secret | Descripción |
|--------|-------------|
| `DATABASE_URL` | Transaction pooler Supabase (puerto 6543) |
| `DIRECT_URL` | Direct connection Supabase (puerto 5432) — para migrations |
| `MP_ACCESS_TOKEN` | MercadoPago access token (producción) |
| `MP_WEBHOOK_SECRET` | Secret del webhook en el panel de MercadoPago |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | MP public key (se expone al cliente, pero va como secret en CI) |
| `SESSION_SECRET` | 64-char hex — generado con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NETLIFY_AUTH_TOKEN` | Token de Netlify — Settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID` | ID del site en Netlify — Site settings → Site ID |

## Variables (visibles en logs)

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_BASE_URL` | `https://mk-pets.com.ar` |

## Environment: production

El workflow de deploy usa el environment `production` en GitHub.  
Configurar en: **Settings → Environments → production**

Recomendado: activar **Required reviewers** para que cada deploy a producción requiera aprobación manual.
