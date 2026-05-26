'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult, CrearRecordatorioForm, EstatusRecordatorio, Recordatorio } from '@/types/database';

import { RecordatorioService } from '@/core/services/RecordatorioService';
import { SupabaseRecordatorioRepository } from '@/infrastructure/persistence/SupabaseRecordatorioRepository';
import { OneSignalNotificationService } from '@/infrastructure/external/OneSignalNotificationService';

function getRecordatorioService() {
  return new RecordatorioService(
    new SupabaseRecordatorioRepository(),
    new OneSignalNotificationService()
  );
}

export async function crearRecordatorio(
  form: CrearRecordatorioForm
): Promise<ActionResult<Recordatorio | null>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'No autorizado' };

  const adminSupabase = createAdminClient();
  const { data: perfilData } = await adminSupabase
    .from('perfiles')
    .select('nombre_completo')
    .eq('id', user.id)
    .single();

  const service = getRecordatorioService();
  const result = await service.crearRecordatorio(
    user.id,
    form,
    perfilData?.nombre_completo || 'Asesora'
  );

  if (result.success) {
    revalidatePath('/abogada');
  }

  return result;
}

export async function actualizarEstatusRecordatorio(
  recordatorioId: string,
  expedienteId: string,
  estatus: EstatusRecordatorio
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'No autorizado' };

  const service = getRecordatorioService();
  const result = await service.actualizarEstatus(user.id, recordatorioId, expedienteId, estatus);

  if (result.success) {
    revalidatePath('/abogada');
  }

  return result;
}
