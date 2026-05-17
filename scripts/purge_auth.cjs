require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Usamos Service Role Key para tener permisos de administrador en Auth
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

(async () => {
    console.log("=== INICIANDO PURGA DE USUARIOS EN AUTH ===");

    try {
        // 1. Obtener lista de todos los usuarios
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
            throw new Error(`Error listando usuarios: ${listError.message}`);
        }

        console.log(`Total de usuarios encontrados: ${users.length}`);

        let deletedCount = 0;
        let preservedCount = 0;

        for (const user of users) {
            const nombre = user.user_metadata?.nombre_completo?.toLowerCase() || '';
            const rol = user.user_metadata?.rol?.toLowerCase() || '';
            const email = user.email?.toLowerCase() || '';

            // CRITERIOS PARA PRESERVAR
            const esKevin = nombre.includes('kevin vargas') || email.includes('kevin');
            const esMiguelito = nombre.includes('miguelito');
            const esDirectora = rol === 'directora';

            if (esKevin || esMiguelito || esDirectora) {
                console.log(`PRESERVADO: ${user.email} (${nombre || 'Sin nombre'}) [${rol}]`);
                preservedCount++;
                continue;
            }

            // ELIMINAR EL RESTO
            console.log(`ELIMINANDO: ${user.email} (${nombre})`);
            const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
            
            if (deleteError) {
                console.error(`  Error eliminando a ${user.email}: ${deleteError.message}`);
            } else {
                deletedCount++;
            }
        }

        console.log("\n--- Resumen ---");
        console.log(`Usuarios eliminados: ${deletedCount}`);
        console.log(`Usuarios preservados: ${preservedCount}`);

    } catch (error) {
        console.error("Fallo crítico:", error.message);
    }

    console.log("=== PURGA DE AUTH FINALIZADA ===");
})();
