'use client';

import { useState, useEffect } from 'react';
import { useExpediente } from '@/hooks/useExpediente';
import Paso1CrearProyecto from '@/components/cliente/Paso1CrearProyecto';
import Paso2Documentacion from '@/components/cliente/Paso2Documentacion';
import Paso3Contrato from '@/components/cliente/Paso3Contrato';
import Paso4SoloLectura from '@/components/cliente/Paso4SoloLectura';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircle, 
  FileText, 
  ClipboardCheck, 
  Search, 
  ChevronLeft, 
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function HomePage() {
  const {
    currentStep: hookStep,
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

  const [activeStep, setActiveStep] = useState<number | null>(null);

  const currentStep = activeStep !== null ? activeStep : hookStep;

  const handleBack = () => {
    if (currentStep > 1) {
      setActiveStep(currentStep - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Cargando tu expediente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Ha ocurrido un error</h2>
          <p className="text-slate-600 mb-8">{error}</p>
          <button onClick={refetch} className="btn-primary w-full">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { step: 1, label: 'Registro', icon: UserCircle },
    { step: 2, label: 'Documentación', icon: FileText },
    { step: 3, label: 'Contrato', icon: ClipboardCheck },
    { step: 4, label: 'Revisión', icon: Search },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Premium */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="w-full px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <span className="font-bold text-xl">C</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                CECANI
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                Portal del Cliente
              </p>
            </div>
          </div>
          
          {perfil && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700">
                  {perfil.nombre_completo}
                </span>
              </div>
              <button 
                onClick={() => {
                  if (confirm('¿Estás seguro de que deseas cerrar sesión? Tendrás que iniciar un nuevo trámite si no has guardado.')) {
                    localStorage.removeItem('cecani_cliente_id');
                    window.location.reload();
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors group"
                title="Cerrar sesión / Nuevo trámite"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Stepper Moderno */}
      <div className="w-full px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between relative">
            {/* Línea de fondo */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
            
            {steps.map(({ step, label, icon: Icon }) => {
              const isCompleted = step < currentStep;
              const isActive = step === currentStep;
              
              return (
                <div key={step} className="relative z-10 flex flex-col items-center group">
                  <div 
                    className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                      ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-110' : 
                        isCompleted ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 
                        'bg-white text-slate-400 border-2 border-slate-200 group-hover:border-slate-300'}
                    `}
                  >
                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                  </div>
                  <div className="absolute -bottom-8 whitespace-nowrap">
                    <span className={`text-xs font-bold uppercase tracking-tight transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <main className="flex-1 w-full px-6 md:px-12 py-12 mt-4">
        <div className="max-w-6xl mx-auto h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {currentStep > 1 && currentStep <= hookStep && (
                <button
                  onClick={handleBack}
                  className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors group"
                >
                  <div className="p-1.5 rounded-lg bg-white border border-slate-200 group-hover:border-slate-300 shadow-sm">
                    <ChevronLeft size={16} />
                  </div>
                  Volver al paso anterior
                </button>
              )}

              <div className="w-full">
                {currentStep === 1 && userId && (
                  <Paso1CrearProyecto
                    figuras={figuras}
                    userId={userId}
                    expediente={expediente}
                    perfil={perfil}
                    contrato={contrato}
                    onComplete={() => {
                      setActiveStep(null);
                      return refetch();
                    }}
                  />
                )}

                {currentStep === 2 && expediente && userId && (
                  <Paso2Documentacion
                    expediente={expediente}
                    onComplete={async () => {
                      setActiveStep(null);
                      await refetch();
                    }}
                  />
                )}

                {currentStep === 3 && expediente && contrato && userId && (
                  <Paso3Contrato
                    expediente={expediente}
                    contrato={contrato}
                    onComplete={async () => {
                      setActiveStep(null);
                      await refetch();
                    }}
                  />
                )}

                {currentStep === 4 && expediente && (
                  <Paso4SoloLectura
                    expediente={expediente}
                    contrato={contrato}
                    documentos={documentos}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Sutil */}
      <footer className="py-6 px-6 text-center text-slate-400 text-[10px] uppercase tracking-widest border-t border-slate-100">
        &copy; {new Date().getFullYear()} CECANI &bull; Todos los derechos reservados
      </footer>
    </div>
  );
}
