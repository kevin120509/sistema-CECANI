'use client';

import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { createClient } from '@/lib/supabase/client';

export default function OneSignalInitializer() {
  useEffect(() => {
    const initOneSignal = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      
      if (!user || !appId) {
        if (!appId) console.warn('OneSignal App ID no configurado en .env.local');
        return;
      }

      // Evitar el error de dominio en localhost
      if (window.location.hostname === 'localhost') {
        console.log('OneSignal: Inicialización omitida en localhost para evitar error de dominio.');
        return;
      }

      // Suprimir errores internos ruidosos de OneSignal en desarrollo (cuando Web Push falla sin HTTPS)
      const originalError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('Op failed') && args[0].includes('update-subscription')) {
          return; // Ignorar logs inofensivos de fallo temporal de suscripción local
        }
        originalError(...args);
      };

      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
            prenotify: true,
            showCredit: false,
            text: {
              'tip.state.unsubscribed': 'Suscríbete a las notificaciones',
              'tip.state.subscribed': 'Estás suscrito a las notificaciones',
              'tip.state.blocked': 'Has bloqueado las notificaciones',
              'message.prenotify': 'Haz clic para suscribirte',
              'message.action.subscribing': 'Suscribiendo...',
              'message.action.subscribed': '¡Gracias por suscribirte!',
              'message.action.resubscribed': 'Estás suscrito de nuevo',
              'message.action.unsubscribed': 'Te has desuscrito',
              'dialog.main.title': 'Notificaciones',
              'dialog.main.button.subscribe': 'Suscribirse',
              'dialog.main.button.unsubscribe': 'Desuscribirse',
              'dialog.blocked.title': 'Desbloquear notificaciones',
              'dialog.blocked.message': 'Sigue estas instrucciones para permitir las notificaciones:'
            }
          },
        });

        // Sincronizamos el ID de Supabase con OneSignal
        // Esto nos permite enviar notificaciones usando el UUID de la base de datos
        await OneSignal.login(user.id);
        
        console.log('OneSignal Initialized for user:', user.id);
      } catch (error) {
        console.error('Error initializing OneSignal:', error);
      }
    };

    initOneSignal();
  }, []);

  return null;
}
