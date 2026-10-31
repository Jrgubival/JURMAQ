"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/barraca/Enlace";
import { formatCLP } from "@jurmaq/shared/format";
import { HORARIO_BARRACA } from "@jurmaq/shared/seo";
import { trackEvents } from "@/lib/analytics";
import { useCarrito } from "@/lib/useCarrito";
import { totalLinea } from "@/lib/combos";
import { descuentoTransferencia, DESCUENTO_TRANSFERENCIA_PCT } from "@/lib/pagos/descuento-transferencia";
import LineaCombo from "@/components/barraca/LineaCombo";
import { reemplazarCarrito, vaciarCarrito, type ItemRevisado } from "@/lib/carrito";
import { rutValido } from "@/lib/rut";
import { precioWebHastaNumerico } from "@/lib/vigencia";
import { ZONAS_DESPACHO, CLAVE_ZONA, zonaPorId } from "@/lib/despacho/zonas";
import { useZonas, zonaEn } from "@/lib/despacho/zonas-cliente";
import { buildWhatsappUrl, SALUDO_WEB_BARRACA } from "@jurmaq/shared/whatsapp";

/**
 * Checkout en una sola página, una columna: datos → entrega → pago.
 * Son tres grupos cortos; partirlo en pasos sumaría clics sin aliviar nada.
 * Validación al salir de cada campo; el botón dice lo que hace ("Pagar $X").
 */

type Campo = "nombre" | "email" | "telefono" | "rut" | "direccion" | "comuna"
  | "facturaRazonSocial" | "facturaRut" | "facturaGiro" | "facturaDireccion" | "facturaComuna";
const CAMPOS_FACTURA: Campo[] = ["facturaRazonSocial", "facturaRut", "facturaGiro", "facturaDireccion", "facturaComuna"];
type Datos = Record<Campo | "notas", string>;

/** El selector muestra sólo las zonas de despacho (zonas.ts) y "mi comuna no está". */
const OTRA_COMUNA = "otra";
const CODIGOS = new Set([...ZONAS_DESPACHO.map((z) => z.id), OTRA_COMUNA]);
/** Antes se guardaba la comuna (código o texto): se intenta reconocerla. */
function codigoGuardado(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  if (CODIGOS.has(v)) return v;
  const n = v.trim().toLowerCase();
  return ZONAS_DESPACHO.find((z) => z.nombre.toLowerCase() === n || z.comuna === v)?.id ?? "";
}
const WHATSAPP_OTRA_COMUNA = buildWhatsappUrl({
  text: `${SALUDO_WEB_BARRACA} y quiero cotizar un despacho a mi comuna`,
  utm_content: "barraca_checkout_otra_comuna",
  utm_campaign: "barraca_despacho",
});
/** Zona elegida en el selector del header, si hay. */
function zonaDelHeader(): string {
  try {
    return zonaPorId(localStorage.getItem(CLAVE_ZONA))?.id ?? "";
  } catch {
    return "";
  }
}

type Cotizacion =
  | { estado: "cargando" }
  | { estado: "ok"; tipo: "propio" | "courier"; costo: number | null; detalle: string; comuna: string; dias?: number | null; simulado?: boolean }
  | { estado: "bloqueado"; motivo: string; productos: string[]; comuna: string; whatsapp?: string }
  | { estado: "sin_servicio" | "error"; motivo: string; whatsapp?: string };

const VACIO: Datos = {
  nombre: "", email: "", telefono: "", rut: "", direccion: "", comuna: "", notas: "",
  facturaRazonSocial: "", facturaRut: "", facturaGiro: "", facturaDireccion: "", facturaComuna: "",
};
const CLAVE_DATOS = "barraca_checkout_datos";

function validar(c: Campo, v: string, despacho: boolean, factura = false): string | null {
  const t = v.trim();
  switch (c) {
    case "facturaRazonSocial": return !factura || t.length >= 2 ? null : "Escribe la razón social de la empresa.";
    case "facturaRut": return !factura || rutValido(t) ? null : "El RUT de la empresa no es válido. Revisa el dígito verificador.";
    case "facturaGiro": return !factura || t.length >= 2 ? null : "Escribe el giro de la empresa.";
    case "facturaDireccion": return !factura || t.length >= 5 ? null : "Escribe la dirección comercial.";
    case "facturaComuna": return !factura || t.length >= 2 ? null : "Escribe la comuna.";
    case "nombre": return t.length >= 3 ? null : "Escribe tu nombre y apellido.";
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? null : "Revisa el correo: ahí te llega el detalle del pedido.";
    case "telefono": return t.replace(/\D/g, "").length >= 8 ? null : "Escribe un teléfono de al menos 8 dígitos.";
    case "rut": return !t || rutValido(t) ? null : "El RUT no es válido. Revisa el dígito verificador.";
    case "direccion": return !despacho || t.length >= 5 ? null : "Escribe la dirección de despacho.";
    case "comuna": return !despacho || CODIGOS.has(t) ? null : "Elige la comuna.";
  }
}

function CampoForm({
  id, label, opcional, ayuda, error, children,
}: { id: string; label: string; opcional?: boolean; ayuda?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#111111] mb-1.5">
        {label}
        {opcional && <span className="font-normal text-[#787774]"> (opcional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-red-700 flex items-start gap-1.5">
          <svg className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1.5 text-[13px] text-[#787774]">{ayuda}</p>
      ) : null}
    </div>
  );
}

const claseInput = (error?: string | null) =>
  `w-full h-12 px-3.5 text-base text-[#111111] bg-white border rounded-lg placeholder:text-[#A8A8A4] focus:outline-none focus:ring-2 transition-colors ${
    error ? "border-red-500 focus:ring-red-200" : "border-gray-300 focus:border-navy-950 focus:ring-navy-950/10"
  }`;

function Opcion({
  nombre, valor, actual, onChange, titulo, detalle, deshabilitada, etiqueta,
}: {
  nombre: string; valor: string; actual: string; onChange: (v: string) => void;
  titulo: string; detalle: string; deshabilitada?: boolean;
  /** Texto chico junto al título, p. ej. "2% de descuento". */
  etiqueta?: string;
}) {
  const activa = actual === valor;
  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-colors ${
        deshabilitada ? "opacity-50 cursor-not-allowed border-gray-200" : activa ? "border-navy-950 bg-[#F7F7F5] cursor-pointer" : "border-gray-200 hover:border-gray-400 cursor-pointer"
      }`}
    >
      <input
        type="radio"
        name={nombre}
        value={valor}
        checked={activa}
        disabled={deshabilitada}
        onChange={() => onChange(valor)}
        className="mt-1 w-4 h-4 accent-[#0c1d3a] shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#111111]">
          {titulo}
          {etiqueta && <span className="ml-2 text-[13px] font-medium text-[#2F7F4E]">{etiqueta}</span>}
        </span>
        <span className="block text-[13px] text-[#5A5A57] mt-0.5">{detalle}</span>
      </span>
    </label>
  );
}

/** Lo que pasa con el despacho a la comuna elegida, justo debajo del selector. */
function EstadoDespacho({ cotizacion, onRetiro }: { cotizacion: Cotizacion | null; onRetiro: () => void }) {
  if (!cotizacion) return null;
  if (cotizacion.estado === "cargando") {
    return (
      <p id="co-despacho-estado" aria-live="polite" className="text-[13px] text-[#787774] flex items-center gap-2">
        <span className="w-3.5 h-3.5 border-2 border-[#C9C9C5] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        Calculando el despacho…
      </p>
    );
  }
  if (cotizacion.estado === "ok") {
    const monto = cotizacion.costo == null ? "a coordinar" : cotizacion.costo === 0 ? "gratis" : formatCLP(cotizacion.costo);
    return (
      <div id="co-despacho-estado" aria-live="polite" className="rounded-lg bg-[#F7F7F5] border border-[#EAEAEA] px-4 py-3 text-sm">
        <p className="font-semibold text-[#111111]">
          {cotizacion.tipo === "propio" ? "Despacho a domicilio" : "Envío por courier"} · <span className="tabular-nums">{monto}</span>
          {cotizacion.simulado && (
            <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-wide rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">Tarifa de ejemplo</span>
          )}
        </p>
        <p className="text-[13px] text-[#5A5A57] mt-0.5">{cotizacion.detalle}</p>
      </div>
    );
  }
  return (
    <div id="co-despacho-estado" role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm">
      <p className="font-semibold text-red-800">
        {cotizacion.estado === "bloqueado" ? `No despachamos este carrito a ${cotizacion.comuna}` : "Despacho no disponible"}
      </p>
      <p className="text-[13px] text-red-800/90 mt-1">{cotizacion.motivo}</p>
      {cotizacion.estado === "bloqueado" && cotizacion.productos.length > 0 && (
        <ul className="mt-2 text-[13px] text-red-900 list-disc pl-5 space-y-0.5">
          {cotizacion.productos.slice(0, 5).map((n) => <li key={n}>{n}</li>)}
          {cotizacion.productos.length > 5 && <li>y {cotizacion.productos.length - 5} más</li>}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onRetiro} className="min-h-[40px] px-4 rounded-lg bg-white border border-red-300 text-sm font-semibold text-red-800 hover:bg-red-100">
          Retirar en la barraca
        </button>
        {"whatsapp" in cotizacion && cotizacion.whatsapp?.startsWith("https://wa.me/") && (
          <a href={cotizacion.whatsapp} target="_blank" rel="noopener noreferrer" className="min-h-[40px] inline-flex items-center px-4 rounded-lg bg-white border border-red-300 text-sm font-semibold text-red-800 hover:bg-red-100">
            Cotizar despacho por WhatsApp
          </a>
        )}
        {cotizacion.estado === "bloqueado" && (
          <Link href="/carrito" className="min-h-[40px] inline-flex items-center px-4 rounded-lg text-sm font-semibold text-red-800 underline underline-offset-2">
            Editar carrito
          </Link>
        )}
      </div>
    </div>
  );
}

/** "Te faltan $X para despacho gratis" o "Despacho gratis", según la zona elegida. */
function AvisoGratis({ zonaId, subtotal, alineado = "derecha" }: { zonaId: string; subtotal: number; alineado?: "derecha" | "izquierda" }) {
  const z = zonaEn(useZonas(), zonaId);
  if (!z || z.costo === 0 || z.gratisDesde == null) return null;
  const falta = z.gratisDesde - subtotal;
  return (
    <p className={`text-xs mt-1.5 tabular-nums ${alineado === "derecha" ? "text-right" : "-mt-1"} ${falta <= 0 ? "text-[#2F7F4E] font-medium" : "text-[#787774]"}`}>
      {falta <= 0 ? `Despacho gratis a ${z.nombre}` : `Gratis desde ${formatCLP(z.gratisDesde)} · te faltan ${formatCLP(falta)}`}
    </p>
  );
}

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#EAEAEA] rounded-2xl p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold text-[#111111] mb-5">
        <span className="w-7 h-7 rounded-full bg-navy-950 text-white text-sm font-bold flex items-center justify-center tabular-nums" aria-hidden="true">{n}</span>
        {titulo}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function CheckoutClient({ pagoEnLinea }: { pagoEnLinea: boolean }) {
  const router = useRouter();
  const { items, total, ahorro, cantidad, cargando, hayProblemas } = useCarrito({ revisar: true });
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [entrega, setEntrega] = useState<"retiro" | "despacho">("retiro");
  const [metodo, setMetodo] = useState<"webpay" | "transferencia">(pagoEnLinea ? "webpay" : "transferencia");
  const [documento, setDocumento] = useState<"boleta" | "factura">("boleta");
  const factura = documento === "factura";
  const [errores, setErrores] = useState<Partial<Record<Campo, string | null>>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [errorTerminos, setErrorTerminos] = useState(false);
  const [aceptaOfertas, setAceptaOfertas] = useState(false);
  const iniciado = useRef(false);

  // Datos del comprador recordados en este navegador (no el RUT ni notas).
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_DATOS) || "{}");
      setDatos((d) => ({ ...d, nombre: g.nombre || "", email: g.email || "", telefono: g.telefono || "", direccion: g.direccion || "", comuna: zonaDelHeader() || codigoGuardado(g.comuna) }));
    } catch { /* sin datos guardados */ }
  }, []);

  useEffect(() => {
    if (cargando || iniciado.current || items.length === 0) return;
    iniciado.current = true;
    trackEvents.beginCheckout(items.map((i) => ({ id: i.productoId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })));
  }, [cargando, items]);

  const despacho = entrega === "despacho";
  const zonas = useZonas();
  // Costo del despacho para la comuna elegida. Es sólo para mostrarlo: al
  // crear el pedido el servidor lo calcula de nuevo y cobra ese. La respuesta
  // se guarda con la consulta que la pidió, así una vieja nunca se muestra.
  const claveItems = items.map((i) => `${i.productoId}x${i.cantidad}`).join(",");
  const otraComuna = despacho && datos.comuna === OTRA_COMUNA;
  const consulta = despacho && !otraComuna && CODIGOS.has(datos.comuna) && claveItems ? `${datos.comuna}|${claveItems}` : null;
  const [respuesta, setRespuesta] = useState<{ consulta: string; cotizacion: Cotizacion } | null>(null);
  const cotizacion: Cotizacion | null = otraComuna
    ? { estado: "sin_servicio", motivo: "Por ahora despachamos sólo a las zonas de la lista. Puedes retirar gratis en la barraca o cotizar el despacho a tu comuna por WhatsApp.", whatsapp: WHATSAPP_OTRA_COMUNA }
    : !consulta
    ? null
    : respuesta?.consulta === consulta ? respuesta.cotizacion : { estado: "cargando" };

  useEffect(() => {
    if (!consulta) return;
    const [comuna, lista] = consulta.split("|");
    const ctrl = new AbortController();
    const fijar = (c: Cotizacion) => setRespuesta({ consulta, cotizacion: c });
    fetch("/api/tienda/despacho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comuna,
        items: lista.split(",").map((s) => {
          const [id, cant] = s.split("x");
          return { productoId: Number(id), cantidad: Number(cant) };
        }),
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        fijar(res.ok ? (data as Cotizacion) : { estado: "error", motivo: data.error || "No pudimos calcular el despacho. Intenta de nuevo." });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") fijar({ estado: "error", motivo: "Se cortó la conexión al calcular el despacho." });
      });
    return () => ctrl.abort();
  }, [consulta]);

  const costoDespacho = despacho && cotizacion?.estado === "ok" ? cotizacion.costo : null;
  // Vista previa: el descuento que vale es el que calcula el servidor al crear el pedido.
  const descuento = metodo === "transferencia" ? descuentoTransferencia(total) : 0;
  const totalPedido = total - descuento + (costoDespacho ?? 0);
  const despachoListo = !despacho || cotizacion?.estado === "ok";

  const set = (c: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setDatos((d) => ({ ...d, [c]: v }));
    // Un error ya mostrado se va apenas el valor queda válido, no antes.
    if (c !== "notas" && errores[c as Campo]) {
      setErrores((er) => ({ ...er, [c]: validar(c as Campo, v, despacho, factura) }));
    }
  };
  const blur = (c: Campo) => () => setErrores((er) => ({ ...er, [c]: validar(c, datos[c], despacho, factura) }));
  const props = (c: Campo) => ({
    id: `co-${c}`,
    value: datos[c],
    onChange: set(c),
    onBlur: blur(c),
    "aria-invalid": !!errores[c] || undefined,
    "aria-describedby": errores[c] ? `co-${c}-error` : undefined,
    className: claseInput(errores[c]),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrorEnvio(null);
    const campos: Campo[] = [
      "nombre", "email", "telefono", "rut",
      ...(factura ? CAMPOS_FACTURA : []),
      ...(despacho ? (["comuna", "direccion"] as Campo[]) : []),
    ];
    const nuevos: Partial<Record<Campo, string | null>> = {};
    for (const c of campos) nuevos[c] = validar(c, datos[c], despacho, factura);
    setErrores(nuevos);
    const primero = campos.find((c) => nuevos[c]);
    if (primero) {
      document.getElementById(`co-${primero}`)?.focus();
      return;
    }
    if (!aceptaTerminos) {
      setErrorTerminos(true);
      document.getElementById("co-terminos")?.focus();
      return;
    }
    if (!despachoListo) {
      setErrorEnvio(
        cotizacion?.estado === "cargando" || !cotizacion
          ? "Espera un segundo: estamos calculando el despacho."
          : "El despacho a esa comuna no está disponible para este carrito. Elige retiro en la barraca o cambia la comuna.",
      );
      document.getElementById("co-despacho-estado")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setEnviando(true);
    try {
      try {
        localStorage.setItem(CLAVE_DATOS, JSON.stringify({ nombre: datos.nombre, email: datos.email, telefono: datos.telefono, direccion: datos.direccion, comuna: datos.comuna }));
      } catch { /* no se pudo recordar: da igual */ }
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
          totalProductos: total,
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          rut: datos.rut,
          entrega,
          direccion: despacho ? datos.direccion : "",
          comuna: despacho ? datos.comuna : "",
          metodoPago: metodo,
          notas: datos.notas,
          documento,
          ...(factura
            ? {
                facturaRazonSocial: datos.facturaRazonSocial,
                facturaRut: datos.facturaRut,
                facturaGiro: datos.facturaGiro,
                facturaDireccion: datos.facturaDireccion,
                facturaComuna: datos.facturaComuna,
              }
            : {}),
          aceptaTerminos,
          aceptaOfertas,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.items)) {
          // El stock o el precio cambió: se actualiza el carrito y se vuelve a él.
          reemplazarCarrito((data.items as ItemRevisado[]).map(({ problema: _p, ...r }) => r));
          router.push("/carrito");
          return;
        }
        setErrorEnvio(data.error || "No pudimos registrar tu pedido. Intenta de nuevo.");
        return;
      }
      try {
        sessionStorage.setItem(`pedido_items_${data.numero}`, JSON.stringify(items.map((i) => ({ id: i.productoId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }))));
      } catch { /* sólo para analítica */ }
      vaciarCarrito();
      window.location.href = data.redirect;
    } catch {
      setErrorEnvio("Se cortó la conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-marca-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0 || hayProblemas) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-[#111111] mb-3">
          {items.length === 0 ? "Tu carrito está vacío" : "Revisa tu carrito"}
        </h1>
        <p className="text-[#5A5A57] mb-8">
          {items.length === 0 ? "Agrega productos para comprar." : "Algunos productos ya no tienen stock o cambiaron."}
        </p>
        <Link href={items.length === 0 ? "/categorias" : "/carrito"} className="inline-flex items-center px-6 py-3 bg-navy-950 text-white text-sm font-medium rounded-lg">
          {items.length === 0 ? "Explorar categorías" : "Volver al carrito"}
        </Link>
      </div>
    );
  }

  const etiquetaBoton = metodo === "webpay" ? `Pagar ${formatCLP(totalPedido)}` : "Confirmar pedido";
  const montoFila = !despacho
    ? "Gratis"
    : cotizacion?.estado === "ok"
      ? cotizacion.costo == null ? "A coordinar" : cotizacion.costo === 0 ? "Gratis" : formatCLP(cotizacion.costo)
      : cotizacion?.estado === "cargando" ? "Calculando…" : datos.comuna ? "No disponible" : "Elige zona";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-[#787774] mb-8">
        <Link href="/carrito" className="hover:text-[#111111] transition-colors">Carrito</Link>
        <svg className="w-3.5 h-3.5 text-[#C9C9C5]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[#111111] font-medium">Finalizar compra</span>
      </nav>

      <h1
        className="text-[#111111] leading-[1.1] mb-8"
        style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.01em" }}
      >
        Finalizar <span style={{ fontWeight: 400 }}>compra</span>
      </h1>

      <form onSubmit={enviar} noValidate className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 w-full space-y-5">
          <Seccion n={1} titulo="Tus datos">
            <CampoForm id="co-nombre" label="Nombre y apellido" error={errores.nombre}>
              <input {...props("nombre")} type="text" autoComplete="name" />
            </CampoForm>
            <CampoForm id="co-email" label="Correo" ayuda="Te mandamos el detalle del pedido." error={errores.email}>
              <input {...props("email")} type="email" inputMode="email" autoComplete="email" placeholder="nombre@correo.cl" />
            </CampoForm>
            <CampoForm id="co-telefono" label="Teléfono" ayuda="Para avisarte cuando esté listo o coordinar el despacho." error={errores.telefono}>
              <input {...props("telefono")} type="tel" inputMode="tel" autoComplete="tel" placeholder="+56 9 1234 5678" />
            </CampoForm>
            <CampoForm id="co-rut" label="Tu RUT" opcional error={errores.rut}>
              <input {...props("rut")} type="text" autoComplete="off" placeholder="12.345.678-5" />
            </CampoForm>
            <fieldset>
              <legend className="block text-sm font-medium text-[#111111] mb-1.5">Documento</legend>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Documento tributario">
                <Opcion nombre="documento" valor="boleta" actual={documento} onChange={(v) => setDocumento(v as "boleta")}
                  titulo="Boleta" detalle="Para personas." />
                <Opcion nombre="documento" valor="factura" actual={documento} onChange={(v) => setDocumento(v as "factura")}
                  titulo="Factura" detalle="Para empresas." />
              </div>
            </fieldset>
            {factura && (
              <div className="space-y-4 rounded-xl bg-[#F7F7F5] border border-[#EAEAEA] p-4">
                <p className="text-[13px] text-[#5A5A57]">Datos de la empresa para la factura. Te la mandamos por correo.</p>
                <CampoForm id="co-facturaRazonSocial" label="Razón social" error={errores.facturaRazonSocial}>
                  <input {...props("facturaRazonSocial")} type="text" autoComplete="organization" maxLength={150} placeholder="Constructora Ejemplo SpA" />
                </CampoForm>
                <CampoForm id="co-facturaRut" label="RUT de la empresa" error={errores.facturaRut}>
                  <input {...props("facturaRut")} type="text" autoComplete="off" maxLength={14} placeholder="76.123.456-0" />
                </CampoForm>
                <CampoForm id="co-facturaGiro" label="Giro" error={errores.facturaGiro}>
                  <input {...props("facturaGiro")} type="text" autoComplete="off" maxLength={120} placeholder="Construcción" />
                </CampoForm>
                <CampoForm id="co-facturaDireccion" label="Dirección comercial" error={errores.facturaDireccion}>
                  <input {...props("facturaDireccion")} type="text" autoComplete="off" maxLength={150} placeholder="Calle y número" />
                </CampoForm>
                <CampoForm id="co-facturaComuna" label="Comuna" error={errores.facturaComuna}>
                  <input {...props("facturaComuna")} type="text" autoComplete="off" maxLength={60} placeholder="Curicó" />
                </CampoForm>
              </div>
            )}
          </Seccion>

          <Seccion n={2} titulo="Entrega">
            <div className="grid gap-3" role="radiogroup" aria-label="Forma de entrega">
              <Opcion nombre="entrega" valor="retiro" actual={entrega} onChange={(v) => setEntrega(v as "retiro")}
                titulo="Retiro en la barraca · gratis"
                detalle={`Av. Poniente 2157, Molina. ${HORARIO_BARRACA.semana}.`} />
              <Opcion nombre="entrega" valor="despacho" actual={entrega} onChange={(v) => setEntrega(v as "despacho")}
                titulo="Despacho a domicilio"
                detalle="A Molina, Curicó, Sagrada Familia, Teno, Talca y alrededores. Otras comunas: cotiza por WhatsApp." />
            </div>
            {despacho && (
              <>
                <CampoForm id="co-comuna" label="Zona de despacho" error={errores.comuna}>
                  <div className="relative">
                    <select
                      id="co-comuna"
                      value={datos.comuna}
                      onChange={set("comuna")}
                      onBlur={blur("comuna")}
                      autoComplete="address-level2"
                      aria-invalid={!!errores.comuna || undefined}
                      aria-describedby={errores.comuna ? "co-comuna-error" : "co-despacho-estado"}
                      className={`${claseInput(errores.comuna)} appearance-none pr-10`}
                    >
                      <option value="">Elige tu zona</option>
                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre} · {z.costo === 0 ? "Gratis" : formatCLP(z.costo)}
                        </option>
                      ))}
                      <option value={OTRA_COMUNA}>Mi comuna no está en la lista</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#787774]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </CampoForm>
                <EstadoDespacho cotizacion={cotizacion} onRetiro={() => setEntrega("retiro")} />
                {cotizacion?.estado === "ok" && <AvisoGratis zonaId={datos.comuna} subtotal={total} alineado="izquierda" />}
                <CampoForm id="co-direccion" label="Dirección" error={errores.direccion}>
                  <input {...props("direccion")} type="text" autoComplete="street-address" placeholder="Calle, número, depto." />
                </CampoForm>
              </>
            )}
          </Seccion>

          <Seccion n={3} titulo="Pago">
            <div className="grid gap-3" role="radiogroup" aria-label="Forma de pago">
              <Opcion nombre="pago" valor="webpay" actual={metodo} onChange={(v) => setMetodo(v as "webpay")}
                deshabilitada={!pagoEnLinea}
                titulo="Pagar en línea con Webpay"
                detalle={pagoEnLinea ? "Tarjeta de débito o crédito. Hasta 3 cuotas sin interés con tarjeta de crédito. El pedido queda confirmado al pagar." : "No disponible por ahora."} />
              <Opcion nombre="pago" valor="transferencia" actual={metodo} onChange={(v) => setMetodo(v as "transferencia")}
                titulo="Transferencia bancaria"
                etiqueta={`${DESCUENTO_TRANSFERENCIA_PCT}% de descuento`}
                detalle="Te mostramos los datos de la cuenta. Preparamos el pedido cuando veamos la transferencia." />
            </div>
            <CampoForm id="co-notas" label="Comentario para la barraca" opcional>
              <textarea id="co-notas" value={datos.notas} onChange={set("notas")} rows={2} maxLength={500}
                className="w-full px-3.5 py-3 text-base text-[#111111] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-navy-950 focus:ring-navy-950/10" />
            </CampoForm>
          </Seccion>
        </div>

        {/* Resumen + acción. En celular queda al final del formulario, junto al botón. */}
        <aside className="w-full lg:w-[360px] shrink-0 lg:sticky lg:top-40">
          <div className="bg-white border border-[#EAEAEA] rounded-2xl p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold text-[#111111] mb-4">Tu pedido ({cantidad})</h2>
            <ul className="divide-y divide-gray-100 mb-4 max-h-72 overflow-y-auto -mx-1 px-1">
              {items.map((i) => (
                <li key={i.productoId} className="py-2.5 flex justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-[#111111] leading-snug">{i.nombre}</span>
                    <span className="block text-xs text-[#787774] tabular-nums">{i.cantidad} × {formatCLP(i.precio)}</span>
                    <LineaCombo precio={i.precio} cantidad={i.cantidad} combo={i.combo} />
                  </span>
                  <span className="font-medium text-[#111111] tabular-nums shrink-0">{formatCLP(totalLinea(i.precio, i.cantidad, i.combo).total)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3 mb-5">
              <div className="flex justify-between"><span className="text-[#5A5A57]">Productos</span><span className="tabular-nums">{formatCLP(total + ahorro)}</span></div>
              {ahorro > 0 && (
                <div className="flex justify-between text-[#2F7F4E]"><span>Ahorro por cantidad</span><span className="tabular-nums">−{formatCLP(ahorro)}</span></div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-[#5A5A57]">{despacho ? `Despacho${cotizacion && "comuna" in cotizacion ? ` a ${cotizacion.comuna}` : ""}` : "Retiro en Molina"}</span>
                <span className={`tabular-nums shrink-0 ${costoDespacho ? "text-[#111111]" : "text-[#5A5A57]"}`}>{montoFila}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-[#2F7F4E]"><span>Descuento transferencia</span><span className="tabular-nums">−{formatCLP(descuento)}</span></div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                <span className="font-semibold text-[#111111]">Total</span>
                <span className="text-2xl font-extrabold text-navy-950 tabular-nums">{formatCLP(totalPedido)}</span>
              </div>
              <p className="text-xs text-[#787774] text-right">IVA incluido{despacho && costoDespacho == null ? " · despacho aparte" : ""}</p>
              {despacho && <AvisoGratis zonaId={datos.comuna} subtotal={total} />}
              <p className="text-xs text-[#787774] mt-2 leading-snug">
                {precioWebHastaNumerico() ? `Precio web válido hasta el ${precioWebHastaNumerico()}. ` : ""}Tu compra queda con el precio que confirmas. {"Lo preparamos en 1 a 5 días hábiles y te contactamos por WhatsApp o teléfono para coordinar el retiro o la entrega."}
              </p>
            </div>

            {/* Términos: obligatoria (art. 12 A). Ofertas: aparte y opcional (Privacidad, sección 4). */}
            <div className="space-y-3 mb-4">
              <label className="flex items-start gap-3 text-[13px] text-[#3F3F3D] leading-snug cursor-pointer">
                <input
                  id="co-terminos"
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => { setAceptaTerminos(e.target.checked); if (e.target.checked) setErrorTerminos(false); }}
                  aria-invalid={errorTerminos || undefined}
                  aria-describedby={errorTerminos ? "co-terminos-error" : undefined}
                  className="mt-0.5 w-5 h-5 shrink-0 accent-[#0c1d3a]"
                />
                <span>
                  Acepto los{" "}
                  <a href="/terminos" target="_blank" rel="noopener" className="underline underline-offset-2 text-[#111111]">Términos y Condiciones</a>{" "}
                  y la{" "}
                  <a href="/privacidad" target="_blank" rel="noopener" className="underline underline-offset-2 text-[#111111]">Política de Privacidad</a>.
                </span>
              </label>
              {errorTerminos && (
                <p id="co-terminos-error" className="text-[13px] text-red-700 -mt-1 pl-8">Para comprar tienes que aceptar los Términos y la Política de Privacidad.</p>
              )}
              <label className="flex items-start gap-3 text-[13px] text-[#5A5A57] leading-snug cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceptaOfertas}
                  onChange={(e) => setAceptaOfertas(e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 accent-[#0c1d3a]"
                />
                <span>Quiero recibir recordatorios y ofertas por correo <span className="text-[#787774]">(opcional)</span>.</span>
              </label>
            </div>
            {errorEnvio && (
              <p role="alert" className="mb-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorEnvio}</p>
            )}
            <button
              type="submit"
              disabled={enviando}
              className="w-full min-h-[52px] flex items-center justify-center gap-2 px-4 py-3.5 text-base font-bold bg-marca-600 text-white rounded-lg hover:bg-marca-700 disabled:opacity-70 shadow-md shadow-marca-200 transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] touch-manipulation"
            >
              {enviando ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  {metodo === "webpay" ? "Abriendo Webpay…" : "Registrando pedido…"}
                </>
              ) : etiquetaBoton}
            </button>
            <p className="text-xs text-[#787774] mt-3 text-center">
              {metodo === "webpay" ? "Te llevamos a Webpay (Transbank) para pagar de forma segura." : "No se cobra nada ahora."}
            </p>
            <Link href="/carrito" className="block mt-3 text-center text-sm text-[#5A5A57] hover:text-[#111111]">Volver al carrito</Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
