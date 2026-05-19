# OpenWA — Gateway WhatsApp self-hosted

Servicio que envía mensajes WhatsApp para los OTP de JURMAQ. Corre en una VM aparte (Vercel serverless NO sirve porque WhatsApp Web requiere conexión persistente).

## Por qué OpenWA (y caveats)

| Pro | Contra |
|---|---|
| Gratis (sin costo mensual por mensaje) | Riesgo de **baneo del número WhatsApp** — viola TOS de WhatsApp técnicamente |
| Control total sobre el flujo | Self-host: hay que mantener una VM corriendo 24/7 |
| Sin onboarding de Meta Business | OpenWA puede romperse si WhatsApp actualiza su frontend |
| Send-recv (podríamos hacer chatbot futuro) | Para volumen alto conviene migrar a Cloud API oficial |

**Plan B**: el código tiene abstracción multi-provider. Si OpenWA falla / nos banean, swap a WhatsApp Cloud API (Meta) o Twilio for WhatsApp seteando `WHATSAPP_CLOUD_*` / `TWILIO_*` envs. El dispatcher detecta el más sano y rutea.

---

## Requisitos previos

1. **VM Linux** (Ubuntu 22.04+) con Docker + docker-compose instalados. Recomendado: Railway, DigitalOcean Droplet ($6/mes), o Hetzner Cloud ($5/mes). NO Vercel/Cloudflare Workers.
2. **Número WhatsApp dedicado** — comprar plan prepago en Entel/Movistar/WOM (~CLP 3,000/mes). **NO usar el número principal de JURMAQ** (+56976673577): si OpenWA es baneado, perdés el canal de soporte al cliente.
3. **DNS A record** apuntando `openwa.jurmaq.cl` → IP pública de la VM.
4. **Puerto 80 + 443** abiertos en la VM (Caddy auto-renueva certs Let's Encrypt).

---

## Setup paso a paso

### 1. Provisionar VM

```bash
# Ej. en DigitalOcean:
# 1. Crear Droplet Ubuntu 22.04, $6/mes (1GB RAM mínimo).
# 2. Setear A record openwa.jurmaq.cl → IP_DE_LA_DROPLET.
# 3. SSH a la VM y instalar Docker:
ssh root@IP_DE_LA_VM
apt update && apt install -y docker.io docker-compose-v2
```

### 2. Copiar archivos

```bash
# En la VM:
mkdir -p /opt/openwa && cd /opt/openwa
# Copiar docker-compose.yml + Caddyfile desde este repo (infra/openwa/).
# Por ejemplo, vía scp desde tu máquina local:
#   scp infra/openwa/docker-compose.yml root@IP:/opt/openwa/
#   scp infra/openwa/Caddyfile          root@IP:/opt/openwa/
```

### 3. Crear `.env`

```bash
# En la VM, /opt/openwa/.env:
OPENWA_SESSION=jurmaq
OPENWA_API_KEY=<openssl rand -base64 48>     # GUARDAR ESTE VALOR
```

### 4. Levantar el servicio

```bash
docker compose up -d
docker compose logs -f openwa
```

El primer arranque imprime un **QR code en los logs**. Escanealo con el WhatsApp del número dedicado:

1. Abrir WhatsApp en el celular.
2. Configuración → Dispositivos vinculados → Vincular un dispositivo.
3. Apuntar la cámara al QR en la terminal.
4. OpenWA detecta el vínculo y empieza a estar listo en ~30s.

Verificar:
```bash
curl https://openwa.jurmaq.cl/api/sessions/jurmaq/me -H "x-api-key: $OPENWA_API_KEY"
# Debería devolver { "wid": "56xxxxxxxxx@c.us", ... }
```

### 5. Configurar Vercel (app constructora)

En **Project Settings → Environment Variables**:

```
OPENWA_BASE_URL=https://openwa.jurmaq.cl
OPENWA_SESSION=jurmaq
OPENWA_API_KEY=<el mismo valor del .env de arriba>
```

Redeploy de constructora. El endpoint `/api/admin/otp/health` debería mostrar `openwa: OK`.

### 6. Probar envío

Como admin logueado en jurmaq.cl/admin:
1. Ir a `/admin/sistema/otp`.
2. Verificar que OpenWA aparezca como "OK".
3. Para probar end-to-end, generar un contrato de prueba y solicitar firma — el OTP debería llegar por WhatsApp + email simultáneamente.

---

## Operación

### Health check

Cron de Caddy + Docker `restart: unless-stopped` reinician OpenWA si crashea. Para verificar manualmente:

```bash
ssh root@IP
cd /opt/openwa
docker compose ps      # status
docker compose logs --tail 100 openwa   # logs recientes
```

### Si la sesión se desvincula

Si WhatsApp desvincula el dispositivo (cierre forzado, baneo, etc):

```bash
docker compose down
rm -rf sessions/         # ← borra la sesión vieja
docker compose up -d
docker compose logs -f openwa   # escanear QR nuevo
```

**Si recibís un baneo del número**: ese número queda comprometido, conseguí otro. Mientras tanto, el fallback a email de los OTP sigue funcionando — el flujo de firma no rompe.

### Actualizar imagen

OpenWA actualiza con WhatsApp. Recomiendo `docker compose pull && docker compose up -d` mensualmente.

```bash
cd /opt/openwa
docker compose pull
docker compose up -d
```

---

## Monitoreo

- **Logs**: `docker compose logs openwa` (rota automáticamente).
- **Métricas**: `/admin/sistema/otp` en la app muestra envíos/fallos 24h por provider.
- **Alertas**: si querés notificación cuando OpenWA cae, conectá a uptime-kuma o healthchecks.io (futuro).

---

## Costos estimados

| Item | Costo aprox CLP/mes |
|---|---|
| VM DigitalOcean basic | ~$6,000 |
| Plan prepago WhatsApp dedicado | ~$3,000 |
| Dominio openwa.jurmaq.cl (subdominio) | $0 |
| **Total** | **~$9,000** |

vs. WhatsApp Cloud API (oficial): $0 hasta 1000 conversaciones de servicio/mes en Latam. Considerar migrar si: (a) OpenWA causa problemas operativos, (b) volumen > 1000 OTP/mes, (c) querés certificación oficial Meta Business.
