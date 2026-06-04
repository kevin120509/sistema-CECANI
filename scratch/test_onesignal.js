const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

async function testOneSignal() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  console.log('--- Iniciando Prueba de OneSignal ---');
  console.log('App ID:', appId);
  console.log('API Key:', restApiKey ? '***' + restApiKey.slice(-4) : 'No encontrada');

  if (!appId || !restApiKey) {
    console.error('Error: Faltan credenciales en .env.local');
    return;
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
        included_segments: ['All'], // Enviamos a todos los suscritos para la prueba
        contents: { 
          es: '¡Conexión Exitosa! El Sistema CECANI ahora puede enviarte alertas en tiempo real.',
          en: 'Success! CECANI System can now send you real-time alerts.' 
        },
        headings: { 
          es: 'Sistema CECANI - Prueba',
          en: 'CECANI System - Test' 
        },
        name: 'TEST_MANUAL_GEMINI'
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('OneSignal devolvió errores:', data.errors);
    } else {
      console.log('✅ Notificación enviada con éxito!');
      console.log('Respuesta de OneSignal:', data);
    }
  } catch (error) {
    console.error('Error fatal en la petición:', error);
  }
}

testOneSignal();
