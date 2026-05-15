'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/onesignal-server';
import type { ActionResult, CrearExpedienteForm } from '@/types/database';

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

/**
 * Crea un expediente completo:
 * 1. Crea usuario auth (pasa metadatos legales para el trigger)
 * 2. Actualiza perfil con toda la información legal
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
    if (!datosPersonales.rfc?.trim()) {
      return { success: false, error: 'El RFC es obligatorio para el contrato.' };
    }
    if (!datosPersonales.curp?.trim()) {
      return { success: false, error: 'La CURP es obligatoria para el contrato.' };
    }
    if (!datosPersonales.estado_civil?.trim()) {
      return { success: false, error: 'El estado civil es obligatorio para el contrato.' };
    }
    if (!datosPersonales.domicilio_completo?.trim()) {
      return { success: false, error: 'El domicilio completo es necesario para las declaraciones.' };
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
          estado_civil: datosPersonales.estado_civil?.trim() || '',
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

    // 2. Verificar/actualizar perfil con TODOS los campos legales
    const updateData = {
      telefono: datosPersonales.telefono?.trim() || null,
      estado: datosPersonales.estado?.trim() || null,
      rfc: datosPersonales.rfc?.trim().toUpperCase() || null,
      curp: datosPersonales.curp?.trim().toUpperCase() || null,
      ocupacion: datosPersonales.ocupacion?.trim() || null,
      estado_civil: datosPersonales.estado_civil?.trim() || null,
      domicilio_completo: datosPersonales.domicilio_completo?.trim() || null,
      folio_ine: datosPersonales.folio_ine?.trim() || null,
    };

    const { data: perfilExiste } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (perfilExiste) {
      await supabase.from('perfiles').update(updateData).eq('id', userId);
    } else {
      const { error: perfilError } = await supabase.from('perfiles').insert({
        id: userId,
        rol: 'cliente',
        nombre_completo: nombre,
        ...updateData
      });

      if (perfilError) {
        await supabase.auth.admin.deleteUser(userId);
        return { success: false, error: `Error al crear perfil: ${perfilError.message}` };
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
        tipo_tramite: form.tipo_tramite,
        servicios_extra: form.servicios_extra || [],
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
      monto_total: form.monto_total || 0,
      servicio_base: form.servicio_base,
      modulos_extra: form.modulos_extra,
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

/**
 * Actualiza un expediente completo:
 * 1. Actualiza perfil
 * 2. Actualiza auth.users metadata
 * 3. Actualiza expediente
 * 4. Actualiza contrato
 */
export async function actualizarExpedienteCompleto(
  userId: string,
  expedienteId: string,
  datosPersonales: DatosPersonales,
  form: CrearExpedienteForm
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    // Validaciones
    if (!datosPersonales.nombre_completo?.trim()) {
      return { success: false, error: 'El nombre completo es requerido.' };
    }
    if (!datosPersonales.rfc?.trim()) {
      return { success: false, error: 'El RFC es obligatorio para el contrato.' };
    }
    if (!datosPersonales.curp?.trim()) {
      return { success: false, error: 'La CURP es obligatoria para el contrato.' };
    }
    if (!datosPersonales.estado_civil?.trim()) {
      return { success: false, error: 'El estado civil es obligatorio para el contrato.' };
    }
    if (!datosPersonales.domicilio_completo?.trim()) {
      return { success: false, error: 'El domicilio completo es necesario para las declaraciones.' };
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

    // 1. Actualizar perfil
    const { error: perfilError } = await supabase
      .from('perfiles')
      .update({
        nombre_completo: datosPersonales.nombre_completo.trim(),
        telefono: datosPersonales.telefono?.trim() || null,
        estado: datosPersonales.estado?.trim() || null,
        rfc: datosPersonales.rfc?.trim().toUpperCase() || null,
        curp: datosPersonales.curp?.trim().toUpperCase() || null,
        ocupacion: datosPersonales.ocupacion?.trim() || null,
        estado_civil: datosPersonales.estado_civil?.trim() || null,
        domicilio_completo: datosPersonales.domicilio_completo?.trim() || null,
        folio_ine: datosPersonales.folio_ine?.trim() || null,
      })
      .eq('id', userId);

    if (perfilError) {
      return { success: false, error: `Error al actualizar perfil: ${perfilError.message}` };
    }

    // 2. Actualizar user_metadata en auth.users
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        nombre_completo: datosPersonales.nombre_completo.trim(),
        telefono: datosPersonales.telefono?.trim() || '',
        estado: datosPersonales.estado?.trim() || '',
      }
    });

    // 3. Actualizar expediente
    const { error: expError } = await supabase
      .from('expedientes')
      .update({
        figura_id: form.figura_id,
        nombre_empresa: form.nombre_empresa.trim(),
        tipo_tramite: form.tipo_tramite,
        servicios_extra: form.servicios_extra || [],
      })
      .eq('id', expedienteId);

    if (expError) {
      return { success: false, error: `Error al actualizar expediente: ${expError.message}` };
    }

    // 4. Actualizar contrato (plan_pagos)
    const { error: contratoError } = await supabase
      .from('contratos')
      .update({
        plan_pagos: form.plan_pagos,
        monto_total: form.monto_total || 0,
        servicio_base: form.servicio_base,
        modulos_extra: form.modulos_extra,
      })
      .eq('expediente_id', expedienteId);

    if (contratoError) {
      return { success: false, error: `Error al actualizar contrato: ${contratoError.message}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`,
    };
  }
}

