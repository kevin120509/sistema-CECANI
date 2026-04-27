import { createAdminClient } from './supabase/admin';

export async function getIdsByRol(rol: 'directora' | 'abogada' | 'cliente'): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('perfiles')
    .select('id')
    .eq('rol', rol);

  if (error || !data) return [];
  return data.map(p => p.id);
}

export async function sendPushNotification({
  userIds,
  title,
  message,
  url,
}: {
  userIds: string[];
  title: string;
  message: string;
  url?: string;
}) {
  if (userIds.length === 0) return { success: false, error: 'No user IDs provided' };

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.error('OneSignal credentials missing');
    return { success: false, error: 'Configuración faltante' };
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        // Usamos include_external_user_ids para enviar a usuarios específicos de nuestra DB
        include_external_user_ids: userIds,
        contents: { en: message, es: message },
        headings: { en: title, es: title },
        url: url || '',
      }),
    });

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error sending OneSignal notification:', error);
    return { success: false, error };
  }
}
