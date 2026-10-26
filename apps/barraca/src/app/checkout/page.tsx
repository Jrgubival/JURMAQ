import { pagoEnLineaDisponible } from "@/lib/pagos";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutClient pagoEnLinea={pagoEnLineaDisponible()} />;
}
