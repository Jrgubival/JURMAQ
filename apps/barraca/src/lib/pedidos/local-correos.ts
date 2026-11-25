import 'server-only';
import { leerLocalSeguro } from '@/lib/contenido/local-seguro';
import { textosLocal, type TextosLocal } from './textos-local';

/** Textos del local para los correos de pedido (fuente única con respaldo en código). */
export async function textosDelLocal(): Promise<TextosLocal> {
  return textosLocal(await leerLocalSeguro());
}
