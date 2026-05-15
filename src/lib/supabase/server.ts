import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

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
              // Eliminamos maxAge y expires para que la cookie sea de sesión
              // (se borre al cerrar el navegador)
              const { maxAge, expires, ...rest } = options;
              cookieStore.set(name, value, rest);
            });
          } catch {
            // Este método se llama desde un Server Component.
            // Podemos ignorarlo de forma segura porque el middleware maneja el refresco.
          }
        },
      },
    }
  );
}
