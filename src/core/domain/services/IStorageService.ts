export interface IStorageService {
  /**
   * Sube un archivo y retorna la URL pública
   */
  subirArchivo(file: File, ruta: string): Promise<string>;

  /**
   * Sube un buffer de datos y retorna la URL pública
   */
  subirBuffer(
    buffer: Uint8Array,
    contentType: string,
    ruta: string
  ): Promise<string>;
}
