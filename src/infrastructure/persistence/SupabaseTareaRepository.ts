import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ITareaRepository } from '@/core/domain/repositories/ITareaRepository';

export class SupabaseTareaRepository implements ITareaRepository {
  async verificarPermisoExpediente(expedienteId: string, asesoraId: string): Promise<boolean> {
    const supabase = await createClient();

    // 1. Verificar si es admin o directora
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', asesoraId)
      .single();
      
    if (perfil?.rol === 'admin' || perfil?.rol === 'directora') {
      return true;
    }

    // 2. Verificar campo asesora_id legacy
    const { data: exp } = await supabase
      .from('expedientes')
      .select('id')
      .eq('id', expedienteId)
      .eq('asesora_id', asesoraId)
      .maybeSingle();
      
    if (exp) return true;

    // 3. Verificar tabla de relación
    const { data: rel } = await supabase
      .from('expediente_asesoras')
      .select('id')
      .eq('expediente_id', expedienteId)
      .eq('asesora_id', asesoraId)
      .maybeSingle();

    return !!rel;
  }

  async marcarHito(expedienteId: string, hitoId: number, completado: boolean): Promise<void> {
    const adminClient = createAdminClient();
    
    const { error } = await adminClient
      .from('seguimiento_tareas')
      .upsert(
        {
          expediente_id: expedienteId,
          hito_id: hitoId,
          estatus: completado ? 'completado' : 'pendiente',
          fecha_completado: completado ? new Date().toISOString() : null,
        },
        { onConflict: 'expediente_id, hito_id' }
      );

    if (error) throw error;
  }

  async agregarNotaBitacora(
    expedienteId: string,
    autorId: string,
    nota: string,
    fechaProximo: string,
    hora: string | null
  ): Promise<void> {
    const adminClient = createAdminClient();
    
    const { error } = await adminClient
      .from('bitacora')
      .insert({
        expediente_id: expedienteId,
        autor_id: autorId,
        nota,
        fecha_proximo_seguimiento: fechaProximo,
        hora: hora || null,
      });

    if (error) throw error;
  }
}
