'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/database';

import { sendPushNotification } from '@/lib/onesignal-server';

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

  // Verificar que el expediente pertenece a esta abogada
  const { data: exp } = await supabase
    .from('expedientes')
    .select('id, nombre_empresa')
    .eq('id', expedienteId)
    .eq('asesora_id', user.id)
    .single();

  if (!exp) {
    return { success: false, error: 'No tienes permisos sobre este expediente.' };
  }

  // Usar admin client para bypasear RLS en seguimiento_tareas
  const adminClient = createAdminClient();

  try {
    if (completado) {
      const { error } = await adminClient
        .from('seguimiento_tareas')
        .upsert(
          {
            expediente_id: expedienteId,
            hito_id: parseInt(hitoId),
            estatus: 'completado',
            fecha_completado: new Date().toISOString(),
          },
          { onConflict: 'expediente_id, hito_id' }
        );

      if (error) throw error;
    } else {
      const { error } = await adminClient
        .from('seguimiento_tareas')
        .upsert(
          {
            expediente_id: expedienteId,
            hito_id: parseInt(hitoId),
            estatus: 'pendiente',
            fecha_completado: null,
          },
          { onConflict: 'expediente_id, hito_id' }
        );

      if (error) throw error;
    }

    revalidatePath('/abogada');
    return { success: true };
  } catch (error) {
    console.error('Error al actualizar hito:', error);
    return { success: false, error: 'Ocurrió un error al actualizar el hito.' };
  }
}

export async function agregarNotaBitacora(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'No autorizado' };
  }

  const expedienteId = formData.get('expediente_id') as string;
  const nota = formData.get('nota') as string;
  const fechaProximo = formData.get('fecha_proximo_seguimiento') as string;

  if (!expedienteId || !nota.trim() || !fechaProximo) {
    return { success: false, error: 'Faltan campos obligatorios.' };
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

  try {
    const { error } = await supabase.from('bitacora').insert({
      expediente_id: expedienteId,
      autor_id: user.id,
      nota: nota.trim(),
      fecha_proximo_seguimiento: fechaProximo,
    });

    if (error) throw error;

    // NOTIFICACIÓN DE RECORDATORIO AGENDADO (Para la propia abogada)
    await sendPushNotification({
      userIds: [user.id],
      title: 'Seguimiento Agendado',
      message: `Se ha registrado tu nota. Recuerda el próximo seguimiento para el día ${fechaProximo}.`,
      url: `/abogada/expediente/${expedienteId}`
    });

    revalidatePath('/abogada');
    return { success: true };
  } catch (error) {
    console.error('Error al agregar nota:', error);
    return { success: false, error: 'Ocurrió un error al agregar la nota.' };
  }
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
