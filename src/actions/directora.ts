'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/onesignal-server';
import { subirArchivoR2 } from '@/lib/r2';

// Importaciones de la Arquitectura Limpia
import { AuthService } from '@/core/services/AuthService';
import { SupabaseAuthAdapter } from '@/infrastructure/external/SupabaseAuthAdapter';

function getAuthService() {
  return new AuthService(new SupabaseAuthAdapter());
}

export async function loginDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const service = getAuthService();
  const result = await service.loginDirectora(formData);
  
  if (result.success) {
    revalidatePath('/directora');
  }
  
  return result;
}

export async function registrarDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const service = getAuthService();
  return await service.registrarDirectora(formData);
}

export async function enviarContratoCliente(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Verificación estricta de seguridad
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'No autorizado / Sesión expirada' };
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.rol !== 'directora') {
      return { error: 'Acceso denegado: Se requiere rol de directora.' };
    }

    const adminSupabase = createAdminClient();

    const expedienteId = formData.get('expediente_id') as string;
    const contratoId = formData.get('contrato_id') as string;
    const file = formData.get('file') as File | null;

    if (!expedienteId || !contratoId || !file || file.size === 0) {
      return { error: 'Faltan datos obligatorios o el archivo (PDF de respaldo) no fue cargado.' };
    }

    // Obtener el ID del cliente antes de actualizar para enviarle notificación
    const { data: expData } = await adminSupabase
      .from('expedientes')
      .select('perfil_id')
      .eq('id', expedienteId)
      .single();

    // Subir a R2 (Bodega)
    const urlPdfOficial = await subirArchivoR2(file, `expedientes/${expedienteId}/contratos`);

    // Transacción: Actualizar Contrato
    const { error: contratoError } = await adminSupabase
      .from('contratos')
      .update({
        url_pdf_generado: urlPdfOficial,
      })
      .eq('id', contratoId);

    if (contratoError) throw new Error(`Fallo actualizando el contrato: ${contratoError.message}`);

    // Transacción: Actualizar Expediente y asignar estatus
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .update({
        estatus: 'en_proceso'
      })
      .eq('id', expedienteId);

    if (expError) throw new Error(`Fallo actualizando el expediente: ${expError.message}`);

    // NOTIFICACIÓN AL CLIENTE
    if (expData?.perfil_id) {
      await sendPushNotification({
        userIds: [expData.perfil_id],
        title: '¡Contrato Listo!',
        message: 'Tu contrato ha sido generado. Por favor, revísalo y fírmalo para continuar.',
        url: '/documentacion'
      });
    }

    // Revalidar las vistas para refrescar el cliente y la directora
    revalidatePath('/directora');
    revalidatePath('/');

    return { success: true };
  } catch (error: unknown) {
    return { error: (error as Error).message || 'Error de servidor desconocido' };
  }
}

export async function aprobarContratoGeneradoCliente(expedienteId: string, contratoId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // Obtener perfil_id para notificación
    const { data: expData } = await adminSupabase
      .from('expedientes')
      .select('cliente_id')
      .eq('id', expedienteId)
      .single();

    // Actualizar Expediente y asignar estatus
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .update({
        estatus: 'en_proceso'
      })
      .eq('id', expedienteId);

    if (expError) throw new Error(`Fallo actualizando el expediente: ${expError.message}`);

    // NOTIFICACIÓN AL CLIENTE
    if (expData?.cliente_id) {
      await sendPushNotification({
        userIds: [expData.cliente_id],
        title: '¡Contrato Aprobado!',
        message: 'Tu contrato ha sido verificado y está listo. Por favor, revísalo y fírmalo para continuar.',
        url: '/documentacion'
      });
    }

    revalidatePath('/directora');
    revalidatePath('/');

    return { success: true };
  } catch (error: unknown) {
    return { error: (error as Error).message || 'Error de servidor desconocido' };
  }
}

export async function asignarAbogada(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Verificación estricta de seguridad
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'No autorizado / Sesión expirada' };
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.rol !== 'directora') {
      return { error: 'Acceso denegado: Se requiere rol de directora.' };
    }

    const adminSupabase = createAdminClient();

    const expedienteId = formData.get('expediente_id') as string;
    const asesoraId = formData.get('asesora_id') as string;

    if (!expedienteId || !asesoraId) {
      return { error: 'Faltan datos obligatorios para la asignación.' };
    }

    // Transacción: Actualizar Expediente y asignar
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .update({
        asesora_id: asesoraId,
        estatus: 'en_proceso'
      })
      .eq('id', expedienteId);

    if (expError) throw new Error(`Fallo actualizando el expediente: ${expError.message}`);

    // NOTIFICACIÓN A LA ABOGADA
    await sendPushNotification({
      userIds: [asesoraId],
      title: 'Nuevo Expediente Asignado',
      message: 'Se te ha asignado un nuevo caso. Revisa la información del cliente para iniciar el seguimiento.',
      url: '/abogada'
    });

    // Revalidar las vistas para refrescar el cliente y la directora
    revalidatePath('/directora');
    revalidatePath('/');
    revalidatePath('/abogada');

    return { success: true };
  } catch (error: unknown) {
    return { error: (error as Error).message || 'Error de servidor desconocido' };
  }
}

export async function subirContratoDobleFirma(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'No autorizado' };
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!perfil || perfil.rol !== 'directora') {
      return { error: 'Acceso denegado: Se requiere rol de directora.' };
    }

    const adminSupabase = createAdminClient();

    const expedienteId = formData.get('expediente_id') as string;
    const contratoId = formData.get('contrato_id') as string;
    const file = formData.get('file') as File | null;

    if (!expedienteId || !contratoId || !file || file.size === 0) {
      return { error: 'Falta el archivo de la Doble Firma.' };
    }

    // 1. Subir a R2 (Bodega)
    const urlDobleFirma = await subirArchivoR2(file, `expedientes/${expedienteId}/contratos`);

    // 2. Actualizar Contrato
    const { error: contratoError } = await adminSupabase
      .from('contratos')
      .update({
        url_pdf_doble_firma: urlDobleFirma,
        estatus: 'doble_firma'
      })
      .eq('id', contratoId);

    if (contratoError) throw contratoError;

    // 3. Revalidar
    revalidatePath('/directora');
    revalidatePath('/abogada');

    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Error desconocido' };
  }
}
