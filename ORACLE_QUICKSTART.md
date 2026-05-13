# Oracle Cloud — Quickstart paso-a-paso (click por click)

> Asume que ya tenés la cuenta creada y logueada en https://cloud.oracle.com
> Tiempo total: ~30 min para las 2 VMs

---

## PARTE 0 — Antes de empezar: SSH key en tu Mac (5 min)

Abrí Terminal en tu Mac:

```bash
# 1. Crear el par de llaves (sin passphrase para simplificar)
ssh-keygen -t ed25519 -f ~/.ssh/oracle-jurmaq -C "jurmaq-oracle" -N ""

# 2. Ver la pública (la vas a copiar al pegar en Oracle más adelante)
cat ~/.ssh/oracle-jurmaq.pub
```

La salida empieza con `ssh-ed25519 AAAA...` y termina con `jurmaq-oracle`. **Eso es lo que vas a copiar.** Dejá la terminal abierta, vas a volver.

---

## PARTE 1 — Verificar región y configurar VCN (10 min)

### 1.1 Confirmar región correcta
Arriba a la derecha de Oracle Cloud Console vas a ver el nombre de la región (ejemplo: `South America East (São Paulo)` o `Chile Central (Santiago)`).

- **Si dice Santiago** → perfecto, latencia mínima a Chile.
- **Si dice São Paulo** → bien igual, ~30ms a Chile.
- **Si dice US East / cualquier otra USA** → click en la región arriba a la derecha → cambiá a `sa-saopaulo-1` o `sa-santiago-1`.

> ⚠️ Si cambiás región, todas las VMs/recursos que crees quedan en esa región. **Decidí antes de crear cosas.**

### 1.2 Crear la VCN (Virtual Cloud Network)
Una VCN es la "red privada" donde viven tus VMs. La hacés una vez y la usás para ambas.

1. Menu hamburguesa arriba a la izquierda (☰) → **Networking** → **Virtual Cloud Networks**
2. Click botón naranja **"Start VCN Wizard"** (arriba)
3. Seleccioná **"Create VCN with Internet Connectivity"** → click **"Start VCN Wizard"** (al final)
4. Form:
   - **VCN Name:** `vcn-jurmaq`
   - **Compartment:** dejá el que sale por default (tu compartment root)
   - **VCN IPv4 CIDR Block:** dejá `10.0.0.0/16`
   - **Public Subnet CIDR Block:** dejá `10.0.0.0/24`
   - **Private Subnet CIDR Block:** dejá `10.0.1.0/24`
   - **Use DNS hostnames in this VCN:** ✅ marcado
5. Click **"Next"** → **"Create"** → esperá ~30 seg → **"View Virtual Cloud Network"**

Te queda un resumen verde. La VCN existe.

### 1.3 Abrir puertos 80 y 443 en la Security List

Esto es la **capa firewall a nivel Oracle** (la otra capa, iptables del SO, se abre después al SSHear).

1. En la página de la VCN que creaste → panel izquierdo **"Resources"** → click **"Security Lists"**
2. Verás una sola entrada: **"Default Security List for vcn-jurmaq"** → click el nombre
3. Panel izquierdo **"Resources"** → click **"Ingress Rules"**
4. Click botón **"Add Ingress Rules"**
5. Llenar el form:
   - **Stateless:** dejalo desmarcado
   - **Source Type:** `CIDR`
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `TCP`
   - **Source Port Range:** dejá vacío
   - **Destination Port Range:** `80,443`  ← ojo, exacto así con coma sin espacio
   - **Description:** `HTTP and HTTPS public`
6. Click **"Add Ingress Rules"** (botón azul abajo)

Listo. Tu red está preparada para servir web.

---

## PARTE 2 — Crear VM #1: Barraca (10 min)

### 2.1 Empezar la creación
1. Menu (☰) → **Compute** → **Instances**
2. Botón azul arriba **"Create Instance"**

### 2.2 Configurar la VM — TODOS los campos

Te aparece un form largo. Te voy por las secciones de arriba a abajo:

#### Sección "Name"
- **Name:** `vm-barraca`
- **Create in compartment:** dejá el default

#### Sección "Placement"
- **Availability domain:** dejá la que está seleccionada (AD-1 o AD-2). Si dice "Out of capacity" en el siguiente paso, volvé acá y cambiá a otra AD.

#### Sección "Security"
Dejá todo el default — `Shielded instance: off`, `Confidential computing: off`.

#### Sección "Image and shape"

**👉 Esto es lo más importante, leelo despacio.**

##### Image
1. Click **"Edit"** (a la derecha del título "Image and shape")
2. Si el botón dice **"Change image"** → click ahí
3. En el panel que se abre, lista de imágenes a la izquierda:
   - Click **"Canonical Ubuntu"** en la barra lateral
   - Seleccioná **"Canonical Ubuntu 22.04"** en la grilla
4. Importante: vas a ver una columna "OS version" con tres opciones:
   - `22.04` (x86 — NO usar, no es ARM)
   - `22.04 Minimal aarch64`
   - `22.04 aarch64`  ← **ESTA**
5. Click la fila **"Canonical-Ubuntu-22.04-aarch64-..."** (el aarch64 sin "Minimal")
6. Click **"Select image"** (botón azul abajo a la derecha)

##### Shape (compute)
1. Sigue en la sección "Image and shape". Ahora click **"Change shape"** (a la derecha)
2. En el panel que se abre:
   - **Instance type:** dejá `Virtual machine`
   - **Shape series:** click **"Ampere"** ← ARM, este es el free
   - En la lista te aparece **"VM.Standard.A1.Flex"** — selecciónalo
3. Abajo del shape aparecen dos sliders:
   - **Number of OCPUs:** subilo a `2`
   - **Amount of memory (GB):** subilo a `12`
4. Click **"Select shape"** (azul abajo a la derecha)

> Si dice **"This shape is not available in the selected availability domain"** o **"Out of capacity"** → volvé arriba a "Placement" → cambiá la Availability domain (probá AD-1, AD-2, AD-3) hasta que acepte.

#### Sección "Primary VNIC information"
- **Virtual cloud network:** seleccioná `vcn-jurmaq` (la que creaste en Parte 1)
- **Subnet:** seleccioná el subnet que tiene "public" en el nombre (algo como `Public Subnet-vcn-jurmaq`)
- **Primary VNIC IP addresses:**
  - Private IPv4 address: `Automatically assign private IPv4 address` ✅
  - **Public IPv4 address: ✅ `Automatically assign public IPv4 address`** ← NO te olvides esta

#### Sección "Add SSH keys"
- Seleccioná **"Paste public keys"**
- Pegá el contenido de `~/.ssh/oracle-jurmaq.pub` (lo que copiaste en Parte 0)
- Si pegás bien, abajo aparece un mini-resumen verde con el nombre de tu key

#### Sección "Boot volume"
- **Specify a custom boot volume size:** ✅ marcado
- **Boot volume size (GB):** `80`
- **Boot volume performance:** dejá `Balanced` (default)
- Lo demás dejalo en default

### 2.3 Crear
- Scrolleá hasta abajo del todo
- Click botón azul grande **"Create"**

Pantalla de provisioning aparece. Estado pasa por:
1. `Provisioning` (~1 min, círculo amarillo)
2. `Running` (~30 seg más, círculo verde) ← lista

### 2.4 Anotar la IP pública
Una vez en `Running`:
- En la página de la instancia, scrolleá un poco
- Sección **"Instance access"** → ahí está **"Public IPv4 address"**
- Anotá esa IP, ejemplo: `132.226.x.x`

### 2.5 Reservar la IP (para que no cambie al reiniciar)
1. Sigue en la página de la VM → panel izquierdo **"Resources"** → click **"Attached VNICs"**
2. Click el VNIC que aparece (tiene el nombre de tu instancia)
3. Panel izquierdo de nuevo → **"IPv4 Addresses"**
4. En la fila de la IP pública, click los **"⋮"** (tres puntos) a la derecha → **"Edit"**
5. En el form:
   - **Public IP type:** cambialo de `Ephemeral` a `Reserved Public IP`
   - **Create new reserved public IP:** ✅
   - **Reserved Public IP Name:** `ip-barraca`
6. Click **"Update"**

---

## PARTE 3 — Primera conexión SSH (5 min)

En tu Mac:

```bash
# Reemplazá <IP> con la IP que anotaste
ssh -i ~/.ssh/oracle-jurmaq ubuntu@<IP>
```

Primera vez te pregunta `Are you sure you want to continue connecting (yes/no)?` → escribí `yes` + Enter.

Si todo OK estás dentro. Vas a ver algo como:
```
Welcome to Ubuntu 22.04.5 LTS (GNU/Linux ... aarch64)
...
ubuntu@vm-barraca:~$
```

### 3.1 Abrir iptables del SO (CRÍTICO — esto se olvida siempre)

Ya adentro de la VM:

```bash
# Permitir 80 y 443 a nivel kernel
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Guardar para que sobreviva reboots
sudo netfilter-persistent save

# Verificar
sudo iptables -L INPUT --line-numbers | head -15
```

Deberías ver las reglas 80 y 443 en la lista.

### 3.2 Test rápido de conectividad
Desde tu Mac, en otra terminal:
```bash
curl -v http://<IP-barraca>
```

Deberías ver **"Connection refused"** (todavía no hay nginx) — eso es bueno, significa que llegás. Si decía **"Connection timed out"**, falta abrir puerto.

### 3.3 Salí del SSH
```bash
exit
```

---

## PARTE 4 — Crear VM #2: Constructora (5 min)

Repetí Parte 2 con estos cambios:

| Campo | Valor |
|---|---|
| Name | `vm-constructora` |
| Image | Ubuntu 22.04 aarch64 (igual) |
| Shape | Ampere VM.Standard.A1.Flex |
| **OCPUs** | **1** |
| **Memory (GB)** | **6** |
| VCN | `vcn-jurmaq` (la misma) |
| Subnet | Public Subnet (el mismo) |
| Public IP | ✅ Auto-assign |
| SSH key | mismo `oracle-jurmaq.pub` |
| **Boot volume** | **60 GB** |

Después de creada, reservá la IP igual que en 2.5, llamala `ip-constructora`.

SSH-test:
```bash
ssh -i ~/.ssh/oracle-jurmaq ubuntu@<IP-constructora>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
exit
```

---

## PARTE 5 — Convertir a "Paid Plan" (para que no te reclamen las VMs)

**Importante:** las cuentas Always Free reclaman ("idle reclaim") instancias después de 7 días sin uso significativo. Para evitar esto **sin gastar dinero**:

1. Menu (☰) → **Billing & Cost Management** → **Upgrade and Manage Payment**
2. Click **"Upgrade to Paid"** o **"Add Payment Method"** (depende cómo lo muestre)
3. Confirmá la tarjeta de crédito (la misma que usaste al crear la cuenta)
4. Aceptá los términos → Submit

**Lo que pasa:**
- Tu cuenta ahora dice "Pay As You Go" en vez de "Always Free"
- **Todo lo que usás dentro del cupo Always Free SIGUE siendo gratis** ($0)
- Si pasás el cupo (por ejemplo creás una 5ta VM), te cobran solo el exceso
- **YA NO te reclaman las VMs** por estar idle

Si te asusta que cobren: andá a **Billing → Cost Analysis** una vez por semana las primeras 2-3 semanas para verificar que sigue en $0.

---

## PARTE 6 — Validación final (3 min)

Al final tenés que tener:

✅ 2 VMs en estado `Running`
✅ Cada VM con su IP pública reservada
✅ SSH funciona en ambas con `~/.ssh/oracle-jurmaq`
✅ `sudo iptables -L INPUT` muestra reglas para 80 y 443 en ambas
✅ Plan upgradeado a "Paid" (pero sin cargos)

### Check de capacity sobrante
Menu (☰) → **Compute** → **Instances** → arriba a la derecha hay un resumen. Para tu free tier ARM esperás:
- **Used:** 3 OCPU + 18 GB (2+1 OCPU, 12+6 GB)
- **Disponible:** 1 OCPU + 6 GB (para tu tercer proyecto futuro)

---

## ¿Y ahora qué?

Las VMs están listas pero **vacías** (solo Ubuntu base). Lo siguiente es:
1. Instalar Node 20, pnpm, PM2, nginx, certbot en ambas
2. Deployar el código de cada app
3. Configurar reverse proxy + SSL
4. Cutover DNS

Todo eso ya está descrito en **`ORACLE_SETUP.md` Fases 4–11**. Esa guía la corres después con las VMs ya creadas.

**Pero antes**, yo termino el refactor monorepo y te aviso. No tiene sentido deployar el código actual a Oracle — mejor splitearlo primero y deployar la versión separada.

---

## Si algo falla en la creación

| Mensaje | Causa | Fix |
|---|---|---|
| "Out of capacity for shape A1.Flex" | AD elegida sin stock ARM | Cambia Availability domain (AD-1/2/3) y volvé a Create |
| "Out of capacity" en todas las AD | Región saturada | Si estás en Santiago, probá São Paulo. Si ambas fallan, reintentá en 1-3 h, suele liberarse capacity |
| "Service limit exceeded" | Ya creaste algo y consumió cuota | Compute → Instances → revisá si hay VMs viejas; o pedí limit increase en Governance → Limits |
| SSH `Permission denied` | Key mal pegada o archivo equivocado | `chmod 600 ~/.ssh/oracle-jurmaq`; verificá que pegaste el `.pub` no el privado |
| SSH `Connection refused` | iptables bloquea | Andá a la consola web Oracle → Instance Console Connection → adentro corré los `iptables -I` |
| SSH `Connection timed out` | Security List no tiene puerto 22 | Networking → VCN → Security Lists → revisá que 22 está abierto para `0.0.0.0/0` |

---

**Avisame cuando termines Parte 4** (las 2 VMs funcionando con SSH). Mientras tanto sigo con el monorepo split.
