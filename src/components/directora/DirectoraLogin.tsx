'use client';

import { useState } from 'react';
import { loginDirectora, registrarDirectora } from '@/actions/directora';
import { useRouter } from 'next/navigation';

export default function DirectoraLogin() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    
    if (isRegistering) {
      const result = await registrarDirectora(formData);
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        setSuccess('¡Cuenta creada! Ahora puedes iniciar sesión.');
        setIsRegistering(false);
        setIsLoading(false);
      }
    } else {
      const result = await loginDirectora(formData);
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        router.refresh();
        router.push('/directora');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-[2rem] shadow-2xl border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-black text-blue-900 uppercase tracking-tighter">
            {isRegistering ? 'Crear Cuenta' : 'Acceso Directivo'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500 font-bold uppercase tracking-widest">
            {isRegistering ? 'Registro de Directora CECANI' : 'Portal Corporativo CECANI'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isRegistering && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre Completo</label>
                <input
                  name="nombre"
                  type="text"
                  required
                  className="appearance-none rounded-xl relative block w-full px-4 py-4 border-2 border-gray-100 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 font-bold"
                  placeholder="Escribe tu nombre..."
                />
              </div>
            )}
            
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Correo Electrónico</label>
              <input
                name="email"
                type="email"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-4 border-2 border-gray-100 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 font-bold"
                placeholder="ejemplo@cecani.com"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña</label>
              <input
                name="password"
                type="password"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-4 border-2 border-gray-100 placeholder-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 font-bold"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs font-black text-center text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-100 uppercase tracking-tight">
              {error}
            </div>
          )}

          {success && (
            <div className="text-xs font-black text-center text-emerald-600 bg-emerald-50 p-4 rounded-xl border-2 border-emerald-100 uppercase tracking-tight">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-5 px-4 border-b-8 border-blue-800 text-sm font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              {isLoading ? 'Procesando...' : (isRegistering ? 'Registrarme ahora' : 'Entrar al Panel')}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
                setSuccess(null);
              }}
              className="w-full text-center text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 tracking-[0.2em] transition-colors"
            >
              {isRegistering ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
