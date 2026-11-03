import type { MetadataRoute } from "next";
import { ACTUALIZADO, url } from "@/data/empresa";
import { OBRAS } from "@/data/obras";
import { SERVICIOS } from "@/data/servicios";
import { ZONAS } from "@/data/zonas";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const rutas = [
    "/",
    "/servicios",
    "/proyectos",
    "/nosotros",
    "/cotizar-obra",
    ...SERVICIOS.map((s) => `/servicios/${s.slug}`),
    ...OBRAS.map((o) => `/proyectos/${o.slug}`),
    ...ZONAS.map((z) => `/obras-civiles-en/${z.slug}`),
  ];
  return rutas.map((ruta) => ({ url: url(ruta), lastModified: ACTUALIZADO }));
}
