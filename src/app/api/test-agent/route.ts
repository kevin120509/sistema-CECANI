import { NextResponse } from 'next/server';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // 1. Encontrar un expediente en_registro
    const { data: expedientes } = await supabase.from('expedientes').select('*').limit(1);
    if (!expedientes || expedientes.length === 0) {
      return NextResponse.json({ error: 'No expedientes found' });
    }
    const expediente = expedientes[0];

    // 2. Simular subida a R2
    const formData = new FormData();
    const blob = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', blob, 'test.txt');
    
    const uploadResult = await subirArchivoR2Action(formData, 'expedientes/test');
    if (!uploadResult.success) {
      return NextResponse.json({ step: 'R2 Upload Failed', error: uploadResult.error });
    }

    // 3. Simular registro en DB
    const dbResult = await registrarDocumento(expediente.id, 'ine_frente', uploadResult.data?.url || 'url');
    if (!dbResult.success) {
      return NextResponse.json({ step: 'DB Insert Failed', error: dbResult.error });
    }

    // 4. Actualizar estatus
    const statusResult = await actualizarEstatusExpediente(expediente.id, 'revision_directora');
    if (!statusResult.success) {
      return NextResponse.json({ step: 'Status Update Failed', error: statusResult.error });
    }

    return NextResponse.json({ success: true, message: 'ALL STEPS PASSED LOCALLY!' });
  } catch (error: any) {
    return NextResponse.json({ __DEBUG_ERROR__: true, error: error.message, stack: error.stack }, { status: 200 });
  }
}
