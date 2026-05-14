"use server";

import { revalidatePath } from "next/cache";
import { subirArchivoR2 } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { TipoDocumento, ActionResult } from "@/types/database";

/**
 * Server Action genérico para subir un archivo a R2.
 */
export async function subirArchivoR2Action(
  formData: FormData,
  carpeta: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return { success: false, error: "No se proporcionó un archivo válido." };
    }

    const url = await subirArchivoR2(file, carpeta);
    return { success: true, data: { url } };
  } catch (error) {
    console.error("Error en subirArchivoR2Action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al subir a R2",
    };
  }
}

/**
 * Server Action Híbrido:
 * 1. Sube el archivo a Cloudflare R2 (Bodega).
 * 2. Guarda la URL y metadatos en Supabase (Archivero).
 */
export async function guardarDocumentoExpediente(formData: FormData) {
  try {
    // 1. Extraer datos del formulario
    const archivo = formData.get("ine_cliente") as File;
    const expedienteId = formData.get("id_expediente") as string;
    
    if (!archivo || archivo.size === 0) {
      throw new Error("No se adjuntó ningún archivo o el archivo está vacío");
    }

    if (!expedienteId) {
      throw new Error("ID de expediente no proporcionado");
    }

    // 2. Subir a Cloudflare R2 (Bodega)
    // Usamos la carpeta 'expedientes' para organizar los archivos
    const urlArchivoR2 = await subirArchivoR2(archivo, "expedientes");

    // 3. Guardar en Supabase (Archivero)
    const supabase = createAdminClient();

    // Determinamos el tipo basado en el nombre del archivo o lógica de negocio
    // Por ahora lo marcamos como 'otro' o podrías recibirlo del formData
    const tipoDocumento: TipoDocumento = "otro";

    const { error: dbError } = await supabase
      .from("documentos")
      .insert({
        expediente_id: expedienteId,
        tipo: tipoDocumento,
        url_archivo: urlArchivoR2,
        validado: false // Por defecto requiere validación de la directora
      });

    if (dbError) {
      console.error("Error al guardar en Supabase:", dbError);
      throw new Error(`Error en base de datos: ${dbError.message}`);
    }

    // 4. Revalidar la ruta para actualizar la UI
    revalidatePath("/documentacion"); // Ajusta según tu estructura de rutas
    revalidatePath(`/abogada`); 

    return { success: true, url: urlArchivoR2 };
    
  } catch (error: any) {
    console.error("Error en guardarDocumentoExpediente:", error);
    return { success: false, error: error.message || "Error desconocido al procesar el documento" };
  }
}
