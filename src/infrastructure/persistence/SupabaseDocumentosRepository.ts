import { createAdminClient } from '@/lib/supabase/admin';
import { IDocumentoRepository, IPagoRepository } from '@/core/domain/repositories/IDocumentoRepository';
import { TipoDocumento } from '@/types/database';

export class SupabaseDocumentoRepository implements IDocumentoRepository {
  async registrarDocumento(
    expedienteId: string,
    tipo: TipoDocumento,
    urlArchivo: string,
    integranteId?: string | null,
    nombrePersonalizado?: string,
    validado: boolean = false
  ): Promise<string> {
    const supabase = createAdminClient();

    // Eliminar versión previa del mismo tipo para este expediente (y opcionalmente este integrante)
    // Esto asegura que si el documento fue rechazado (url_archivo=''), se borre antes de insertar el nuevo
    let query = supabase.from('documentos').delete().eq('expediente_id', expedienteId).eq('tipo', tipo);
    if (integranteId) {
      query = query.eq('integrante_id', integranteId);
    } else {
      query = query.is('integrante_id', null);
    }
    // Si tiene nombre_personalizado, borramos solo los que coinciden
    if (nombrePersonalizado) {
      query = query.eq('nombre_personalizado', nombrePersonalizado);
    }

    await query;

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        expediente_id: expedienteId,
        tipo,
        url_archivo: urlArchivo,
        integrante_id: integranteId,
        nombre_personalizado: nombrePersonalizado,
        validado: validado
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Error al registrar documento: ${error?.message}`);
    }

    return data.id;
  }
}

export class SupabasePagoRepository implements IPagoRepository {
  async registrarPago(
    expedienteId: string,
    monto: number,
    urlComprobante: string,
    esPagoInicial: boolean
  ): Promise<string> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('pagos')
      .insert({
        expediente_id: expedienteId,
        monto,
        fecha_pago: new Date().toISOString().split('T')[0],
        url_comprobante: urlComprobante,
        es_pago_inicial: esPagoInicial,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Error al registrar pago: ${error?.message}`);
    }

    return data.id;
  }
}
