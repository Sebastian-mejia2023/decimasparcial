#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: ejecuta este instalador con sudo:"
    echo "sudo bash $0"
    exit 1
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$BASE_DIR/frontend/dist"
JAR_FILE="$BASE_DIR/backend/app.jar"
NGINX_CONF="$BASE_DIR/nginx-default.conf"
RUN_USER="${SUDO_USER:-root}"
RUN_GROUP="$(id -gn "$RUN_USER")"

echo "=============================================================="
echo " DESPLIEGUE AJEDREZ ICE - UBUNTU SERVER"
echo "=============================================================="
echo "Usuario que ejecutara el backend: $RUN_USER"

echo "[1/8] Verificando archivos del paquete..."
for f in "$FRONTEND_DIR/index.html" "$JAR_FILE" "$NGINX_CONF"; do
    if [[ ! -f "$f" ]]; then
        echo "ERROR: falta $f"
        exit 1
    fi
done

echo "[2/8] Verificando Nginx, curl y Java..."
export DEBIAN_FRONTEND=noninteractive

NEED_INSTALL=0
command -v nginx >/dev/null 2>&1 || NEED_INSTALL=1
command -v curl >/dev/null 2>&1 || NEED_INSTALL=1

if ! command -v java >/dev/null 2>&1; then
    JAVA_MAJOR=0
    NEED_INSTALL=1
else
    JAVA_MAJOR="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | cut -d. -f1)"
    [[ "${JAVA_MAJOR:-0}" -ge 17 ]] || NEED_INSTALL=1
fi

if [[ "$NEED_INSTALL" -eq 1 ]]; then
    apt-get update
    apt-get install -y nginx curl
    if [[ "${JAVA_MAJOR:-0}" -lt 17 ]]; then
        apt-get install -y openjdk-17-jre-headless || apt-get install -y openjdk-21-jre-headless
    fi
fi

if [[ -x /usr/lib/jvm/java-17-openjdk-amd64/bin/java ]]; then
    update-alternatives --set java /usr/lib/jvm/java-17-openjdk-amd64/bin/java || true
fi
java -version

echo "[3/8] Deteniendo backend anterior..."
pkill -f '[j]ava -jar app.jar' 2>/dev/null || true
sleep 1

echo "[4/8] Copiando frontend..."
install -d -m 755 /var/www/ajedrez
rm -rf /var/www/ajedrez/dist
cp -r "$FRONTEND_DIR" /var/www/ajedrez/dist
chown -R www-data:www-data /var/www/ajedrez
find /var/www/ajedrez -type d -exec chmod 755 {} \;
find /var/www/ajedrez -type f -exec chmod 644 {} \;

echo "[5/8] Copiando backend..."
install -d -m 755 /opt/ajedrez/backend
install -m 644 "$JAR_FILE" /opt/ajedrez/backend/app.jar
install -o "$RUN_USER" -g "$RUN_GROUP" -m 644 /dev/null /opt/ajedrez/backend/backend.log
chown -R "$RUN_USER":"$RUN_GROUP" /opt/ajedrez/backend

echo "[6/8] Configurando Nginx..."
if [[ -f /etc/nginx/sites-available/default ]]; then
    cp /etc/nginx/sites-available/default "/etc/nginx/sites-available/default.bak.$(date +%Y%m%d%H%M%S)"
fi
install -m 644 "$NGINX_CONF" /etc/nginx/sites-available/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[7/8] Iniciando backend con nohup..."
cd /opt/ajedrez/backend
if [[ "$RUN_USER" == "root" ]]; then
    nohup java -jar app.jar > backend.log 2>&1 &
else
    sudo -u "$RUN_USER" nohup java -jar app.jar > backend.log 2>&1 &
fi
sleep 5

if ! pgrep -f '[j]ava -jar app.jar' >/dev/null || ! grep -q 'Servidor escuchando' /opt/ajedrez/backend/backend.log; then
    echo "ERROR: el backend no arranco. Log:"
    tail -n 50 /opt/ajedrez/backend/backend.log || true
    exit 1
fi

BACKEND_PID="$(pgrep -f '[j]ava -jar app.jar' | head -n1)"
echo "$BACKEND_PID" > /opt/ajedrez/backend/backend.pid
chown "$RUN_USER":"$RUN_GROUP" /opt/ajedrez/backend/backend.pid

echo "[8/8] Verificando servicios..."
echo "Nginx: $(systemctl is-active nginx)"
echo "Java:"
pgrep -af '[j]ava -jar app.jar' || true
echo "Puertos:"
ss -ltnp | grep -E ':(80|10000|10002)\b' || true

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp
    ufw allow 10000/tcp
    ufw allow 10002/tcp
fi

echo "HTTP:"
curl -s -o /dev/null -w "index=%{http_code}\n" http://127.0.0.1/
curl -s -o /dev/null -w "css=%{http_code}\n" http://127.0.0.1/assets/css/styles.css
curl -s -o /dev/null -w "ice=%{http_code}\n" http://127.0.0.1/assets/js/Ice.min.js

echo "WebSocket via Nginx:"
curl -s -o /dev/null -w "websocket=%{http_code}\n" --http1.1 --max-time 3 \
    -H 'Connection: Upgrade' \
    -H 'Upgrade: websocket' \
    -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    http://127.0.0.1/ice || true

IP_VM="$(hostname -I | awk '{print $1}')"
echo "=============================================================="
echo " LISTO"
echo " En esta maquina: http://localhost"
echo " Desde otra maquina: http://${IP_VM}"
echo " Log: /opt/ajedrez/backend/backend.log"
echo "=============================================================="
