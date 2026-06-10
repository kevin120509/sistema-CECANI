const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
    return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function cleanString(str) {
    if (!str) return null;
    return str.toString().trim().replace(/\r?\n|\r/g, ' ');
}

async function runImport() {
    console.log('--- Starting Import ---');
    
    // Read to_import.json
    const toImportPath = path.resolve(process.cwd(), 'scratch', 'to_import.json');
    if (!fs.existsSync(toImportPath)) {
        console.log('to_import.json not found. Run compare script first.');
        return;
    }
    const toImport = JSON.parse(fs.readFileSync(toImportPath, 'utf8'));

    // Cache hitos 32 to 48 for seguimiento_tareas
    const { data: hitos } = await supabase.from('catalogo_hitos').select('id').gte('id', 32).lte('id', 48);
    const hitoIds = hitos.map(h => h.id);

    console.log(`Processing ${toImport.length} records...`);

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const record of toImport) {
        try {
            const { type, row, dbPerfil, dbExpediente } = record;
            
            // Excel Columns Mapping
            const nombre_completo = cleanString(row[2]) || 'Cliente Desconocido';
            const asesora_encargada = cleanString(row[3]);
            const nombre_empresa = cleanString(row[4]) || 'A.C. Sin Nombre';
            const estado = cleanString(row[5]);
            const actividad = cleanString(row[6]);
            const cluni = cleanString(row[7]);
            const estatus_rpp = cleanString(row[8]);
            const notaria = cleanString(row[9]);
            const pago_notario = cleanString(row[10]);
            const total_contrato = cleanString(row[11]);
            const periodicidad_pagos = cleanString(row[12]);
            const pago_entrega_donataria = cleanString(row[13]);
            const cantidad_cobrar_proximo = cleanString(row[14]);
            const estatus_detalle = cleanString(row[15]);
            const accion_realizar = cleanString(row[16]);
            const num_pagos_realizados = cleanString(row[17]);
            const cantidad_pagada_acumulada = cleanString(row[18]);
            const saldo_cliente = cleanString(row[19]);
            const fecha_ultimo_pago = cleanString(row[20]);
            const quien_cobra = cleanString(row[21]);
            const vendedora = cleanString(row[22]);
            const telefono_cliente = cleanString(row[23]);
            const fecha_contrato = cleanString(row[25]);
            const link_reunion = cleanString(row[26]);
            const fecha_reunion_acuerdos = cleanString(row[27]);

            let clienteId = dbPerfil ? dbPerfil.id : null;

            // 1. Handle Perfil
            if (!clienteId) {
                const fakeEmail = `${nombre_completo.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15)}_${Date.now()}@cecani.temp`;
                
                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                    email: fakeEmail,
                    email_confirm: true,
                    user_metadata: {
                        nombre_completo: nombre_completo,
                        rol: 'cliente',
                        telefono: telefono_cliente
                    }
                });

                if (authError || !authUser.user) {
                    console.log(`Error creating auth user for ${nombre_completo}: ${authError?.message}`);
                    errorCount++;
                    continue;
                }
                clienteId = authUser.user.id;

                // Update perfil with phone
                await supabase.from('perfiles').update({
                    telefono: telefono_cliente
                }).eq('id', clienteId);
            }

            // 2. Handle Expediente
            let expedienteId = dbExpediente ? dbExpediente.id : null;
            if (!expedienteId) {
                const { data: expData, error: expError } = await supabase.from('expedientes').insert({
                    cliente_id: clienteId,
                    figura_id: 2, // Assuming A.C. which is typically 2 or 1, let's use 2.
                    nombre_empresa: nombre_empresa,
                    estatus: 'en_proceso' // Assuming these are in tracking
                }).select('id').single();

                if (expError || !expData) {
                    console.log(`Error creating expediente for ${nombre_empresa}: ${expError?.message}`);
                    errorCount++;
                    continue;
                }
                expedienteId = expData.id;

                // 2.1 Create Seguimiento Tareas (Checklist)
                if (hitoIds.length > 0) {
                    const tareas = hitoIds.map(hId => ({
                        expediente_id: expedienteId,
                        hito_id: hId,
                        estatus: 'pendiente'
                    }));
                    await supabase.from('seguimiento_tareas').insert(tareas);
                }

                // 2.2 Create basic Contrato to avoid UI errors
                await supabase.from('contratos').insert({
                    expediente_id: expedienteId,
                    plan_pagos: 'unico',
                    monto_total: 0,
                    estatus: 'generado',
                    servicio_base: 'constitucion_donataria'
                });
            }

            // 3. Handle Datos Concentrado
            const concentradoPayload = {
                expediente_id: expedienteId,
                asesora_encargada,
                estado,
                actividad,
                cluni,
                estatus_rpp,
                notaria,
                pago_notario,
                total_contrato,
                periodicidad_pagos,
                pago_entrega_donataria,
                cantidad_cobrar_proximo,
                estatus_detalle,
                accion_realizar,
                num_pagos_realizados,
                cantidad_pagada_acumulada,
                saldo_cliente,
                fecha_ultimo_pago,
                quien_cobra,
                vendedora,
                telefono_cliente,
                fecha_contrato,
                link_reunion,
                fecha_reunion_acuerdos,
                nombre_completo // Duplicated for easier search
            };

            if (type === 'Missing Concentrado') {
                const { error: concError } = await supabase.from('datos_concentrado').insert(concentradoPayload);
                if (concError) {
                    console.log(`Error inserting concentrado for ${nombre_empresa}: ${concError.message}`);
                    errorCount++;
                } else {
                    importedCount++;
                }
            } else {
                // New Record
                const { error: concError } = await supabase.from('datos_concentrado').insert(concentradoPayload);
                if (concError) {
                    console.log(`Error inserting concentrado for ${nombre_empresa}: ${concError.message}`);
                    errorCount++;
                } else {
                    importedCount++;
                }
            }

            // Simple progress log
            if (importedCount % 50 === 0) {
                console.log(`Processed ${importedCount} records...`);
            }
        } catch (e) {
            console.error(`Unexpected error on record ${record.idx}: ${e.message}`);
            errorCount++;
        }
    }

    console.log(`\n--- Import Complete ---`);
    console.log(`Imported/Created: ${importedCount}`);
    console.log(`Errors: ${errorCount}`);
}

runImport();
