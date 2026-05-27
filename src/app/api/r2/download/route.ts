import { NextResponse } from 'next/server';
import { generarUrlFirmadaR2 } from '@/lib/r2';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const urlArchivo = searchParams.get('url');

    if (!urlArchivo) {
      return NextResponse.json({ error: 'URL del archivo es requerida' }, { status: 400 });
    }

    // Generar la URL firmada (dura 24 horas)
    const signedUrl = await generarUrlFirmadaR2(urlArchivo);

    // Redirigir al usuario directamente al archivo en R2 con el token temporal
    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error('Error al generar link firmado:', error);
    return NextResponse.json({ error: 'Error al procesar la descarga' }, { status: 500 });
  }
}
