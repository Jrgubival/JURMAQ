import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@jurmaq/shared/env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Admin client (RLS bypass). Usar SOLO en handlers protegidos por
 * requirePermission()/auth, en seed scripts, cron jobs, o migraciones.
 *
 * NUNCA en endpoints publicos sin auth ni en server components que
 * solo necesiten leer datos publicos. Cada vez que lo importas estas
 * confiando en que la logica del handler es la unica defensa contra
 * cualquier abuso de input — un bug de validacion = bypass total de RLS.
 *
 * Para lecturas publicas (catalogo, sitemap, paginas SEO) usar
 * `supabasePublic` que respeta RLS y solo expone lo que las policies
 * permitan al rol anon.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Anon client (respeta RLS). Para lectores publicos: sitemaps, paginas
 * de catalogo, productos publicados. Lo que el rol anon no puede ver,
 * Postgres lo bloquea automaticamente — el codigo no necesita validar.
 *
 * Requiere que las tablas tengan RLS habilitado y policies de SELECT
 * apropiadas (ver scripts/enable-rls.sql + harden-rls.js).
 */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
