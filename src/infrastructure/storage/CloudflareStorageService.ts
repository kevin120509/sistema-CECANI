import { subirArchivoR2 } from '@/lib/r2';
import { IStorageService } from '@/core/domain/services/IStorageService';

export class CloudflareStorageService implements IStorageService {
  async subirArchivo(file: File, ruta: string): Promise<string> {
    return await subirArchivoR2(file, ruta);
  }

  async subirBuffer(buffer: Uint8Array, contentType: string, ruta: string): Promise<string> {
    const file = new File([buffer as any], ruta.split('/').pop() || 'file', { type: contentType });
    return await subirArchivoR2(file, ruta.substring(0, ruta.lastIndexOf('/')) || '');
  }
}
