// env falso para cargar lib/pedidos/correos.ts sin servidor ni secretos.
export const env = { PEDIDOS_STORE: 'supabase', AUTH_SECRET: 'x'.repeat(40), NEXT_PUBLIC_BARRACA_URL: undefined };
