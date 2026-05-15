import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Solo aplicamos almacenamiento de sesión para staff (abogada/directora)
  const isStaffPath = typeof window !== 'undefined' && 
    (window.location.pathname.startsWith('/abogada') || window.location.pathname.startsWith('/directora'));

  // LIMPIEZA: Si el navegador tiene una sesión "vieja" permanente en localStorage, la movemos a sesión
  if (isStaffPath && typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          sessionStorage.setItem(key, val);
          localStorage.removeItem(key);
        }
      }
    }
  }

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
