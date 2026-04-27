'use client';

import { useState } from 'react';
import { crearExpedienteCompleto } from '@/actions/expediente';
import type { CatalogoFigura, PlanPagos } from '@/types/database';

interface Paso1Props {
  figuras: CatalogoFigura[];
  userId: string;
  onComplete: () => Promise<void>;
}

export default function Paso1CrearProyecto({
  figuras,
  userId,
  onComplete,
}: Paso1Props) {
  // Datos personales del cliente
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState('');

  // Datos de la empresa
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [figuraId, setFiguraId] = useState<number | ''>('');
  const [planPagos, setPlanPagos] = useState<PlanPagos | ''>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombreCompleto.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }
    if (!nombreEmpresa.trim()) {
      setError('El nombre de la empresa es requerido.');
      return;
    }
    if (!figuraId) {
      setError('Selecciona un tipo de figura legal.');
      return;
    }
    if (!planPagos) {
      setError('Selecciona un plan de pagos.');
      return;
    }

    setIsLoading(true);

    try {
      setIsLoading(true);

      const dataPersonales = {
        nombre_completo: nombreCompleto,
        telefono,
        estado,
      };

      const formData = {
        nombre_empresa: nombreEmpresa,
        figura_id: figuraId as number,
        plan_pagos: planPagos as PlanPagos,
      };

      const result = await crearExpedienteCompleto(dataPersonales, formData);

      if (result.success) {
        if (result.data?.user_id) {
          // 1. Guardar el ID definitivo
          localStorage.setItem('cecani_cliente_id', result.data.user_id);
          
          // 2. Disparar evento para que useExpediente se entere
          window.dispatchEvent(new Event('storage'));
        }
        
        setIsSuccess(true);
        
        // 3. Pequeña pausa para mostrar el check verde y luego avanzar
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError(result.error || 'Error al registrar el expediente.');
      }
    } catch (err) {
      setError('Error inesperado de red.');
    } finally {
      setIsLoading(false);
    }
  };

  // supress unused var warning - userId is passed as prop but we generate the real one server-side
  void userId;

  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow-sm border p-12 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Expediente Creado con Éxito!</h2>
        <p className="text-gray-600">Tus datos han sido guardados correctamente.</p>
        <p className="text-gray-500 text-sm mt-4">Redirigiendo al siguiente paso...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Registro de Expediente
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Completa tus datos personales y los de tu empresa para iniciar el
          trámite.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ===== Datos Personales ===== */}
          <fieldset className="border border-gray-200 rounded-md p-4">
            <legend className="text-sm font-semibold text-gray-600 px-2">
              👤 Datos Personales
            </legend>
            <div className="space-y-3 mt-2">
              <div>
                <label
                  htmlFor="nombre_completo"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nombre completo *
                </label>
                <input
                  id="nombre_completo"
                  type="text"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  placeholder="Juan Pérez López"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  maxLength={150}
                />
              </div>

              <div>
                <label
                  htmlFor="telefono"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Teléfono
                </label>
                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="55 1234 5678"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  maxLength={20}
                />
              </div>

              <div>
                <label
                  htmlFor="estado"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Estado (entidad federativa)
                </label>
                <input
                  id="estado"
                  type="text"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="Ciudad de México"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  maxLength={100}
                />
              </div>
            </div>
          </fieldset>

          {/* ===== Datos de la Empresa ===== */}
          <fieldset className="border border-gray-200 rounded-md p-4">
            <legend className="text-sm font-semibold text-gray-600 px-2">
              🏢 Datos de la Empresa
            </legend>
            <div className="space-y-3 mt-2">
              <div>
                <label
                  htmlFor="nombre_empresa"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nombre de la Empresa *
                </label>
                <input
                  id="nombre_empresa"
                  type="text"
                  value={nombreEmpresa}
                  onChange={(e) => setNombreEmpresa(e.target.value)}
                  placeholder="Ej: Mi Empresa S.A. de C.V."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  maxLength={200}
                />
              </div>

              <div>
                <label
                  htmlFor="figura_id"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tipo de Figura Legal *
                </label>
                <select
                  id="figura_id"
                  value={figuraId}
                  onChange={(e) =>
                    setFiguraId(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                >
                  <option value="">Selecciona una figura legal...</option>
                  {figuras.map((fig) => (
                    <option key={fig.id} value={fig.id}>
                      {fig.siglas} — {fig.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plan_pagos"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Plan de Pagos *
                </label>
                <select
                  id="plan_pagos"
                  value={planPagos}
                  onChange={(e) =>
                    setPlanPagos(e.target.value as PlanPagos | '')
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                >
                  <option value="">Selecciona un plan...</option>
                  <option value="unico">Pago Único</option>
                  <option value="2_meses">2 Meses</option>
                  <option value="4_meses">4 Meses</option>
                </select>
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Creando expediente...' : 'Registrar Expediente'}
          </button>
        </form>
      </div>
    </div>
  );
}
