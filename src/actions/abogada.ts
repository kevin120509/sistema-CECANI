'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/database';

import { sendPushNotification } from '@/lib/onesignal-server';

// Importaciones de la Arquitectura Limpia
import { TareaService } from '@/core/services/TareaService';
import { SupabaseTareaRepository } from '@/infrastructure/persistence/SupabaseTareaRepository';

function getTareaService() {
  return new TareaService(new SupabaseTareaRepository());
}

export async function marcarHitoCompletado(
  expedienteId: string,
  hitoId: string,
  completado: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'No autorizado' };
  }

  const service = getTareaService();
  const result = await service.marcarHitoCompletado(user.id, expedienteId, hitoId, completado);

  if (result.success) {
    revalidatePath('/abogada');
  }

  return result;
}

export async function agregarNotaBitacora(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'No autorizado' };
  }

  const service = getTareaService();
  const result = await service.agregarNotaBitacora(user.id, formData);

  if (result.success) {
    revalidatePath('/abogada');
  }

  return result;
}

export async function guardarDatosConcentrado(
  expedienteId: string,
  datos: Record<string, string>
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'No autorizado' };
  }

  // Verificar que el expediente pertenece a esta abogada
  const { data: exp } = await supabase
    .from('expedientes')
    .select('id')
    .eq('id', expedienteId)
    .eq('asesora_id', user.id)
    .single();

  if (!exp) {
    return { success: false, error: 'No tienes permisos sobre este expediente.' };
  }

  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from('datos_concentrado')
      .upsert(
        {
          expediente_id: expedienteId,
          ...datos,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'expediente_id' }
      );

    if (error) throw error;

    revalidatePath('/abogada');
    return { success: true };
  } catch (error) {
    console.error('Error al guardar datos concentrado:', error);
    return { success: false, error: 'Ocurrió un error al guardar los datos.' };
  }
}
