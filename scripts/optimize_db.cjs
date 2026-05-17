require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    console.log("=== INICIANDO OPTIMIZACIÓN DE BASE DE DATOS ===");

    // 1. OBTENER PERFILES DE ASESORAS (CON SPLIT PARA MATCHING)
    const { data: perfiles } = await supabase.from('perfiles').select('id, nombre_completo').in('rol', ['asesora', 'abogada', 'admin']);
    const nameToIdMap = {};
    
    perfiles.forEach(p => {
        const parts = p.nombre_completo.split(/[\/\-]| y /i).map(n => n.trim().toLowerCase()).filter(Boolean);
        parts.forEach(part => {
            nameToIdMap[part] = p.id;
        });
        nameToIdMap[p.nombre_completo.trim().toLowerCase()] = p.id;
    });

    // 2. AUTO-ASIGNACIÓN DESDE DATOS CONCENTRADO (CON SPLIT)
    console.log("\n--- Procesando Auto-asignación ---");
    const { data: concentrado } = await supabase.from('datos_concentrado').select('expediente_id, vendedora');
    let assignedCount = 0;

    for (const item of concentrado) {
        if (!item.vendedora) continue;

        // Separar nombres legados
        const legacyNames = item.vendedora.split(/[\/\-]| y /i).map(n => 
            n.trim().toLowerCase()
             .replace(/^(mtro|lic|dra|dr|maestra|maestro|licenciada|licenciado)\.?\s+/i, '')
        ).filter(Boolean);
        
        for (const name of legacyNames) {
            // Mapeos manuales mejorados
            let searchName = name;
            if (name.includes('clau')) searchName = 'claudia';
            if (name.includes('kathy')) searchName = 'kathyuska';
            if (name.includes('aracely') || name.includes('araceli')) searchName = 'araceli';
            if (name.includes('felipe')) searchName = 'felipe vega';
            if (name.includes('mara')) searchName = 'mara';

            // Buscar por coincidencia exacta o por inclusión
            let asesoraId = nameToIdMap[searchName];
            
            if (!asesoraId) {
                // Si no hay match exacto, buscar si el nombre legado está contenido en algún perfil
                const entry = Object.entries(nameToIdMap).find(([pName]) => 
                    pName.includes(searchName) || searchName.includes(pName)
                );
                if (entry) asesoraId = entry[1];
            }

            if (asesoraId) {
                console.log(`Matching: "${item.vendedora}" -> "${searchName}" -> ASESORA_ID FOUND`);
                const { error } = await supabase.from('expediente_asesoras').upsert({
                    expediente_id: item.expediente_id,
                    asesora_id: asesoraId
                }, { onConflict: 'expediente_id, asesora_id' });

                if (error) {
                    console.error("  Upsert error:", error.message);
                } else {
                    await supabase.from('expedientes').update({ asesora_id: asesoraId, estatus: 'en_proceso' }).eq('id', item.expediente_id);
                    assignedCount++;
                }
            }
        }
    }
    console.log(`Auto-asignaciones realizadas: ${assignedCount}`);

    // 3. LIMPIEZA DE DUPLICADOS (EXPEDIENTES)
    console.log("\n--- Limpiando Duplicados ---");
    const { data: expedientes } = await supabase.from('expedientes').select('id, nombre_empresa').order('updated_at', { ascending: false });
    const seen = new Set();
    const toDelete = [];

    for (const exp of expedientes) {
        if (!exp.nombre_empresa) continue;
        const name = exp.nombre_empresa.trim().toLowerCase();
        
        // Ignorar registros de prueba
        if (name.includes('kevin vargas') || name.includes('miguelito')) {
            continue;
        }

        if (seen.has(name)) {
            toDelete.push(exp.id);
        } else {
            seen.add(name);
        }
    }

    if (toDelete.length > 0) {
        console.log(`Eliminando ${toDelete.length} expedientes duplicados...`);
        // Eliminamos por lotes para evitar límites
        for (let i = 0; i < toDelete.length; i += 50) {
            const batch = toDelete.slice(i, i + 50);
            const { error } = await supabase.from('expedientes').delete().in('id', batch);
            if (error) console.error("Error eliminando lote:", error.message);
        }
        console.log("Limpieza completada.");
    } else {
        console.log("No se encontraron duplicados significativos.");
    }

    console.log("\n=== OPTIMIZACIÓN FINALIZADA ===");
})();
