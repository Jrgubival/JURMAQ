/** Enlaces entre guías y páginas de máquina, en ambos sentidos. */
export const GUIAS_POR_TIPO: Record<string, string[]> = {
  retroexcavadora: ['valor-hora-retroexcavadora', 'precio-arriendo-retroexcavadora-chile', 'diferencia-retroexcavadora-miniexcavadora', 'que-maquinaria-elegir-fundacion-casa'],
  miniexcavadora: ['arriendo-miniexcavadora-xcmg-xe35u', 'diferencia-retroexcavadora-miniexcavadora', 'como-calcular-volumen-excavacion-zanja'],
  minicargador: ['arriendo-minicargador-implementos', 'arriendo-maquinaria-con-o-sin-operador'],
  'camion-tolva': ['como-calcular-volumen-excavacion-zanja', 'arriendo-maquinaria-con-o-sin-operador'],
  'brazo-articulado': ['arriendo-maquinaria-con-o-sin-operador', 'seguros-y-responsabilidad-arriendo-maquinaria'],
  alzahombre: ['seguros-y-responsabilidad-arriendo-maquinaria', 'glosario-maquinaria-construccion'],
  'plataforma-elevadora': ['seguros-y-responsabilidad-arriendo-maquinaria', 'glosario-maquinaria-construccion'],
};

export function tiposDeGuia(slug: string): string[] {
  return Object.entries(GUIAS_POR_TIPO).filter(([, g]) => g.includes(slug)).map(([t]) => t);
}
