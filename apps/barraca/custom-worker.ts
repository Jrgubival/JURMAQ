// Worker de Cloudflare: el de OpenNext más el cron diario que antes corría en
// Vercel (vercel.json → /api/cron/post-purchase, 09:00 UTC). El cron llama a la
// misma ruta con CRON_SECRET, así que la autenticación no cambia.
// Lo genera `opennextjs-cloudflare build` (fuera del typecheck: ver tsconfig).
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  WORKER_SELF_REFERENCE: { fetch: (req: Request) => Promise<Response> };
}

export default {
  fetch: handler.fetch,
  async scheduled(controller: { cron?: string }, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const secret = env.CRON_SECRET?.trim();
    if (!secret) return; // fail-closed: sin secreto no se llama
    // Cada media hora: aviso interno de carritos sin pagar. Diario 09:00 UTC: post-purchase.
    const ruta = controller.cron === "*/30 * * * *" ? "avisos-carritos" : "post-purchase";
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(
        new Request(`https://barraca.jurmaq.cl/api/cron/${ruta}`, {
          method: "POST",
          headers: { authorization: `Bearer ${secret}` },
        }),
      ),
    );
  },
};

// Clases de Durable Objects de OpenNext (caché de ISR).
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
