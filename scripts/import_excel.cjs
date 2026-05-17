const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesario para crear usuarios sin Auth real en el script
);

async function importExcel() {
  console.log('--- Iniciando Importación de Excel ---');
  const filePath = path.join(process.cwd(), 'informacion', 'CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { range: 0 }); // La fila 0 tiene los encabezados que vimos

  // 1. Obtener catálogo de figuras para mapear (o crear una por defecto)
  const { data: figuras } = await supabase.from('catalogo_figuras').select('*');
  const figuraDefault = figuras?.[0]?.id || 1;

  for (const row of data) {
    const nombreCliente = row['CLIENTE'];
    const nombreEmpresa = row['NOMBRE DE A.C.'];
    const asesoraName = row['ASESORA CECANI ENCARGADA'];
    const telefono = String(row['TELÉFONO DEL CLIENTE'] || '').trim();
    const totalContrato = parseFloat(row['TOTAL DEL CONTRATO']) || 0;
    const planPagosStr = row['CONTRATO DESCRIBIR PERIODICIDAD DE PAGOS'] || '';

    if (!nombreCliente || !nombreEmpresa) continue;

    console.log(`Procesando: ${nombreEmpresa} (${nombreCliente}) - Asesora: ${asesoraName}`);

    try {
      // 2. Gestionar Asesora (Buscar o Crear)
      let asesoraId = null;
      if (asesoraName) {
        // Buscamos si ya existe un perfil con ese nombre y rol asesora
        const { data: profileAsesora } = await supabase
          .from('perfiles')
          .select('id')
          .ilike('nombre_completo', `%${asesoraName}%`)
          .eq('rol', 'asesora')
          .maybeSingle();

        if (profileAsesora) {
          asesoraId = profileAsesora.id;
        } else {
          // Si no existe, creamos un usuario de "relleno" para la asesora
          // Nota: En producción esto debería estar ya cargado, pero para la migración creamos el registro
          const tempEmail = `${asesoraName.toLowerCase().replace(/[^a-z]/g, '')}_temp@cecani.temp`;
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: tempEmail,
            email_confirm: true,
            user_metadata: { nombre_completo: asesoraName, rol: 'asesora' }
          });

          if (!authErr && authUser.user) {
            asesoraId = authUser.user.id;
            // El trigger de la DB debería crear el perfil, si no, lo forzamos:
            await supabase.from('perfiles').update({ rol: 'asesora', nombre_completo: asesoraName }).eq('id', asesoraId);
          }
        }
      }

      // 3. Crear Usuario Cliente
      const clientEmail = `${nombreCliente.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}_${Date.now()}@cecani.temp`;
      const { data: authClient, error: clientErr } = await supabase.auth.admin.createUser({
        email: clientEmail,
        email_confirm: true,
        user_metadata: { nombre_completo: nombreCliente, rol: 'cliente' }
      });

      if (clientErr) {
        console.error(`Error creando auth cliente ${nombreCliente}:`, clientErr.message);
        continue;
      }

      const clienteId = authClient.user.id;

      // 4. Actualizar Perfil Cliente
      await supabase.from('perfiles').update({
        nombre_completo: nombreCliente,
        telefono: telefono,
        rol: 'cliente'
      }).eq('id', clienteId);

      // 5. Crear Expediente
      const { data: expData, error: expErr } = await supabase.from('expedientes').insert({
        cliente_id: clienteId,
        asesora_id: asesoraId,
        nombre_empresa: nombreEmpresa,
        figura_id: figuraDefault,
        estatus: 'en_proceso', // Marcamos en proceso por ser histórico
      }).select().single();

      if (expErr) throw expErr;

      // 6. Crear Contrato
      const planPagos = planPagosStr.toLowerCase().includes('unico') ? 'unico' : '4_meses';
      await supabase.from('contratos').insert({
        expediente_id: expData.id,
        monto_total: totalContrato,
        plan_pagos: planPagos,
        estatus: 'vigente'
      });

      // 7. Guardar metadatos extendidos en una tabla de 'concentrado' si existe
      // Según ARCHITECTURE.md, hay una tabla de concentrado para la abogada
      await supabase.from('datos_concentrado').insert({
        expediente_id: expData.id,
        asesora_encargada: asesoraName,
        actividad: row['ACTIVIDAD'],
        cluni: row['CLUNI'],
        estatus_rpp: row['ESTATUS DE RPP '],
        total_contrato: String(totalContrato),
        quien_cobra: row['QUIEN COBRA O NEGOCIA'],
        vendedora: row['VENDEDORA']
      });

      console.log(`✅ Importado con éxito: ${nombreEmpresa}`);
    } catch (e) {
      console.error(`❌ Error importando ${nombreEmpresa}:`, e.message);
    }
  }
}

importExcel();
