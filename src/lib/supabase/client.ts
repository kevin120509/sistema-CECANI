import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Solo aplicamos limpieza para staff (abogada/directora)
  const isStaffPath = typeof window !== 'undefined' && 
    (window.location.pathname.startsWith('/abogada') || window.location.pathname.startsWith('/directora'));

  // LIMPIEZA: Si el navegador tiene una sesión "vieja" permanente en localStorage, la eliminamos
  if (isStaffPath && typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // En Next.js App Router usando @supabase/ssr, es mejor no definir 'storage'
        // y dejar que el cliente browser use su adaptador de cookies interno.
        // La naturaleza "de sesión" (borrar al cerrar navegador) se controla en server.ts
        // eliminando el maxAge de la cookie.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}
