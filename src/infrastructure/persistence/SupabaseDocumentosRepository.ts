import { createAdminClient } from '@/lib/supabase/admin';
import { IDocumentoRepository, IPagoRepository } from '@/core/domain/repositories/IDocumentoRepository';
import { TipoDocumento } from '@/types/database';

export class SupabaseDocumentoRepository implements IDocumentoRepository {
  async registrarDocumento(
    expedienteId: string,
    tipo: TipoDocumento,
    urlArchivo: string
  ): Promise<string> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        expediente_id: expedienteId,
        tipo,
        url_archivo: urlArchivo,
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
