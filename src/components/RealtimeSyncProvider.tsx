'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Proveedor de Sincronización Global en Tiempo Real.
 * Escucha cambios en las tablas críticas y refresca la ruta actual
 * para asegurar que los datos sean siempre los más recientes sin F5.
 */
export default function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // 1. Escuchar TODO lo relevante en la base de datos
    const channel = supabase
      .channel('global_system_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, (payload) => {
        console.log('🔄 Sync: Cambio en Expedientes', payload);
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, (payload) => {
        console.log('🔄 Sync: Cambio en Documentos', payload);
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, (payload) => {
        console.log('🔄 Sync: Cambio en Pagos', payload);
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, (payload) => {
        console.log('🔄 Sync: Cambio en Contratos', payload);
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, (payload) => {
        console.log('🔄 Sync: Cambio en Perfiles/Roles', payload);
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
