#!/bin/bash
# Arranque de la máquina de Google Cloud para Evolution API (MK-Pets).
# Corre como root en cada inicio (startup-script) y es idempotente.
#
#   1. Memoria de intercambio (la e2-micro tiene 1 GB) y Docker.
#   2. Baja docker-compose.gcp.yml del repo.
#   3. Si todavía no hay credenciales (.env), abre un receptor de un solo uso:
#      acepta UN archivo por HTTPS, protegido por un token que está en los
#      metadatos de la instancia, y se cierra. Así las credenciales viajan
#      cifradas desde la PC y no hay que pegarlas a mano en ninguna terminal.
#   4. Levanta Evolution detrás de Caddy (HTTPS automático).
#
# El dominio es <ip-con-guiones>.sslip.io: resuelve solo a la IP de la máquina,
# sin registrar nada. Cuando haya dominio propio, se cambia WA_DOMAIN en .env.
set -euo pipefail

DIR=/opt/mkpets-wa
REPO_RAW=https://raw.githubusercontent.com/Gaston-Sartini/MK-Pets/main/infra/evolution
META=http://metadata.google.internal/computeMetadata/v1/instance
log() { echo "[mkpets-bootstrap] $*"; }

mkdir -p "$DIR" && cd "$DIR"

if [ ! -f /swapfile ]; then
  log "creando swap de 1 GB"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  log "instalando Docker"
  curl -fsSL https://get.docker.com | sh >/dev/null
fi

curl -fsSLo docker-compose.gcp.yml "$REPO_RAW/docker-compose.gcp.yml"

IP=$(curl -fsS -H 'Metadata-Flavor: Google' "$META/network-interfaces/0/access-configs/0/external-ip")
DOMAIN="${IP//./-}.sslip.io"
log "dominio: $DOMAIN"

if [ ! -f .env ]; then
  TOKEN=$(curl -fsS -H 'Metadata-Flavor: Google' "$META/attributes/mkpets-upload-token" || true)
  if [ -z "$TOKEN" ]; then
    log "falta .env y no hay token de subida en los metadatos: no se puede continuar"
    exit 1
  fi

  log "esperando el archivo de credenciales en https://$DOMAIN/upload (un solo uso)"
  cat > /tmp/mkpets-receiver.py <<'PY'
import http.server, os, sys, threading

TOKEN, TARGET = os.environ["TOKEN"], os.environ["TARGET"]

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, text):
        self.send_response(code)
        self.end_headers()
        self.wfile.write(text.encode())

    def do_PUT(self):
        length = int(self.headers.get("content-length", "0"))
        if self.path != "/upload" or self.headers.get("x-token") != TOKEN:
            return self.reply(403, "no\n")
        if not 0 < length < 20000:
            return self.reply(400, "tamaño inválido\n")
        data = self.rfile.read(length)
        fd = os.open(TARGET, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.write(fd, data)
        os.close(fd)
        self.reply(200, "recibido\n")
        threading.Thread(target=self.server.shutdown, daemon=True).start()

http.server.HTTPServer(("127.0.0.1", 9000), Handler).serve_forever()
PY

  docker rm -f mkpets-upload-proxy >/dev/null 2>&1 || true
  docker run -d --name mkpets-upload-proxy --network host -v mkpets-wa_caddy_data:/data caddy:2-alpine \
    caddy reverse-proxy --from "$DOMAIN" --to 127.0.0.1:9000 >/dev/null
  TOKEN="$TOKEN" TARGET="$DIR/.env" python3 /tmp/mkpets-receiver.py
  docker rm -f mkpets-upload-proxy >/dev/null
  rm -f /tmp/mkpets-receiver.py
  log "credenciales recibidas"
fi

# El dominio depende de la IP de esta máquina, no del valor que traiga el archivo
sed -i '/^WA_DOMAIN=/d' .env
echo "WA_DOMAIN=$DOMAIN" >> .env
chmod 600 .env

log "levantando Evolution"
docker compose -f docker-compose.gcp.yml up -d
log "listo: https://$DOMAIN"
