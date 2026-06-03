'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/onesignal-server';
import type { ActionResult, CrearExpedienteForm } from '@/types/database';

// Importaciones de la nueva arquitectura
import { ExpedienteService } from '@/core/services/ExpedienteService';
import { SupabaseExpedienteRepository } from '@/infrastructure/persistence/SupabaseExpedienteRepository';
import { SupabaseUserRepository } from '@/infrastructure/persistence/SupabaseUserRepository';

interface DatosPersonales {
  nombre_completo: string;
  telefono?: string;
  estado?: string;
  rfc?: string;
  curp?: string;
  ocupacion?: string;
  estado_civil?: string;
  domicilio_completo?: string;
  folio_ine?: string;
}

// Factoría rápida para el servicio (podría moverse a un archivo de configuración)
function getExpedienteService() {
  const expedienteRepo = new SupabaseExpedienteRepository();
  const userRepo = new SupabaseUserRepository();
  return new ExpedienteService(expedienteRepo, userRepo);
}

/**
 * Crea un expediente completo usando la Arquitectura Limpia.
 */
export async function crearExpedienteCompleto(
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult<{ expediente_id: string; user_id: string }>> {
  const service = getExpedienteService();
  const result = await service.registrarNuevoClienteConExpediente(datosPersonales, form);
  
  if (result.success) {
    revalidatePath('/');
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Actualiza el estatus de un expediente.
 * (Pendiente de mover a Service e Infrastructure)
 */
export async function actualizarEstatusExpediente(
  expedienteId: string,
  nuevoEstatus: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const updateData: any = { estatus: nuevoEstatus, updated_at: new Date().toISOString() };
    if (nuevoEstatus === 'revision_directora' || nuevoEstatus === 'en_proceso') {
      updateData.motivo_rechazo = null;
    }

    const { error } = await supabase
      .from('expedientes')
      .update(updateData)
      .eq('id', expedienteId);

    if (error) {
      return { success: false, error: `Error al actualizar estatus: ${error.message}` };
    }

    // DISPARADOR DE NOTIFICACIONES PARA DIRECTORAS
    if (nuevoEstatus === 'revision_directora' || nuevoEstatus === 'en_proceso') {
      const { data: directoras } = await supabase
        .from('perfiles')
        .select('id')
        .eq('rol', 'directora');

      if (directoras && directoras.length > 0) {
        const adminIds = directoras.map(d => d.id);
        
        let msg = '';
        if (nuevoEstatus === 'revision_directora') {
          msg = 'Un nuevo cliente ha completado su registro y subido sus documentos iniciales.';
        } else if (nuevoEstatus === 'en_proceso') {
          msg = 'Un cliente ha devuelto su contrato firmado junto con su comprobante de pago. Pendiente de asignación.';
        }

        await sendPushNotification({
          userIds: adminIds,
          title: 'Actualización de Expediente',
          message: msg,
          url: '/directora'
        });
      }
    }

    revalidatePath('/directora');
    revalidatePath('/abogada');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Obtiene los datos completos del dashboard.
 * (Pendiente de mover a Service e Infrastructure)
 */
export async function obtenerDashboardData(clienteId: string) {
  try {
    const supabase = createAdminClient();

    const [perfilResult, expedienteResult, figurasResult] = await Promise.all([
      supabase.from('perfiles').select('*').eq('id', clienteId).maybeSingle(),
      supabase.from('expedientes').select('*, contratos(*)').eq('cliente_id', clienteId).maybeSingle(),
      supabase.from('catalogo_figuras').select('*').order('id'),
    ]);

    let documentosData = [];
    if (expedienteResult.data?.id) {
      const docsReq = await supabase
        .from('documentos')
        .select('*')
        .eq('expediente_id', expedienteResult.data.id)
        .order('created_at', { ascending: true });
      documentosData = docsReq.data || [];
    }

    return {
      success: true,
      data: {
        perfil: perfilResult.data,
        expediente: expedienteResult.data,
        figuras: figurasResult.data || [],
        documentos: documentosData,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado al cargar datos: ${error instanceof Error ? error.message : 'Desconocido'}`
    };
  }
}

/**
 * Actualiza un expediente completo.
 */
export async function actualizarExpedienteCompleto(
  userId: string,
  expedienteId: string,
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult> {
  const service = getExpedienteService();
  const result = await service.actualizarExpedienteExistente(userId, expedienteId, datosPersonales, form);

  if (result.success) {
    revalidatePath('/');
    revalidatePath('/directora');
    revalidatePath('/abogada');
    return { success: true };
  }

  return { success: false, error: result.error };
}
