import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DirectorDashboard from '@/components/directora/DirectorDashboard';
import DirectoraLogin from '@/components/directora/DirectoraLogin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Panel de Dirección | CECANI',
};

export default async function DirectoraPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return <DirectoraLogin />;
  }

  // Verificar que el usuario tenga rol de Directora usando Admin (Bypassea RLS)
  const { data: perfilData } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!perfilData || perfilData.rol !== 'directora') {
    return <DirectoraLogin />;
  }

  // 1. Obtener Abogadas (Para el <select> de Asignación)
  const { data: abogadasData } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre_completo')
    .or('rol.eq.asesora,rol.eq.abogada,rol.eq.admin');

  // 2. Expedientes Pendientes de Asignar (solo columnas necesarias para la tabla)
  const { data: asignarData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      id,
      cliente_id,
      nombre_empresa,
      estatus,
      created_at,
      servicios_extra,
      perfiles!cliente_id(nombre_completo),
      figura:catalogo_figuras(descripcion),
      contratos(id, monto_total, url_pdf_generado, url_pdf_firmado_cliente, url_pdf_doble_firma, plan_pagos, servicio_base, modulos_extra),
      documentos(tipo, url_archivo),
      pagos(monto, url_comprobante, fecha_pago)
    `)
    .is('asesora_id', null)
    .order('created_at', { ascending: false });

  // 3. Concentrado Global (OPTIMIZADO: solo columnas de tabla, sin relaciones pesadas)
  const { data: concentradoData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      id,
      cliente_id,
      nombre_empresa,
      estatus,
      created_at,
      servicios_extra,
      perfiles!cliente_id(nombre_completo),
      asesora:perfiles!asesora_id(id, nombre_completo),
      figura:catalogo_figuras(descripcion)
    `)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-8">
      <DirectorDashboard 
        abogadas={abogadasData || []} 
        porAsignar={(asignarData || []) as any}
        concentrado={(concentradoData || []) as any} 
      />
    </main>
  );
}
