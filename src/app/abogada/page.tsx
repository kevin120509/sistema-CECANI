import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ExpedienteManager from '@/components/abogada/ExpedienteManager';
import AbogadaAuth from '@/components/abogada/AbogadaAuth';
import type { CatalogoHito, ExpedienteAvanzado, SeguimientoTarea, NotaBitacora } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Panel de Abogada | CECANI',
};

// Extensión del tipo ExpedienteAvanzado para incluir seguimientos y bitácora
export interface ExpedienteAbogada extends ExpedienteAvanzado {
  seguimiento_tareas: SeguimientoTarea[];
  bitacora: NotaBitacora[];
}

export default async function AbogadaPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return <AbogadaAuth />;
  }

  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!perfilData || perfilData.rol !== 'abogada') {
    return <AbogadaAuth />;
  }

  // Fetch 1: Catálogo de Hitos (usando admin client para bypasear RLS)
  const supabaseAdmin = createAdminClient();
  const { data: hitosData } = await supabaseAdmin
    .from('catalogo_hitos')
    .select('*')
    .order('orden', { ascending: true });

  const hitos = (hitosData || []) as CatalogoHito[];

  // Fetch 2: Expedientes asignados a la abogada (Usamos admin para asegurar ver perfiles)
  const { data: expedientesData } = await supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      cliente:perfiles!cliente_id(nombre_completo, telefono),
      asesora:perfiles!asesora_id(nombre_completo),
      figura:catalogo_figuras(descripcion),
      contratos(*),
      documentos(*),
      seguimiento_tareas(*),
      pagos(*),
      bitacora(
        *,
        autor:perfiles!autor_id(nombre_completo)
      )
    `)
    .eq('asesora_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch datos_concentrado separately with admin client (bypasses RLS)
  const expedienteIds = (expedientesData || []).map(e => e.id);
  const { data: datosConcentradoData } = expedienteIds.length > 0
    ? await supabaseAdmin.from('datos_concentrado').select('*').in('expediente_id', expedienteIds)
    : { data: [] };

  // Merge datos_concentrado into expedientes
  const expedientesConDatos = (expedientesData || []).map(exp => ({
    ...exp,
    datos_concentrado: (datosConcentradoData || []).filter(d => d.expediente_id === exp.id),
  }));

  const expedientes = expedientesConDatos as unknown as ExpedienteAbogada[];

  // Lógica: Tareas de Hoy (Recordatorios)
  // Filtrar los expedientes cuya fecha_proximo_seguimiento en alguna bitácora sea <= HOY
  const hoyStr = new Date().toISOString().split('T')[0];
  
  const expedientesConAlerta = expedientes.filter(exp => {
    if (!exp.bitacora || exp.bitacora.length === 0) return false;
    // Buscamos la fecha de próximo seguimiento más reciente (o iteramos todas)
    return exp.bitacora.some(nota => {
      // Comparar fechas como strings 'YYYY-MM-DD' es seguro
      return nota.fecha_proximo_seguimiento <= hoyStr;
    });
  });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Client Component que manejará el estado de tabs y formularios */}
      <ExpedienteManager 
        expedientes={expedientes}
        hitos={hitos}
        alertasHoy={expedientesConAlerta}
      />
    </main>
  );
}
