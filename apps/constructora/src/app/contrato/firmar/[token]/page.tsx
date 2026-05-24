'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { SignaturePadHandle } from './SignaturePad';

// Load the signature canvas only in the browser. `signature_pad` touches
// canvas/DOM APIs on mount so it must not be prerendered.
const SignaturePad = dynamic(() => import('./SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
      Cargando area de firma...
    </div>
  ),
});

// --- Types --------------------------------------------------------------

interface ContratoData {
  numero: string | number;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  arrendatario_rut?: string | null;
  html: string; // rendered contract HTML
  firmado?: boolean;
  firmado_at?: string | null; // ISO
  pdf_url?: string | null;
  identidad_subida?: boolean;
  firma_otp_verified?: boolean;
}

type Step = 'loading' | 'verify_identity' | 'verify_phone' | 'sign' | 'done';

// --- Helpers ------------------------------------------------------------

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // Keep last 4 digits, mask the rest: "+56 9 ****3577"
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  const last4 = digits.slice(-4);
  const masked = phone.replace(/\d(?=\d{4})/g, '*');
  if (!masked.includes(last4)) return `****${last4}`;
  return masked;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Page ---------------------------------------------------------------

export default function FirmarContratoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [contrato, setContrato] = useState<ContratoData | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Phone verification state
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Identity verification state (Ley 19.799 evidence package).
  const [identityRut, setIdentityRut] = useState('');
  const [identityCedula, setIdentityCedula] = useState<string | null>(null);
  const [identityCedulaName, setIdentityCedulaName] = useState<string | null>(null);
  const [identityUploading, setIdentityUploading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Signature state
  const signatureRef = useRef<SignaturePadHandle | null>(null);
  const handleSignatureReady = useCallback(
    (handle: SignaturePadHandle | null) => {
      signatureRef.current = handle;
    },
    []
  );
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  // Tracks whether the signature was just submitted in this session, so we
  // can render the success copy ("firmado correctamente") vs the "already
  // signed" copy when the user opens an already-signed link.
  const [justSigned, setJustSigned] = useState(false);

  // --- Load contract on mount ------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/public/contratos/firmar/${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );

        if (!res.ok) {
          let msg = 'No se pudo cargar el contrato.';
          if (res.status === 404) {
            msg = 'Este enlace de firma no es valido o ha expirado.';
          } else if (res.status === 410) {
            msg = 'Este enlace de firma ha expirado.';
          } else {
            try {
              const data = (await res.json()) as { error?: string };
              if (data?.error) msg = data.error;
            } catch {
              // ignore parse error
            }
          }
          if (!cancelled) {
            setLoadError(msg);
          }
          return;
        }

        const data = (await res.json()) as ContratoData;
        if (cancelled) return;

        setContrato(data);

        if (data.firmado) {
          setSignedAt(data.firmado_at ?? null);
          setSignedPdfUrl(data.pdf_url ?? null);
          setStep('done');
        } else if (!data.identidad_subida) {
          // The customer hasn't uploaded their identity yet — gate the OTP
          // step behind RUT + cédula so the firma electrónica simple is
          // tied to a verifiable identity document.
          setStep('verify_identity');
        } else if (!data.firma_otp_verified) {
          setStep('verify_phone');
        } else {
          // Identity uploaded AND OTP already verified — go straight to
          // signing canvas.
          setStep('sign');
          setPhoneVerified(true);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Error de conexion al cargar el contrato.'
        );
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // --- Identity upload (verify_identity step) --------------------------
  // Validates RUT client-side with módulo-11 algorithm (mirrors
  // src/lib/rut.ts for instant feedback) and uploads cédula photo as
  // base64. Server-side does the same validation + magic-bytes check.
  function rutDvOk(rut: string): boolean {
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (!/^\d{7,9}[0-9K]$/.test(clean)) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    let sum = 0, multi = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * multi;
      multi = multi === 7 ? 2 : multi + 1;
    }
    const mod = 11 - (sum % 11);
    const expected = mod === 11 ? '0' : mod === 10 ? 'K' : String(mod);
    return dv === expected;
  }

  function onCedulaSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
      setIdentityError('Solo JPG, PNG o WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setIdentityError('La imagen supera los 4 MB.');
      return;
    }
    setIdentityError(null);
    setIdentityCedulaName(file.name);
    const reader = new FileReader();
    reader.onload = () => setIdentityCedula(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setIdentityError('No se pudo leer el archivo.');
    reader.readAsDataURL(file);
  }

  async function handleUploadIdentidad() {
    setIdentityError(null);
    if (!identityRut.trim() || !rutDvOk(identityRut)) {
      setIdentityError('Ingresa un RUT chileno válido (con dígito verificador).');
      return;
    }
    if (!identityCedula) {
      setIdentityError('Sube la foto de tu cédula.');
      return;
    }
    setIdentityUploading(true);
    try {
      const res = await fetch(
        `/api/public/contratos/firmar/${encodeURIComponent(token)}/upload-identidad`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rut: identityRut,
            cedula_base64: identityCedula,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIdentityError(data?.error || 'No se pudo subir la identidad.');
        return;
      }
      setStep('verify_phone');
    } catch {
      setIdentityError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIdentityUploading(false);
    }
  }

  // --- Request OTP -----------------------------------------------------
  async function handleRequestOtp() {
    setOtpError(null);
    setOtpInfo(null);
    setSendingOtp(true);
    try {
      const res = await fetch(
        `/api/public/contratos/firmar/${encodeURIComponent(token)}/request-otp`,
        { method: 'POST' }
      );
      if (!res.ok) {
        let msg = 'No se pudo enviar el codigo. Intenta nuevamente.';
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          /* ignore */
        }
        setOtpError(msg);
        return;
      }
      setOtpSent(true);
      // The endpoint also returns `to_masked` so we tell the user where
      // exactly the code was sent ("a***@gmail.com") for confirmation.
      let info = 'Código enviado a tu correo. Revisa tu bandeja de entrada (y la carpeta spam por si acaso). Es válido por 15 minutos.';
      try {
        const data = await res.json();
        if (data?.to_masked) {
          info = `Código enviado a ${data.to_masked}. Válido por 15 minutos. Revisa también la carpeta de spam.`;
        }
      } catch { /* ignore */ }
      setOtpInfo(info);
    } catch {
      setOtpError('Error de conexion. Intenta nuevamente.');
    } finally {
      setSendingOtp(false);
    }
  }

  // --- Verify OTP ------------------------------------------------------
  async function handleVerifyOtp() {
    setOtpError(null);
    setOtpInfo(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError('Ingresa el codigo de 6 digitos recibido por correo.');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(
        `/api/public/contratos/firmar/${encodeURIComponent(token)}/verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: otpCode }),
        }
      );
      if (!res.ok) {
        let msg = 'Codigo incorrecto. Verifica e intenta nuevamente.';
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          /* ignore */
        }
        setOtpError(msg);
        return;
      }
      setPhoneVerified(true);
      setStep('sign');
      setOtpInfo('Telefono verificado correctamente.');
    } catch {
      setOtpError('Error de conexion. Intenta nuevamente.');
    } finally {
      setVerifying(false);
    }
  }

  // --- Signature canvas actions ---------------------------------------
  function handleClearSignature() {
    signatureRef.current?.clear();
    setSignError(null);
  }

  async function handleSign() {
    setSignError(null);

    const pad = signatureRef.current;
    if (!pad || pad.isEmpty()) {
      setSignError('Dibuja tu firma en el recuadro antes de continuar.');
      return;
    }

    const dataUrl = pad.toDataURL('image/png');

    setSigning(true);
    try {
      const res = await fetch(
        `/api/public/contratos/firmar/${encodeURIComponent(token)}/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature: dataUrl }),
        }
      );
      if (!res.ok) {
        let msg = 'No se pudo registrar la firma. Intenta nuevamente.';
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          /* ignore */
        }
        setSignError(msg);
        return;
      }
      const data = (await res.json()) as {
        firmado_at?: string | null;
        pdf_url?: string | null;
      };
      setSignedAt(data.firmado_at ?? new Date().toISOString());
      setSignedPdfUrl(data.pdf_url ?? null);
      setJustSigned(true);
      setStep('done');
    } catch {
      setSignError('Error de conexion al registrar la firma.');
    } finally {
      setSigning(false);
    }
  }

  // --- Render states --------------------------------------------------

  // Loading / error state
  if (step === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {loadError ? (
          <div
            role="alert"
            className="bg-white border border-red-200 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-red-600 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  No se pudo cargar el contrato
                </h1>
                <p className="mt-1 text-sm text-gray-700">{loadError}</p>
                <p className="mt-4 text-sm text-gray-600">
                  Si crees que esto es un error, contactanos al{' '}
                  <a
                    href="tel:+56976673577"
                    className="text-navy-700 font-medium hover:underline"
                  >
                    +56 9 7667 3577
                  </a>{' '}
                  o a{' '}
                  <a
                    href="mailto:contacto@jurmaq.cl"
                    className="text-navy-700 font-medium hover:underline"
                  >
                    contacto@jurmaq.cl
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <svg
              className="animate-spin w-8 h-8 mb-3 text-navy-700"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm">Cargando contrato...</p>
          </div>
        )}
      </div>
    );
  }

  // Done — contract signed (either just now or previously)
  if (step === 'done' && contrato) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white border border-green-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 text-white mb-4">
              <svg
                className="w-9 h-9"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-green-900">
              {justSigned
                ? 'Contrato firmado correctamente'
                : 'Este contrato ya fue firmado'}
            </h1>
            <p className="mt-2 text-green-800 text-sm sm:text-base">
              Contrato <span className="font-semibold">N&deg; {contrato.numero}</span>
              {signedAt && (
                <>
                  <span className="mx-1.5">&middot;</span>
                  Firmado el{' '}
                  <span className="font-semibold">
                    {formatDateTime(signedAt)}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-sm text-gray-700 leading-relaxed">
              Hemos registrado tu firma electronica. Guarda una copia del
              contrato firmado para tu respaldo. JURMAQ te enviara una copia
              por correo electronico.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {signedPdfUrl ? (
                <a
                  href={signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    />
                  </svg>
                  Descargar contrato firmado (PDF)
                </a>
              ) : (
                <span className="inline-flex items-center text-sm text-gray-500">
                  El PDF firmado estara disponible en breve.
                </span>
              )}
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors min-h-[44px]"
              >
                Volver al sitio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main flow — render contract, phone verification, signature
  if (!contrato) return null; // defensive

  const maskedPhone = maskPhone(contrato.cliente_telefono);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Intro */}
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-950">
          Firma de contrato N&deg; {contrato.numero}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">
          {contrato.cliente_nombre ? (
            <>
              Hola <strong>{contrato.cliente_nombre}</strong>. Revisa el
              contrato y firma electronicamente abajo.
            </>
          ) : (
            <>Revisa el contrato y firma electronicamente abajo.</>
          )}
        </p>
      </section>

      {/* Contract preview */}
      <section
        aria-labelledby="contrato-preview-title"
        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
          <h2
            id="contrato-preview-title"
            className="text-sm sm:text-base font-semibold text-gray-900"
          >
            Vista previa del contrato
          </h2>
          {contrato.pdf_url && (
            <a
              href={contrato.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-navy-700 hover:text-navy-900"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h3l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              Descargar PDF
            </a>
          )}
        </div>
        <iframe
          srcDoc={contrato.html}
          title={`Contrato N ${contrato.numero}`}
          sandbox="allow-same-origin"
          className="w-full h-[400px] border-0 bg-white"
        />
      </section>

      {/* Step 0: Identity verification (Ley 19.799 — evidence package) */}
      {step === 'verify_identity' && (
        <section
          aria-labelledby="paso-0-title"
          className="bg-white border border-navy-200 rounded-2xl shadow-sm p-5 sm:p-6"
        >
          <div className="flex items-start gap-3 mb-4">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 bg-navy-900 text-white"
              aria-hidden="true"
            >
              1
            </span>
            <div>
              <h2
                id="paso-0-title"
                className="text-base sm:text-lg font-semibold text-gray-900"
              >
                Verifica tu identidad
              </h2>
              <p className="mt-0.5 text-sm text-gray-600">
                Ingresa tu RUT chileno y sube una foto de tu cédula. Esto refuerza la firma del contrato bajo la Ley 19.799 y protege tanto a JURMAQ como a ti.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-800">RUT</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={identityRut}
                onChange={(e) => setIdentityRut(e.target.value)}
                placeholder="12.345.678-9"
                className="mt-1 w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-800">Foto de tu cédula</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onCedulaSelected}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gold-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-950 hover:file:bg-gold-200"
              />
              {identityCedulaName && (
                <span className="mt-1 block text-xs text-gray-500">
                  Archivo: {identityCedulaName}
                </span>
              )}
              <span className="mt-1 block text-xs text-gray-500">
                JPG, PNG o WebP · máximo 4 MB · solo el anverso (lado con tu foto).
              </span>
            </label>
            {identityError && (
              <p className="text-sm text-red-600" role="alert">
                {identityError}
              </p>
            )}
            <button
              type="button"
              onClick={handleUploadIdentidad}
              disabled={identityUploading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 disabled:cursor-not-allowed text-navy-950 font-semibold rounded-lg transition-colors min-h-[44px]"
            >
              {identityUploading ? 'Subiendo...' : 'Continuar al código'}
            </button>
            <p className="text-xs text-gray-500">
              Tu cédula se almacena cifrada y solo es accesible por JURMAQ. Se usará exclusivamente para validar tu identidad en este contrato.
              Ver <Link href="/privacidad" target="_blank" className="underline">Política de Privacidad</Link>.
            </p>
          </div>
        </section>
      )}

      {/* Step 1: Phone verification */}
      <section
        aria-labelledby="paso-1-title"
        className={`bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 ${
          step === 'verify_identity' ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <div className="flex items-start gap-3 mb-4">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
              phoneVerified
                ? 'bg-green-600 text-white'
                : 'bg-navy-900 text-white'
            }`}
            aria-hidden="true"
          >
            {phoneVerified ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              '1'
            )}
          </span>
          <div>
            <h2
              id="paso-1-title"
              className="text-base sm:text-lg font-semibold text-gray-900"
            >
              Verifica tu identidad por correo
            </h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Te enviaremos un código de 6 dígitos al correo registrado en el contrato. Es válido por 15 minutos.
            </p>
          </div>
        </div>

        {!phoneVerified && (
          <div className="space-y-3">
            {!otpSent ? (
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={sendingOtp}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 hover:bg-gold-600 disabled:bg-gold-300 disabled:cursor-not-allowed text-navy-950 font-semibold rounded-lg transition-colors min-h-[44px]"
              >
                {sendingOtp ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Enviarme el código por correo
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <label
                  htmlFor="otp-code"
                  className="block text-sm font-medium text-gray-700"
                >
                  Codigo de 6 digitos
                </label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(
                        e.target.value.replace(/\D/g, '').slice(0, 6)
                      )
                    }
                    placeholder="123456"
                    className="w-full sm:w-48 px-4 py-3 text-lg tracking-[0.3em] text-center font-mono rounded-lg border border-gray-300 focus:border-navy-700 focus:ring-2 focus:ring-navy-700/20 outline-none min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifying || otpCode.length !== 6}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-navy-900 hover:bg-navy-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors min-h-[44px]"
                  >
                    {verifying ? (
                      <>
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Verificando...
                      </>
                    ) : (
                      'Verificar'
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={sendingOtp}
                  className="text-sm text-navy-700 hover:text-navy-900 font-medium disabled:text-gray-500"
                >
                  {sendingOtp ? 'Reenviando...' : 'Reenviar codigo'}
                </button>
              </div>
            )}

            {otpError && (
              <p
                role="alert"
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
              >
                {otpError}
              </p>
            )}
            {otpInfo && !otpError && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {otpInfo}
              </p>
            )}
          </div>
        )}

        {phoneVerified && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Telefono verificado. Puedes firmar el contrato abajo.
          </p>
        )}
      </section>

      {/* Step 2: Signature */}
      <section
        aria-labelledby="paso-2-title"
        aria-disabled={!phoneVerified}
        className={`bg-white border rounded-2xl shadow-sm p-5 sm:p-6 ${
          phoneVerified ? 'border-gray-200' : 'border-gray-200 opacity-60'
        }`}
      >
        <div className="flex items-start gap-3 mb-4">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
              phoneVerified
                ? 'bg-navy-900 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}
            aria-hidden="true"
          >
            2
          </span>
          <div>
            <h2
              id="paso-2-title"
              className="text-base sm:text-lg font-semibold text-gray-900"
            >
              Firma aqui
            </h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Dibuja tu firma con el mouse o el dedo en el recuadro.
            </p>
          </div>
        </div>

        <div className={phoneVerified ? '' : 'pointer-events-none select-none'}>
          <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-lg overflow-hidden touch-none">
            <SignaturePad
              onReady={handleSignatureReady}
              disabled={!phoneVerified}
            />
            {!phoneVerified && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-600 font-medium">
                Verifica tu telefono primero
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClearSignature}
              disabled={!phoneVerified || signing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 disabled:border-gray-200 disabled:text-gray-500 text-gray-700 font-medium rounded-lg transition-colors min-h-[44px]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3"
                />
              </svg>
              Borrar
            </button>
            <button
              type="button"
              onClick={handleSign}
              disabled={!phoneVerified || signing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 hover:bg-gold-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-navy-950 font-semibold rounded-lg transition-colors min-h-[44px]"
            >
              {signing ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Firmando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Firmar contrato
                </>
              )}
            </button>
          </div>

          {signError && (
            <p
              role="alert"
              className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {signError}
            </p>
          )}

          {/* Legal disclaimer */}
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed">
              Al presionar <strong>Firmar contrato</strong>, declaras que la
              firma y tus datos son correctos y aceptas el contenido del
              contrato. Esta firma electronica simple tiene validez legal en
              Chile conforme a la <strong>Ley N&deg; 19.799</strong> sobre
              documentos electronicos, firma electronica y servicios de
              certificacion. Se registrara la fecha, hora, direccion IP y el
              codigo SMS verificado como evidencia de tu consentimiento.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
