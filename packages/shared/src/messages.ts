/**
 * Microcopy centralizado — toasts, alerts y mensajes user-facing reutilizables.
 *
 * Por qué:
 * - Cambiar el saludo / tono de error en un solo lugar afecta toda la app.
 * - Evita strings duplicados entre componentes (`"Agregado al carrito"`
 *   aparecía en 3 sitios con leves variaciones de capitalización).
 * - Hace explícita la **convención de copy accionable** (hallazgo C-3 del
 *   audit): preferir `"No pudimos X — intenta de nuevo"` sobre `"Error al X"`.
 *
 * Uso:
 *   import { TOAST_MESSAGES } from '@jurmaq/shared/messages';
 *   showToast(TOAST_MESSAGES.cart.ADDED, 'success');
 *   showToast(TOAST_MESSAGES.cart.ADD_ERROR, 'error');
 *
 * Para mensajes dinámicos (ej. error de API parseado), seguir usando string
 * literal — no todo es centralizable.
 */
export const TOAST_MESSAGES = {
  cart: {
    /** Producto agregado al carrito (success). */
    ADDED: 'Agregado al carrito',
    /** Producto promocionado agregado (incluye señalización del descuento). */
    ADDED_WITH_DISCOUNT: 'Agregado al carrito con descuento',
    /** Fallo genérico al agregar al carrito (sin detalle del backend). */
    ADD_ERROR: 'No pudimos agregar al carrito — intenta de nuevo',
    /** Fallback cuando el backend no devuelve mensaje específico. */
    ADD_FAILED_FALLBACK: 'No pudimos agregar al carrito',
    /** Rate-limit del API de carrito (HTTP 429). */
    RATE_LIMITED: 'Demasiadas solicitudes — espera un momento',
  },
  cotizacion: {
    /** Cotización enviada exitosamente desde formulario. */
    SENT_OK: 'Cotización enviada — te contactaremos pronto',
    /** Fallback cuando el backend rechaza la cotización sin detalle. */
    SEND_ERROR: 'No pudimos enviar la cotización — intenta de nuevo',
  },
  admin: {
    /** Asignación de imagen falló (admin/imagenes). */
    IMAGE_ASSIGN_ERROR: 'No pudimos asignar la imagen — intenta de nuevo',
    /** Admin saltó un producto manualmente en la cola de imágenes. */
    PRODUCT_SKIPPED: 'Producto saltado',
    /** Confirmación de asignación de imagen a N productos (pluraliza). */
    imageAssignedTo: (count: number) =>
      `Imagen asignada a ${count} producto${count > 1 ? 's' : ''}`,
  },
  generic: {
    /** Falla de red — el fetch no llegó a completarse. */
    CONNECTION_ERROR: 'Error de conexión — verifica tu internet',
  },
} as const;

export type ToastMessages = typeof TOAST_MESSAGES;
