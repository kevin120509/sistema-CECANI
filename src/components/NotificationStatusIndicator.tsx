'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Bell, BellOff, BellRing } from 'lucide-react';

export default function NotificationStatusIndicator() {
  const [status, setStatus] = useState<'granted' | 'denied' | 'default' | 'loading'>('loading');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Esperar un momento a que OneSignal se inicialice si es necesario
        if (OneSignal.Notifications) {
          const permission = await OneSignal.Notifications.permission;
          setStatus(permission ? 'granted' : 'default');
          
          // Escuchar cambios
          OneSignal.Notifications.addEventListener('permissionChange', (permission: boolean) => {
            setStatus(permission ? 'granted' : 'default');
          });
        }
      } catch (e) {
        setStatus('denied');
      }
    };

    checkStatus();
  }, []);

  const handleRequest = async () => {
    try {
      const os = OneSignal as any;
      if (os.Slidedown) {
        await os.Slidedown.prompt();
      } else if (os.showSlidedownPrompt) {
        await os.showSlidedownPrompt();
      }
    } catch (e) {
      console.error('Error al solicitar notificaciones:', e);
    }
  };

  if (status === 'loading') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 bg-white shadow-sm">
      {status === 'granted' ? (
        <>
          <div className="relative">
            <BellRing className="w-4 h-4 text-green-600 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
          </div>
          <span className="text-xs font-medium text-green-700">Notificaciones Activas</span>
        </>
      ) : (
        <>
          <button 
            onClick={handleRequest}
            className="flex items-center gap-2 group hover:scale-105 transition-transform"
          >
            <BellOff className="w-4 h-4 text-red-500 group-hover:text-red-600" />
            <span className="text-xs font-medium text-red-600 group-hover:text-red-700">Activar Notificaciones</span>
          </button>
        </>
      )}
    </div>
  );
}
