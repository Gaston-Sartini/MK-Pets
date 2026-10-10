# WhatsApp en producción (Evolution API en un VPS)

El sitio manda los WhatsApp llamando a Evolution API. En tu PC corre en
`localhost:8085`; para producción tiene que estar en un servidor prendido 24/7
con HTTPS, porque Netlify le pega desde internet.

## Qué número vincular

El número que escanea el QR es **el remitente** de todos los avisos. Conviene
que sea el WhatsApp de la tienda (el mismo que figura en el sitio), no uno
personal: los clientes van a responder a ese chat.

Evolution API no es la API oficial de WhatsApp. Para avisos a clientes que
acaban de comprar el riesgo de bloqueo es bajo, pero existe: no lo uses para
mandar promociones masivas.

## 1. Contratar el VPS

Cualquier VPS con **2 GB de RAM o más**, Ubuntu 24.04 y una IP pública.
Referencia de precio: USD 5–8 por mes.

Al crearlo, elegí "SSH key" como forma de acceso si el proveedor lo ofrece.

## 2. Apuntar un subdominio

En el DNS del dominio, creá un registro **A**:

| Nombre | Tipo | Valor |
|---|---|---|
| `wa` | A | la IP del VPS |

Queda `wa.mk-pets.com.ar`. Sin dominio propio no hay HTTPS automático; en ese
caso usá un subdominio gratuito tipo `mkpets-wa.duckdns.org`.

## 3. Instalar Docker en el VPS

```bash
ssh root@LA_IP_DEL_VPS
```

```bash
curl -fsSL https://get.docker.com | sh
```

Cerrá todo menos SSH y web:

```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Levantar Evolution

Copiá `docker-compose.yml` de esta carpeta al VPS (por ejemplo a `/opt/mkpets-wa/`)
y creá al lado un archivo `.env`:

```bash
mkdir -p /opt/mkpets-wa && cd /opt/mkpets-wa
```

```bash
cat > .env <<EOF
WA_DOMAIN=wa.mk-pets.com.ar
EVOLUTION_API_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
EOF
cat .env
```

Guardá el valor de `EVOLUTION_API_KEY`: lo vas a cargar en Netlify.

```bash
docker compose up -d
```

A los dos minutos, `https://wa.mk-pets.com.ar` tiene que responder con un JSON
de bienvenida de Evolution.

## 5. Crear la instancia y vincular el teléfono

En el VPS:

```bash
source .env && curl -s -X POST "https://$WA_DOMAIN/instance/create" -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" -d '{"instanceName":"mi-bot","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

Después, **en tu PC**, desde la raíz del repo (PowerShell):

```powershell
$env:EVOLUTION_API_URL="https://wa.mk-pets.com.ar"; $env:EVOLUTION_API_KEY="LA_KEY_DEL_PASO_4"; node infra/evolution/qr-server.mjs
```

Abrí <http://localhost:8099> y escaneá el QR desde WhatsApp → Dispositivos
vinculados. La página avisa cuando queda conectado.

## 6. Conectar el sitio

En Netlify → Site configuration → Environment variables:

| Variable | Valor |
|---|---|
| `EVOLUTION_API_URL` | `https://wa.mk-pets.com.ar` |
| `EVOLUTION_API_KEY` | la del paso 4 |
| `EVOLUTION_INSTANCE` | `mi-bot` |
| `TRANSFER_ALIAS` | el alias para transferencias |
| `OWNER_WHATSAPP` | número que recibe el aviso de cada pedido (formato `549...`) |

Volvé a desplegar el sitio y hacé un pedido de prueba con tu propio teléfono.

## Mantenimiento

- **Si el teléfono pasa ~14 días sin conexión**, WhatsApp desvincula el
  dispositivo. Se arregla repitiendo el paso 5 (solo la parte del QR).
- Ver el estado: `curl -s https://wa.mk-pets.com.ar/instance/connectionState/mi-bot -H "apikey: ..."`.
  Tiene que decir `"state":"open"`.
- Logs: `docker compose logs -f evolution`.
- Actualizar el sistema del VPS cada tanto: `apt update && apt upgrade -y`.
