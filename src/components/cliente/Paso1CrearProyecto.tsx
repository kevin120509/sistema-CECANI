'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { crearExpedienteCompleto, actualizarExpedienteCompleto } from '@/actions/expediente';
import type { CatalogoFigura, PlanPagos, Expediente, Perfil, Contrato, TipoTramite } from '@/types/database';
import { SERVICIOS_PRINCIPALES, SERVICIOS_EXTRAS, PLANES_PAGO_LABELS, PRECIOS_POR_PLAN } from '@/lib/constants';
import { validateRFC, validateCURP } from '@/lib/validations';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, MapPin, Building2, Scale, CreditCard, 
  ArrowRight, CheckCircle2, Loader2, Calculator, 
  FileText, Briefcase, AlertCircle, Sparkles, Users, ChevronLeft
} from 'lucide-react';

interface Paso1Props {
  figuras: CatalogoFigura[];
  userId: string;
  expediente?: Expediente | null;
  perfil?: Perfil | null;
  contrato?: Contrato | null;
  onComplete: () => Promise<void>;
}

/**
 * Componente: Paso1CrearProyecto
 * Habilidades Aplicadas: 
 * - next-best-practices (React 19)
 * - frontend-design (Luxury Premium Aesthetic)
 * - tailwind-css-patterns (Shadows & Fluid Layout)
 */
export default function Paso1CrearProyecto({
  figuras,
  userId,
  expediente,
  perfil,
  contrato,
  onComplete,
}: Paso1Props) {
  // --- Estados Locales ---
  const [subStep, setSubStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // --- Form State ---
  const [formData, setFormData] = useState({
    nombreCompleto: perfil?.nombre_completo || '',
    telefono: perfil?.telefono || '',
    estado: perfil?.estado || '',
    rfc: perfil?.rfc || '',
    curp: perfil?.curp || '',
    ocupacion: perfil?.ocupacion || '',
    estadoCivil: perfil?.estado_civil || '',
    domicilioCompleto: perfil?.domicilio_completo || '',
    nombreEmpresa: expediente?.nombre_empresa || '',
    figuraId: expediente?.figura_id || ('' as number | ''),
    planPagos: contrato?.plan_pagos || ('' as PlanPagos | ''),
    servicioBaseId: contrato?.servicio_base || '',
    extrasSeleccionados: contrato?.modulos_extra || ([] as string[]),
    observacionesPago: (contrato as any)?.observaciones_pago || '',
  });

  // --- Lógica de Trámite ---
  const [tipoServicio, setTipoServicio] = useState<'legal' | 'contabilidad'>(
    (contrato as any)?.tipo_contrato === 'contabilidad' ? 'contabilidad' : 'legal'
  );

  const [tieneActa, setTieneActa] = useState<boolean | null>(
    expediente?.tipo_tramite ? (expediente.tipo_tramite !== 'CONSTITUCION') : null
  );
  const [necesitaRenovar, setNecesitaRenovar] = useState<boolean | null>(
    expediente?.tipo_tramite === 'RECUPERACION' ? true : 
    expediente?.tipo_tramite === 'EXTRAORDINARIA' ? false : null
  );

  const tipoTramite = useMemo((): TipoTramite | undefined => {
    if (tipoServicio === 'contabilidad') return undefined;
    if (tieneActa === false) return 'CONSTITUCION';
    if (tieneActa === true && necesitaRenovar === true) return 'RECUPERACION';
    if (tieneActa === true && necesitaRenovar === false) return 'EXTRAORDINARIA';
    return undefined;
  }, [tieneActa, necesitaRenovar, tipoServicio]);

  useEffect(() => {
    let baseId = '';
    if (tipoServicio === 'contabilidad') {
      baseId = 'contabilidad';
    } else if (tipoTramite === 'CONSTITUCION') {
      baseId = 'constitucion';
    } else if (tipoTramite === 'RECUPERACION') {
      baseId = 'recuperacion';
    } else if (tipoTramite === 'EXTRAORDINARIA') {
      baseId = 'acta_extra';
    }

    if (baseId && baseId !== formData.servicioBaseId) {
      setFormData(prev => ({ ...prev, servicioBaseId: baseId }));
    }
  }, [tipoTramite, tipoServicio]);

  // --- Calculadora ---
  const presupuestoTotal = useMemo(() => {
    const { planPagos, extrasSeleccionados, servicioBaseId } = formData;

    // Matriz de Precios CECANI 2026
    const PRECIOS_BASE: Record<string, number> = {
      'constitucion': 65000,
      'acta_extra': 65000,
      'recuperacion': 35000,
      'contabilidad': 15000
    };

    // Matriz de Planes para Paquetes Completos ($65k -> $76k/78k)
    const MATRIZ_PLANES: Record<string, number> = {
      'unico': 65000,
      '3_msi': 65000,
      '6_msi': 65000,
      '12_msi': 76000,
      '18_msi': 78000,
      '2_pagos': 71000,
      '4_pagos': 82500
    };

    let total = 0;
    const esPaqueteLegal65 = servicioBaseId === 'constitucion' || servicioBaseId === 'acta_extra';

    // 1. Determinar Base
    if (esPaqueteLegal65 && planPagos && MATRIZ_PLANES[planPagos]) {
      total = MATRIZ_PLANES[planPagos];
    } else {
      total = PRECIOS_BASE[servicioBaseId] || 0;
      // Recargo del 15% si no es de contado en servicios fuera de matriz
      if (planPagos && planPagos !== 'unico' && total > 0 && !esPaqueteLegal65) {
        total = total * 1.15;
      }
    }

    // 2. Sumar Extras (Precios Especiales en Paquete)
    extrasSeleccionados.forEach(extraId => {
      const extra = Object.values(SERVICIOS_EXTRAS).find(e => e.id === extraId);
      if (!extra) return;

      // Aplicar precios de paquete si es constitución o acta
      if (esPaqueteLegal65) {
        if (extraId === 'cluni') total += 10000;
        else if (extraId === 'web') total += 5000;
        else total += extra.precio;
      } else {
        total += extra.precio;
      }
    });

    return Math.round(total);
  }, [formData.planPagos, formData.extrasSeleccionados, formData.servicioBaseId]);

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = (step: number) => {
    setLocalError(null);
    const f = formData;
    if (step === 1) {
      // Validaciones eliminadas a petición del usuario para permitir mayor flexibilidad
      return true;
    } else if (step === 2) {
      if (!f.nombreEmpresa.trim() || !f.figuraId || !f.planPagos) {
        setLocalError('La configuración de la empresa y el plan de pagos son requeridos.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate(3)) return;

    startTransition(async () => {
      const dataPersonales = {
        nombre_completo: formData.nombreCompleto,
        telefono: formData.telefono,
        estado: formData.estado,
        rfc: formData.rfc,
        curp: formData.curp,
        ocupacion: formData.ocupacion,
        estado_civil: formData.estadoCivil,
        domicilio_completo: formData.domicilioCompleto,
      };

      const serviciosExtraMapped = formData.extrasSeleccionados.map(id => {
        if (id === 'web') return 'WEB';
        if (id === 'cluni') return 'CLUNI';
        return id.toUpperCase();
      });

      const payload = {
        nombre_empresa: formData.nombreEmpresa,
        figura_id: formData.figuraId as number,
        plan_pagos: formData.planPagos as PlanPagos,
        servicio_base: formData.servicioBaseId,
        modulos_extra: formData.extrasSeleccionados,
        monto_total: presupuestoTotal,
        tipo_tramite: tipoTramite,
        servicios_extra: serviciosExtraMapped,
        tipo_contrato: tipoServicio,
        observaciones_pago: formData.observacionesPago,
      };

      const result = expediente?.id 
        ? await actualizarExpedienteCompleto(userId, expediente.id, dataPersonales, payload)
        : await crearExpedienteCompleto(dataPersonales, payload);

      if (result.success) {
        if (!expediente?.id && result.data?.user_id) {
          localStorage.setItem('cecani_cliente_id', result.data.user_id);
          window.dispatchEvent(new Event('storage'));
        }
        setIsSuccess(true);
        setTimeout(onComplete, 1500);
      } else {
        setLocalError(result.error || 'Ocurrió un error al procesar la solicitud.');
      }
    });
  };

  // --- Framer Motion Variants ---
  const containerVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.4 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (isSuccess) return <SuccessView isUpdate={!!expediente?.id} />;

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[1600px] mx-auto py-4">
      {/* Sidebar: Sub-pasos dinámicos */}
      <aside className="lg:w-[320px] shrink-0">
        <div className="sticky top-28 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl overflow-hidden border border-white/5 group">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="p-2 bg-sky-500/20 rounded-lg">
                <Sparkles className="text-sky-400" size={18} />
              </div>
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-sky-400">Paso 1: Perfil Legal</h2>
            </div>
            
            <nav className="space-y-12">
              {['Identidad', 'Estructura', 'Servicios'].map((label, idx) => {
                const stepNum = idx + 1;
                const active = subStep === stepNum;
                const done = subStep > stepNum;
                return (
                  <div key={label} className="relative flex items-center gap-6 group cursor-default">
                    {idx < 2 && (
                      <div className={`absolute left-5 top-10 w-0.5 h-12 transition-all duration-700 ${done ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                    )}
                    <div className={`
                      w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500 z-10
                      ${active ? 'bg-sky-500 text-white shadow-[0_0_25px_rgba(14,165,233,0.4)] scale-110 -rotate-3' : 
                        done ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-slate-600 border border-white/5'}
                    `}>
                      {done ? '✓' : stepNum}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
                      {active && (
                        <motion.div layoutId="substep-indicator" className="h-0.5 bg-sky-500 mt-2 w-8 rounded-full" />
                      )}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
          {/* Decorative gradients */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sky-500/10 rounded-full blur-[100px] group-hover:bg-sky-500/20 transition-all duration-1000" />
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[80px]" />
        </div>
      </aside>

      {/* Main Form Area */}
      <main className="flex-1 min-w-0">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[3.5rem] p-8 md:p-14 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] border border-slate-100/50 relative overflow-hidden"
        >
          {/* Error Message */}
          <AnimatePresence>
            {localError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-900 shadow-sm"
              >
                <div className="p-2 bg-red-100 rounded-xl"><AlertCircle size={20} /></div>
                <p className="text-xs font-bold uppercase tracking-tight leading-relaxed">{localError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Content */}
          <div className="min-h-[500px]">
            <AnimatePresence mode="wait">
              {subStep === 1 && (
                <StepContent key="identidad" title="Identidad del Titular" icon={<User size={30} />} variants={itemVariants}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                    <InputCol span={2} label="Nombre Completo (INE) *" name="nombreCompleto" value={formData.nombreCompleto} onChange={handleInputChange} icon={<User size={18} />} placeholder="Ej. Alejandra García López" />
                    <InputCol label="Teléfono (WhatsApp) *" name="telefono" value={formData.telefono} onChange={handleInputChange} icon={<Phone size={18} />} placeholder="55 1234 5678" />
                    <InputCol label="RFC *" name="rfc" value={formData.rfc} onChange={handleInputChange} icon={<FileText size={18} />} placeholder="GALA900101XXX" />
                    <InputCol label="CURP *" name="curp" value={formData.curp} onChange={handleInputChange} icon={<FileText size={18} />} placeholder="18 Caracteres..." />
                    <InputCol label="Estado Civil *" name="estadoCivil" value={formData.estadoCivil} onChange={handleInputChange} icon={<Users size={18} />} placeholder="Ej. Soltero(a)" />
                    <InputCol span={2} label="Domicilio Legal Completo *" name="domicilioCompleto" value={formData.domicilioCompleto} onChange={handleInputChange} icon={<MapPin size={18} />} isTextArea placeholder="Calle, Número, Colonia, CP, Ciudad, Estado" />
                  </div>
                </StepContent>
              )}

              {subStep === 2 && (
                <StepContent key="organizacion" title="Estructura del Proyecto" icon={<Building2 size={30} />} variants={itemVariants}>
                  <div className="space-y-12">
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tipo de Servicio Requerido</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ToggleButton active={tipoServicio === 'legal'} onClick={() => setTipoServicio('legal')}>Trámite Legal (Constitución)</ToggleButton>
                        <ToggleButton active={tipoServicio === 'contabilidad'} onClick={() => setTipoServicio('contabilidad')}>Servicios Contables</ToggleButton>
                      </div>
                    </div>

                    <InputCol label="Nombre de la Asociación o Empresa *" name="nombreEmpresa" value={formData.nombreEmpresa} onChange={handleInputChange} icon={<Building2 size={18} />} placeholder="Ej. Transformando Vidas A.C." />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <SelectCol 
                        label="Figura Jurídica *" 
                        name="figuraId" 
                        value={formData.figuraId} 
                        onChange={handleInputChange} 
                        icon={<Scale size={18} />} 
                        options={figuras.map(f => ({ value: f.id, label: `${f.siglas} — ${f.descripcion}` }))} 
                      />
                      <SelectCol 
                        label="Plan de Liquidación *" 
                        name="planPagos" 
                        value={formData.planPagos} 
                        onChange={handleInputChange} 
                        icon={<CreditCard size={18} />} 
                        options={Object.keys(PLANES_PAGO_LABELS).map(key => ({ 
                          value: key, 
                          label: (PLANES_PAGO_LABELS as any)[key] 
                        }))} 
                      />
                    </div>
                  </div>
                </StepContent>
              )}

              {subStep === 3 && (
                <StepContent key="resumen" title="Configuración de Servicios" icon={<Calculator size={30} />} variants={itemVariants}>
                  <div className="space-y-10">
                    {/* Tarjeta de Resumen Financiero */}
                    <div className="bg-slate-950 p-10 md:p-14 rounded-[3.5rem] text-white relative overflow-hidden shadow-[0_30px_60px_-15px_rgba(15,23,42,0.5)]">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 border-b border-white/10 pb-12">
                        <div className="text-center md:text-left">
                          <h4 className="text-[10px] font-black tracking-[0.4em] uppercase text-sky-400 mb-3">Total Inversión Proyectada</h4>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Conceptos de gestoría, impuestos y notaría</p>
                        </div>
                        <div className="text-6xl md:text-7xl font-black text-sky-400 tracking-tighter flex items-baseline gap-2 tabular-nums">
                          <span className="text-2xl font-light opacity-30">$</span>
                          {presupuestoTotal.toLocaleString()}
                          <span className="text-sm font-bold opacity-20 tracking-widest">MXN</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Estado de la Organización</p>
                          <div className="grid grid-cols-2 gap-4">
                            <ToggleButton active={tieneActa === true} onClick={() => setTieneActa(true)}>Acta Existente</ToggleButton>
                            <ToggleButton active={tieneActa === false} onClick={() => { setTieneActa(false); setNecesitaRenovar(null); }}>Nueva Constitución</ToggleButton>
                          </div>
                        </div>

                        {tieneActa !== null && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Alcance del Trámite</p>
                            <div className="flex flex-col gap-3">
                              {tieneActa === false ? (
                                <OptionButton active={true} onClick={() => {}}>Constitución desde Cero</OptionButton>
                              ) : (
                                <>
                                  <OptionButton active={necesitaRenovar === false} onClick={() => setNecesitaRenovar(false)}>Modificación de Estatutos</OptionButton>
                                  <OptionButton active={necesitaRenovar === true} onClick={() => setNecesitaRenovar(true)}>Recuperación de Vigencia</OptionButton>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* SERVICIOS EXTRAS (Restaurados) */}
                      <div className="mt-12 space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Módulos Especializados (Opcionales)</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.values(SERVICIOS_EXTRAS).map(extra => (
                            <button
                              key={extra.id}
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const list = prev.extrasSeleccionados.includes(extra.id)
                                    ? prev.extrasSeleccionados.filter(id => id !== extra.id)
                                    : [...prev.extrasSeleccionados, extra.id];
                                  return { ...prev, extrasSeleccionados: list };
                                });
                              }}
                              className={`
                                p-6 rounded-[2rem] border-2 text-left transition-all duration-300 flex flex-col justify-between min-h-[140px]
                                ${formData.extrasSeleccionados.includes(extra.id) 
                                  ? 'bg-sky-500 border-sky-400 text-white shadow-xl shadow-sky-500/20' 
                                  : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:bg-white/10'}
                              `}
                            >
                              <div>
                                <h5 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${formData.extrasSeleccionados.includes(extra.id) ? 'text-white' : 'text-slate-300'}`}>
                                  {extra.nombre}
                                </h5>
                                <p className={`text-[9px] font-medium leading-relaxed opacity-60 uppercase`}>
                                  {extra.descripcion}
                                </p>
                              </div>
                              <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs font-black tabular-nums">
                                  {extra.precio === 0 ? 'Cotizar' : `+$${extra.precio.toLocaleString()}`}
                                </span>
                                {formData.extrasSeleccionados.includes(extra.id) && <CheckCircle2 size={14} />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </StepContent>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <footer className="mt-16 pt-10 border-t border-slate-100 flex items-center justify-between">
            <button 
              onClick={() => { setSubStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              disabled={subStep === 1 || isPending} 
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${subStep === 1 ? 'opacity-0' : 'text-slate-400 hover:text-slate-900 hover:-translate-x-1'}`}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            
            <div className="flex items-center gap-6">
              {subStep < 3 ? (
                <button 
                  onClick={() => { if(validate(subStep)) { setSubStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} 
                  className="bg-slate-950 text-white px-12 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-sky-600 transition-all duration-500 shadow-2xl shadow-slate-200 flex items-center gap-4 group"
                >
                  Continuar <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button 
                  onClick={handleSubmit} 
                  disabled={isPending} 
                  className="bg-sky-600 text-white px-14 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-sky-700 transition-all duration-500 shadow-2xl shadow-sky-200 flex items-center gap-4 disabled:opacity-50 group"
                >
                  {isPending ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />}
                  {isPending ? 'Procesando Datos' : 'Finalizar Registro'}
                </button>
              )}
            </div>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}

// --- Componentes UI Refinados ---

function StepContent({ title, icon, children, variants }: any) {
  return (
    <motion.section variants={variants} className="space-y-12">
      <header className="flex items-center gap-8 mb-16">
        <div className="w-20 h-20 bg-slate-50 text-sky-600 rounded-[2.5rem] flex items-center justify-center shadow-inner border border-slate-100">
          {icon}
        </div>
        <div>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{title}</h3>
          <div className="flex items-center gap-2 mt-4">
            <div className="h-1.5 w-12 bg-sky-500 rounded-full" />
            <div className="h-1.5 w-4 bg-sky-200 rounded-full" />
            <div className="h-1.5 w-4 bg-sky-100 rounded-full" />
          </div>
        </div>
      </header>
      {children}
    </motion.section>
  );
}

function InputCol({ label, icon, span = 1, isTextArea = false, ...props }: any) {
  const Component = isTextArea ? 'textarea' : 'input';
  return (
    <div className={span === 2 ? 'md:col-span-2' : ''}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      <div className="relative group">
        <div className="absolute left-6 top-[22px] text-slate-300 group-focus-within:text-sky-500 transition-all duration-300 group-focus-within:scale-110">{icon}</div>
        <Component 
          {...props} 
          className={`
            w-full bg-slate-50/50 border-2 border-slate-100/50 focus:border-sky-500 focus:bg-white focus:shadow-[0_10px_30px_rgba(14,165,233,0.05)]
            rounded-3xl py-5 pl-16 pr-8 text-sm font-bold text-slate-800 outline-none transition-all duration-300 
            placeholder:text-slate-300 placeholder:font-normal
            ${isTextArea ? 'min-h-[140px] pt-5' : ''}
          `} 
        />
      </div>
    </div>
  );
}

function SelectCol({ label, icon, options, ...props }: any) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      <div className="relative group">
        <div className="absolute left-6 top-[22px] text-slate-300 group-focus-within:text-sky-500 transition-all duration-300 z-10">{icon}</div>
        <select 
          {...props} 
          className="w-full bg-slate-50/50 border-2 border-slate-100/50 focus:border-sky-500 focus:bg-white rounded-3xl py-5 pl-16 pr-12 text-sm font-bold text-slate-800 outline-none transition-all duration-300 appearance-none relative cursor-pointer"
        >
          <option value="">Seleccionar opción...</option>
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ active, children, onClick }: any) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`
        py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500
        ${active ? 'bg-sky-500 text-white shadow-xl shadow-sky-500/40 scale-105' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10 hover:text-slate-300'}
      `}
    >
      {children}
    </button>
  );
}

function OptionButton({ active, children, onClick }: any) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`
        w-full py-5 px-8 rounded-2xl text-[10px] text-left font-black uppercase tracking-[0.1em] transition-all duration-300 border
        ${active ? 'bg-sky-500 border-sky-400 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-500 hover:border-white/20 hover:text-slate-400'}
      `}
    >
      {children}
    </button>
  );
}

function SuccessView({ isUpdate }: { isUpdate: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, rotateX: 20 }} 
      animate={{ opacity: 1, scale: 1, rotateX: 0 }} 
      className="max-w-2xl mx-auto bg-white rounded-[4rem] p-16 text-center shadow-[0_50px_100px_rgba(0,0,0,0.1)] border border-slate-100"
    >
      <div className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
        <CheckCircle2 size={56} />
      </div>
      <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-6 leading-tight">
        {isUpdate ? 'Expediente Actualizado' : 'Misión Cumplida'}
      </h2>
      <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-md mx-auto">
        Tus datos han sido integrados con éxito. Estamos orquestando la siguiente fase de tu estructura legal.
      </p>
      <div className="mt-12 flex items-center justify-center gap-4 text-sky-500 font-black text-[11px] uppercase tracking-[0.3em]">
        <Loader2 className="animate-spin" size={24} />
        <span>Sincronizando portal...</span>
      </div>
    </motion.div>
  );
}
