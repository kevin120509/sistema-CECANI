import { generarContratoPDF } from '@/lib/pdf-generator';
import { IPdfService, DatosContratoPDF } from '@/core/domain/services/IPdfService';

export class PdfGeneratorAdapter implements IPdfService {
  async generarContrato(datos: DatosContratoPDF): Promise<Uint8Array> {
    return await generarContratoPDF(datos);
  }
}
