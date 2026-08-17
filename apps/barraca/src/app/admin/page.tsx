import { redirect } from 'next/navigation';

/**
 * `/admin` de barraca → redirige a `/admin/dashboard`.
 *
 * Había DOS dashboards de barraca y el que estaba en la raíz era el malo:
 *
 * - Filtraba las cotizaciones por `estado === 'nueva' || 'abierta'`, estados
 *   que no existen en la base (los reales son 'pendiente', 'aprobada',
 *   'pagada'), así que el KPI "Cotizaciones nuevas" marcaba 0 habiendo 10
 *   pendientes.
 * - Leía `subsRes.total` de `/api/suscriptores`, que devuelve un array pelado
 *   sin `.total`, así que "Suscriptores" marcaba 0 habiendo 18.
 * - Calculaba todo en el cliente contra endpoints públicos.
 *
 * `/admin/dashboard` hace lo mismo bien: server-side, con los estados que sí
 * existen, comparativa contra el período anterior y top de productos. Estaba
 * escondido, sin entrada de menú.
 *
 * Se conserva la redirección (y no se borra la ruta) porque `/admin` es la URL
 * que la gente tiene en marcadores y a la que apunta el login.
 */
export default function AdminBarracaRoot() {
  redirect('/admin/dashboard');
}
