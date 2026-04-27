'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAbogada } from '@/actions/auth-abogada';

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}

export default function AbogadaAuth() {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (formData: FormData) => {
    setError(null);
    const res = await loginAbogada(formData);
    if (res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-6 text-center text-white">
          <h1 className="text-2xl font-bold">Portal Operativo Legal</h1>
          <p className="text-slate-400 text-sm mt-1">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <form action={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                name="email"
                required
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="abogada@cecani.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                name="password"
                required
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>
            <SubmitButton label="Iniciar Sesión" loadingLabel="Verificando..." />
          </form>
        </div>
      </div>
    </div>
  );
}
