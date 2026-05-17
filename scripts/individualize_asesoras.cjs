require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    console.log("=== INICIANDO INDIVIDUALIZACIÓN DE ASESORAS ===");

    // 1. Obtener todos los perfiles de asesoras/abogadas
    const { data: perfiles } = await supabase.from('perfiles').select('*').in('rol', ['asesora', 'abogada']);
    
    // 2. Identificar nombres individuales y perfiles combinados
    const individualMap = {}; // nombre -> id
    const combinedPerfiles = [];

    perfiles.forEach(p => {
        const name = p.nombre_completo.trim().toLowerCase();
        const isCombined = name.includes('-') || name.includes('/') || name.toLowerCase().includes(' y ');
        
        if (!isCombined) {
            individualMap[name] = p.id;
        } else {
            combinedPerfiles.push(p);
        }
    });

    console.log(`Perfiles individuales encontrados: ${Object.keys(individualMap).length}`);
    console.log(`Perfiles combinados a procesar: ${combinedPerfiles.length}`);

    // 3. Procesar perfiles combinados
    for (const cp of combinedPerfiles) {
        const parts = cp.nombre_completo.split(/[\/\-]| y /i).map(n => n.trim()).filter(Boolean);
        console.log(`\nProcesando combinado: "${cp.nombre_completo}" -> [${parts.join(', ')}]`);

        const partIds = [];

        for (const part of parts) {
            const partLower = part.toLowerCase();
            if (individualMap[partLower]) {
                partIds.push(individualMap[partLower]);
            } else {
                // Crear perfil individual si no existe
                console.log(`  Creando perfil individual para: ${part}`);
                const tempEmail = `${partLower.replace(/[^a-z]/g, '')}_${Date.now()}@cecani.temp`;
                const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
                    email: tempEmail,
                    email_confirm: true,
                    user_metadata: { nombre_completo: part.toUpperCase(), rol: 'asesora' }
                });

                if (authErr) {
                    console.error(`  Error creando auth para ${part}:`, authErr.message);
                    continue;
                }

                const newId = authUser.user.id;
                await supabase.from('perfiles').update({ 
                    nombre_completo: part.toUpperCase(), 
                    rol: 'asesora' 
                }).eq('id', newId);

                individualMap[partLower] = newId;
                partIds.push(newId);
            }
        }

        // 4. Migrar expedientes que usaban este perfil combinado
        const { data: exps } = await supabase.from('expedientes').select('id').eq('asesora_id', cp.id);
        if (exps && exps.length > 0) {
            console.log(`  Migrando ${exps.length} expedientes a la nueva relación...`);
            for (const exp of exps) {
                for (const pid of partIds) {
                    await supabase.from('expediente_asesoras').upsert({
                        expediente_id: exp.id,
                        asesora_id: pid
                    }, { onConflict: 'expediente_id, asesora_id' });
                }
                // Actualizar legacy asesora_id con la primera parte para evitar duplicados en el dashboard actual
                if (partIds.length > 0) {
                    await supabase.from('expedientes').update({ asesora_id: partIds[0] }).eq('id', exp.id);
                }
            }
        }
    }

    console.log("\n=== INDIVIDUALIZACIÓN FINALIZADA ===");
})();
