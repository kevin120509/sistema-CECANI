'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Obtener el ID del usuario actual para filtrar notificaciones personales
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id || null;
    });

    const channel = supabase
      .channel('global_system_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, (payload: any) => {
        console.log('🔄 Sync: Cambio en Expedientes', payload);
        
        // Manejar eliminaciones explícitamente para aviso visual opcional
        if (payload.eventType === 'DELETE') {
          console.log('Expediente eliminado, refrescando vistas...');
        }
        
        // Si es una actualización y el asesora_id coincide con el usuario actual, es una nueva asignación
        if (payload.eventType === 'UPDATE' && payload.new.asesora_id === userIdRef.current && (!payload.old || payload.old.asesora_id !== userIdRef.current)) {
          toast.success('¡Nuevo Expediente Asignado!', {
            description: `Se te ha asignado el proyecto "${payload.new.nombre_empresa}".`,
            duration: 10000, // 10 segundos
          });
        } else {
          // Toast genérico silencioso para asegurar que sepa que algo cambió
          console.log('Refrescando datos por cambio en expediente...');
        }

        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, (payload: any) => {
        console.log('🔄 Sync: Cambio en Documentos');
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, (payload: any) => {
        console.log('🔄 Sync: Cambio en Pagos');
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, (payload: any) => {
        console.log('🔄 Sync: Cambio en Contratos');
        router.refresh();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 Sistema de Sincronización Global Activado');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return <>{children}</>;
}
