'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAbogada, registerAbogada } from '@/actions/auth-abogada';

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-sky-600 text-white font-black uppercase tracking-widest text-xs py-4 px-4 rounded-xl hover:bg-sky-500 transition shadow-xl disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}

export default function AbogadaAuth() {
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    const res = isRegister ? await registerAbogada(formData) : await loginAbogada(formData);
    if (res?.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800">
        <div className="bg-slate-950 p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-sky-600 shadow-[0_0_20px_rgba(14,165,233,0.5)]"></div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            {isRegister ? 'Registro Operativo' : 'Portal Operativo Legal'}
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            {isRegister ? 'Crea tu cuenta de abogada' : 'Gestión de Contratos CECANI'}
          </p>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-8 bg-rose-950/40 text-rose-400 p-4 rounded-2xl border-2 border-rose-900 text-xs font-bold text-center animate-shake">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-6">
            {isRegister && (
              <div className="group">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  name="nombre"
                  required
                  className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Ej. Lic. Maria Perez"
                />
              </div>
            )}
            
            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Correo Institucional</label>
              <input
                type="email"
                name="email"
                required
                className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="abogada@cecani.com"
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <input
                type="password"
                name="password"
                required
                className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <SubmitButton 
                label={isRegister ? "Registrar Cuenta" : "Entrar al Sistema"} 
                loadingLabel="Procesando..." 
              />
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-800 flex flex-col items-center gap-4">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center">
              {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes acceso todavía?'}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="w-full bg-slate-800 text-sky-400 border border-sky-900/50 font-black uppercase text-[11px] tracking-widest py-4 rounded-xl hover:bg-slate-700 hover:text-sky-300 transition-all shadow-md"
            >
              {isRegister ? '← Volver al Inicio de Sesión' : 'Regístrate como Abogada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
