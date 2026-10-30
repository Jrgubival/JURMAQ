"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ejesDe, valorNumerico } from "@/lib/variantes";

/**
 * Selector de medida en cascada.
 *
 * El catálogo NO es una matriz. Un ángulo doblado existe en 30x30 y en 80x80,
 * nunca en 30x50; un tubo rectangular de 30x20 viene en 1.5 y 2.0 mm, pero el
 * de 150x50 sólo en 2.0 y 3.0. Son combinaciones sueltas: las que hay en
 * bodega.
 *
 * La primera versión dibujaba Ancho, Alto y Espesor como tres ejes
 * independientes, con píldoras "punteadas" que saltaban a la variante más
 * parecida cuando la combinación no existía. Eso ofrecía 30 x 50 como si se
 * pudiera pedir, y el dueño lo dijo con toda razón: "no puedo hacer una
 * combinación, si sólo existe el 50x50; 30x30 sólo da esas opciones".
 *
 * Ahora:
 *  1. Dos ejes que son SIEMPRE iguales en toda la familia (el ancho y el alto
 *     de un ángulo, el lado de un tubo cuadrado) se muestran como uno solo.
 *  2. Cada eje muestra únicamente los valores que existen con lo ya elegido en
 *     los ejes anteriores. Elegido 30x30, en Espesor aparecen sólo los
 *     espesores que hay para 30x30. Nada apagado, nada que salte a otro lado.
 *  3. Al cambiar un eje, los ejes posteriores se resuelven a una combinación
 *     que exista de verdad, con stock si se puede.
 */

export interface VarianteMedida {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  medida: string | null;
}

interface Opcion {
  valor: string;
  variante: VarianteMedida;
  hayStock: boolean;
}

interface Eje {
  etiqueta: string;
  opciones: Opcion[];
  seleccionado?: string;
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

    const porVariante = new Map<number, string[]>();
    let etiquetas: string[] = [];
    for (const v of variantes) {
      const e = ejesDe(v.nombre, v.medida);
      if (e.length > etiquetas.length) etiquetas = e.map((x) => x.etiqueta);
      porVariante.set(v.id, e.map((x) => x.valor));
    }
    if (!etiquetas.length) return { ejes: [] as Eje[], actual };

    const vals = (v: VarianteMedida) => porVariante.get(v.id) || [];

    // 1) Colapsar ejes que son iguales en TODAS las variantes de la familia.
    const visibles: number[] = [];
    const nombres: string[] = [];
    const absorbidos = new Set<number>();
    for (let i = 0; i < etiquetas.length; i++) {
      if (absorbidos.has(i)) continue;
      let nombre = etiquetas[i];
      for (let j = i + 1; j < etiquetas.length; j++) {
        if (absorbidos.has(j)) continue;
        const iguales = variantes.every((v) => vals(v)[i] !== undefined && vals(v)[i] === vals(v)[j]);
        if (iguales) {
          absorbidos.add(j);
          if (etiquetas[i] === "Ancho" && etiquetas[j] === "Alto") nombre = "Lado";
        }
      }
      visibles.push(i);
      nombres.push(nombre);
    }

    const valoresActual = actual ? vals(actual) : [];

    // 2) Cascada: el eje k sólo ofrece valores compatibles con los ejes < k.
    const ejes: Eje[] = visibles.map((idx, k) => {
      const previos = visibles.slice(0, k);
      const compatibles = variantes.filter((v) =>
        previos.every((p) => valoresActual[p] === undefined || vals(v)[p] === valoresActual[p]),
      );

      const porValor = new Map<string, VarianteMedida[]>();
      for (const v of compatibles) {
        const valor = vals(v)[idx];
        if (!valor) continue;
        const lista = porValor.get(valor);
        if (lista) lista.push(v);
        else porValor.set(valor, [v]);
      }

      // 3) Destino de cada opción: la variante que además conserva lo elegido
      //    en los ejes posteriores; a igualdad, la que tenga stock.
      const posteriores = visibles.slice(k + 1);
      const opciones = [...porValor.entries()]
        .map(([valor, candidatas]) => {
          const mejor = candidatas
            .map((v) => ({
              v,
              coinc: posteriores.filter((p) => vals(v)[p] === valoresActual[p]).length,
            }))
            .sort((a, b) => b.coinc - a.coinc || Number(b.v.stock > 0) - Number(a.v.stock > 0))[0];
          return { valor, variante: mejor.v, hayStock: candidatas.some((v) => v.stock > 0) };
        })
        .sort((a, b) => valorNumerico(a.valor) - valorNumerico(b.valor));

      return { etiqueta: nombres[k], opciones, seleccionado: valoresActual[idx] };
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
              return (
                <button
                  key={op.valor}
                  type="button"
                  disabled={esActual}
                  aria-pressed={esActual}
                  title={op.hayStock ? undefined : "No disponible"}
                  onClick={() => router.push(`/producto/${op.variante.slug}`)}
                  className={[
                    "min-h-[44px] min-w-[72px] px-4 py-2 text-sm rounded-lg border tabular-nums",
                    "transition-[border-color,color] duration-150 ease-out",
                    // Sin stock: en gris, como en las tiendas grandes. Se puede
                    // tocar igual (la ficha dice "No disponible").
                    esActual
                      ? op.hayStock
                        ? "border-navy-950 bg-navy-950 text-white font-semibold"
                        : "border-gray-400 bg-gray-100 text-gray-500 font-semibold"
                      : op.hayStock
                        ? "border-gray-300 bg-white text-gray-800 hover:border-navy-950 hover:text-navy-950"
                        : "border-gray-200 bg-gray-50 text-gray-400 line-through decoration-gray-300",
                  ].join(" ")}
                >
                  {op.valor}
                </button>
              );
            })}
          </div>
        </div>
      ))}

    </div>
  );
}
