"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ejesDe, valorNumerico } from "@/lib/variantes";

/**
 * Selector de medida por ejes.
 *
 * Antes las variantes salían como una fila de píldoras con la medida completa
 * ("40 x 20 x 2.0 MM"), y con 50 tubos rectangulares eso son 50 píldoras casi
 * idénticas: hay que leerlas una por una para encontrar la que se busca.
 *
 * Acá la medida se parte en sus ejes reales —Ancho, Alto, Espesor— y cada eje
 * tiene su propia fila. Elegir deja de ser "buscar mi string entre cincuenta"
 * y pasa a ser lo que se hace en el mesón: primero el perfil, después el
 * espesor.
 *
 * Las combinaciones que no existen en bodega se dibujan apagadas en vez de
 * desaparecer: que el 6 mm figure y esté gris dice "existe pero no lo tengo",
 * que es información. Si desapareciera, el comprador no sabría si no existe o
 * si lo está buscando mal.
 */

export interface VarianteMedida {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  medida: string | null;
}

export default function SelectorMedidas({
  variantes,
  actualId,
  nombreBase,
}: {
  variantes: VarianteMedida[];
  actualId: number;
  nombreBase: string;
}) {
  const router = useRouter();

  const { ejes, actual } = useMemo(() => {
    const actual = variantes.find((v) => v.id === actualId) || null;

    // Cada variante, descompuesta en sus ejes.
    const porVariante = new Map<number, string[]>();
    let etiquetas: string[] = [];
    for (const v of variantes) {
      const e = ejesDe(v.nombre, v.medida);
      if (e.length > etiquetas.length) etiquetas = e.map((x) => x.etiqueta);
      porVariante.set(v.id, e.map((x) => x.valor));
    }
    if (!etiquetas.length) return { ejes: [], actual };

    const valoresActual = actual ? porVariante.get(actual.id) || [] : [];

    const ejes = etiquetas.map((etiqueta, i) => {
      // Una opción es elegible si EXISTE en este eje. Al tocarla se salta a la
      // variante más parecida a la actual, conservando los demás ejes donde se
      // pueda.
      //
      // La primera versión exigía que la opción fuera compatible con TODO lo ya
      // elegido, y con tres ejes eso deja casi todo bloqueado: parado en
      // 30x20x1.5, de diez anchos sólo dos eran clicables y no había forma de
      // llegar al resto. Un selector que no deja moverse no es un selector.
      const porValor = new Map<string, VarianteMedida[]>();
      for (const v of variantes) {
        const valor = (porVariante.get(v.id) || [])[i];
        if (!valor) continue;
        const lista = porValor.get(valor);
        if (lista) lista.push(v);
        else porValor.set(valor, [v]);
      }

      const opciones = [...porValor.entries()]
        .map(([valor, candidatas]) => {
          // La mejor candidata es la que comparte más ejes con la actual;
          // a igualdad, la que tenga stock.
          const mejor = candidatas
            .map((v) => {
              const vals = porVariante.get(v.id) || [];
              const coincidencias = vals.filter((x, j) => j !== i && x === valoresActual[j]).length;
              return { v, coincidencias };
            })
            .sort(
              (a, b) =>
                b.coincidencias - a.coincidencias ||
                Number(b.v.stock > 0) - Number(a.v.stock > 0),
            )[0];
          return {
            valor,
            variante: mejor?.v ?? null,
            hayStock: candidatas.some((v) => v.stock > 0),
            exacta: (mejor?.coincidencias ?? 0) === etiquetas.length - 1,
          };
        })
        .sort((a, b) => valorNumerico(a.valor) - valorNumerico(b.valor));

      return { etiqueta, opciones, seleccionado: valoresActual[i] };
    });

    return { ejes, actual };
  }, [variantes, actualId]);

  if (variantes.length < 2 || !ejes.length) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em]">
          Elige la medida
        </h3>
        <span className="text-xs text-gray-500">
          <span className="tabular-nums">{variantes.length}</span> medidas de {nombreBase}
        </span>
      </div>

      {ejes.map((eje) => (
        <div key={eje.etiqueta}>
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-semibold text-navy-950">{eje.etiqueta}:</span>{" "}
            <span className="tabular-nums">{eje.seleccionado || "—"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {eje.opciones.map((op) => {
              const esActual = op.valor === eje.seleccionado;
              const alcanzable = !!op.variante;
              return (
                <button
                  key={op.valor}
                  type="button"
                  disabled={!alcanzable || esActual}
                  aria-pressed={esActual}
                  title={
                    !op.exacta && alcanzable
                      ? "No existe con las otras medidas elegidas; te lleva a la más parecida"
                      : op.hayStock
                        ? undefined
                        : "Sobre pedido"
                  }
                  onClick={() => {
                    if (op.variante) router.push(`/producto/${op.variante.slug}`);
                  }}
                  className={[
                    "min-h-[44px] min-w-[72px] px-4 py-2 text-sm rounded-lg border tabular-nums transition-colors",
                    esActual
                      ? "border-marca-600 bg-marca-50 text-marca-700 font-semibold"
                      : op.exacta
                        ? "border-gray-300 bg-white text-gray-800 hover:border-navy-800 hover:text-navy-950"
                        : // Existe en este eje, pero no combinado con lo demás
                          // elegido: se puede tocar y lleva a la más parecida.
                          // Borde punteado para que se note que el salto cambia
                          // otra medida.
                          "border-dashed border-gray-300 bg-white text-gray-500 hover:border-navy-800 hover:text-navy-950",
                  ].join(" ")}
                >
                  {op.valor}
                  {alcanzable && !op.hayStock && (
                    <span className="ml-1.5 text-[10px] text-gray-500 font-normal">
                      s/ pedido
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {actual?.medida && (
        <p className="text-xs text-gray-500 tabular-nums">
          Elegido: {actual.medida}
          {actual.stock > 0 ? ` · ${actual.stock} en stock` : " · sobre pedido"}
        </p>
      )}
    </div>
  );
}
