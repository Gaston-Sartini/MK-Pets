#!/bin/bash
# Vigilante de WhatsApp (MK-Pets). Corre en la máquina de Google Cloud cada 5 minutos.
#
# Por qué existe: en octubre de 2026 la conexión de Evolution con WhatsApp se
# cortó por dentro y Evolution siguió diciendo "open". Todos los envíos
# respondían "Connection Closed" y nadie se enteró durante días. Reiniciar el
# contenedor la recupera (la sesión vinculada queda guardada).
#
# Qué hace: pregunta si un número inventado tiene WhatsApp. Esa consulta no le
# manda nada a nadie, pero necesita la conexión viva. Si da "Connection Closed"
# dos veces seguidas, reinicia el contenedor de Evolution. Si la sesión quedó
# desvinculada (state distinto de "open"), no reinicia: hay que escanear el QR.
#
# Lo instala gcp-bootstrap.sh (en cada arranque). Registro: /var/log/mkpets-watchdog.log
set -uo pipefail

DIR=/opt/mkpets-wa
STATE=/var/lib/mkpets-watchdog-fails
LOG=/var/log/mkpets-watchdog.log
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

# shellcheck disable=SC1091
set -a; . "$DIR/.env"; set +a
URL="https://${WA_DOMAIN}"
INSTANCE="${EVOLUTION_INSTANCE:-mi-bot}"

state=$(curl -s -m 15 -H "apikey: $EVOLUTION_API_KEY" "$URL/instance/connectionState/$INSTANCE" | grep -o '"state":"[a-z]*"' | cut -d'"' -f4)
if [ "$state" != "open" ]; then
  # Desvinculada o servidor caído: un reinicio no arregla una sesión cerrada, y
  # si el contenedor no responde Docker ya lo reinicia solo (restart: unless-stopped).
  log "estado: ${state:-sin respuesta} (no se reinicia)"
  exit 0
fi

probe="54911$(printf '%08d' $((RANDOM * 32768 + RANDOM)) | cut -c1-8)"
answer=$(curl -s -m 20 -X POST -H "apikey: $EVOLUTION_API_KEY" -H 'content-type: application/json' \
  -d "{\"numbers\":[\"$probe\"]}" "$URL/chat/whatsappNumbers/$INSTANCE")

if echo "$answer" | grep -q 'Connection Closed'; then
  fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
  echo "$fails" > "$STATE"
  log "conexión caída (falla $fails)"
  if [ "$fails" -ge 2 ]; then
    log "reiniciando Evolution"
    docker compose -f "$DIR/docker-compose.gcp.yml" restart evolution >> "$LOG" 2>&1
    echo 0 > "$STATE"
  fi
else
  echo 0 > "$STATE"
fi

# Que el registro no crezca para siempre
tail -n 500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
