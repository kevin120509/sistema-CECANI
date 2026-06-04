const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixSchema() {
  console.log('--- Corrigiendo Esquema: Agregando motivo_rechazo ---');
  
  // En Supabase, para agregar una columna mediante JS sin usar SQL Editor, 
  // usualmente necesitamos ejecutar un RPC o tener habilitado el acceso a la extensión de SQL.
  // Como no podemos ejecutar SQL arbitrario directamente desde el cliente de JS de forma estándar
  // sin un endpoint de RPC, intentaremos verificar primero si la columna existe.

  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS motivo_rechazo text;'
  });

  if (error) {
    console.log('Nota: El RPC "execute_sql" falló o no existe. Intentando inserción de prueba para verificar columnas.');
    
    // Si no hay RPC, intentamos una consulta introspectiva si es posible o simplemente reportamos.
    // Una alternativa es intentar actualizar un registro inexistente con esa columna para ver el error exacto.
    const { error: updateError } = await supabase
      .from('expedientes')
      .update({ motivo_rechazo: null })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    if (updateError && updateError.message.includes('column "motivo_rechazo" does not exist')) {
      console.error('CONFIRMADO: La columna motivo_rechazo NO existe.');
      console.log('RECOMENDACIÓN: Ejecuta "ALTER TABLE expedientes ADD COLUMN motivo_rechazo text;" en el SQL Editor de Supabase.');
    } else if (updateError) {
       console.log('Respuesta de validación:', updateError.message);
    } else {
       console.log('La columna parece existir ahora o la actualización fue aceptada.');
    }
  } else {
    console.log('✅ Columna agregada exitosamente mediante RPC.');
  }
}

fixSchema();
