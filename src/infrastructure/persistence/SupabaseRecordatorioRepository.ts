import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { IRecordatorioRepository } from '@/core/domain/repositories/IRecordatorioRepository';
import type { Recordatorio, CrearRecordatorioForm, EstatusRecordatorio, RecordatorioConRelaciones } from '@/types/database';

export class SupabaseRecordatorioRepository implements IRecordatorioRepository {
  async verificarPermisoExpediente(expedienteId: string, userId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data: exp } = await supabase
      .from('expedientes')
      .select('id, asesora_id')
      .eq('id', expedienteId)
      .single();
    if (!exp) return false;

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (perfil && ['directora', 'admin'].includes(perfil.rol)) return true;

    const { data: rel } = await supabase
      .from('expediente_asesoras')
      .select('id')
      .eq('expediente_id', expedienteId)
      .eq('asesora_id', userId)
      .maybeSingle();

    return exp.asesora_id === userId || !!rel;
  }

  async crear(form: CrearRecordatorioForm, creadoPor: string): Promise<Recordatorio> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recordatorios')
      .insert({
        expediente_id: form.expediente_id,
        creado_por: creadoPor,
        tipo: form.tipo,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        fecha: form.fecha,
        hora: form.hora || null,
        link_reunion: form.link_reunion || null,
        docs_requeridos: form.docs_requeridos,
        notificar_abogada: form.notificar_abogada,
        notificar_cliente_whatsapp: form.notificar_cliente_whatsapp,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Recordatorio;
  }

  async obtenerPorExpediente(expedienteId: string): Promise<Recordatorio[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recordatorios')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (error) throw error;
    return (data || []) as Recordatorio[];
  }

  async obtenerPorFecha(fecha: string): Promise<RecordatorioConRelaciones[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recordatorios')
      .select(`
        *,
        expediente:expediente_id (
          nombre_empresa,
          asesora_id,
          cliente:perfiles!cliente_id (nombre_completo, telefono)
        ),
        creador:creado_por (nombre_completo)
      `)
      .eq('fecha', fecha)
      .neq('estatus', 'cancelado')
      .order('hora', { ascending: true });

    if (error) throw error;
    return (data || []) as RecordatorioConRelaciones[];
  }

  async actualizarEstatus(id: string, estatus: EstatusRecordatorio): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin
      .from('recordatorios')
      .update({ estatus })
      .eq('id', id);
    if (error) throw error;
  }

  async marcarPushEnviado(id: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin
      .from('recordatorios')
      .update({ push_enviado: true })
      .eq('id', id);
    if (error) throw error;
  }

  async marcarWhatsappEnviado(id: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin
      .from('recordatorios')
      .update({ whatsapp_enviado: true })
      .eq('id', id);
    if (error) throw error;
  }
}
