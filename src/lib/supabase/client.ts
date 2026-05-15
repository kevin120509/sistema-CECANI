import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Solo aplicamos almacenamiento de sesión para staff (abogada/directora)
  const isStaffPath = typeof window !== 'undefined' && 
    (window.location.pathname.startsWith('/abogada') || window.location.pathname.startsWith('/directora'));

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        // Si es staff usamos sessionStorage (se borra al cerrar pestaña/navegador)
        // Si es cliente u otro, usamos localStorage (persiste)
        storage: typeof window !== 'undefined' 
          ? (isStaffPath ? window.sessionStorage : window.localStorage)
          : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}
