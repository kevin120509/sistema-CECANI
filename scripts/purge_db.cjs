require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    console.log("=== INICIANDO PURGA DE BASE DE DATOS ===");

    // 1. ELIMINAR TODOS LOS EXPEDIENTES (Esto limpia clientes, contratos, pagos, docs por cascada)
    console.log("\n--- Eliminando todos los expedientes y datos de clientes ---");
    const { error: expErr } = await supabase.from('expedientes').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (expErr) console.error("Error eliminando expedientes:", expErr.message);
    else console.log("✅ Todos los expedientes y clientes eliminados.");

    // 2. ELIMINAR ASESORAS/ABOGADAS EXCEPTO KEVIN Y MIGUELITO
    console.log("\n--- Eliminando asesoras y abogadas (excepto preservados) ---");
    
    // Primero identificamos a los que NO debemos borrar
    const { data: toKeep } = await supabase
        .from('perfiles')
        .select('id, nombre_completo')
        .or('nombre_completo.ilike.%kevin vargas%,nombre_completo.ilike.%miguelito%');
    
    const keepIds = toKeep.map(p => p.id);
    console.log("Preservando perfiles:", toKeep.map(p => p.nombre_completo));

    // Borramos el resto de asesoras/abogadas
    const { error: perfErr } = await supabase
        .from('perfiles')
        .delete()
        .in('rol', ['asesora', 'abogada'])
        .not('id', 'in', `(${keepIds.join(',')})`);

    if (perfErr) console.error("Error eliminando asesoras:", perfErr.message);
    else console.log("✅ Asesoras y abogadas eliminadas correctamente.");

    // 3. LIMPIEZA DE AUTH (Opcional pero recomendado para consistencia)
    console.log("\n--- Nota: Los usuarios en Auth permanecen, se recomienda borrarlos manualmente desde el dashboard de Supabase si es necesario. ---");

    console.log("\n=== PURGA FINALIZADA ===");
})();
