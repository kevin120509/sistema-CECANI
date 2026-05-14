'use client';

import React, { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { guardarDocumentoExpediente } from '@/actions/r2-actions';

interface Props {
  idExpediente: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full py-2 px-4 rounded-md font-medium text-white transition-all ${
        pending 
          ? 'bg-blue-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
      }`}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Subiendo...
        </span>
      ) : (
        'Subir Documento'
      )}
    </button>
  );
}

export default function SubirDocumentoForm({ idExpediente }: Props) {
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);

  async function handleAction(formData: FormData) {
    setMensaje(null);
    const result = await guardarDocumentoExpediente(formData);

    if (result.success) {
      setMensaje({ texto: '¡Documento subido y guardado correctamente!', tipo: 'exito' });
      // Opcional: limpiar el input
      const form = document.getElementById('upload-form') as HTMLFormElement;
      form.reset();
    } else {
      setMensaje({ texto: result.error || 'Error al subir el documento', tipo: 'error' });
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 max-w-md mx-auto">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Añadir Documento al Expediente</h3>
      
      <form id="upload-form" action={handleAction} className="space-y-4">
        {/* ID del expediente (para el insert en Supabase) */}
        <input type="hidden" name="id_expediente" value={idExpediente} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Selecciona el documento (PDF o Imagen)
          </label>
          <input
            type="file"
            name="ine_cliente"
            accept=".pdf, image/*"
            required
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <SubmitButton />

        {mensaje && (
          <div className={`mt-4 p-3 rounded-md text-sm font-medium ${
            mensaje.tipo === 'exito' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {mensaje.texto}
          </div>
        )}
      </form>
    </div>
  );
}
