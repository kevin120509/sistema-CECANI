'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { actualizarPassword } from '@/actions/recuperar-password';

export default function ActualizarPasswordClient() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipo = searchParams.get('tipo') || '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const result = await actualizarPassword(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setSuccess('¡Contraseña actualizada con éxito! Redirigiendo al portal...');
      setTimeout(() => {
        router.push(`/${tipo}`); // Redirige a /directora o /abogada
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800">
        <div className="bg-slate-950 p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-sky-600 shadow-[0_0_20px_rgba(14,165,233,0.5)]"></div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Nueva Contraseña</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            Sistema CECANI
          </p>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-8 bg-rose-950/40 text-rose-400 p-4 rounded-2xl border-2 border-rose-900 text-xs font-bold text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-8 bg-emerald-950/40 text-emerald-400 p-4 rounded-2xl border-2 border-emerald-900 text-xs font-bold text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nueva Contraseña</label>
              <input
                type="password"
                name="password"
                required
                className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirmar Contraseña</label>
              <input
                type="password"
                name="confirmPassword"
                required
                className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !!success}
                className="w-full bg-sky-600 text-white font-black uppercase tracking-widest text-xs py-4 px-4 rounded-xl hover:bg-sky-500 transition shadow-xl disabled:opacity-50"
              >
                {isLoading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
