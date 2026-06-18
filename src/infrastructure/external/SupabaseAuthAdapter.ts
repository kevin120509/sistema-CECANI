import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { IAuthService } from '@/core/domain/services/IAuthService';

export class SupabaseAuthAdapter implements IAuthService {
  async loginDirectora(email: string, password: string): Promise<void> {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw new Error('Credenciales inválidas: ' + authError.message);
    if (!authData.user) throw new Error('No se pudo recuperar la información del usuario.');

    const adminSupabase = createAdminClient();
    const { data: perfil, error: perfilError } = await adminSupabase
      .from('perfiles')
      .select('rol')
      .eq('id', authData.user.id)
      .single();

    if (perfilError || !perfil) {
      await supabase.auth.signOut();
      throw new Error('Tu cuenta no tiene un perfil configurado en la base de datos.');
    }

    if (perfil.rol !== 'directora') {
      await supabase.auth.signOut();
      throw new Error('Acceso denegado: Esta cuenta no tiene rol de directora.');
    }
  }

  async registrarDirectora(email: string, password: string, nombre: string): Promise<void> {
    const adminSupabase = createAdminClient();
    
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombre,
        rol: 'directora'
      }
    });

    if (authError) throw new Error('Error al registrar: ' + authError.message);
    if (!authData.user) throw new Error('No se pudo crear el usuario.');

    // Autologin after registration
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });

    const { error: perfilError } = await adminSupabase
      .from('perfiles')
      .upsert({
        id: authData.user.id,
        nombre_completo: nombre,
        rol: 'directora'
      });

    if (perfilError) console.error('Error perfil:', perfilError);
  }
}
