import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Obtiene el cliente de S3 configurado para R2.
 * Se usa una función para asegurar que las variables de entorno estén cargadas.
 */
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan credenciales de Cloudflare R2 en las variables de entorno.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Función reutilizable para subir archivos
export async function subirArchivoR2(file: File, carpeta: string): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName || !publicUrl) {
    throw new Error("R2_BUCKET_NAME o R2_PUBLIC_URL no están configurados.");
  }

  const client = getR2Client();
  
  // Genera un nombre único con la fecha para que no se sobreescriban archivos con el mismo nombre
  const nombreUnico = `${carpeta}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: nombreUnico,
    Body: buffer,
    ContentType: file.type,
  });

  try {
    await client.send(command);
    
    // Asegurarse de que no haya doble diagonal al concatenar
    const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return `${baseUrl}/${nombreUnico}`;
  } catch (error) {
    console.error("Error en subirArchivoR2:", error);
    throw error;
  }
}

/**
 * Sube un buffer (Uint8Array) a Cloudflare R2.
 * Útil para archivos generados en el servidor como PDFs de contratos.
 */
export async function subirBufferR2(
  buffer: Uint8Array,
  carpeta: string,
  nombreArchivo: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName || !publicUrl) {
    throw new Error("R2_BUCKET_NAME o R2_PUBLIC_URL no están configurados.");
  }

  const client = getR2Client();
  const nombreUnico = `${carpeta}/${Date.now()}-${nombreArchivo.replace(/\s+/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: nombreUnico,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await client.send(command);
    
    const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return `${baseUrl}/${nombreUnico}`;
  } catch (error) {
    console.error("Error en subirBufferR2:", error);
    throw error;
  }
}
