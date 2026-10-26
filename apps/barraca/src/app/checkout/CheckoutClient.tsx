"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/barraca/Enlace";
import { formatCLP } from "@jurmaq/shared/format";
import { HORARIO_BARRACA } from "@jurmaq/shared/seo";
import { trackEvents } from "@/lib/analytics";
import { useCarrito } from "@/lib/useCarrito";
import { reemplazarCarrito, vaciarCarrito, type ItemRevisado } from "@/lib/carrito";
import { rutValido } from "@/lib/rut";

/**
 * Checkout en una sola página, una columna: datos → entrega → pago.
 * Son tres grupos cortos; partirlo en pasos sumaría clics sin aliviar nada.
 * Validación al salir de cada campo; el botón dice lo que hace ("Pagar $X").
 */

type Campo = "nombre" | "email" | "telefono" | "rut" | "direccion" | "comuna";
type Datos = Record<Campo | "notas", string>;

const VACIO: Datos = { nombre: "", email: "", telefono: "", rut: "", direccion: "", comuna: "", notas: "" };
const CLAVE_DATOS = "barraca_checkout_datos";

function validar(c: Campo, v: string, despacho: boolean): string | null {
  const t = v.trim();
  switch (c) {
    case "nombre": return t.length >= 3 ? null : "Escribe tu nombre y apellido.";
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? null : "Revisa el correo: ahí te llega el detalle del pedido.";
    case "telefono": return t.replace(/\D/g, "").length >= 8 ? null : "Escribe un teléfono de al menos 8 dígitos.";
    case "rut": return !t || rutValido(t) ? null : "El RUT no es válido. Revisa el dígito verificador.";
    case "direccion": return !despacho || t.length >= 5 ? null : "Escribe la dirección de despacho.";
    case "comuna": return !despacho || t.length >= 3 ? null : "Escribe la comuna.";
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
  nombre, valor, actual, onChange, titulo, detalle, deshabilitada,
}: {
  nombre: string; valor: string; actual: string; onChange: (v: string) => void;
  titulo: string; detalle: string; deshabilitada?: boolean;
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
        <span className="block text-[15px] font-semibold text-[#111111]">{titulo}</span>
        <span className="block text-[13px] text-[#5A5A57] mt-0.5">{detalle}</span>
      </span>
    </label>
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
  const { items, total, cantidad, cargando, hayProblemas } = useCarrito({ revisar: true });
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [entrega, setEntrega] = useState<"retiro" | "despacho">("retiro");
  const [metodo, setMetodo] = useState<"mercadopago" | "transferencia">(pagoEnLinea ? "mercadopago" : "transferencia");
  const [errores, setErrores] = useState<Partial<Record<Campo, string | null>>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const iniciado = useRef(false);

  // Datos del comprador recordados en este navegador (no el RUT ni notas).
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_DATOS) || "{}");
      setDatos((d) => ({ ...d, nombre: g.nombre || "", email: g.email || "", telefono: g.telefono || "", direccion: g.direccion || "", comuna: g.comuna || "" }));
    } catch { /* sin datos guardados */ }
  }, []);

  useEffect(() => {
    if (cargando || iniciado.current || items.length === 0) return;
    iniciado.current = true;
    trackEvents.beginCheckout(items.map((i) => ({ id: i.productoId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })));
  }, [cargando, items]);

  const despacho = entrega === "despacho";
  const set = (c: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDatos((d) => ({ ...d, [c]: v }));
    // Un error ya mostrado se va apenas el valor queda válido, no antes.
    if (c !== "notas" && errores[c as Campo]) {
      setErrores((er) => ({ ...er, [c]: validar(c as Campo, v, despacho) }));
    }
  };
  const blur = (c: Campo) => () => setErrores((er) => ({ ...er, [c]: validar(c, datos[c], despacho) }));
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
    const campos: Campo[] = ["nombre", "email", "telefono", "rut", ...(despacho ? (["direccion", "comuna"] as Campo[]) : [])];
    const nuevos: Partial<Record<Campo, string | null>> = {};
    for (const c of campos) nuevos[c] = validar(c, datos[c], despacho);
    setErrores(nuevos);
    const primero = campos.find((c) => nuevos[c]);
    if (primero) {
      document.getElementById(`co-${primero}`)?.focus();
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
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          rut: datos.rut,
          entrega,
          direccion: despacho ? datos.direccion : "",
          comuna: despacho ? datos.comuna : "",
          metodoPago: metodo,
          notas: datos.notas,
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

  const etiquetaBoton = metodo === "mercadopago" ? `Pagar ${formatCLP(total)}` : "Confirmar pedido";

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
            <CampoForm id="co-rut" label="RUT" opcional ayuda="Sólo si necesitas factura." error={errores.rut}>
              <input {...props("rut")} type="text" autoComplete="off" placeholder="76.123.456-7" />
            </CampoForm>
          </Seccion>

          <Seccion n={2} titulo="Entrega">
            <div className="grid gap-3" role="radiogroup" aria-label="Forma de entrega">
              <Opcion nombre="entrega" valor="retiro" actual={entrega} onChange={(v) => setEntrega(v as "retiro")}
                titulo="Retiro en la barraca · gratis"
                detalle={`Av. Poniente 2157, Molina. ${HORARIO_BARRACA.semana}.`} />
              <Opcion nombre="entrega" valor="despacho" actual={entrega} onChange={(v) => setEntrega(v as "despacho")}
                titulo="Despacho a domicilio · a coordinar"
                detalle="Te llamamos para acordar día y costo según comuna. El despacho se paga aparte." />
            </div>
            {despacho && (
              <>
                <CampoForm id="co-direccion" label="Dirección" error={errores.direccion}>
                  <input {...props("direccion")} type="text" autoComplete="street-address" placeholder="Calle, número, depto." />
                </CampoForm>
                <CampoForm id="co-comuna" label="Comuna" error={errores.comuna}>
                  <input {...props("comuna")} type="text" autoComplete="address-level2" placeholder="Curicó" />
                </CampoForm>
              </>
            )}
          </Seccion>

          <Seccion n={3} titulo="Pago">
            <div className="grid gap-3" role="radiogroup" aria-label="Forma de pago">
              <Opcion nombre="pago" valor="mercadopago" actual={metodo} onChange={(v) => setMetodo(v as "mercadopago")}
                deshabilitada={!pagoEnLinea}
                titulo="Pagar en línea con Mercado Pago"
                detalle={pagoEnLinea ? "Tarjeta de débito o crédito. El pedido queda confirmado al pagar." : "No disponible por ahora."} />
              <Opcion nombre="pago" valor="transferencia" actual={metodo} onChange={(v) => setMetodo(v as "transferencia")}
                titulo="Transferencia bancaria"
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
                  </span>
                  <span className="font-medium text-[#111111] tabular-nums shrink-0">{formatCLP(i.precio * i.cantidad)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3 mb-5">
              <div className="flex justify-between"><span className="text-[#5A5A57]">Productos</span><span className="tabular-nums">{formatCLP(total)}</span></div>
              <div className="flex justify-between"><span className="text-[#5A5A57]">{despacho ? "Despacho" : "Retiro en Molina"}</span><span className="text-[#5A5A57]">{despacho ? "A coordinar" : "Gratis"}</span></div>
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                <span className="font-semibold text-[#111111]">Total</span>
                <span className="text-2xl font-extrabold text-navy-950 tabular-nums">{formatCLP(total)}</span>
              </div>
              <p className="text-xs text-[#787774] text-right">IVA incluido{despacho ? " · despacho aparte" : ""}</p>
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
                  {metodo === "mercadopago" ? "Abriendo Mercado Pago…" : "Registrando pedido…"}
                </>
              ) : etiquetaBoton}
            </button>
            <p className="text-xs text-[#787774] mt-3 text-center">
              {metodo === "mercadopago" ? "Te llevamos a Mercado Pago para pagar de forma segura." : "No se cobra nada ahora."}
            </p>
            <Link href="/carrito" className="block mt-3 text-center text-sm text-[#5A5A57] hover:text-[#111111]">Volver al carrito</Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
