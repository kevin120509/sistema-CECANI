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
  const supabaseAdmin = createAdminClient();
  const { data: perfilData, error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', data.user.id)
    .single();
    
  if (perfilError) console.error("Error fetching perfil:", perfilError);

  if (!perfilData || !['asesora', 'abogada', 'admin', 'directora'].includes(perfilData.rol)) {
    await supabase.auth.signOut();
    return { error: 'Esta cuenta no tiene permisos para acceder al panel.' };
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

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre_completo: nombre,
        rol: 'asesora',
      }
    }
  });

  if (authError) {
    return { error: authError.message || 'Error al crear el usuario.' };
  }

  // Ya no iniciamos sesión automáticamente ni revalidamos para redirigir
  // porque el usuario debe confirmar su correo electrónico primero.

  return { success: true };
}

export async function logoutAbogada() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/abogada');
}
