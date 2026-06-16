'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function solicitarRecuperacionPassword(formData: FormData, returnToPath: string) {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Por favor, ingresa tu correo electrónico.' };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://sistema-cecani.vercel.app';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback?next=/actualizar-password?tipo=${returnToPath.replace('/', '')}`,
  });

  if (error) {
    console.error('Error al solicitar recuperación de contraseña:', error);
    return { error: 'No se pudo enviar el correo de recuperación. Verifica que el correo sea correcto.' };
  }

  return { success: true };
}

export async function actualizarPassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Las contraseñas no coinciden.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    console.error('Error al actualizar contraseña:', error);
    return { error: 'Ocurrió un error al actualizar la contraseña. Es posible que el enlace haya expirado.' };
  }

  // Desloguear por seguridad, forzando un re-login con la nueva contraseña
  await supabase.auth.signOut();

  return { success: true };
}
