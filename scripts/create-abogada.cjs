const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAbogada() {
  const email = 'abogada@cecani.com';
  const password = 'password123';
  const nombre_completo = 'Lic. Ana Rodríguez';

  console.log(`Creando cuenta de prueba para: ${email}...`);

  // 1. Crear usuario en Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.code === 'email_exists' || authError.message.includes('already exists') || authError.message.includes('ya está registrado')) {
       console.log('El usuario ya existe en Auth. Buscando ID...');
       const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
       if (listError) throw listError;
       const user = usersData.users.find(u => u.email === email);
       if (user) {
         await checkOrCreateProfile(user.id, nombre_completo);
       }
       return;
    }
    throw authError;
  }

  const userId = authData.user.id;
  console.log('Usuario de Auth creado con ID:', userId);

  await checkOrCreateProfile(userId, nombre_completo);
}

async function checkOrCreateProfile(userId, nombre_completo) {
  // 2. Insertar/Actualizar en tabla perfiles
  console.log('Asegurando perfil en tabla perfiles...');
  const { error: profileError } = await supabaseAdmin
    .from('perfiles')
    .upsert({
      id: userId,
      nombre_completo,
      rol: 'abogada',
    });

  if (profileError) {
    console.error('Error al crear el perfil:', profileError);
  } else {
    console.log('¡Cuenta de abogada de prueba creada y lista para usarse!');
    console.log('-----------------------------');
    console.log('Email:', 'abogada@cecani.com');
    console.log('Contraseña:', 'password123');
    console.log('-----------------------------');
  }
}

createAbogada().catch(console.error);
