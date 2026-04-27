const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    console.log('Intentando actualizar el rol a la cuenta creada...');
    // Buscamos el UUID de la directora
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    const dirUser = userData.users.find(u => u.email === 'directora@cecani.mx');
    
    if (dirUser) {
        const { error } = await supabase.from('perfiles').update({ rol: 'directora', nombre_completo: 'Directora CECANI' }).eq('id', dirUser.id);
        if (error) {
            console.error('Error al actualizar el perfil:', error.message);
        } else {
            console.log('¡Perfil actualizado con éxito! Puedes iniciar sesión con directora@cecani.mx / password123');
        }
    } else {
        console.log('No se pudo encontrar el usuario en auth');
    }
})();
