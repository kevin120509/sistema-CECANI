import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ITareaRepository } from '@/core/domain/repositories/ITareaRepository';

export class SupabaseTareaRepository implements ITareaRepository {
  async verificarPermisoExpediente(expedienteId: string, asesoraId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data: exp } = await supabase
      .from('expedientes')
      .select('id')
      .eq('id', expedienteId)
      .eq('asesora_id', asesoraId)
      .single();
    
    return !!exp;
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
