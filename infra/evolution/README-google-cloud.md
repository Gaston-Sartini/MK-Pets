# WhatsApp gratis en Google Cloud (máquina `e2-micro`)

Alternativa sin costo al VPS pago de [README.md](README.md). **Es lo que está
en producción desde el 2026-10-11.**

Usa la máquina gratuita permanente de Google Cloud, que tiene solo 1 GB de RAM;
por eso corre una versión liviana de Evolution (`docker-compose.gcp.yml`):

- **Sin base propia:** guarda sus datos en Supabase, en un schema aparte
  (`evolution`) con un usuario propio (`evolution_app`) que no puede leer los
  pedidos ni nada de la tienda.
- **Sin Redis.**

## Qué hay desplegado

| | |
|---|---|
| Proyecto de Google Cloud | `mkpets-wa` |
| Máquina | `mkpets-wa`, `e2-micro`, zona `us-central1-a`, disco `pd-standard` de 30 GB |
| IP (fija) | `35.254.138.207` |
| Dirección de Evolution | `https://35-254-138-207.sslip.io` |
| Instancia de WhatsApp | `mi-bot` |
| Alerta de gasto | presupuesto de USD 1 en la cuenta de facturación |
| Credenciales | `infra/evolution/.env` en la PC (no se sube a git) y `/opt/mkpets-wa/.env` en la máquina |

El dominio `<ip-con-guiones>.sslip.io` resuelve solo a la IP, sin registrar
nada. Cuando exista el dominio de la tienda se puede pasar a
`wa.mk-pets.com.ar` cambiando `WA_DOMAIN` en el `.env` de la máquina.

En Netlify están cargadas `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` y
`EVOLUTION_INSTANCE`.

## Costo: qué mirar

- La máquina `e2-micro`, 30 GB de disco **estándar** y 1 GB de tráfico saliente
  por mes son gratis sin fecha de fin, **solo en** `us-west1`, `us-central1` o
  `us-east1`.
- **Duda abierta:** Google cobra aparte la IP pública en las máquinas comunes
  (unos USD 3–4 por mes) y su documentación no aclara si la gratuita queda
  exenta. Se ve en la primera factura; la alerta de USD 1 avisa por mail.
  Si la cobran, conviene mudarse a un VPS pago (ver al final).

## Lo que se aprendió al montarlo

- **Memoria:** ~170 MB recién arrancado, ~250 MB con la sesión activa. Entra
  cómodo en 1 GB.
- **La sesión sobrevive a los reinicios de la misma máquina** (las claves
  quedan en su disco).
- **La sesión NO se muda a otra máquina.** En una prueba volvió sola con el
  disco vacío; al hacerlo de nuevo, WhatsApp la dio de baja (código 401). Al
  cambiar de máquina hay que contar con escanear el QR otra vez.
- **Vincular solo funciona sobre una instancia limpia.** Si la instancia
  arrastra datos de una sesión anterior (aunque esté cerrada), el teléfono
  responde "No se pudo vincular el dispositivo". Pasó dos veces. La solución es
  borrar la instancia y crearla de nuevo antes de escanear (ver abajo).
- Crear un pedido tarda unos segundos más cuando el WhatsApp va con imagen,
  porque el sitio espera a que el aviso salga.

## Volver a vincular el teléfono

Hace falta si WhatsApp cierra la sesión (el teléfono pasó ~14 días sin
conexión, o se cerró desde "Dispositivos vinculados") o para cambiar de número.

1. Borrar la instancia y crear una limpia. En PowerShell, desde `D:\MK-Pets`:

   ```powershell
   $env:EVOLUTION_API_URL="https://35-254-138-207.sslip.io"; node --env-file=infra/evolution/.env infra/evolution/reset-instance.mjs
   ```

2. Mostrar el QR:

   ```powershell
   $env:EVOLUTION_API_URL="https://35-254-138-207.sslip.io"; node --env-file=infra/evolution/.env infra/evolution/qr-server.mjs
   ```

3. Abrir <http://localhost:8099> y escanear desde WhatsApp → Dispositivos
   vinculados. La página avisa cuando queda conectado.

El número que escanea es el remitente de los avisos.

## Cómo se creó (para repetirlo)

Todo desde Cloud Shell (`>_` en la consola de Google Cloud), con el proyecto ya
creado y con facturación:

```bash
gcloud services enable compute.googleapis.com
```

```bash
TOKEN=$(openssl rand -hex 16); gcloud compute instances create mkpets-wa --zone=us-central1-a --machine-type=e2-micro --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud --boot-disk-size=30GB --boot-disk-type=pd-standard --tags=mkpets-web --metadata=mkpets-upload-token=$TOKEN,startup-script='curl -fsSL https://raw.githubusercontent.com/Gaston-Sartini/MK-Pets/main/infra/evolution/gcp-bootstrap.sh | bash'; echo TOKEN=$TOKEN
```

```bash
gcloud compute firewall-rules create mkpets-web --allow=tcp:80,tcp:443 --target-tags=mkpets-web
```

Los tres valores que hacen que sea gratis son `e2-micro`, `us-central1-a` y
`pd-standard`. Desde los menús, el disco por defecto es otro y se cobra.

La máquina se configura sola con [gcp-bootstrap.sh](gcp-bootstrap.sh) (swap,
Docker, compose) y queda esperando el archivo de credenciales. Se le manda desde
la PC, una sola vez, con la IP y el token que mostró el comando:

```bash
curl -T infra/evolution/.env "https://LA-IP-CON-GUIONES.sslip.io/upload" -H "x-token: EL_TOKEN"
```

Después conviene fijar la IP y borrar el token:

```bash
gcloud compute addresses create mkpets-wa-ip --region=us-central1 --addresses=LA_IP
```

```bash
gcloud compute instances remove-metadata mkpets-wa --zone=us-central1-a --keys=mkpets-upload-token
```

## Si no funciona: cómo volver atrás

Nada de esto toca la tienda. Sin las variables `EVOLUTION_*`, el sitio funciona
igual y simplemente no manda avisos.

1. **Desconectar el sitio:**

   ```bash
   netlify env:unset EVOLUTION_API_URL
   ```

   y volver a desplegar con `gh workflow run Deploy`.

2. **Borrar la máquina y su IP** (corta cualquier costo):

   ```bash
   gcloud compute instances delete mkpets-wa --zone=us-central1-a
   ```

   ```bash
   gcloud compute addresses delete mkpets-wa-ip --region=us-central1
   ```

   ```bash
   gcloud compute firewall-rules delete mkpets-web
   ```

3. **Desvincular el teléfono:** WhatsApp → Dispositivos vinculados → tocar el
   dispositivo → Cerrar sesión.

4. **Borrar los datos de Evolution en Supabase** (SQL Editor). Solo si no vas a
   usar más esta variante:

   ```sql
   drop schema evolution cascade;
   drop role evolution_app;
   ```

**Para pasar a un VPS pago** no hace falta el paso 4: se copia el mismo
`docker-compose.gcp.yml` y el mismo `.env` a la máquina nueva, se cambia
`WA_DOMAIN`, se levanta, y se vuelve a vincular el teléfono (sección de arriba).
Apagá la máquina vieja antes: la misma sesión en dos lugares hace que WhatsApp
las desconecte.

## Mantenimiento

- Estado: `curl -s https://35-254-138-207.sslip.io/instance/connectionState/mi-bot -H "apikey: ..."`
  tiene que decir `"state":"open"`.
- Entrar a la máquina: desde Cloud Shell, `gcloud compute ssh mkpets-wa --zone=us-central1-a`.
  Los archivos están en `/opt/mkpets-wa`.
- Memoria: `sudo docker stats --no-stream`.
- Logs: `sudo docker compose -f /opt/mkpets-wa/docker-compose.gcp.yml logs -f evolution`.
- No levantes la misma instancia en la PC y en la nube a la vez.

## Si WhatsApp no envía

Evolution puede decir `"state":"open"` con la conexión a WhatsApp muerta por
dentro: todos los envíos responden `Connection Closed` (pasó en octubre de 2026 y
los avisos no salieron durante días). Hay tres defensas:

1. **Vigilante en la máquina** (`watchdog.sh`, cada 5 minutos, lo instala
   `gcp-bootstrap.sh` en cada arranque): si la conexión está caída dos veces
   seguidas, reinicia el contenedor de Evolution. Registro en
   `/var/log/mkpets-watchdog.log`.
2. **Chequeo de GitHub** (`.github/workflows/whatsapp.yml`, cada 30 minutos):
   abre un aviso con la etiqueta `whatsapp` si no sale, y lo cierra cuando vuelve.
3. **Panel**: el Dashboard muestra si WhatsApp está conectado, y en Pedidos, si un
   aviso no sale, aparece el mensaje listo para mandarlo a mano.

Arreglo a mano, desde Cloud Shell:

```bash
gcloud compute ssh mkpets-wa --zone=us-central1-a --command="sudo docker compose -f /opt/mkpets-wa/docker-compose.gcp.yml restart evolution"
```

Si después del reinicio la sesión queda en `close`, el teléfono se desvinculó:
hay que volver a escanear el QR (sección de vinculación, más arriba).
