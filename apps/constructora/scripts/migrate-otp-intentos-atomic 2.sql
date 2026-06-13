-- migrate-otp-intentos-atomic.sql
-- Fix auditoría (OTP intentos): verifyOtp incrementaba `intentos` con un
-- read-then-write (leer intentos → +1 → UPDATE). Bajo intentos concurrentes
-- eso pierde actualizaciones (lost update) y permite más adivinanzas que
-- max_intentos. Esta función incrementa de forma ATÓMICA y devuelve el nuevo
-- valor, de modo que cada fallo cuenta exactamente una vez.
--
-- El dispatcher (packages/shared/src/otp) la usa con fallback al UPDATE no
-- atómico si la función no existe, así que el deploy es seguro en cualquier orden.
--
-- Idempotente. Run en Supabase Dashboard > SQL Editor.

CREATE OR REPLACE FUNCTION public.otp_increment_intentos(p_id uuid)
RETURNS integer AS $$
DECLARE
  v_intentos integer;
BEGIN
  UPDATE public.otp_codigos
    SET intentos = intentos + 1
    WHERE id = p_id
    RETURNING intentos INTO v_intentos;
  RETURN v_intentos;
END;
$$ LANGUAGE plpgsql;
