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

/**
 * Helper para verificar si el usuario tiene permiso sobre un expediente.
 */
async function verificarAccesoExpediente(supabase: any, expedienteId: string, userId: string): Promise<boolean> {
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', userId)
    .single();
  
  if (perfil?.rol === 'directora' || perfil?.rol === 'admin') {
    return true;
  }

  const { data: exp } = await supabase
    .from('expedientes')
    .select('id')
    .eq('id', expedienteId)
    .eq('asesora_id', userId)
    .maybeSingle();

  if (exp) return true;

  const { data: expRel } = await supabase
    .from('expediente_asesoras')
    .select('id')
    .eq('expediente_id', expedienteId)
    .eq('asesora_id', userId)
    .maybeSingle();

  return !!expRel;
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

  if (!(await verificarAccesoExpediente(supabase, expedienteId, user.id))) {
    return { success: false, error: 'No tienes permisos sobre este expediente.' };
  }

  const adminClient = createAdminClient();

  try {
    // 1. Obtener cliente_id para actualizar perfiles si es necesario
    const { data: expInfo } = await adminClient
      .from('expedientes')
      .select('cliente_id')
      .eq('id', expedienteId)
      .single();

    const { 
      numero_control, 
      nombre_completo, rfc, curp, estado_civil, ocupacion, domicilio_completo, telefono_cliente,
      ...datosRestantes 
    } = datos;

    // 2. Actualizar expediente si viene numero_control
    if (numero_control !== undefined) {
      const { error: expError } = await adminClient
        .from('expedientes')
        .update({ numero_control })
        .eq('id', expedienteId);
      if (expError) throw expError;
    }

    // 3. Actualizar perfil del cliente si vienen datos personales
    if (expInfo?.cliente_id) {
      const perfilUpdate: any = {};
      if (nombre_completo !== undefined) perfilUpdate.nombre_completo = nombre_completo;
      if (rfc !== undefined) perfilUpdate.rfc = rfc;
      if (curp !== undefined) perfilUpdate.curp = curp;
      if (estado_civil !== undefined) perfilUpdate.estado_civil = estado_civil;
      if (ocupacion !== undefined) perfilUpdate.ocupacion = ocupacion;
      if (domicilio_completo !== undefined) perfilUpdate.domicilio_completo = domicilio_completo;
      if (telefono_cliente !== undefined) perfilUpdate.telefono = telefono_cliente;

      if (Object.keys(perfilUpdate).length > 0) {
        const { error: perfilError } = await adminClient
          .from('perfiles')
          .update(perfilUpdate)
          .eq('id', expInfo.cliente_id);
        if (perfilError) throw perfilError;
      }
    }

    // 4. Guardar en datos_concentrado (Snapshot para reportes)
    const { error } = await adminClient
      .from('datos_concentrado')
      .upsert(
        {
          expediente_id: expedienteId,
          nombre_completo, rfc, curp, estado_civil, ocupacion, domicilio_completo, telefono_cliente,
          ...datosRestantes,
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

/**
 * Agrega un nuevo integrante (asociado) al expediente.
 */
export async function agregarIntegrante(
  expedienteId: string,
  nombre: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'No autorizado' };

  if (!(await verificarAccesoExpediente(supabase, expedienteId, user.id))) {
    return { success: false, error: 'No tienes permisos sobre este expediente.' };
  }

  const adminClient = createAdminClient();
  try {
    const { error } = await adminClient
      .from('expediente_integrantes')
      .insert({
        expediente_id: expedienteId,
        nombre_completo: nombre,
      });

    if (error) throw error;
    revalidatePath('/abogada');
    return { success: true };
  } catch (error: any) {
    console.error('Error en agregarIntegrante:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina un integrante (asociado) del expediente.
 */
export async function eliminarIntegranteAction(
  integranteId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'No autorizado' };

  const adminClient = createAdminClient();
  try {
    // Primero obtener el expediente_id para validar permiso
    const { data: integrante } = await adminClient
      .from('expediente_integrantes')
      .select('expediente_id')
      .eq('id', integranteId)
      .single();

    if (!integrante) return { success: false, error: 'Integrante no encontrado.' };

    if (!(await verificarAccesoExpediente(supabase, integrante.expediente_id, user.id))) {
      return { success: false, error: 'No tienes permisos sobre este expediente.' };
    }

    const { error } = await adminClient
      .from('expediente_integrantes')
      .delete()
      .eq('id', integranteId);

    if (error) throw error;
    revalidatePath('/abogada');
    return { success: true };
  } catch (error: any) {
    console.error('Error en eliminarIntegranteAction:', error);
    return { success: false, error: error.message };
  }
}
