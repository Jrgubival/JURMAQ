# Setup verificación de propiedad — Google Search Console + Bing Webmaster

Guía paso-a-paso para verificar la propiedad de **jurmaq.cl** (constructora) y
**barraca.jurmaq.cl** (barraca) en Google Search Console y Bing Webmaster Tools,
y dejar configurados los submits de sitemap.

---

## Estado del código (ya implementado)

Los layouts root de ambas apps leen `process.env.NEXT_PUBLIC_GSC_VERIFICATION`
y `process.env.NEXT_PUBLIC_BING_VERIFICATION` y los inyectan como meta tags vía
el campo `metadata.verification` de Next.js 16. Si las env vars no están
seteadas, **no se inyecta meta tag** (no aparece como `<meta content="">`).

Archivos relevantes:

- `apps/constructora/src/app/layout.tsx` — metadata de jurmaq.cl.
- `apps/barraca/src/app/layout.tsx` — metadata de barraca.jurmaq.cl.
- `packages/shared/src/env.ts` — schema Zod con las 2 vars como `.optional()`.

Lo que falta es **obtener los tokens** y **agregarlos a Vercel**. El resto es
automático en el próximo deploy.

---

## 1. Google Search Console

### 1.1 Crear las propiedades

1. Ir a https://search.google.com/search-console
2. Login con la cuenta Google del proyecto (idealmente la misma que recibe los
   reportes de GA4).
3. Click **"Añadir propiedad"** → elegir **"Prefijo de URL"** (recomendado
   sobre "Dominio" porque permite separar tráfico de jurmaq.cl vs
   barraca.jurmaq.cl como propiedades independientes, y porque la verificación
   por meta tag sólo está disponible en este modo).
4. Repetir el flujo dos veces, una por dominio:
   - Primera propiedad: `https://jurmaq.cl`
   - Segunda propiedad: `https://barraca.jurmaq.cl`

> **Nota sobre Dominio vs Prefijo de URL:** "Dominio" (`jurmaq.cl`) cubre
> automáticamente subdominios y http/https/www variants, pero requiere
> verificación DNS (TXT record en Cloudflare/registrar). Aquí elegimos
> "Prefijo de URL" porque (a) queremos tratar jurmaq.cl y barraca.jurmaq.cl
> como **search properties separadas** para ver métricas independientes por
> sitio y (b) la verificación con meta tag es trivial (commit + deploy).

### 1.2 Obtener el verification token

En el modal de verificación de cada propiedad:

1. Elegir el método **"Etiqueta HTML"**.
2. Aparece un snippet como:
   ```html
   <meta name="google-site-verification" content="ABCD1234abcd1234...XYZ" />
   ```
3. **Copiar sólo el valor del atributo `content`** (la cadena alfanumérica
   larga). NO el snippet entero.
4. **NO hacer click en "Verificar"** todavía — primero hay que setear la env
   var, deployar, y recién después validar.

Importante: **el token es distinto para cada propiedad**. Vas a tener dos
tokens, uno para jurmaq.cl y otro para barraca.jurmaq.cl.

### 1.3 Setear las env vars en Vercel

1. https://vercel.com/dashboard → seleccionar el proyecto **constructora**
   (jurmaq.cl) → Settings → Environment Variables.
2. Agregar:
   - **Name:** `NEXT_PUBLIC_GSC_VERIFICATION`
   - **Value:** el token del paso 1.2 (sólo el `content`, sin comillas).
   - **Environments:** marcar **Production**, **Preview**, **Development**.
   - Save.
3. Repetir para el proyecto **barraca** (barraca.jurmaq.cl) con su **propio
   token** (distinto al de constructora).

> Si en Vercel ambas apps comparten un único proyecto con monorepo, igual hay
> que setear la var distinta por **environment scope** o usar dos variables
> distintas (ej. `NEXT_PUBLIC_GSC_VERIFICATION_CONSTRUCTORA` y
> `_BARRACA`). El código actual asume **un proyecto Vercel por app**. Si la
> realidad es distinta, ajustar el código antes de proceder.

### 1.4 Redeploy y validar

1. Trigger redeploy (o push a main). El usuario despliega manualmente con
   `vercel --prod --yes`.
2. Una vez deployado, abrir `https://jurmaq.cl` y verificar en DevTools que
   aparece el meta tag:
   ```html
   <meta name="google-site-verification" content="..." />
   ```
   (View source → buscar "google-site-verification").
3. Volver a Search Console → click **"Verificar"** en el modal. Debe pasar a
   estado "Verificado".
4. Repetir para `https://barraca.jurmaq.cl`.

### 1.5 Submit del sitemap

Una vez verificada cada propiedad:

1. Sidebar izquierdo → **Sitemaps**.
2. Agregar un nuevo sitemap. En el campo "Añadir un sitemap nuevo" escribir:
   - Para constructora: `sitemap.xml` (el path completo queda
     `https://jurmaq.cl/sitemap.xml`).
   - Para barraca: `sitemap.xml` (`https://barraca.jurmaq.cl/sitemap.xml`).
3. Click **Enviar**. Estado inicial: "Correcto" o "No se ha podido obtener" —
   si lo segundo, abrir la URL del sitemap directamente en el browser y
   verificar que devuelve XML válido. Si está vacío, revisar la route
   `apps/<app>/src/app/sitemap.ts`.

Google empezará a crawlear las URLs declaradas en el sitemap. La primera pasada
suele tardar 1-7 días; indexación completa puede tomar 2-4 semanas.

---

## 2. Bing Webmaster Tools

### 2.1 Crear las propiedades

1. Ir a https://www.bing.com/webmasters
2. Login con cuenta Microsoft (la institucional si existe, sino una personal
   asociada al negocio).
3. Atajo: **"Importar desde Google Search Console"** — si ya verificaste GSC,
   Bing puede importar las propiedades automáticamente y verificarlas vía OAuth
   sin necesidad de meta tag separado.
   - Si elegís este método, **podés saltar 2.2 y 2.3** y seguir directo a
     **2.4 (submit del sitemap)**. La var `NEXT_PUBLIC_BING_VERIFICATION` queda
     opcional (no la setees y el meta tag no se inyecta).
4. Si preferís verificación independiente (meta tag), click **"Añadir sitio"**
   y agregar cada URL:
   - `https://jurmaq.cl`
   - `https://barraca.jurmaq.cl`

### 2.2 Obtener el verification token (sólo si NO importaste desde GSC)

En el modal de verificación:

1. Elegir **"Opción 2: Copiar y pegar etiqueta meta"** (o similar — el texto
   exacto varía con redesigns de Bing).
2. Aparece:
   ```html
   <meta name="msvalidate.01" content="ABCD1234..." />
   ```
3. **Copiar sólo el `content`** (sin comillas). Distinto por propiedad.

### 2.3 Setear las env vars en Vercel (sólo si NO importaste desde GSC)

Mismo flujo que GSC, con el nombre `NEXT_PUBLIC_BING_VERIFICATION`. Una var
por proyecto Vercel, con el token correspondiente a esa propiedad.

Redeploy y verificar el meta tag en HTML (`<meta name="msvalidate.01" ...>`),
luego click **"Verificar"** en Bing.

### 2.4 Submit del sitemap

1. Sidebar → **Sitemaps**.
2. **"Enviar sitemap"** → ingresar la URL completa:
   - `https://jurmaq.cl/sitemap.xml`
   - `https://barraca.jurmaq.cl/sitemap.xml`
3. Bing procesa el sitemap más rápido que Google (suele tardar horas, no
   días).

---

## 3. Validación final (checklist)

Después del redeploy y de hacer click en "Verificar" en ambas plataformas:

- [ ] GSC: `jurmaq.cl` muestra estado **"Propiedad verificada"**.
- [ ] GSC: `barraca.jurmaq.cl` muestra estado **"Propiedad verificada"**.
- [ ] Bing: ambos dominios muestran tilde verde de verificación.
- [ ] `https://jurmaq.cl/sitemap.xml` retorna XML válido (no 404).
- [ ] `https://barraca.jurmaq.cl/sitemap.xml` retorna XML válido.
- [ ] Sitemap submitted en GSC para ambos dominios (estado "Correcto").
- [ ] Sitemap submitted en Bing para ambos dominios.
- [ ] DevTools en producción muestra los meta tags `google-site-verification`
      y `msvalidate.01` en `<head>`.

---

## 4. Próximos pasos (post-verificación)

Una vez verificada la propiedad, lo que toca priorizar en GSC para que la
indexación sea sana:

1. **Cobertura** (sidebar GSC) — revisar las URLs descubiertas vs indexadas.
   Las marcadas como "Detectada, actualmente sin indexar" o "Rastreada,
   actualmente sin indexar" son normales al inicio pero hay que monitorearlas.
2. **Rendimiento** — ver qué queries empiezan a generar impresiones (CTR <1%
   suele indicar problema de title/description, no de ranking).
3. **Core Web Vitals** — Pestaña "Experiencia" → revisar LCP/INP/CLS.
4. **Mejoras** — Bing y Google reportan acá si hay errores en los JSON-LD ya
   inyectados (ver `packages/shared/src/seo/jsonld.ts`). Si aparece algún
   error, investigar el `@graph` que se está sirviendo.

Para auditar errores SEO específicos antes de la indexación, ver
`docs/auditorias/2026-05-27-seo-master-plan.md`.
