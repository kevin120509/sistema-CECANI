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

  // 2. Obtener Expedientes Pendientes de Asignar (Cliente ya firmó o está por firmar)
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
        porAsignar={asignarData || []}
        concentrado={concentradoData || []} 
      />
    </main>
  );
}
