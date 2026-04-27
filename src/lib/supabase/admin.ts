import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con Service Role Key.
 * SOLO para uso en Server Actions — nunca exponer al cliente.
 * Bypasa RLS y permite operaciones admin (crear usuarios, etc).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
