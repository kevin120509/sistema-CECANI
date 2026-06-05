import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  // Obtener documentos con estado de rechazo
  const { data: docs, error: docsError } = await supabase
    .from('documentos')
    .select('id, tipo, url_archivo, validado, motivo_rechazo, expediente_id')
    .order('created_at', { ascending: false })
    .limit(20);

  // Obtener expedientes con estatus
  const { data: exps } = await supabase
    .from('expedientes')
    .select('id, estatus, nombre_empresa')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    documentos: docs,
    docsError: docsError?.message,
    expedientes: exps,
  });
}
