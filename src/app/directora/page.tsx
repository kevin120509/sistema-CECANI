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
  // Buscamos asesora, abogada o incluso admin para asegurar que la lista tenga opciones si se crearon con roles distintos
  const { data: abogadasData } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre_completo')
    .or('rol.eq.asesora,rol.eq.abogada,rol.eq.admin');

  // 2. Obtener Expedientes Pendientes de Asignar (Sin importar estatus, solo que no tengan asesora)
  const { data: asignarData, error: asignarError } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      cliente:perfiles!cliente_id(*),
      figura:catalogo_figuras(descripcion),
      contratos(*),
      documentos(*),
      pagos(*),
      datos_concentrado(*)
    `)
    .is('asesora_id', null)
    .order('created_at', { ascending: false });

  if (asignarError) console.error('Error fetching asignarData:', asignarError);

  // 4. Obtener Concentrado Operativo (SOLO los que ya tienen asesora asignada)
  const { data: concentradoData, error: concentradoError } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      cliente:perfiles!cliente_id(*),
      asesora:perfiles!asesora_id(id, nombre_completo),
      figura:catalogo_figuras(descripcion),
      documentos(*),
      contratos(*),
      pagos(*),
      datos_concentrado(*)
    `)
    .not('asesora_id', 'is', null)
    .order('created_at', { ascending: false });

  if (concentradoError) console.error('Error fetching concentradoData:', concentradoError);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-300">
      <DirectorDashboard 
        abogadas={abogadasData || []} 
        porAsignar={asignarData || []}
        concentrado={concentradoData || []} 
      />
    </main>
  );
}
