# Oracle Cloud Free Tier — Setup paso a paso para JURMAQ.CL

**Objetivo:** Hostear `jurmaq.cl` (constructora) y `barraca.jurmaq.cl` (e-commerce) en VMs separadas Oracle ARM, free forever.

---

## Fase 1 — Cuenta Oracle Cloud

### 1.1 Registro
1. Andá a https://cloud.oracle.com/free
2. **Country:** Chile
3. **Cloud Account Name:** algo único tipo `jurmaq-prod` (no es público, queda permanente).
4. **Home Region:** elegí **Chile Central (Santiago) — `sa-santiago-1`** si está disponible. Si no, **`sa-saopaulo-1`** (São Paulo). NO uses USA — la latencia mata.
5. Verificación: tarjeta de crédito (no cobra, retiene USD $1 y devuelve). Necesitás dirección Chile + RUT opcional.
6. Esperá 30 min – 4 h para que activen la cuenta.

### 1.2 Verificar Always Free disponibilidad
Una vez logueado:
- Menu → **Governance & Administration** → **Limits, Quotas and Usage**
- Buscar service "Compute" → ver que tengas quota disponible en **Standard.A1.Flex (Ampere)**
- En 2024-2025 la capacidad ARM mejoró mucho, pero si dice 0 en Santiago, probá São Paulo.

---

## Fase 2 — Crear las 2 VMs ARM

### 2.1 SSH key local (en tu Mac)
```bash
# Si todavía no tenés una para esto
ssh-keygen -t ed25519 -f ~/.ssh/oracle-jurmaq -C "jurmaq-oracle"
# No le pongas passphrase (o usá agent forwarding después)
cat ~/.ssh/oracle-jurmaq.pub  # copiá este output, lo pegás en Oracle
```

### Sizing decidido (asimétrico, deja headroom para tercer proyecto)

| VM | OCPU | RAM | Boot disk |
|---|---|---|---|
| `vm-barraca` | 2 | 12 GB | 80 GB |
| `vm-constructora` | 1 | 6 GB | 60 GB |
| Reservado tercer proyecto futuro | 1 | 6 GB | 60 GB |
| **Total ARM** | **4** | **24 GB** | **200 GB** |

Free tier ARM permite **4 OCPU + 24 GB total** repartido como quieras. Esto deja una tercera VM lista para cuando la necesites — sin tocar facturación.

### 2.2 VM #1: Barraca (2 OCPU + 12 GB)
1. Menu → **Compute** → **Instances** → **Create instance**
2. **Name:** `vm-barraca`
3. **Compartment:** root (default)
4. **Image:** click "Change image" → **Canonical Ubuntu 22.04 (Aarch64)** — IMPORTANTE que sea ARM, no x86.
5. **Shape:** click "Change shape" → **Virtual machine** → **Ampere** → **VM.Standard.A1.Flex**
   - **OCPUs:** `2`
   - **Memory (GB):** `12`
6. **Networking:**
   - VCN: dejá el default (Oracle te crea uno)
   - Subnet: public subnet
   - **Assign public IPv4 address:** YES
7. **SSH keys:** Upload public key file → pegá `~/.ssh/oracle-jurmaq.pub`
8. **Boot volume:**
   - Size: **80 GB**
9. **Create**

Esperá ~2 min. Anotá el **Public IP** que te asigna (algo tipo `132.226.x.x`).

### 2.3 Reservar la IP (importante)
Por defecto la IP es "ephemeral" — si reinicias la VM puede cambiar. Convertila a reserved (también gratis):
1. En la página de la VM → **Attached VNICs** → click el VNIC
2. **IPv4 Addresses** → click los `...` del Public IP → **Edit**
3. Cambiá a **Reserved Public IP** → **Reserve new** → save.

### 2.4 VM #2: Constructora (1 OCPU + 6 GB)
Repetí 2.2 con:
- **Name:** `vm-constructora`
- **OCPUs:** `1`
- **Memory (GB):** `6`
- **Boot volume:** `60 GB`

### 2.5 (Futuro) VM #3: Tercer proyecto
Cuando lances algo nuevo: 1 OCPU + 6 GB + 60 GB. Suma 4 + 24 + 200 = exactamente el cap free tier.

### 2.6 Si necesitás más potencia más adelante
Las shapes A1.Flex son **resize en caliente** (reboot 1 min). Para mover RAM/CPU entre VMs:
1. Apagá la VM destino, subila a la cantidad nueva
2. Apagá otra VM, bajala
3. Total tiene que seguir siendo ≤ 4 OCPU + 24 GB
4. Sin costo extra mientras estés dentro de la cuota

---

## Fase 3 — Abrir puertos (CRÍTICO — gotcha de Oracle)

Oracle tiene **DOS niveles de firewall**, ambos hay que abrir:

### 3.1 Security List (capa Oracle, antes del SO)
Para cada VM:
1. VM page → **Primary VNIC** → **Subnet** → **Default Security List for vcn-…**
2. **Ingress Rules** → Add Ingress Rule:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `80,443`
   - Description: "HTTP + HTTPS"
3. SSH (puerto 22) ya viene abierto por default.

### 3.2 iptables del SO (esto se OLVIDA siempre)
SSH a cada VM y corré:
```bash
ssh -i ~/.ssh/oracle-jurmaq ubuntu@<IP>

# Oracle Ubuntu trae iptables locked. Limpiar y permitir HTTP/S:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Test desde tu Mac: `curl http://<IP>` debería dar conexión rechazada (todavía no hay nginx), no timeout.

---

## Fase 4 — Stack base (correr en CADA VM)

```bash
# Update OS
sudo apt update && sudo apt upgrade -y

# Node 20 LTS (ARM)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm

# PM2 (process manager)
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu  # te imprime un comando, copialo y corre con sudo

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# Certbot (Let's Encrypt SSL gratis)
sudo apt install -y certbot python3-certbot-nginx

# fail2ban (protección SSH brute force)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# UFW (firewall amigable, complementa iptables)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## Fase 5 — Database

### Opción A — Mantener Supabase Cloud (recomendado para arrancar)
**Pros:** dashboard, RLS gestionado, backups automáticos, cero ops.
**Contras:** dependencia externa.
**Costo:** Free tier 500 MB → si crecés, $25/mes Pro.

→ No hacés nada acá. Las apps siguen conectando a tu Supabase actual con `process.env.NEXT_PUBLIC_SUPABASE_URL`.

### Opción B — Postgres self-host en cada VM
**Pros:** $0 forever, DB aislada por app.
**Contras:** vos haces backups, updates, RLS sin GUI, sin Realtime ni Storage.

```bash
sudo apt install -y postgresql-14
sudo -u postgres psql

# Dentro de psql:
CREATE DATABASE jurmaq_barraca;  # o jurmaq_constructora
CREATE USER jurmaq_app WITH PASSWORD '<password fuerte aquí>';
GRANT ALL PRIVILEGES ON DATABASE jurmaq_barraca TO jurmaq_app;
\q

# Backups automáticos diarios:
sudo tee /etc/cron.d/jurmaq-pg-backup > /dev/null <<'EOF'
0 3 * * * postgres pg_dump jurmaq_barraca | gzip > /var/backups/pg-$(date +\%F).sql.gz
0 4 * * * root find /var/backups -name 'pg-*.sql.gz' -mtime +14 -delete
EOF
sudo mkdir -p /var/backups && sudo chown postgres /var/backups
```

**Mi recomendación:** Opción A para el primer mes. Migrá a B después si querés cero costos.

---

## Fase 6 — Deploy de la app (ejemplo para Barraca)

```bash
# En la VM
cd ~
git clone https://github.com/<tu-org>/<tu-repo>.git jurmaq
cd jurmaq/apps/barraca  # path después del refactor a monorepo
pnpm install
cp .env.example .env.local
nano .env.local  # pegá tus secretos
pnpm build
pm2 start npm --name "barraca" -- start -- -p 3000
pm2 save
```

Repetí en la VM constructora con `apps/constructora` y puerto 3000.

---

## Fase 7 — Nginx + SSL

`/etc/nginx/sites-available/barraca.jurmaq.cl`:
```nginx
server {
    listen 80;
    server_name barraca.jurmaq.cl;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/barraca.jurmaq.cl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL automático
sudo certbot --nginx -d barraca.jurmaq.cl

# Renovación automática (certbot la configura solo, verificá):
sudo systemctl status certbot.timer
```

Repetí para `jurmaq.cl` y `www.jurmaq.cl` en la otra VM.

---

## Fase 8 — DNS cutover

En tu registrar (Cloudflare/NIC.cl/donde tengas el dominio):

| Hostname | Tipo | Valor |
|---|---|---|
| `jurmaq.cl` | A | IP-vm-constructora |
| `www.jurmaq.cl` | A | IP-vm-constructora |
| `barraca.jurmaq.cl` | A | IP-vm-barraca |

**Estrategia segura:**
1. Bajá TTL a 60s (en Vercel/Cloudflare) **24 h antes** del switch.
2. Hacé el cambio fuera de horario peak.
3. Monitoreá ambas durante 2 horas.
4. Si algo falla, revertí a IPs Vercel (las dejaste anotadas, ¿no?).
5. 7 días después, si todo OK, subí TTL a 3600.

---

## Fase 9 — Monitoreo gratis (instalá en ambas VMs)

### Netdata (métricas en vivo)
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait
# Acceso: http://<IP>:19999 (cerrá puerto 19999 cuando termines de mirar)
```

### Uptime Kuma (uptime monitoring + alertas a tu email/Telegram)
Corré en una de las VMs:
```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
# Acceso: http://<IP>:3001 — configurá monitor HTTP a las dos webs
```

### Logs centralizados (opcional)
```bash
# Loki + Grafana en una VM, agentes en ambas
# Por ahora con `pm2 logs` y `journalctl -u nginx` alcanza.
```

---

## Fase 10 — Idle reclaim (gotcha importante)

Oracle reclama instancias Always Free si están "idle 7 días". Definición de idle:
- CPU < 20% por 95% de cualquier ventana 7 días
- Network < 20% sustained
- Memoria < 20% sustained

**Cómo protegerte:** las VMs corriendo Next.js + nginx + tráfico real (aunque sea bajo) están bien. Si la web no tiene tráfico todavía:
- Un cron simple: `*/15 * * * * curl -s http://localhost > /dev/null` (mantiene la CPU activa).
- O **pagá** la versión "Paid" — sigue siendo gratis si te quedás dentro de Always Free quota, pero ya no aplica reclaim.

Conversión a "Paid Plan" sin costo:
- Menu → **Billing** → **Upgrade and Manage Payment**
- Cuenta queda como "Pay As You Go" pero todo lo Always Free **sigue gratis**.
- Esto **desactiva la política de idle reclaim**.

---

## Fase 11 — Seguridad adicional (post-go-live)

```bash
# SSH harden: cambia puerto, deshabilita password
sudo nano /etc/ssh/sshd_config
# Port 2222  (descomentar y cambiar)
# PasswordAuthentication no
# PermitRootLogin no
sudo systemctl restart sshd
# AGREGAR en Security List Oracle el puerto 2222, después cerrar 22.

# Updates automáticos de seguridad
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Snapshots de boot volume (Oracle dashboard, gratis hasta 5):
# Compute → Boot Volumes → tu volumen → Backups → Manual Backup
# O configura backup automático diario (uno gratis)
```

---

## Costo final estimado (real)

| Recurso | Quota Always Free | Tu uso | Costo |
|---|---|---|---|
| ARM VMs | 4 OCPU + 24 GB total | 4 OCPU + 24 GB ✅ | $0 |
| Boot volumes | 200 GB total | 200 GB ✅ | $0 |
| Network egress | 10 TB / mes | ~50 GB ✅ | $0 |
| Public IPs reserved | 2 free | 2 ✅ | $0 |
| **Total mensual** | | | **$0** |

Si crecés: 1 OCPU ARM extra = ~$1/mes. Egress sobre 10 TB = $0.0085/GB.

---

## Checklist final antes del cutover

- [ ] Las 2 VMs creadas, IP reservada, SSH funciona
- [ ] iptables abierto puerto 80/443 en ambas
- [ ] Node 20, pnpm, pm2, nginx, certbot instalados en ambas
- [ ] Apps deployadas y respondiendo en `localhost:3000` (test con `curl`)
- [ ] Nginx reverse proxy funcionando con HTTP (http://IP responde)
- [ ] SSL emitido con certbot, https://IP funciona
- [ ] Las apps conectan a Supabase OK desde la VM (test login + un read)
- [ ] DNS cutover hecho (TTL bajo)
- [ ] Uptime Kuma monitorea ambos dominios
- [ ] Conversión a Paid Plan hecha (sin costo) para evitar idle reclaim
- [ ] Vercel deploys quedan vivos 1 semana como rollback

---

## Si algo sale mal

| Síntoma | Causa probable | Fix |
|---|---|---|
| `curl http://IP` da timeout | iptables/security list | Fase 3 — abrí ambos firewalls |
| Build de Next falla por memoria | `pnpm build` se queda sin RAM | `NODE_OPTIONS=--max-old-space-size=8192 pnpm build` |
| `certbot` falla | DNS no propagado o puerto 80 cerrado | Esperá DNS, verificá nginx en puerto 80 |
| Site lento desde Chile | Región mal elegida | Si estás en São Paulo, ~30ms a Chile es OK |
| VM "stopped" sin pedirlo | Idle reclaim | Convertí a Paid Plan (Fase 10) |
| ARM instance "Out of capacity" | Capacidad regional | Probá otra AD (Availability Domain) o sa-saopaulo-1 |
