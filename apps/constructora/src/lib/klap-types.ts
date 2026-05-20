/**
 * Tipos para la integración con Klap (api.pasarela.multicaja.cl v4).
 *
 * Documentación de referencia (verificado mayo 2026):
 *   - POST /card-payments/v4/preauth             → crear hold
 *   - POST /card-payments/v4/preauth/completion  → capturar parcial/total
 *   - POST /card-payments/v4/preauth/cancel      → liberar hold
 *   - POST /card-payments/v4/charges             → cargo off-session con token
 */

export type KlapCardBrand = 'VISA' | 'MASTERCARD' | 'AMEX';

export interface KlapNetworkToken {
  network_token: string;
  token_requestor_id: string;
  card_brand: KlapCardBrand;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
}

export interface KlapPreauthRequest {
  consumer_transaction_id: string;   // único globalmente
  amount: { value: number; currency_code: 'CLP' };
  network_token: KlapNetworkToken;
  merchant_meta?: Record<string, string>;
}

export interface KlapPreauthResponse {
  code: string;                       // '00' = aprobado
  trx_id: string;                     // id de la transacción en Klap
  external_authorization_code?: string;
  hold_expires_at: string;            // ISO timestamp del límite del hold
  raw?: unknown;
}

export interface KlapCaptureRequest {
  consumer_transaction_id: string;
  consumer_original_transaction_id: string;
  amount: { value: number; currency_code: 'CLP' };
}

export interface KlapCaptureResponse {
  code: string;
  trx_id: string;
  external_authorization_code?: string;
  raw?: unknown;
}

export interface KlapCancelRequest {
  consumer_transaction_id: string;
  consumer_original_transaction_id: string;
  amount: { value: number; currency_code: 'CLP' };
}

export interface KlapCancelResponse {
  code: string;
  trx_id: string;
  raw?: unknown;
}

export interface KlapOffsessionChargeRequest {
  consumer_transaction_id: string;
  consumer_related_transaction_id: string;   // id del hold original (vínculo card-on-file)
  amount: { value: number; currency_code: 'CLP' };
  network_token: KlapNetworkToken;
  charge_type: {
    initiator: 'merchant';
    type: 'card_on_file' | 'recurring';
  };
}

export interface KlapChargeResponse {
  code: string;
  trx_id: string;
  external_authorization_code?: string;
  decline_reason?: string;
  raw?: unknown;
}

export interface KlapResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  /** Si es webhook-driven: payload original para audit. */
  raw?: unknown;
}
