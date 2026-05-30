#!/bin/bash
# ══════════════════════════════════════════════════════════════════
#  setup-hetzner.sh — Prepara el servidor Hetzner para MAGNO
#  Ejecutar como root en un VPS Debian/Ubuntu limpio.
#  Uso: bash scripts/setup-hetzner.sh TU_DOMINIO.COM tu@email.com
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

DOMINIO="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMINIO" || -z "$EMAIL" ]]; then
  echo "Uso: bash setup-hetzner.sh TU_DOMINIO.COM tu@email.com"
  exit 1
fi

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│   MAGNO — Setup Hetzner                      │"
echo "│   Dominio : $DOMINIO"
echo "│   Email   : $EMAIL"
echo "└──────────────────────────────────────────────┘"
echo ""

# ── 1. Sistema ────────────────────────────────────────────────────
echo "[1/6] Actualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw

# ── 2. Docker ─────────────────────────────────────────────────────
echo "[2/6] Instalando Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Habilitar Docker sin sudo (requiere re-login para aplicar)
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "$SUDO_USER"
fi

# Asegurar que docker compose (plugin) esté disponible
docker compose version >/dev/null 2>&1 || {
  apt-get install -y -qq docker-compose-plugin
}

# ── 3. Firewall ───────────────────────────────────────────────────
echo "[3/6] Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable

# ── 4. Directorio de la app ───────────────────────────────────────
echo "[4/6] Preparando /opt/magno..."
mkdir -p /opt/magno
# Si el repo ya está clonado en otro lado, puedes omitir esto.
# git clone https://github.com/TU_ORG/magno-sistema.git /opt/magno

# ── 5. Certbot (SSL Let's Encrypt) ───────────────────────────────
echo "[5/6] Instalando certbot y obteniendo certificados..."
apt-get install -y -qq certbot

# Obtener cert en modo standalone (puerto 80 debe estar libre)
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMINIO"

# Copiar certs a la carpeta que monta docker-compose
CERT_SRC="/etc/letsencrypt/live/$DOMINIO"
CERT_DST="/opt/magno/nginx/ssl"
mkdir -p "$CERT_DST"
cp "$CERT_SRC/fullchain.pem" "$CERT_DST/fullchain.pem"
cp "$CERT_SRC/privkey.pem"   "$CERT_DST/privkey.pem"
chmod 600 "$CERT_DST"/*.pem

# Renovación automática (copia los certs después de renovar)
cat > /etc/cron.d/magno-certbot <<EOF
0 3 * * * root certbot renew --quiet && \
  cp /etc/letsencrypt/live/$DOMINIO/fullchain.pem $CERT_DST/fullchain.pem && \
  cp /etc/letsencrypt/live/$DOMINIO/privkey.pem   $CERT_DST/privkey.pem && \
  docker exec magno-nginx nginx -s reload
EOF

echo "[6/6] ¡Servidor listo!"
echo ""
echo "Próximos pasos:"
echo "  1. Sube tu código a /opt/magno  (git clone o scp)"
echo "  2. cd /opt/magno"
echo "  3. cp .env.example .env  →  edita .env con tus valores reales"
echo "  4. Edita nginx/nginx.conf y cambia TU_DOMINIO_AQUI por: $DOMINIO"
echo "  5. docker compose up -d --build"
echo "  6. docker compose logs -f   (verifica que todo arranque)"
echo ""
echo "IP del servidor: $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
