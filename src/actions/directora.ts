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

import { SupabaseExpedienteRepository } from '@/infrastructure/persistence/SupabaseExpedienteRepository';
import { SupabaseUserRepository } from '@/infrastructure/persistence/SupabaseUserRepository';
import { ExpedienteService } from '@/core/services/ExpedienteService';

function getExpedienteService() {
  return new ExpedienteService(new SupabaseExpedienteRepository(), new SupabaseUserRepository());
}

export async function crearClienteManualAction(formData: FormData): Promise<{ success?: boolean; error?: string; data?: { expediente_id: string; cliente_id: string; contrato_id: string } }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    const service = getExpedienteService();
    const result = await service.registrarClienteManual(
      {
        nombre_completo: formData.get('nombre_completo') as string,
        telefono: formData.get('telefono') as string,
        rfc: formData.get('rfc') as string || undefined,
      },
      formData.get('nombre_empresa') as string
    );

    if (result.success && result.data) {
      revalidatePath('/directora');
      return { 
        success: true, 
        data: {
          expediente_id: result.data.expediente_id,
          cliente_id: result.data.user_id,
          contrato_id: result.data.contrato_id
        } 
      };
    }
    return { error: result.error };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function eliminarExpedienteAction(expedienteId: string, clienteId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    const adminSupabase = createAdminClient();

    // 1. Eliminar expediente (la base de datos debería manejar cascada para contratos/documentos/pagos si está configurado, 
    // pero lo hacemos manual o confiamos en el esquema)
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .delete()
      .eq('id', expedienteId);

    if (expError) throw expError;

    // 2. Eliminar perfil del cliente
    const { error: perfilError } = await adminSupabase
      .from('perfiles')
      .delete()
      .eq('id', clienteId);

    if (perfilError) throw perfilError;

    // 3. Eliminar usuario de Auth (Opcional, pero recomendado para limpieza total)
    await adminSupabase.auth.admin.deleteUser(clienteId);

    revalidatePath('/directora');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Error al eliminar registro' };
  }
}

export async function vincularContratoDobleFirmaAction(contratoId: string, url: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('contratos')
      .update({
        url_pdf_doble_firma: url,
        estatus: 'doble_firma'
      })
      .eq('id', contratoId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
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

    // 1. Insertar en la tabla relacional (Muchos a Muchos)
    const { error: relError } = await adminSupabase
      .from('expediente_asesoras')
      .upsert({
        expediente_id: expedienteId,
        asesora_id: asesoraId
      }, { onConflict: 'expediente_id, asesora_id' });

    if (relError) throw new Error(`Fallo en relación de asesora: ${relError.message}`);

    // 2. Transacción: Actualizar Expediente (Legacy asesora_id para filtros antiguos y estatus)
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .update({
        asesora_id: asesoraId, // Mantenemos el último asignado como principal
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
