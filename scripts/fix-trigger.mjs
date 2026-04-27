/**
 * Script para arreglar el trigger handle_new_user en Supabase.
 * 
 * USO: node scripts/fix-trigger.mjs TU_PASSWORD_DE_BASE_DE_DATOS
 * 
 * La contraseña la encuentras en:
 * Supabase Dashboard → Settings → Database → Connection string → Password
 */

import pg from 'pg';
const { Client } = pg;

const DB_PASSWORD = process.argv[2] || process.env.DATABASE_PASSWORD;

if (!DB_PASSWORD) {
  console.error('❌ Debes proporcionar la contraseña de la base de datos.');
  console.error('');
  console.error('USO: node scripts/fix-trigger.mjs TU_PASSWORD');
  console.error('');
  console.error('Encuéntrala en: Supabase Dashboard → Settings → Database → Database password');
  process.exit(1);
}

const connectionString = `postgresql://postgres.cvbvzseaokobbyawkbzf:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function fixTrigger() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado.');

    // 1. Ver triggers actuales en auth.users
    console.log('\n📋 Buscando triggers en auth.users...');
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE event_object_schema = 'auth' AND event_object_table = 'users'
    `);
    
    if (triggersResult.rows.length === 0) {
      console.log('⚠️  No se encontraron triggers en auth.users');
    } else {
      console.log(`   Encontrados ${triggersResult.rows.length} trigger(s):`);
      for (const row of triggersResult.rows) {
        console.log(`   - ${row.trigger_name} (${row.event_manipulation}): ${row.action_statement}`);
      }
    }

    // 2. Ver la función handle_new_user actual
    console.log('\n📋 Buscando función handle_new_user...');
    const fnResult = await client.query(`
      SELECT routine_schema, routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user'
    `);

    if (fnResult.rows.length > 0) {
      console.log(`   Función encontrada en esquema: ${fnResult.rows[0].routine_schema}`);
      
      // Ver el código fuente de la función
      const srcResult = await client.query(`
        SELECT prosrc FROM pg_proc 
        WHERE proname = 'handle_new_user'
      `);
      if (srcResult.rows.length > 0) {
        console.log('\n📄 Código actual de handle_new_user:');
        console.log(srcResult.rows[0].prosrc);
      }
    }

    // 3. Reemplazar la función con una versión que funcione
    console.log('\n🔧 Reemplazando función handle_new_user...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $$
      BEGIN
        INSERT INTO public.perfiles (id, nombre_completo, rol, telefono, estado)
        VALUES (
          new.id,
          COALESCE(
            new.raw_user_meta_data->>'nombre_completo',
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            'Cliente'
          ),
          COALESCE(
            new.raw_user_meta_data->>'rol',
            'cliente'
          )::public.rol_usuario,
          new.raw_user_meta_data->>'telefono',
          new.raw_user_meta_data->>'estado'
        );
        RETURN new;
      END;
      $$;
    `);
    console.log('✅ Función handle_new_user actualizada correctamente.');

    // 4. Verificar que el trigger existe y apunta a la función correcta
    console.log('\n🔍 Verificando trigger...');
    const verifyResult = await client.query(`
      SELECT trigger_name FROM information_schema.triggers 
      WHERE event_object_schema = 'auth' 
        AND event_object_table = 'users'
        AND action_statement LIKE '%handle_new_user%'
    `);

    if (verifyResult.rows.length === 0) {
      console.log('⚠️  No hay trigger vinculado. Creando...');
      await client.query(`
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW
          EXECUTE FUNCTION public.handle_new_user();
      `);
      console.log('✅ Trigger creado.');
    } else {
      console.log(`✅ Trigger existente: ${verifyResult.rows[0].trigger_name}`);
    }

    // 5. Insertar datos en catalogo_figuras si está vacía
    console.log('\n📋 Verificando catalogo_figuras...');
    const figurasCount = await client.query('SELECT COUNT(*) FROM public.catalogo_figuras');
    
    if (parseInt(figurasCount.rows[0].count) === 0) {
      console.log('   Tabla vacía. Insertando figuras legales...');
      await client.query(`
        INSERT INTO public.catalogo_figuras (siglas, descripcion) VALUES
          ('SA de CV', 'Sociedad Anónima de Capital Variable'),
          ('S de RL de CV', 'Sociedad de Responsabilidad Limitada de Capital Variable'),
          ('SAS', 'Sociedad por Acciones Simplificada'),
          ('SC', 'Sociedad Civil'),
          ('AC', 'Asociación Civil'),
          ('SAPI', 'Sociedad Anónima Promotora de Inversión'),
          ('S en C', 'Sociedad en Comandita Simple'),
          ('SNC', 'Sociedad en Nombre Colectivo')
      `);
      console.log('✅ 8 figuras legales insertadas.');
    } else {
      console.log(`   Ya tiene ${figurasCount.rows[0].count} registro(s).`);
    }

    // 6. Agregar políticas RLS para lectura pública de catalogo_figuras
    console.log('\n🔧 Configurando RLS para catalogo_figuras...');
    try {
      await client.query(`
        ALTER TABLE public.catalogo_figuras ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Lectura pública de figuras" ON public.catalogo_figuras;
        CREATE POLICY "Lectura pública de figuras" ON public.catalogo_figuras
          FOR SELECT USING (true);
      `);
      console.log('✅ RLS configurado para catalogo_figuras (lectura pública).');
    } catch (e) {
      console.log(`⚠️  No se pudo configurar RLS: ${e.message}`);
    }

    console.log('\n🎉 ¡Todo listo! El formulario debería funcionar ahora.');
    console.log('   Reinicia el servidor dev (npm run dev) y prueba.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 La contraseña es incorrecta.');
      console.error('   Encuéntrala en: Supabase Dashboard → Settings → Database → Database password');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      console.error('\n💡 No se puede conectar al servidor. Verifica tu conexión a internet.');
    }
  } finally {
    await client.end();
  }
}

fixTrigger();
