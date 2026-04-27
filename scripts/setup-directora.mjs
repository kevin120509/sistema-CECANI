import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Error: Faltan variables de entorno en .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDirectora() {
  const email = 'directora@cecani.com';
  const password = 'password123';
  const nombre = 'Directora CECANI';

  console.log(`🔄 Iniciando configuración para: ${email}...`);

  // 1. Crear o actualizar usuario en Auth
  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre }
  });

  let userId = userData?.user?.id;

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('ℹ️ El usuario ya existe en Auth. Buscando ID...');
      const { data: listUsers } = await supabase.auth.admin.listUsers();
      const existingUser = listUsers.users.find(u => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
        // Resetear contraseña por si acaso
        await supabase.auth.admin.updateUserById(userId, { password });
        console.log('✅ Contraseña reseteada a password123');
      }
    } else {
      console.error('❌ Error Auth:', authError.message);
      return;
    }
  } else {
    console.log('✅ Usuario creado en Auth.');
  }

  if (!userId) return;

  // 2. Asegurar entrada en tabla perfiles
  const { error: profileError } = await supabase
    .from('perfiles')
    .upsert({
      id: userId,
      nombre_completo: nombre,
      rol: 'directora',
      email: email,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌ Error Perfil:', profileError.message);
  } else {
    console.log('✅ Perfil configurado como "directora" exitosamente.');
  }

  console.log('\n🎉 ¡Listo! Ahora puedes entrar con:');
  console.log(`📧 Usuario: ${email}`);
  console.log(`🔑 Contraseña: ${password}`);
}

setupDirectora();
