import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ExpedienteManager from '@/components/abogada/ExpedienteManager';
import AbogadaAuth from '@/components/abogada/AbogadaAuth';
import SolicitarAltaPanel from '@/components/abogada/SolicitarAltaPanel';
import type { CatalogoHito, ExpedienteAvanzado, SeguimientoTarea, NotaBitacora, Recordatorio } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Panel de Abogada | CECANI',
};

// Extensión del tipo ExpedienteAvanzado para incluir seguimientos, bitácora y recordatorios
export interface ExpedienteAbogada extends ExpedienteAvanzado {
  seguimiento_tareas: SeguimientoTarea[];
  bitacora: NotaBitacora[];
  recordatorios: Recordatorio[];
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

  if (!perfilData || !['asesora', 'abogada', 'admin', 'directora'].includes(perfilData.rol)) {
    return <AbogadaAuth />;
  }

  const esAdmin = ['admin', 'directora'].includes(perfilData.rol);

  // Fetch 1: Catálogo de Hitos
  const supabaseAdmin = createAdminClient();
  const { data: hitosData } = await supabaseAdmin
    .from('catalogo_hitos')
    .select('*')
    .order('orden', { ascending: true });

  const hitos = (hitosData || []) as CatalogoHito[];

  // Fetch 2: Expedientes (Filtro de Privacidad y Flujo)
  let query = supabaseAdmin
    .from('expedientes')
    .select(`
      *,
      cliente:perfiles!cliente_id(nombre_completo, telefono, estado, rfc, curp, estado_civil, ocupacion, domicilio_completo),
      asesora:perfiles!asesora_id(nombre_completo),
      figura:catalogo_figuras(*),
      contratos(*),
      documentos(*),
      seguimiento_tareas(*),
      pagos(*),
      integrantes:expediente_integrantes(*),
      recordatorios(*),
      bitacora(
        *,
        autor:perfiles!autor_id(nombre_completo)
      )
    `);

  // --- REGLA DE NEGOCIO CRÍTICA ---
  // Un expediente SOLO debe aparecer en el panel legal si:
  // 1. Tiene una abogada asignada (asesora_id no es nulo).
  // 2. Ya superó la validación de la directora (estatus NO es en_registro ni revision_directora).
  
  if (!esAdmin) {
    // Si es abogada estándar: Solo ve sus propios expedientes asignados y validados
    query = query
      .not('asesora_id', 'is', null)
      .eq('asesora_id', user.id)
      .not('estatus', 'in', '("en_registro","revision_directora")');
  } else {
    // Si es admin/directora en el panel legal: Ve todos los asignados para supervisión, 
    // pero OCULTAMOS los no asignados para evitar ruido y errores de flujo.
    query = query
      .not('asesora_id', 'is', null)
      .not('estatus', 'in', '("en_registro","revision_directora")');
  }

  const { data: expedientesData, error: expedientesError } = await query.order('created_at', { ascending: false });
  if (expedientesError) {
    console.error("SUPABASE QUERY ERROR IN ABOGADA/PAGE:", expedientesError);
  }

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

  // Fetch solicitudes de alta de este usuario
  const { data: solicitudesData } = await supabaseAdmin
    .from('solicitudes_alta')
    .select('id, nombre_cliente, nombre_empresa, estatus, notas_rechazo, created_at')
    .eq('asesora_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

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
        solicitarAltaPanel={
          <SolicitarAltaPanel key="solicitar-alta" solicitudesIniciales={(solicitudesData || []) as any} />
        }
      />
    </main>
  );
}
