// Crea en Supabase un usuario y un schema exclusivos para Evolution API, y deja
// las credenciales en infra/evolution/.env (ignorado por git). No imprime secretos.
//
// Reversible:  drop schema evolution cascade;  drop role evolution_app;
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const ROOT = 'D:/MK-Pets'
const REF = 'ctttonxivmozsqegzotb'
const ENV_FILE = path.join(ROOT, 'infra/evolution/.env')

const local = {}
fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^([A-Z_0-9]+)="?([^"]*)"?\s*$/)
  if (m) local[m[1]] = m[2]
})

const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'))

;(async () => {
  const admin = new PrismaClient({ datasources: { db: { url: local.DATABASE_URL } } })
  const dbPassword = crypto.randomBytes(24).toString('hex')   // solo [0-9a-f]: seguro en SQL y en URLs
  const apiKey     = crypto.randomBytes(32).toString('hex')

  const exists = await admin.$queryRawUnsafe(`select 1 from pg_roles where rolname = 'evolution_app'`)
  if (exists.length) {
    await admin.$executeRawUnsafe(`alter role evolution_app with login password '${dbPassword}'`)
    console.log('rol evolution_app ya existía: contraseña rotada')
  } else {
    await admin.$executeRawUnsafe(`create role evolution_app with login password '${dbPassword}'`)
    console.log('rol evolution_app creado')
  }
  // postgres tiene que poder administrar (y borrar) lo que cree este rol
  await admin.$executeRawUnsafe(`grant evolution_app to postgres`)
  await admin.$executeRawUnsafe(`create schema if not exists evolution authorization evolution_app`)
  // Sin acceso a los datos de la tienda
  await admin.$executeRawUnsafe(`revoke all on schema public from evolution_app`)
  console.log('schema evolution listo')
  await admin.$disconnect()

  const dbUrl = `postgresql://evolution_app.${REF}:${dbPassword}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?schema=evolution&connection_limit=3`

  // Probar que el usuario nuevo entra por el pooler y que NO ve los pedidos
  const app = new PrismaClient({ datasources: { db: { url: dbUrl } } })
  const who = await app.$queryRawUnsafe(`select current_user as u, current_schema() as s`)
  console.log('conexión por pooler OK →', who[0].u, '/', who[0].s)
  try {
    await app.$queryRawUnsafe(`select count(*) from public."Order"`)
    console.log('⚠ el rol PUEDE leer public."Order" — revisar')
  } catch (e) {
    console.log('aislamiento OK: no puede leer los pedidos (' + String(e.message).split('\n').pop().trim().slice(0, 60) + ')')
  }
  await app.$disconnect()

  const previous = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : ''
  const keepKey = (previous.match(/^EVOLUTION_API_KEY=(.+)$/m) || [])[1]
  fs.writeFileSync(ENV_FILE, [
    '# Credenciales de Evolution API para Google Cloud. NO subir a git.',
    '# Generado por setup-evolution-db: copiar este archivo tal cual a la VM.',
    'WA_DOMAIN=CAMBIAR-por-tu-subdominio.duckdns.org',
    `EVOLUTION_API_KEY=${keepKey || apiKey}`,
    `EVOLUTION_DATABASE_URL=${dbUrl}`,
    '',
  ].join('\n'))
  console.log('credenciales guardadas en infra/evolution/.env')
})().catch(e => { console.error('ERROR', String(e.message).slice(0, 300)); process.exit(1) })
