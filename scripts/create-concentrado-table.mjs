/**
 * Script para crear la tabla datos_concentrado y agregar columna JSONB a expedientes.
 * 
 * USO: node scripts/create-concentrado-table.mjs TU_PASSWORD_DE_BASE_DE_DATOS
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
  console.error('USO: node scripts/create-concentrado-table.mjs TU_PASSWORD');
  console.error('');
  console.error('Encuéntrala en: Supabase Dashboard → Settings → Database → Database password');
  process.exit(1);
}

const connectionString = `postgresql://postgres.cvbvzseaokobbyawkbzf:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function createTable() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado.');

    // 1. Create datos_concentrado table
    console.log('\n📋 Creando tabla datos_concentrado...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.datos_concentrado (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        expediente_id uuid REFERENCES public.expedientes(id) ON DELETE CASCADE NOT NULL UNIQUE,
        asesora_encargada text DEFAULT '',
        estado text DEFAULT '',
        actividad text DEFAULT '',
        cluni text DEFAULT '',
        estatus_rpp text DEFAULT '',
        notaria text DEFAULT '',
        pago_notario text DEFAULT '',
        total_contrato text DEFAULT '',
        periodicidad_pagos text DEFAULT '',
        pago_entrega_donataria text DEFAULT '',
        cantidad_cobrar_proximo text DEFAULT '',
        estatus_detalle text DEFAULT '',
        accion_realizar text DEFAULT '',
        num_pagos_realizados text DEFAULT '',
        cantidad_pagada_acumulada text DEFAULT '',
        saldo_cliente text DEFAULT '',
        fecha_ultimo_pago text DEFAULT '',
        quien_cobra text DEFAULT '',
        vendedora text DEFAULT '',
        telefono_cliente text DEFAULT '',
        fecha_contrato text DEFAULT '',
        link_reunion text DEFAULT '',
        fecha_reunion_acuerdos text DEFAULT '',
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      );
    `);
    console.log('✅ Tabla datos_concentrado creada.');

    // 2. Disable RLS on datos_concentrado (admin will manage access)
    console.log('\n🔧 Configurando acceso...');
    await client.query(`ALTER TABLE public.datos_concentrado ENABLE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "Acceso completo service role" ON public.datos_concentrado;`);
    await client.query(`CREATE POLICY "Acceso completo service role" ON public.datos_concentrado FOR ALL USING (true);`);
    console.log('✅ RLS configurado.');

    // 3. Verify
    console.log('\n📋 Verificando tabla...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'datos_concentrado' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log(`✅ Tabla tiene ${result.rows.length} columnas:`);
    result.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`));

    console.log('\n🎉 ¡Todo listo!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 La contraseña es incorrecta.');
      console.error('   Encuéntrala en: Supabase Dashboard → Settings → Database → Database password');
    }
  } finally {
    await client.end();
  }
}

createTable();
