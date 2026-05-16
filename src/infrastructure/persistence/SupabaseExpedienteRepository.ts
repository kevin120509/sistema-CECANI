import { createAdminClient } from '@/lib/supabase/admin';
import { IExpedienteRepository } from '@/core/domain/repositories/IExpedienteRepository';
import { Expediente, CrearExpedienteForm } from '@/types/database';

export class SupabaseExpedienteRepository implements IExpedienteRepository {
  async crearExpedienteConContrato(
    perfilId: string,
    form: CrearExpedienteForm
  ): Promise<{ expedienteId: string; contratoId: string }> {
    const supabase = createAdminClient();

    // 1. Crear el expediente
    const { data: expData, error: expError } = await supabase
      .from('expedientes')
      .insert({
        cliente_id: perfilId,
        nombre_empresa: form.nombre_empresa.trim(),
        figura_id: form.figura_id,
        estatus: 'en_registro',
        tipo_tramite: form.tipo_tramite || 'CONSTITUCION',
        servicios_extra: form.servicios_extra || [],
      })
      .select()
      .single();

    if (expError || !expData) {
      throw new Error(`Error al crear expediente: ${expError?.message}`);
    }

    // 2. Crear el contrato asociado
    const { data: conData, error: conError } = await supabase
      .from('contratos')
      .insert({
        expediente_id: expData.id,
        plan_pagos: form.plan_pagos,
        monto_total: form.monto_total || 0,
        servicio_base: form.servicio_base || '',
        modulos_extra: form.modulos_extra || [],
        estatus: 'generado',
      })
      .select()
      .single();

    if (conError || !conData) {
      // Nota: En una arquitectura ideal usaríamos una transacción real de SQL
      throw new Error(`Error al crear contrato: ${conError?.message}`);
    }

    return {
      expedienteId: expData.id,
      contratoId: conData.id,
    };
  }

  async obtenerPorId(id: string): Promise<Expediente | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('expedientes')
      .select('*, figura:catalogo_figuras(*), contratos(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async obtenerPorClienteId(clienteId: string): Promise<Expediente | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('expedientes')
      .select('*, figura:catalogo_figuras(*), contratos(*)')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (error) return null;
    return data;
  }
}
