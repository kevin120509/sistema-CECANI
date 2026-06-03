import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
    region: "us-east-1",
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

/**
 * Borra un archivo de Cloudflare R2 utilizando su URL pública.
 */
export async function borrarArchivoR2(urlArchivo: string): Promise<boolean> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName || !publicUrl) {
    throw new Error("R2_BUCKET_NAME o R2_PUBLIC_URL no están configurados.");
  }

  try {
    // Extraer el Key (ruta del archivo) de la URL pública
    const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    let key = urlArchivo.replace(baseUrl, "");
    if (key.startsWith('/')) {
      key = key.substring(1);
    }
    
    // Si la URL usa .r2.dev u otro formato en producción, decodificamos el key
    key = decodeURIComponent(key);

    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error("Error en borrarArchivoR2:", error);
    // No lanzamos error para que no bloquee el flujo si el archivo ya no existía
    return false;
  }
}

/**
 * Genera una URL firmada (temporal) válida por 24 horas para acceder a un archivo privado en R2.
 */
export async function generarUrlFirmadaR2(urlArchivo: string): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucketName || !publicUrl) {
    throw new Error("R2_BUCKET_NAME o R2_PUBLIC_URL no están configurados.");
  }

  // Extraer el Key
  const baseUrl = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
  let key = urlArchivo.replace(baseUrl, "");
  if (key.startsWith('/')) {
    key = key.substring(1);
  }
  key = decodeURIComponent(key);

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // Expira en 24 horas (86400 segundos)
  return await getSignedUrl(client, command, { expiresIn: 86400 });
}
