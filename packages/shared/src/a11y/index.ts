/**
 * @jurmaq/shared/a11y — Componentes y hooks compartidos para accesibilidad.
 *
 * WCAG 2.1 AA targets:
 *  - SkipLink → SC 2.4.1 Bypass Blocks
 *  - Modal → SC 1.3.1, 2.1.2, 2.4.3, 2.4.7, 3.2.1
 *  - useFocusTrap → SC 2.4.3 Focus Order
 *  - useEscapeKey → SC 2.1.2 No Keyboard Trap
 */
export { SkipLink } from "./SkipLink";
export { Modal } from "./Modal";
export { useFocusTrap } from "./useFocusTrap";
export { useEscapeKey } from "./useEscapeKey";
export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
