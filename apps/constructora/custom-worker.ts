// Worker de Cloudflare: el de OpenNext más los crons que antes corrían en Vercel
// (vercel.json). Cada Cron Trigger llama a su ruta con CRON_SECRET, así que la
// autenticación no cambia.
// Lo genera `opennextjs-cloudflare build` (fuera del typecheck: ver tsconfig).
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  WORKER_SELF_REFERENCE: { fetch: (req: Request) => Promise<Response> };
}

const CRONS: Record<string, string> = {
  "0 5 * * *": "/api/cron/email-queue/retry",
  "0 3 * * *": "/api/cron/contratos/expirar",
  "0 4 * * *": "/api/cron/cedulas/purgar",
  "0 6 * * *": "/api/cron/klap-renew-holds",
  "0 8 1 * *": "/api/cron/iec-notif",
  "0 8 * * *": "/api/cron/mantenciones-alerta",
};

export default {
  fetch: handler.fetch,
  async scheduled(controller: { cron: string }, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const secret = env.CRON_SECRET?.trim();
    const ruta = CRONS[controller.cron];
    if (!secret || !ruta) return; // fail-closed: sin secreto no se llama
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(
        new Request(`https://jurmaq.cl${ruta}`, {
          method: "POST",
          headers: { authorization: `Bearer ${secret}` },
        }),
      ),
    );
  },
};

// Clases de Durable Objects de OpenNext (caché de ISR).
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
