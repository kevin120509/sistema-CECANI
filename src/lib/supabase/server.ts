import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const referer = headersList.get('referer') || '';
  const isStaffPath = referer.includes('/abogada') || referer.includes('/directora');

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Configuración de seguridad para evitar errores de token duplicado
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              let finalOptions = { ...options };
              
              if (isStaffPath) {
                // Forzamos que sea de sesión para staff
                const { maxAge, expires, ...rest } = finalOptions;
                finalOptions = rest;
              }

              cookieStore.set(name, value, finalOptions);
            });
          } catch {
            // Este método se llama desde un Server Component.
          }
        },
      },
    }
  );
}
