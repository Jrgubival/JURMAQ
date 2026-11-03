import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  // Páginas en R2 con una copia en la caché del data center (Cache API): menos
  // lecturas de R2 por visita. El tag cache (D1) se sigue consultando, así que
  // revalidatePath sigue refrescando al instante.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  tagCache: d1NextTagCache,
  queue: doQueue,
  // Una página en caché se responde sin levantar el servidor de Next: es lo que
  // más CPU gastaba por visita (p50 63 ms el día del corte, 03-11-2026).
  enableCacheInterception: true,
});
