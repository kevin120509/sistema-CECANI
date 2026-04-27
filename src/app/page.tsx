'use client';

import { useExpediente } from '@/hooks/useExpediente';
import Paso1CrearProyecto from '@/components/cliente/Paso1CrearProyecto';
import Paso2Documentacion from '@/components/cliente/Paso2Documentacion';
import Paso3Contrato from '@/components/cliente/Paso3Contrato';
import Paso4SoloLectura from '@/components/cliente/Paso4SoloLectura';

export default function HomePage() {
  const {
    currentStep,
    expediente,
    contrato,
    documentos,
    figuras,
    perfil,
    userId,
    isLoading,
    error,
    refetch,
  } = useExpediente();

  // Estado de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Error general
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-6 max-w-md text-center">
          <p className="text-red-600 font-medium mb-2">Error</p>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">CECANI</h1>
            <p className="text-xs text-gray-500">Portal del Cliente</p>
          </div>
          {perfil && (
            <span className="text-sm text-gray-600">
              {perfil.nombre_completo}
            </span>
          )}
        </div>
      </header>

      {/* Indicador de pasos */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { step: 1, label: 'Registro' },
            { step: 2, label: 'Documentación' },
            { step: 3, label: 'Contrato' },
            { step: 4, label: 'Revisión' },
          ].map(({ step, label }) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === currentStep
                      ? 'bg-blue-600 text-white'
                      : step < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? '✓' : step}
                </div>
                <span className="text-xs text-gray-500 mt-1 hidden sm:block">
                  {label}
                </span>
              </div>
              {step < 4 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-1 ${
                    step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contenido del paso actual */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        {currentStep === 1 && userId && (
          <Paso1CrearProyecto
            figuras={figuras}
            userId={userId}
            onComplete={refetch}
          />
        )}

        {currentStep === 2 && expediente && userId && (
          <Paso2Documentacion
            expediente={expediente}
            onComplete={refetch}
          />
        )}

        {currentStep === 3 && expediente && contrato && userId && (
          <Paso3Contrato
            expediente={expediente}
            contrato={contrato}
            onComplete={refetch}
          />
        )}

        {currentStep === 4 && expediente && (
          <Paso4SoloLectura
            expediente={expediente}
            contrato={contrato}
            documentos={documentos}
          />
        )}
      </main>
    </div>
  );
}
