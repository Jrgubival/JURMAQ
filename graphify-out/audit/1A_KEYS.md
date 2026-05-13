# Audit 1A — Hardcoded Keys & Secrets

## Critical
- (none) — no hardcoded live secrets found in `jurmaq-app/src/**` or `jurmaq-app/scripts/**`.

## Server-only env var referenced in client component (potential bundle leak)
- (none) — every `process.env.{SERVER_SECRET}` reference is inside a server-only path.
  - `src/lib/payments.ts:10` — `MERCADOPAGO_ACCESS_TOKEN` — module is consumed only by API route handlers; no `'use client'` directive. Not client-bundled.
  - `src/lib/supabase.ts:5` — `SUPABASE_SERVICE_ROLE_KEY` — file starts with `import 'server-only';` (build-time enforcement against client import).
  - `src/lib/mail/transport.ts:16` — `RESEND_API_KEY` — file starts with `import 'server-only';`.
  - `src/lib/mail/templates/signed-contract.ts:5` — `RESEND_API_KEY` — server-side template module (no `'use client'`). Note: does not declare `import 'server-only'`, but is reached only from API routes / server actions. Low risk; recommend adding `import 'server-only'` as belt-and-suspenders. (Informational, not critical.)
  - `src/app/api/barraca/pagos/webhook/route.ts:85` — `MERCADOPAGO_ACCESS_TOKEN` — Next.js Route Handler; server-only by definition.

## Patterns scanned
- Stripe keys (`sk_live_*`, `sk_test_*`, `pk_live_*`, `pk_test_*`): 0 hits.
- Supabase service role refs: 1 hit, all via `process.env` in a `server-only` module. 0 hardcoded.
- MercadoPago tokens (`APP_USR-…`): 0 hardcoded. 2 references via `process.env.MERCADOPAGO_ACCESS_TOKEN`, both server-side.
- Resend keys (`re_…`): 0 hardcoded. 2 references via `process.env.RESEND_API_KEY`, both server-side.
- Google API keys (`AIza…`): 0 hits.
- AWS access keys (`AKIA…`): 0 hits.
- JWT tokens (`eyJ…`): 0 hits.
- DB URLs in code (`postgres(ql)://`, `mysql://`): 2 hits, both in `scripts/` and both **template literals** built from env vars / shell vars — no embedded credentials.
  - `scripts/rotate-db-password.sh:46` — `postgresql://postgres.${PROJECT_REF}:${ENCODED_PW}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` (shell var interpolation).
  - `scripts/harden-rls.js:104` — `postgresql://postgres:${pwd}@db.${ref}.supabase.co:5432/postgres` (JS template literal with runtime-supplied password).

## Verdict
- Live secrets in source: 0 / 0
- Client-side leaks of server env: 0 / 0
- Minor hardening recommendation (non-blocking): add `import 'server-only';` to `src/lib/mail/templates/signed-contract.ts` for defense-in-depth.
