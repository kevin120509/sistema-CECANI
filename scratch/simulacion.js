require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSimulation() {
  console.log('--- Iniciando simulación de subida de documentos ---');
  
  // 1. Obtener el cliente más reciente (simulando que estamos logueados)
  const { data: clientes } = await supabase.from('perfiles').select('id').eq('rol', 'cliente').limit(1);
  if (!clientes || clientes.length === 0) {
    console.log('No hay clientes en la BD.');
    return;
  }
  const clienteId = clientes[0].id;
  
  // 2. Obtener su expediente
  const { data: expediente } = await supabase.from('expedientes').select('*').eq('cliente_id', clienteId).single();
  if (!expediente) {
    console.log('El cliente no tiene expediente.');
    return;
  }
  console.log('Expediente actual:', expediente.id, 'Estatus:', expediente.estatus);
  
  // 3. Simular registro de documento (bypassing R2)
  console.log('Simulando registro de INE en BD...');
  const { data: docResult, error: docError } = await supabase
    .from('documentos')
    .insert({
      expediente_id: expediente.id,
      tipo: 'ine_frente',
      url_archivo: 'https://ejemplo.com/ine_frente.png',
      validado: false
    })
    .select('id')
    .single();
    
  if (docError) {
    console.error('ERROR al registrar documento:', docError.message);
    return;
  }
  console.log('Documento insertado con éxito! ID:', docResult.id);
  
  // 4. Simular actualización de estatus
  console.log('Actualizando estatus a revision_directora...');
  const { data: estatusResult, error: estatusError } = await supabase
    .from('expedientes')
    .update({ estatus: 'revision_directora', updated_at: new Date().toISOString() })
    .eq('id', expediente.id)
    .select('estatus')
    .single();
    
  if (estatusError) {
    console.error('ERROR al actualizar estatus:', estatusError.message);
    return;
  }
  console.log('Estatus actualizado correctamente a:', estatusResult.estatus);
  
  console.log('--- Simulación completada con éxito ---');
  console.log('Si esto funcionó, significa que la base de datos está lista.');
  console.log('Con el fix de serialización de archivos que aplicamos, el navegador debería pasar sin problemas.');
}

runSimulation();
