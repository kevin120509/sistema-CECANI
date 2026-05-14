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
      className="w-full bg-slate-900 text-white font-black uppercase tracking-widest text-xs py-4 px-4 rounded-xl hover:bg-slate-800 transition shadow-xl disabled:opacity-50"
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            {isRegister ? 'Registro Operativo' : 'Portal Operativo Legal'}
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            {isRegister ? 'Crea tu cuenta de abogada' : 'Gestión de Contratos CECANI'}
          </p>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-8 bg-red-50 text-red-700 p-4 rounded-2xl border-2 border-red-100 text-xs font-bold text-center animate-shake">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-6">
            {isRegister && (
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  name="nombre"
                  required
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ej. Lic. Maria Perez"
                />
              </div>
            )}
            
            <div className="group">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Correo Institucional</label>
              <input
                type="email"
                name="email"
                required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                placeholder="abogada@cecani.com"
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <input
                type="password"
                name="password"
                required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
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

          <div className="mt-10 pt-8 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">
              {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes acceso todavía?'}
            </p>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-blue-600 font-black uppercase text-[11px] tracking-widest hover:text-blue-800 transition-colors"
            >
              {isRegister ? 'Volver al Inicio de Sesión' : 'Solicitar Registro de Abogada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
