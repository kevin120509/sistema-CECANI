'use client';

import { useState, useEffect } from 'react';
import { useExpediente } from '@/hooks/useExpediente';
import Paso1CrearProyecto from '@/components/cliente/Paso1CrearProyecto';
import Paso2Documentacion from '@/components/cliente/Paso2Documentacion';
import PasoCorreccionDocs from '@/components/cliente/PasoCorreccionDocs';
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
  AlertCircle,
  Loader2
} from 'lucide-react';

import DashboardLayout from '@/components/layout/DashboardLayout';

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
    hasDocumentosRechazados,
    refetch,
  } = useExpediente();

  const [activeStep, setActiveStep] = useState<number | null>(null);

  const currentStep = activeStep !== null ? activeStep : hookStep;

  const handleBack = () => {
    if (currentStep > 1) {
      setActiveStep(currentStep - 1);
    }
  };

  const steps = [
    { step: 1, label: 'Perfil Legal', icon: UserCircle },
    { step: 2, label: 'Documentación', icon: FileText },
    { step: 3, label: 'Contrato y Pago', icon: ClipboardCheck },
    { step: 4, label: 'Finalizado', icon: Search },
  ];

  const sidebarItems = steps.map(s => ({
    label: s.label,
    icon: s.icon,
    active: currentStep === s.step,
    onClick: () => {
      if (s.step <= hookStep) setActiveStep(s.step);
    }
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Sincronizando Expediente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card-base p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error de Conexión</h2>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed">{error}</p>
          <button onClick={refetch} className="btn-primary w-full">
            Reintentar Acceso
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Gestión de Trámite Legal"
      sidebarItems={sidebarItems}
      userProfile={perfil ? { name: perfil.nombre_completo, role: 'Cliente Titular' } : undefined}
      onLogout={() => {
        if (confirm('¿Deseas cerrar tu sesión?')) {
          localStorage.removeItem('cecani_cliente_id');
          window.location.reload();
        }
      }}
    >
      <div className="space-y-8">
        {/* Progress Bar (Stepper simplificado) */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Progreso del Expediente</h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Paso {currentStep} de 4</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-600"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / 4) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep > 1 && currentStep <= hookStep && (
              <button
                onClick={handleBack}
                className="mb-6 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors group"
              >
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Regresar al paso anterior
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
                hasDocumentosRechazados ? (
                  <PasoCorreccionDocs
                    expediente={expediente}
                    documentos={documentos}
                    onComplete={async () => {
                      setActiveStep(null);
                      await refetch();
                    }}
                  />
                ) : (
                  <Paso2Documentacion
                    expediente={expediente}
                    onComplete={async () => {
                      setActiveStep(null);
                      await refetch();
                    }}
                  />
                )
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
    </DashboardLayout>
  );
}
