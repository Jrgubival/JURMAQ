import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth({
  ...authConfig,
  pages: {
    ...authConfig.pages,
    // Login admin propio de jurmaq.cl (SSO Google + fallback a credenciales).
    // Antes rebotaba a barraca.jurmaq.cl/cuenta/login cruzando dominios.
    signIn: '/login',
  },
}).auth;

/**
 * Rutas internas del subdominio constructora.jurmaq.cl.
 * El usuario ve `constructora.jurmaq.cl/servicios`; Next sirve `/constructora/servicios`.
 */
const CONSTRUCTORA_HOST = 'constructora.jurmaq.cl';
const CONSTRUCTORA_PREFIX = '/constructora';

/**
 * Hosts que se comportan como el subdominio.
 *
 * `constructora.localhost` resuelve solo a 127.0.0.1 en los navegadores
 * modernos sin tocar /etc/hosts, así que en desarrollo se puede abrir
 * `http://constructora.localhost:3001` y ejercitar el MISMO rewrite que
 * producción. Sin esto, el subdominio solo sería verificable ya publicado.
 */
const CONSTRUCTORA_HOSTS = new Set([CONSTRUCTORA_HOST, 'constructora.localhost']);

/** Paths que nunca deben re-escribirse al prefijo del subdominio. */
function isInfraPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cuenta') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/contrato') ||
    pathname === '/favicon.ico'
  );
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // `host` puede venir con puerto (localhost:3000) o vacío en runtimes raros.
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();

  // ── Auth de /admin/* — PRIMERO, antes de cualquier branch por Host ────────
  // Va arriba de todo a propósito: si se evalúa después del ruteo del
  // subdominio, `constructora.jurmaq.cl/admin` cae en la rama del subdominio,
  // sale por `NextResponse.next()` y el guard de NextAuth NUNCA corre —un
  // bypass de autenticación dependiente del Host—. Poniéndolo primero, el
  // control es fail-closed en cualquier dominio que sirva esta app.
  if (pathname.startsWith('/admin')) {
    // @ts-expect-error — NextAuth middleware spread compatibility
    return authMiddleware(request);
  }

  // ── constructora.jurmaq.cl ────────────────────────────────────────────────
  // Rewrite por Host: el subdominio sirve el árbol /constructora/* sin que esa
  // carpeta aparezca en la URL. Idempotente: si el path YA trae el prefijo no
  // se vuelve a anteponer (evita /constructora/constructora/...).
  if (CONSTRUCTORA_HOSTS.has(host)) {
    if (isInfraPath(pathname) || pathname.startsWith(CONSTRUCTORA_PREFIX)) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? CONSTRUCTORA_PREFIX : `${CONSTRUCTORA_PREFIX}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // En jurmaq.cl el árbol /constructora/* NO debe ser indexable: es la misma
  // página que el subdominio. Redirigimos 301 para que exista una sola URL
  // canónica por contenido y no competir contra nosotros mismos en Google.
  //
  // Solo en el dominio productivo: en `localhost` (y en las preview URLs de
  // Vercel, donde no hay subdominio que resuelva) hay que poder abrir
  // /constructora/* directo, o el sitio sería imposible de desarrollar y de
  // revisar antes de publicar.
  const isProdHub = host === 'jurmaq.cl' || host === 'www.jurmaq.cl';

  // Los case studies de obra civil se mudaron al subdominio. 301 desde el hub
  // para traspasar el posicionamiento que ya tenía jurmaq.cl/proyectos y evitar
  // que las dos URLs compitan por la misma query.
  if (isProdHub && (pathname === '/proyectos' || pathname.startsWith('/proyectos/'))) {
    return NextResponse.redirect(
      `https://${CONSTRUCTORA_HOST}${pathname}${request.nextUrl.search}`,
      { status: 301 }
    );
  }

  if (isProdHub && (pathname === CONSTRUCTORA_PREFIX || pathname.startsWith(`${CONSTRUCTORA_PREFIX}/`))) {
    const suffix = pathname === CONSTRUCTORA_PREFIX ? '' : pathname.slice(CONSTRUCTORA_PREFIX.length);
    return NextResponse.redirect(
      `https://${CONSTRUCTORA_HOST}${suffix}${request.nextUrl.search}`,
      { status: 301 }
    );
  }

  // En apps/constructora el dominio canónico es jurmaq.cl directo.
  // Si alguien llega a /barraca/* → redirect a barraca.jurmaq.cl
  if (pathname === '/barraca' || pathname.startsWith('/barraca/')) {
    const suffix = pathname === '/barraca' ? '' : pathname.replace(/^\/barraca/, '');
    return NextResponse.redirect(
      `https://barraca.jurmaq.cl${suffix}${request.nextUrl.search}`,
      { status: 301 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluye TODO lo estático, no solo _next. Ver la nota equivalente en
    // apps/barraca/src/middleware.ts: cada ejecución del middleware es una
    // Edge Request facturable, y con el patrón anterior corría también en las
    // 82 imágenes de /public y en el brochure PDF de 8,5 MB.
    //
    // OJO: acá NO se excluyen .txt ni .xml. En esta app el middleware es
    // justamente quien sirve `constructora.jurmaq.cl/robots.txt` y
    // `/sitemap.xml` (los reescribe a /constructora/*); si los sacara del
    // matcher, el subdominio devolvería el robots del hub o un 404.
    '/((?!_next/|images/|img/|icons/|pdf/|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|pdf|woff|woff2|ttf|mp4)$).*)',
  ],
};
