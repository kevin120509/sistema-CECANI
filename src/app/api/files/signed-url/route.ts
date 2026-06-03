import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generarUrlFirmadaR2 } from '@/lib/r2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const clienteId = searchParams.get('cliente_id');

    if (!fileUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Crear el cliente de Supabase
    const supabase = await createClient();
    
    // 2. Verificar si hay un usuario Staff logueado (cookies)
    const { data: { user } } = await supabase.auth.getUser();

    let autorizado = false;

    if (user) {
      // Si hay sesión de Supabase Auth (Staff), se autoriza
      autorizado = true;
    } else if (clienteId) {
      // Si es un cliente y pasa su cliente_id (de localStorage), validamos que sea dueño
      // de la carpeta del expediente en la URL de R2
      try {
        const urlObj = new URL(fileUrl);
        const parts = urlObj.pathname.split('/');
        
        // Formato esperado de ruta: /expedientes/nombre_empresa/...
        const index = parts.indexOf('expedientes');
        if (index !== -1 && parts[index + 1]) {
          const carpetaEmpresaUrl = decodeURIComponent(parts[index + 1]).toLowerCase();
          
          // Consultar expedientes asignados a este cliente
          const { data: expData, error: expError } = await supabase
            .from('expedientes')
            .select('nombre_empresa')
            .eq('cliente_id', clienteId);

          if (!expError && expData) {
            // Verificar si alguna carpeta de sus expedientes coincide con el de la URL
            autorizado = expData.some(exp => {
              const expCarpeta = exp.nombre_empresa
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '')
                .toLowerCase();
              return expCarpeta === carpetaEmpresaUrl;
            });
          }
        }
      } catch (err) {
        console.error('Error al parsear URL para validación de cliente:', err);
      }
    }

    if (!autorizado) {
      return NextResponse.json({ error: 'Unauthorized: Access Denied' }, { status: 403 });
    }

    // 3. Generar la pre-signed URL temporal (expira en 15 minutos)
    const signedUrl = await generarUrlFirmadaR2(fileUrl);

    // 4. Redirigir temporalmente (307 Redirect) al navegador
    return NextResponse.redirect(signedUrl, 307);
  } catch (error: any) {
    console.error('Error en signed-url route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
