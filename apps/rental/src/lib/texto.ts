/** Corta en un límite de palabra, sin dejar puntuación colgando. */
export function cortar(texto: string, maximo = 155): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo + 1);
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,;:.]+$/, '') + '.';
}
