# WhatsApp gratis en Google Cloud (máquina `e2-micro`)

Alternativa sin costo al VPS pago de [README.md](README.md). Usa la máquina
gratuita permanente de Google Cloud, que tiene solo 1 GB de RAM; por eso corre
una versión liviana de Evolution (`docker-compose.gcp.yml`):

- **Sin base propia:** guarda sus datos en tu Supabase, en un schema aparte
  (`evolution`) con un usuario propio (`evolution_app`) que no puede leer los
  pedidos ni nada de la tienda.
- **Sin Redis.**

Probado en local con el mismo límite de memoria: usa ~170 MB con la instancia
creada. **No está probado en Google Cloud en sí**, ni cuánto termina cobrando
Google (ver "Costo").

Lo que ya está hecho: el usuario y el schema en Supabase, las tablas de
Evolution migradas, y el archivo `infra/evolution/.env` en tu PC con las
credenciales (no se sube a git).

## Costo: qué mirar

- La máquina `e2-micro`, 30 GB de disco **estándar** y 1 GB de tráfico saliente
  por mes son gratis sin fecha de fin, **solo en** `us-west1`, `us-central1` o
  `us-east1`.
- **Duda abierta:** Google cobra aparte la IP pública en las máquinas comunes
  (unos USD 3–4 por mes) y su documentación no aclara si la gratuita queda
  exenta. Se ve en la primera factura. Por eso el paso 1 es la alerta.
- Si la cuenta es nueva, Google da 90 días de prueba con crédito. Al terminar
  pide "activar" la cuenta; hay que hacerlo para que la máquina siga prendida.
  Lo gratuito sigue siendo gratuito.

## 1. Cuenta y alerta de gasto

1. Entrá a <https://console.cloud.google.com>, creá la cuenta (pide tarjeta) y
   un proyecto, por ejemplo `mkpets`.
2. **Facturación → Presupuestos y alertas → Crear presupuesto:** importe
   USD 1, con aviso por mail al 50 % y al 100 %.

## 2. Crear la máquina

Arriba a la derecha, abrí **Cloud Shell** (el ícono `>_`) y pegá:

```bash
gcloud services enable compute.googleapis.com
```

```bash
gcloud compute instances create mkpets-wa --zone=us-central1-a --machine-type=e2-micro --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud --boot-disk-size=30GB --boot-disk-type=pd-standard --tags=mkpets-web
```

```bash
gcloud compute firewall-rules create mkpets-web --allow=tcp:80,tcp:443 --target-tags=mkpets-web
```

Al terminar muestra la **EXTERNAL_IP**. Anotala.

Los tres valores que hacen que sea gratis son `e2-micro`, `us-central1-a` y
`pd-standard`. Si la creás desde los menús, el disco por defecto es otro y se cobra.

## 3. Un nombre para la máquina

Netlify necesita llegar por HTTPS, y para eso hace falta un nombre de dominio.
Gratis, con DuckDNS:

1. Entrá a <https://www.duckdns.org> con tu cuenta de Google.
2. Creá un subdominio, por ejemplo `mkpets-wa`, y poné la IP del paso 2.

Queda `mkpets-wa.duckdns.org`. Cuando exista el dominio de la tienda se cambia
por `wa.mk-pets.com.ar`.

La IP puede cambiar si alguna vez **apagás** la máquina (no si la reiniciás).
Si pasa, actualizala en DuckDNS.

## 4. Preparar la máquina

En Cloud Shell:

```bash
gcloud compute ssh mkpets-wa --zone=us-central1-a
```

Ya adentro de la máquina, memoria de intercambio (red de seguridad para 1 GB):

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

## 5. Levantar Evolution

```bash
mkdir -p ~/mkpets-wa && cd ~/mkpets-wa && curl -fsSLO https://raw.githubusercontent.com/Gaston-Sartini/MK-Pets/main/infra/evolution/docker-compose.gcp.yml
```

Creá el archivo de credenciales:

```bash
nano .env
```

Pegá el contenido de `D:\MK-Pets\infra\evolution\.env` de tu PC, cambiá la
línea `WA_DOMAIN=` por tu subdominio (`WA_DOMAIN=mkpets-wa.duckdns.org`),
guardá con `Ctrl+O`, `Enter`, y salí con `Ctrl+X`.

```bash
sudo docker compose -f docker-compose.gcp.yml up -d
```

En un par de minutos, `https://mkpets-wa.duckdns.org` tiene que responder con
el mensaje de bienvenida de Evolution.

## 6. Vincular el teléfono

En tu PC, desde `D:\MK-Pets` (PowerShell):

```powershell
$env:EVOLUTION_API_URL="https://mkpets-wa.duckdns.org"; node --env-file=infra/evolution/.env infra/evolution/qr-server.mjs
```

Abrí <http://localhost:8099> y escaneá el QR desde WhatsApp → Dispositivos
vinculados. La instancia `mi-bot` ya está creada.

El número que escanea es el remitente de los avisos: conviene el de la tienda.

## 7. Conectar el sitio

En `D:\MK-Pets`, con el valor de `EVOLUTION_API_KEY` de `infra/evolution/.env`:

```bash
netlify env:set EVOLUTION_API_URL "https://mkpets-wa.duckdns.org"
```

```bash
netlify env:set EVOLUTION_API_KEY "PEGAR_LA_KEY"
```

```bash
netlify env:set EVOLUTION_INSTANCE "mi-bot"
```

Y volver a desplegar para que el sitio tome las variables:

```bash
gh workflow run Deploy
```

Después, un pedido de prueba en el sitio con tu propio teléfono.

## Si no funciona: cómo volver atrás

Nada de esto toca la tienda. El sitio funciona igual con o sin WhatsApp: sin
las variables `EVOLUTION_*`, simplemente no manda avisos.

1. **Desconectar el sitio:**

   ```bash
   netlify env:unset EVOLUTION_API_URL
   ```

   y volver a desplegar con `gh workflow run Deploy`.

2. **Borrar la máquina** (corta cualquier costo):

   ```bash
   gcloud compute instances delete mkpets-wa --zone=us-central1-a
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
`docker-compose.gcp.yml` y el mismo `.env` a la máquina nueva, se apunta el
dominio a su IP y se levanta. Los datos de la instancia están en Supabase, así
que la sesión de WhatsApp debería conservarse; si no, se repite el paso 6.

## Mantenimiento

- Estado: `curl -s https://mkpets-wa.duckdns.org/instance/connectionState/mi-bot -H "apikey: ..."`
  tiene que decir `"state":"open"`.
- Memoria: `sudo docker stats --no-stream`.
- Logs: `sudo docker compose -f docker-compose.gcp.yml logs -f evolution`.
- Si el teléfono pasa ~14 días sin conexión, WhatsApp desvincula el
  dispositivo: se repite el paso 6.
