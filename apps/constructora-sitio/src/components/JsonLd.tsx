import { safeJsonLd } from "@jurmaq/shared/seo/jsonld";

export default function JsonLd({ datos }: { datos: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(datos) }} />;
}
