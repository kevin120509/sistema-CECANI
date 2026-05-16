import { createAdminClient } from '@/lib/supabase/admin';
import { IUserRepository } from '@/core/domain/repositories/IExpedienteRepository';
import { Perfil } from '@/types/database';

export class SupabaseUserRepository implements IUserRepository {
  async crearUsuarioCliente(datos: {
    nombre: string;
    email: string;
    metadata: any;
  }): Promise<string> {
    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: datos.email,
      email_confirm: true,
      user_metadata: {
        ...datos.metadata,
        nombre_completo: datos.nombre,
        rol: 'cliente',
      },
    });

    if (error || !data.user) {
      throw new Error(`Error al crear usuario en Supabase: ${error?.message}`);
    }

    return data.user.id;
  }

  async actualizarPerfilLegal(userId: string, datos: Partial<Perfil>): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('perfiles')
      .update(datos)
      .eq('id', userId);

    if (error) {
      throw new Error(`Error al actualizar perfil: ${error.message}`);
    }
  }
}
