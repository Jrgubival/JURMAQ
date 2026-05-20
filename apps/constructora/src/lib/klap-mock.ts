import type {
  KlapCancelRequest,
  KlapCancelResponse,
  KlapCaptureRequest,
  KlapCaptureResponse,
  KlapChargeResponse,
  KlapOffsessionChargeRequest,
  KlapPreauthRequest,
  KlapPreauthResponse,
  KlapResult,
} from './klap-types';

/**
 * Mock provider de Klap.
 *
 * Devuelve respuestas canned para que el sistema funcione end-to-end sin
 * credenciales reales. Activa Fase A del rollout: build + tests + UI listos,
 * sólo falta flippear KLAP_ENABLED=true + setear KLAP_API_KEY cuando llegue
 * la cuenta merchant.
 *
 * Comportamiento mock:
 *   - preauth: 99% éxito. 1% rechazo (basado en monto > 10000000 = rechazo
 *     para simular límite de tarjeta).
 *   - capture: éxito si monto ≤ monto del hold.
 *   - cancel: siempre éxito.
 *   - off-session charge: 90% éxito; 10% declined para testear flow de
 *     manejo de errores.
 *
 * Genera trx_ids deterministas (hash del consumer_transaction_id) para
 * facilitar debug en logs.
 */

function fakeTrxId(consumerTxId: string): string {
  // Hash-like opaco. En la práctica Klap devuelve 50 chars.
  return `MOCK-${consumerTxId.slice(0, 16).toUpperCase()}-${Date.now().toString(36)}`;
}

function defaultExpiry(): string {
  // 30 días para VISA equipment rental (consistente con MCC 7359).
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function mockPreauth(req: KlapPreauthRequest): Promise<KlapResult<KlapPreauthResponse>> {
  // Latencia simulada (200-500ms).
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  // Simular rechazo por monto excesivo.
  if (req.amount.value > 10_000_000) {
    return {
      ok: false,
      error: 'Mock: amount exceeds card limit',
      data: undefined,
    };
  }

  const trxId = fakeTrxId(req.consumer_transaction_id);
  return {
    ok: true,
    data: {
      code: '00',
      trx_id: trxId,
      external_authorization_code: `AUTH${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      hold_expires_at: defaultExpiry(),
    },
    raw: { mock: true, ...req },
  };
}

export async function mockCapture(req: KlapCaptureRequest): Promise<KlapResult<KlapCaptureResponse>> {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

  const trxId = fakeTrxId(req.consumer_transaction_id);
  return {
    ok: true,
    data: {
      code: '00',
      trx_id: trxId,
      external_authorization_code: `CAP${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    },
    raw: { mock: true, ...req },
  };
}

export async function mockCancel(req: KlapCancelRequest): Promise<KlapResult<KlapCancelResponse>> {
  await new Promise((r) => setTimeout(r, 100));

  const trxId = fakeTrxId(req.consumer_transaction_id);
  return {
    ok: true,
    data: {
      code: '00',
      trx_id: trxId,
    },
    raw: { mock: true, ...req },
  };
}

export async function mockOffsessionCharge(
  req: KlapOffsessionChargeRequest,
): Promise<KlapResult<KlapChargeResponse>> {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  // 10% declined para testing.
  if (Math.random() < 0.1) {
    return {
      ok: false,
      data: {
        code: '51',
        trx_id: fakeTrxId(req.consumer_transaction_id),
        decline_reason: 'Mock: insufficient funds',
      },
      error: 'Mock: card declined',
    };
  }

  return {
    ok: true,
    data: {
      code: '00',
      trx_id: fakeTrxId(req.consumer_transaction_id),
      external_authorization_code: `OFF${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
    },
    raw: { mock: true, ...req },
  };
}

/** Genera un network_token mock para el flow del cliente "ingresa tarjeta". */
export function mockNetworkToken(brand: 'VISA' | 'MASTERCARD' | 'AMEX' = 'VISA') {
  return {
    network_token: `MOCK-TOKEN-${Math.random().toString(36).slice(2, 18).toUpperCase()}`,
    token_requestor_id: `TSP${Math.random().toString().slice(2, 12)}`,
    card_brand: brand,
    card_last4: String(Math.floor(1000 + Math.random() * 9000)),
    card_exp_month: 12,
    card_exp_year: 2028,
  };
}
