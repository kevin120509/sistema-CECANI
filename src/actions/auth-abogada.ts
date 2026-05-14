'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function loginAbogada(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Por favor, llena todos los campos.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: 'Credenciales inválidas o error de red.' };
  }

  // Verificar si es asesora
  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', data.user.id)
    .single();

  if (!perfilData || perfilData.rol !== 'asesora') {
    await supabase.auth.signOut();
    return { error: 'Esta cuenta no tiene permisos de Abogada/Asesora.' };
  }

  revalidatePath('/abogada');
  return { success: true };
}

export async function registerAbogada(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const nombre = formData.get('nombre') as string;

  if (!email || !password || !nombre) {
    return { error: 'Todos los campos son requeridos.' };
  }

  const supabaseAdmin = createAdminClient();

  // Usar admin auth para crear usuario y evitar que automáticamente se loguee en el cliente si falla el perfil
  // o crear con admin auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return { error: authError?.message || 'Error al crear el usuario en Auth.' };
  }

  const userId = authData.user.id;

  // Insertar en perfiles como 'asesora'
  const { error: profileError } = await supabaseAdmin
    .from('perfiles')
    .insert({
      id: userId,
      nombre_completo: nombre,
      rol: 'asesora',
    });

  if (profileError) {
    // Intentar limpiar el auth user si falla el perfil
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { error: 'Error al crear el perfil de asesora.' };
  }

  // Iniciar sesión automáticamente después de registrar
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: 'Usuario creado pero no se pudo iniciar sesión. Por favor, inicia sesión manualmente.' };
  }

  revalidatePath('/abogada');
  return { success: true };
}

export async function logoutAbogada() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/abogada');
}
