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
      const asesoraId = formData.get('asesora_id') as string;
      if (asesoraId) {
        const adminSupabase = createAdminClient();
        await adminSupabase
          .from('expedientes')
          .update({ 
            asesora_id: asesoraId,
            estatus: 'en_proceso' // Importante para que aparezca en el panel legal de la abogada
          })
          .eq('id', result.data.expediente_id);
          
        await adminSupabase
          .from('expediente_asesoras')
          .insert({
            expediente_id: result.data.expediente_id,
            asesora_id: asesoraId
          });
      }

      revalidatePath('/directora');
      revalidatePath('/abogada');
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

    // 1. PRIMERO ACTUALIZAR LEGACY (Asegura que el sistema funcione y el cliente se mueva de pestaña)
    const { error: expError } = await adminSupabase
      .from('expedientes')
      .update({
        asesora_id: asesoraId, 
        estatus: 'en_proceso'
      })
      .eq('id', expedienteId);

    if (expError) {
      console.error('Legacy Assignment Error:', expError);
      throw new Error(`Fallo actualizando el expediente: ${expError.message}`);
    }

    // 2. SEGUNDO: Intentar insertar en la tabla relacional (Muchos a Muchos)
    // No bloqueamos el éxito de la acción si esta tabla aún no está lista
    try {
      const { error: relError } = await adminSupabase
        .from('expediente_asesoras')
        .upsert({
          expediente_id: expedienteId,
          asesora_id: asesoraId
        }, { onConflict: 'expediente_id,asesora_id' });

      if (relError) {
        console.warn('Relational table update failed (Non-critical):', relError.message);
      }
    } catch (e) {
      console.warn('Relational update caught error (Non-critical)');
    }

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

/**
 * Actualiza el url_pdf_generado de un contrato. (Cuando la directora corrige el generado por sistema)
 */
export async function actualizarContratoGeneradoAction(contratoId: string, nuevaUrl: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('contratos')
      .update({ url_pdf_generado: nuevaUrl })
      .eq('id', contratoId);

    if (error) throw error;
    
    revalidatePath('/directora');
    revalidatePath('/cliente');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Valida o rechaza un documento individual.
 */
export async function validarDocumentoAction(documentoId: string, validado: boolean): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('documentos')
      .update({ validado })
      .eq('id', documentoId);

    if (error) throw error;
    
    revalidatePath('/directora');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}



/**
 * Rechaza un documento individual, notificando al cliente y borrándolo para que pueda resubirlo.
 */
export async function rechazarDocumentoR2Action(
  documentoId: string, 
  tipoDocumento: string, 
  expedienteId: string, 
  clienteId: string, 
  motivo: string,
  urlArchivo: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // 1. Actualizar el registro de la tabla documentos para mantener el motivo de rechazo
    const { error: updateError } = await adminSupabase
      .from('documentos')
      .update({
        validado: false,
        motivo_rechazo: motivo,
        url_archivo: '' // Borramos la URL para que la UI sepa que no hay archivo
      })
      .eq('id', documentoId);

    if (updateError) throw updateError;

    // 2. Intentar borrar el archivo físico en R2
    if (urlArchivo) {
      const { borrarArchivoR2 } = await import('@/lib/r2');
      await borrarArchivoR2(urlArchivo);
    }

    // 3. Regresar el estatus del expediente a en_registro para que el cliente atienda el pendiente
    await adminSupabase
      .from('expedientes')
      .update({ estatus: 'en_registro' })
      .eq('id', expedienteId);

    // 4. Enviar notificación Push al cliente indicando el motivo
    const nombreDoc = tipoDocumento.replace(/_/g, ' ').toUpperCase();
    await sendPushNotification({
      userIds: [clienteId],
      title: `Documento Rechazado: ${nombreDoc}`,
      message: `Tu documento fue rechazado por el siguiente motivo: ${motivo}. Por favor, vuelve a subirlo.`,
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Aprueba el contrato firmado por el cliente.
 */
export async function validarContratoAction(contratoId: string, expedienteId: string, clienteId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // 1. Marcar el documento como validado en la tabla de documentos
    const { error: docError } = await adminSupabase
      .from('documentos')
      .update({ validado: true, motivo_rechazo: null })
      .eq('expediente_id', expedienteId)
      .eq('tipo', 'contrato_firmado');

    if (docError) {
      console.warn('Advertencia al validar documento contrato:', docError.message);
    }

    // 2. Notificar al cliente
    await sendPushNotification({
      userIds: [clienteId],
      title: 'Contrato Validado',
      message: 'Tu contrato firmado ha sido verificado y aprobado por la dirección.',
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Aprueba el expediente completo (documentos + contrato) y notifica al cliente.
 */
export async function aprobarExpedienteAction(expedienteId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // 1. Obtener datos del cliente para la notificación
    const { data: expData, error: fetchError } = await adminSupabase
      .from('expedientes')
      .select('cliente_id, nombre_empresa')
      .eq('id', expedienteId)
      .single();
      
    if (fetchError || !expData) throw new Error('No se encontró el expediente');

    // 2. Cambiar estatus a 'en_proceso' (esto libera el contrato para el cliente)
    const { error: updateError } = await adminSupabase
      .from('expedientes')
      .update({ estatus: 'en_proceso' })
      .eq('id', expedienteId);

    if (updateError) throw updateError;

    // 3. Notificar al cliente
    await sendPushNotification({
      userIds: [expData.cliente_id],
      title: '¡Expediente Aprobado!',
      message: `Tu documentación y contrato para ${expData.nombre_empresa} han sido aprobados. Ya puedes descargar y firmar tu contrato.`,
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rechaza el expediente y lo devuelve al cliente para correcciones.
 */
export async function rechazarExpedienteAction(expedienteId: string, motivo: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    const { data: expData } = await adminSupabase
      .from('expedientes')
      .select('cliente_id')
      .eq('id', expedienteId)
      .single();

    // 1. Regresar estatus a 'en_registro'
    const { error } = await adminSupabase
      .from('expedientes')
      .update({
        estatus: 'en_registro'
      })
      .eq('id', expedienteId);

    if (error) throw error;
    
    // Guardar el motivo en el concentrado (estatus_detalle)
    await adminSupabase
      .from('datos_concentrado')
      .upsert({
         expediente_id: expedienteId,
         estatus_detalle: `RECHAZADO: ${motivo}`
      }, { onConflict: 'expediente_id' });

    // 2. Notificar al cliente
    if (expData?.cliente_id) {
      await sendPushNotification({
        userIds: [expData.cliente_id],
        title: 'Atención: Documentación Rechazada',
        message: `Hay detalles que corregir en tu expediente: ${motivo}. Por favor, revisa tu panel.`,
        url: '/'
      });
    }

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
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

/**
 * Valida un pago y notifica.
 */
export async function validarPagoAction(pagoId: string, expedienteId: string, clienteId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // 1. Marcar el pago como verificado
    const { error: pagoError } = await adminSupabase
      .from('pagos')
      .update({ verificado: true })
      .eq('id', pagoId);

    if (pagoError) throw pagoError;

    // 2. Sincronizar la tabla de documentos para que el checklist visual del cliente se actualice
    // Buscamos el documento tipo 'comprobante_pago' para este expediente
    const { error: docError } = await adminSupabase
      .from('documentos')
      .update({ validado: true, motivo_rechazo: null })
      .eq('expediente_id', expedienteId)
      .eq('tipo', 'comprobante_pago');

    if (docError) {
      console.warn('Advertencia: No se pudo actualizar el checklist visual, pero el pago es válido:', docError.message);
    }
    
    // Opcional: Notificar al cliente que su pago fue verificado
    await sendPushNotification({
      userIds: [clienteId],
      title: 'Pago Verificado',
      message: 'Tu pago ha sido verificado correctamente por la dirección.',
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rechaza un pago, elimina su registro (o vacía url) y notifica al cliente.
 */
export async function rechazarPagoAction(
  pagoId: string, 
  expedienteId: string, 
  clienteId: string, 
  motivo: string,
  urlArchivo: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // Para el pago, lo eliminamos y que el cliente lo vuelva a subir 
    // O lo actualizamos como con documentos. En este caso lo borramos 
    // y la UI pedirá subir uno nuevo ya que no hay pago inicial registrado.
    const { error: deleteError } = await adminSupabase
      .from('pagos')
      .delete()
      .eq('id', pagoId);

    if (deleteError) throw deleteError;

    // Borrar el archivo físico en R2
    if (urlArchivo) {
      const { borrarArchivoR2 } = await import('@/lib/r2');
      await borrarArchivoR2(urlArchivo);
    }

    await sendPushNotification({
      userIds: [clienteId],
      title: 'Comprobante de Pago Rechazado',
      message: `Tu comprobante de pago fue rechazado: ${motivo}. Por favor, vuelve a subirlo.`,
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rechaza el contrato firmado por el cliente.
 */
export async function rechazarContratoClienteAction(
  contratoId: string, 
  expedienteId: string, 
  clienteId: string, 
  motivo: string,
  urlArchivo: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();
    
    // Limpiamos el PDF firmado del cliente y regresamos el estatus a generado
    const { error: updateError } = await adminSupabase
      .from('contratos')
      .update({
        url_pdf_firmado_cliente: null,
        estatus: 'generado' // Para que pueda volver a firmarlo y subirlo
      })
      .eq('id', contratoId);

    if (updateError) throw updateError;

    // Borrar el archivo físico en R2
    if (urlArchivo) {
      const { borrarArchivoR2 } = await import('@/lib/r2');
      await borrarArchivoR2(urlArchivo);
    }

    await sendPushNotification({
      userIds: [clienteId],
      title: 'Contrato Rechazado',
      message: `Tu contrato firmado fue rechazado: ${motivo}. Por favor, vuélvelo a subir corregido.`,
      url: '/documentacion'
    });

    revalidatePath('/directora');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Solicitud de Alta de Cliente por Abogada.
 * Crea un registro en solicitudes_alta pendiente de aprobación por la directora.
 */
export async function solicitarAltaClienteAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    const adminSupabase = createAdminClient();

    const solicitud = {
      asesora_id: user.id,
      nombre_cliente: formData.get('nombre_cliente') as string,
      telefono: formData.get('telefono') as string,
      nombre_empresa: formData.get('nombre_empresa') as string,
      rfc: formData.get('rfc') as string || null,
      curp: formData.get('curp') as string || null,
      ocupacion: formData.get('ocupacion') as string || null,
      estado_civil: formData.get('estado_civil') as string || null,
      domicilio_completo: formData.get('domicilio_completo') as string || null,
      url_ine_frente: formData.get('url_ine_frente') as string || null,
      url_ine_reverso: formData.get('url_ine_reverso') as string || null,
      url_curp: formData.get('url_curp') as string || null,
      url_comprobante_domicilio: formData.get('url_comprobante_domicilio') as string || null,
      url_contrato: formData.get('url_contrato') as string || null,
      monto_total: formData.get('monto_total') ? Number(formData.get('monto_total')) : null,
      plan_pagos: formData.get('plan_pagos') as string || null,
      notas: formData.get('notas') as string || null,
      estatus: 'pendiente',
    };

    const { error } = await adminSupabase
      .from('solicitudes_alta')
      .insert(solicitud);

    if (error) throw error;

    // Notificar a directoras
    const { data: directoras } = await adminSupabase
      .from('perfiles')
      .select('id')
      .eq('rol', 'directora');

    if (directoras?.length) {
      await sendPushNotification({
        userIds: directoras.map(d => d.id),
        title: '📋 Nueva Solicitud de Alta',
        message: `Una asesora solicita dar de alta a: ${solicitud.nombre_cliente} (${solicitud.nombre_empresa})`,
        url: '/directora',
      });
    }

    revalidatePath('/abogada');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Aprobar solicitud de alta por la directora.
 * Crea el expediente y lo marca como aprobado.
 */
export async function aprobarSolicitudAltaAction(solicitudId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    // Obtener datos de la solicitud
    const { data: sol, error: solError } = await adminSupabase
      .from('solicitudes_alta')
      .select('*')
      .eq('id', solicitudId)
      .single();

    if (solError || !sol) throw new Error('Solicitud no encontrada');

    // Crear el expediente usando el servicio con TODOS los datos capturados
    const service = getExpedienteService();
    const result = await service.registrarClienteManual(
      { 
        nombre_completo: sol.nombre_cliente, 
        telefono: sol.telefono, 
        rfc: sol.rfc || undefined,
        curp: sol.curp || undefined,
        ocupacion: sol.ocupacion || undefined,
        estado_civil: sol.estado_civil || undefined,
        domicilio_completo: sol.domicilio_completo || undefined
      },
      sol.nombre_empresa,
    );

    if (!result.success || !result.data) throw new Error(result.error);

    const { expediente_id, contrato_id, user_id } = result.data;

    // Registrar Documentos Automáticamente si existen en la solicitud
    const { registrarDocumento } = await import('@/actions/documentos');
    const { guardarContratoFirmado } = await import('@/actions/contrato');

    if (sol.url_ine_frente) await registrarDocumento(expediente_id, 'ine_frente', sol.url_ine_frente, null, true);
    if (sol.url_ine_reverso) await registrarDocumento(expediente_id, 'ine_reverso', sol.url_ine_reverso, null, true);
    if (sol.url_curp) await registrarDocumento(expediente_id, 'curp', sol.url_curp, null, true);
    if (sol.url_comprobante_domicilio) await registrarDocumento(expediente_id, 'comprobante_domicilio', sol.url_comprobante_domicilio, null, true);
    
    if (sol.url_contrato) {
      await guardarContratoFirmado(contrato_id, sol.url_contrato);
      await registrarDocumento(expediente_id, 'contrato_firmado', sol.url_contrato, null, true);
    }

    // Actualizar contrato con monto y plan si vienen en la solicitud
    if (sol.monto_total || sol.plan_pagos) {
      await adminSupabase
        .from('contratos')
        .update({
          monto_total: sol.monto_total,
          plan_pagos: sol.plan_pagos
        })
        .eq('id', contrato_id);
    }

    // Asignar la asesora solicitante al expediente y marcar como 'en_proceso'
    if (sol.asesora_id) {
      await adminSupabase
        .from('expedientes')
        .update({ 
          asesora_id: sol.asesora_id,
          estatus: 'en_proceso' 
        })
        .eq('id', expediente_id);

      // También guardar en la nueva tabla relacional
      await adminSupabase
        .from('expediente_asesoras')
        .upsert({
          expediente_id: expediente_id,
          asesora_id: sol.asesora_id
        }, { onConflict: 'expediente_id, asesora_id' });
    }

    // Marcar solicitud como aprobada
    await adminSupabase
      .from('solicitudes_alta')
      .update({ estatus: 'aprobada', expediente_id: expediente_id })
      .eq('id', solicitudId);

    // Notificar a la asesora
    await sendPushNotification({
      userIds: [sol.asesora_id],
      title: '✅ Alta Aprobada',
      message: `Tu solicitud de alta para ${sol.nombre_cliente} fue aprobada. Ya puedes verlo en tu panel.`,
      url: '/abogada',
    });

    revalidatePath('/directora');
    revalidatePath('/abogada');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Rechazar solicitud de alta por la directora.
 */
export async function rechazarSolicitudAltaAction(solicitudId: string, motivo: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    const { data: sol } = await adminSupabase
      .from('solicitudes_alta')
      .select('asesora_id, nombre_cliente')
      .eq('id', solicitudId)
      .single();

    await adminSupabase
      .from('solicitudes_alta')
      .update({ estatus: 'rechazada', notas_rechazo: motivo })
      .eq('id', solicitudId);

    if (sol?.asesora_id) {
      await sendPushNotification({
        userIds: [sol.asesora_id],
        title: '❌ Solicitud Rechazada',
        message: `La solicitud de alta para ${sol.nombre_cliente} fue rechazada. Motivo: ${motivo}`,
        url: '/abogada',
      });
    }

    revalidatePath('/directora');
    revalidatePath('/abogada');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Eliminar solicitud de alta por la directora (ya sea aprobada, rechazada o pendiente)
 */
export async function eliminarSolicitudAltaAction(solicitudId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from('solicitudes_alta')
      .delete()
      .eq('id', solicitudId);

    if (error) throw error;

    revalidatePath('/directora');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
