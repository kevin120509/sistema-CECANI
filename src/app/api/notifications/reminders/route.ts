import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/onesignal-server';

/**
 * API Route para procesar recordatorios de la bitácora.
 * Se recomienda ejecutar esto vía Cron Job cada minuto.
 */
export async function GET(req: NextRequest) {
  // Verificación de seguridad básica (opcional, p.ej. una API key en headers)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    // Obtener fecha y hora actual en zona horaria de México (CST/CDT)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const currentHourMin = `${getPart('hour')}:${getPart('minute')}`;
    
    // Calcular mañana
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const partsT = formatter.formatToParts(tomorrow);
    const getPartT = (type: string) => partsT.find(p => p.type === type)?.value || '';
    const tomorrowStr = `${getPartT('year')}-${getPartT('month')}-${getPartT('day')}`;

    // 1. Buscar recordatorios para HOY a esta HORA
    // Nota: Filtramos por hora aproximada (HH:MM)
    const { data: hoyExacto } = await supabase
      .from('bitacora')
      .select(`
        id,
        nota,
        hora,
        autor_id,
        expediente:expediente_id (
          nombre_empresa
        )
      `)
      .eq('fecha_proximo_seguimiento', todayStr)
      .filter('hora', 'ilike', `${currentHourMin}%`);

    // 2. Buscar recordatorios para MAÑANA (para enviar el aviso de "1 día antes")
    // Lo enviamos solo una vez al día, por ejemplo a las 09:00 AM
    let mananaRecordatorios: any[] = [];
    if (currentHourMin === '09:00') {
      const { data } = await supabase
        .from('bitacora')
        .select(`
          id,
          nota,
          hora,
          autor_id,
          expediente:expediente_id (
            nombre_empresa
          )
        `)
        .eq('fecha_proximo_seguimiento', tomorrowStr);
      mananaRecordatorios = data || [];
    }

    const notifications = [];

    // Procesar hoy (exacto)
    if (hoyExacto && hoyExacto.length > 0) {
      for (const item of hoyExacto) {
        notifications.push(sendPushNotification({
          userIds: [item.autor_id],
          title: '⏰ Recordatorio de Seguimiento',
          message: `Evento AHORA: "${item.nota}" para el cliente ${(item.expediente as any)?.nombre_empresa || 'N/A'}.`,
          url: '/abogada'
        }));
      }
    }

    // Procesar mañana (aviso previo)
    if (mananaRecordatorios.length > 0) {
      for (const item of mananaRecordatorios) {
        notifications.push(sendPushNotification({
          userIds: [item.autor_id],
          title: '📅 Recordatorio para Mañana',
          message: `Mañana tienes pendiente: "${item.nota}" (${item.hora || 'Sin hora'}) con el cliente ${(item.expediente as any)?.nombre_empresa || 'N/A'}.`,
          url: '/abogada'
        }));
      }
    }

    await Promise.all(notifications);

    return NextResponse.json({ 
      success: true, 
      processed: {
        hoy: hoyExacto?.length || 0,
        manana: mananaRecordatorios.length || 0,
        time: currentHourMin
      } 
    });

  } catch (error: any) {
    console.error('Error en reminders cron:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
