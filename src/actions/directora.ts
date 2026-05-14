'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendPushNotification } from '@/lib/onesignal-server';

export async function loginDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return { error: 'Correo y contraseña son obligatorios.' };
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { error: 'Credenciales inválidas: ' + authError.message };
    }

    if (!authData.user) {
      return { error: 'No se pudo recuperar la información del usuario.' };
    }

    // VERIFICACIÓN DE ROL CRÍTICA
    const adminSupabase = createAdminClient();
    const { data: perfil, error: perfilError } = await adminSupabase
      .from('perfiles')
      .select('rol')
      .eq('id', authData.user.id)
      .single();

    if (perfilError || !perfil) {
      await supabase.auth.signOut();
      return { error: 'Tu cuenta no tiene un perfil configurado en la base de datos.' };
    }

    if (perfil.rol !== 'directora') {
      await supabase.auth.signOut();
      return { error: 'Acceso denegado: Esta cuenta no tiene rol de directora.' };
    }

    revalidatePath('/directora');
    return { success: true };
  } catch (error: any) {
    console.error('Login Error:', error);
    return { error: 'Error inesperado al iniciar sesión.' };
  }
}

export async function registrarDirectora(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nombre = formData.get('nombre') as string;

    if (!email || !password || !nombre) {
      return { error: 'Todos los campos son obligatorios.' };
    }

    const supabase = await createClient();
    
    // 1. Registrar en Supabase Auth con metadatos
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre_completo: nombre,
          rol: 'directora'
        }
      }
    });

    if (authError) return { error: 'Error al registrar: ' + authError.message };
    if (!authData.user) return { error: 'No se pudo crear el usuario.' };

    // 2. Forzar el perfil en la tabla (por si el trigger tarda o falla)
    const adminSupabase = createAdminClient();
    const { error: perfilError } = await adminSupabase
      .from('perfiles')
      .upsert({
        id: authData.user.id,
        nombre_completo: nombre,
        rol: 'directora'
      });

    if (perfilError) console.error('Error perfil:', perfilError);

    return { success: true };
  } catch (error: any) {
    return { error: 'Error inesperado: ' + error.message };
  }
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

    // Subir a Storage
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const timeHash = Date.now().toString().slice(-6);
    const newFileName = `ContratoOficial_${expedienteId}_${timeHash}_${cleanFileName}`;
    
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('contratos_oficiales')
      .upload(newFileName, file, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      return { error: `Error al almacenar el PDF oficial: ${uploadError.message}` };
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('contratos_oficiales')
      .getPublicUrl(uploadData.path);
    
    const urlPdfOficial = publicUrlData.publicUrl;

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

    // 1. Subir PDF a Storage
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const timeHash = Date.now().toString().slice(-6);
    const newFileName = `DobleFirma_${expedienteId}_${timeHash}_${cleanFileName}`;
    
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('contratos_oficiales')
      .upload(newFileName, file, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) throw new Error(`Error upload: ${uploadError.message}`);

    const { data: publicUrlData } = adminSupabase.storage
      .from('contratos_oficiales')
      .getPublicUrl(uploadData.path);
    
    const urlDobleFirma = publicUrlData.publicUrl;

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
