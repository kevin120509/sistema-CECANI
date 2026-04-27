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
    .eq('rol', 'abogada');

  // 2. Obtener Expedientes Pendientes de Validar (Contratos por subir)
  const { data: pendientesData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      perfiles!cliente_id(nombre_completo),
      figura:catalogo_figuras(descripcion),
      contratos(*),
      documentos(*),
      pagos(*)
    `)
    .eq('estatus', 'revision_directora')
    .order('created_at', { ascending: false });

  // 3. Obtener Expedientes Pendientes de Asignar (Cliente ya firmó o está por firmar)
  const { data: asignarData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      perfiles!cliente_id(nombre_completo),
      figura:catalogo_figuras(descripcion),
      contratos(*),
      documentos(*),
      pagos(*)
    `)
    .eq('estatus', 'en_proceso')
    .is('asesora_id', null)
    .order('created_at', { ascending: false });

  // 4. Obtener Concentrado Global (Todos los expedientes)
  const { data: concentradoData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      perfiles!cliente_id(nombre_completo),
      asesora:perfiles!asesora_id(nombre_completo),
      figura:catalogo_figuras(descripcion),
      contratos(*),
      pagos(*)
    `)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-8">
      <DirectorDashboard 
        abogadas={abogadasData || []} 
        pendientes={pendientesData || []}
        porAsignar={asignarData || []}
        concentrado={concentradoData || []} 
      />
    </main>
  );
}
