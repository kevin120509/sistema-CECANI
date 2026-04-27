'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/onesignal-server';
import type { ActionResult, CrearExpedienteForm } from '@/types/database';

interface DatosPersonales {
  nombre_completo: string;
  telefono?: string;
  estado?: string;
}

/**
 * Crea un expediente completo:
 * 1. Crea usuario auth (pasa nombre_completo en user_metadata para que el trigger funcione)
 * 2. Actualiza perfil con telefono/estado (el trigger ya insertó el perfil)
 * 3. Crea expediente + contrato
 */
export async function crearExpedienteCompleto(
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult<{ expediente_id: string; user_id: string }>> {
  try {
    const supabase = createAdminClient();

    // Validaciones
    if (!datosPersonales.nombre_completo?.trim()) {
      return { success: false, error: 'El nombre completo es requerido.' };
    }
    if (!form.nombre_empresa?.trim()) {
      return { success: false, error: 'El nombre de la empresa es requerido.' };
    }
    if (!form.figura_id) {
      return { success: false, error: 'Debes seleccionar un tipo de figura legal.' };
    }
    if (!form.plan_pagos) {
      return { success: false, error: 'Debes seleccionar un plan de pagos.' };
    }

    // 1. Crear usuario en auth.users
    //    Pasamos nombre_completo, telefono, estado, rol en user_metadata
    //    para que el trigger on_auth_user_created pueda poblar perfiles
    const nombre = datosPersonales.nombre_completo.trim();
    const fakeEmail = `${nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}_${Date.now()}@cecani.temp`;

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        user_metadata: {
          nombre_completo: nombre,
          telefono: datosPersonales.telefono?.trim() || '',
          estado: datosPersonales.estado?.trim() || '',
          rol: 'cliente',
        },
      });

    if (authError || !authData.user) {
      return {
        success: false,
        error: `Error al registrar: ${authError?.message || 'No se pudo crear el usuario'}`,
      };
    }

    const userId = authData.user.id;

    // 2. Verificar/actualizar perfil
    //    El trigger ya debió crear el perfil, pero actualizamos con datos adicionales
    const { data: perfilExiste } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (perfilExiste) {
      // Perfil creado por trigger — actualizar campos opcionales
      await supabase
        .from('perfiles')
        .update({
          telefono: datosPersonales.telefono?.trim() || null,
          estado: datosPersonales.estado?.trim() || null,
        })
        .eq('id', userId);
    } else {
      // Trigger no creó perfil — crearlo manualmente
      const { error: perfilError } = await supabase.from('perfiles').insert({
        id: userId,
        rol: 'cliente',
        nombre_completo: nombre,
        telefono: datosPersonales.telefono?.trim() || null,
        estado: datosPersonales.estado?.trim() || null,
      });

      if (perfilError) {
        await supabase.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: `Error al crear perfil: ${perfilError.message}`,
        };
      }
    }

    // 3. Crear expediente
    const { data: expediente, error: expError } = await supabase
      .from('expedientes')
      .insert({
        cliente_id: userId,
        figura_id: form.figura_id,
        nombre_empresa: form.nombre_empresa.trim(),
        estatus: 'en_registro',
      })
      .select('id')
      .single();

    if (expError || !expediente) {
      await supabase.from('perfiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Error al crear expediente: ${expError?.message}`,
      };
    }

    // 4. Crear contrato vinculado
    const { error: contratoError } = await supabase.from('contratos').insert({
      expediente_id: expediente.id,
      plan_pagos: form.plan_pagos,
      monto_total: 0,
    });

    if (contratoError) {
      await supabase.from('expedientes').delete().eq('id', expediente.id);
      await supabase.from('perfiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Error al crear contrato: ${contratoError.message}`,
      };
    }

    return {
      success: true,
      data: { expediente_id: expediente.id, user_id: userId },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

/**
 * Actualiza el estatus de un expediente.
 */
export async function actualizarEstatusExpediente(
  expedienteId: string,
  nuevoEstatus: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('expedientes')
      .update({ estatus: nuevoEstatus, updated_at: new Date().toISOString() })
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
 * Obtiene los datos completos del dashboard evadiendo RLS 
 * (necesario ya que el usuario no tiene login activo por contraseña).
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

