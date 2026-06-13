-- Migration: rate limit persistente (audit 3.x — OTP en serverless).
-- El rate-limit en memoria (rateLimit) usa un Map por-lambda; en Vercel cada
-- lambda tiene el suyo, así que el límite real = límite × nº de lambdas. Para
-- OTP (anti-brute-force / anti-spam) eso lo vuelve evadible. Esta tabla guarda
-- los contadores en Postgres para que TODAS las lambdas compartan el estado.
--
-- `rateLimitPersistent()` (packages/shared/src/rate-limit) llama a la función
-- de abajo y, si no existe, cae a in-memory. Por eso el deploy del código es
-- seguro incluso antes de aplicar esta migración (solo queda degradado).
--
-- Idempotente. Run en Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at
  ON rate_limit_attempts(reset_at);

-- Función atómica: incrementa el contador y devuelve si pasó el límite.
-- Rota la ventana (si reset_at < now, reinicia). Devuelve { count, reset_at, allowed }.
CREATE OR REPLACE FUNCTION rate_limit_check_and_increment(
  p_key TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE (count INTEGER, reset_at TIMESTAMPTZ, allowed BOOLEAN) AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_new_reset_at TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::interval;
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  INSERT INTO rate_limit_attempts (key, count, reset_at, updated_at)
  VALUES (p_key, 1, v_new_reset_at, v_now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN rate_limit_attempts.reset_at < v_now THEN 1
      ELSE rate_limit_attempts.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit_attempts.reset_at < v_now THEN v_new_reset_at
      ELSE rate_limit_attempts.reset_at
    END,
    updated_at = v_now
  RETURNING rate_limit_attempts.count, rate_limit_attempts.reset_at
  INTO v_count, v_reset_at;

  RETURN QUERY SELECT v_count, v_reset_at, (v_count <= p_max_attempts);
END;
$$ LANGUAGE plpgsql;

-- Cleanup de entries vencidos (llamable por cron).
CREATE OR REPLACE FUNCTION rate_limit_cleanup() RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_attempts WHERE reset_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limit_attempts FROM anon, authenticated;

-- Verify
SELECT * FROM rate_limit_check_and_increment('test:setup', 100, 60);
DELETE FROM rate_limit_attempts WHERE key = 'test:setup';
