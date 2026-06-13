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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800">
        <div className="bg-slate-950 p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-sky-600 shadow-[0_0_20px_rgba(14,165,233,0.5)]"></div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">
            {isRegistering ? 'Alta Directiva' : 'Portal Directivo'}
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            {isRegistering ? 'Registro de acceso total' : 'Supervisión Legal CECANI'}
          </p>
        </div>

        <div className="p-8 md:p-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {isRegistering && (
                <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label>
                  <input
                    name="nombre"
                    type="text"
                    required
                    className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-800"
                    placeholder="Lic. Nombre Apellido"
                  />
                </div>
              )}
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Correo Institucional</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-800"
                  placeholder="directora@cecani.com"
                />
              </div>

              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña de Acceso</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-950/30 text-red-400 p-4 rounded-2xl border-2 border-red-900/50 text-[10px] font-black text-center uppercase tracking-widest">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-950/30 text-emerald-400 p-4 rounded-2xl border-2 border-emerald-900/50 text-[10px] font-black text-center uppercase tracking-widest">
                {success}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 text-white font-black uppercase tracking-[0.2em] text-xs py-5 px-4 rounded-2xl hover:bg-sky-500 hover:-translate-y-1 transition-all shadow-xl shadow-sky-600/20 disabled:opacity-50"
              >
                {isLoading ? 'Autenticando...' : (isRegistering ? 'Crear Acceso Directivo' : 'Entrar al Sistema')}
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-800 flex flex-col items-center gap-4">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center">
                {isRegistering ? '¿Ya tienes una cuenta?' : '¿Necesitas una cuenta?'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full bg-slate-800 text-sky-400 border border-sky-900/50 font-black uppercase text-[11px] tracking-widest py-4 rounded-xl hover:bg-slate-700 hover:text-sky-300 transition-all shadow-md"
              >
                {isRegistering ? '← Iniciar Sesión' : 'Regístrate como Directora'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
