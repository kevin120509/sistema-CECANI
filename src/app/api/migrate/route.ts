import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Endpoint temporal para aplicar migraciones de BD que no se pueden hacer via PostgREST.
 * Uso: GET /api/migrate
 * IMPORTANTE: Eliminar este endpoint cuando la migración esté aplicada.
 */
export async function GET() {
  const supabase = createAdminClient();
  const results: Record<string, unknown> = {};

  // 1. Añadir motivo_rechazo a documentos
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS motivo_rechazo text;`
    });
    results.documentos_motivo_rechazo = error ? `ERROR: ${error.message}` : 'OK';
  } catch (e: any) {
    results.documentos_motivo_rechazo = `CATCH: ${e.message}`;
  }

  // 2. Añadir motivo_rechazo a pagos
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS motivo_rechazo text;`
    });
    results.pagos_motivo_rechazo = error ? `ERROR: ${error.message}` : 'OK';
  } catch (e: any) {
    results.pagos_motivo_rechazo = `CATCH: ${e.message}`;
  }

  // 3. Verificar que las columnas existen ahora
  try {
    const { data, error } = await supabase
      .from('documentos')
      .select('id, motivo_rechazo')
      .limit(1);
    results.verify_documentos = error ? `ERROR: ${error.message}` : `OK - columna existe, ${data?.length ?? 0} filas`;
  } catch (e: any) {
    results.verify_documentos = `CATCH: ${e.message}`;
  }

  return NextResponse.json({ message: 'Migración ejecutada', results });
}
