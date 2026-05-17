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
    <div className="min-h-screen flex flex-col selection:bg-sky-500/30">
      {/* Header Premium - Luxury Refined */}
      <header className="sticky top-0 z-50 bg-white/60 backdrop-blur-2xl border-b border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="w-full px-6 md:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-default">
            <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_20px_rgba(0,0,0,0.2)] group-hover:scale-105 transition-transform duration-500">
              <span className="font-black text-2xl tracking-tighter">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                CECANI
              </h1>
              <p className="text-[9px] uppercase tracking-[0.4em] text-sky-600 font-black mt-1.5 opacity-80">
                CLIENT CONSOLE
              </p>
            </div>
          </div>
          
          {perfil && (
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-4 bg-white/40 border border-slate-200/60 px-5 py-2.5 rounded-2xl shadow-sm">
                <div className="relative">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                  {perfil.nombre_completo}
                </span>
              </div>
              <button 
                onClick={() => {
                  if (confirm('¿Deseas finalizar la sesión actual?')) {
                    localStorage.removeItem('cecani_cliente_id');
                    window.location.reload();
                  }
                }}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300 border border-transparent hover:border-red-100 group"
                title="Cerrar sesión"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Stepper Moderno - Visual Flow */}
      <div className="w-full px-6 md:px-12 py-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between relative px-4 md:px-10">
            {/* Línea de fondo con gradiente */}
            <div className="absolute top-1/2 left-0 w-full h-[3px] bg-slate-100 -translate-y-1/2 z-0 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500"
                initial={{ width: '0%' }}
                animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            
            {steps.map(({ step, label, icon: Icon }) => {
              const isCompleted = step < currentStep;
              const isActive = step === currentStep;
              
              return (
                <div key={step} className="relative z-10 flex flex-col items-center group">
                  <motion.div 
                    initial={false}
                    animate={{ 
                      scale: isActive ? 1.15 : 1,
                      backgroundColor: isActive ? '#0ea5e9' : isCompleted ? '#10b981' : '#ffffff'
                    }}
                    className={`
                      w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border-4
                      ${isActive ? 'text-white border-sky-100 shadow-[0_15px_30px_rgba(14,165,233,0.3)]' : 
                        isCompleted ? 'text-white border-emerald-50 shadow-[0_10px_20px_rgba(16,185,129,0.2)]' : 
                        'text-slate-300 border-slate-50 shadow-sm'}
                    `}
                  >
                    {isCompleted ? <CheckCircle2 size={26} strokeWidth={3} /> : <Icon size={26} strokeWidth={isActive ? 3 : 2} />}
                  </motion.div>
                  <div className="absolute -bottom-10 whitespace-nowrap text-center">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'text-sky-600 scale-105' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="active-dot" className="w-1.5 h-1.5 bg-sky-500 rounded-full mx-auto mt-2 shadow-[0_0_10px_rgba(14,165,233,0.8)]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content - Fluid Transitions */}
      <main className="flex-1 w-full px-6 md:px-12 py-8 mt-6 mb-12">
        <div className="max-w-[1600px] mx-auto h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              {currentStep > 1 && currentStep <= hookStep && (
                <button
                  onClick={handleBack}
                  className="mb-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-translate-x-1 transition-all">
                    <ChevronLeft size={18} />
                  </div>
                  Regresar
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
