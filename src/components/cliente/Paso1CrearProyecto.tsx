'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { crearExpedienteCompleto, actualizarExpedienteCompleto } from '@/actions/expediente';
import type { CatalogoFigura, PlanPagos, Expediente, Perfil, Contrato, TipoTramite } from '@/types/database';
import { PLANES_PAGO_LABELS, SERVICIOS_EXTRAS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Building2, 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ChevronLeft
} from 'lucide-react';

interface Paso1Props {
  figuras: CatalogoFigura[];
  userId: string;
  expediente?: Expediente | null;
  perfil?: Perfil | null;
  contrato?: Contrato | null;
  onComplete: () => Promise<void>;
}

export default function Paso1CrearProyecto({
  figuras,
  userId,
  expediente,
  perfil,
  contrato,
  onComplete,
}: Paso1Props) {
  const [subStep, setSubStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    nombreCompleto: perfil?.nombre_completo || '',
    telefono: perfil?.telefono || '',
    rfc: perfil?.rfc || '',
    curp: perfil?.curp || '',
    estadoCivil: perfil?.estado_civil || '',
    domicilioCompleto: perfil?.domicilio_completo || '',
    nombreEmpresa: expediente?.nombre_empresa || '',
    figuraId: expediente?.figura_id || ('' as number | ''),
    planPagos: contrato?.plan_pagos || ('' as PlanPagos | ''),
    servicioBaseId: contrato?.servicio_base || '',
    extrasSeleccionados: contrato?.modulos_extra || ([] as string[]),
    observacionesPago: (contrato as any)?.observaciones_pago || '',
  });

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
    if (tipoServicio === 'contabilidad') baseId = 'contabilidad';
    else if (tipoTramite === 'CONSTITUCION') baseId = 'constitucion';
    else if (tipoTramite === 'RECUPERACION') baseId = 'recuperacion';
    else if (tipoTramite === 'EXTRAORDINARIA') baseId = 'acta_extra';

    if (baseId && baseId !== formData.servicioBaseId) {
      setFormData(prev => ({ ...prev, servicioBaseId: baseId }));
    }
  }, [tipoTramite, tipoServicio]);

  const presupuestoTotal = useMemo(() => {
    const { planPagos, extrasSeleccionados, servicioBaseId } = formData;
    const PRECIOS_BASE: Record<string, number> = {
      'constitucion': 65000, 'acta_extra': 65000, 'recuperacion': 35000, 'contabilidad': 15000
    };
    const MATRIZ_PLANES: Record<string, number> = {
      'unico': 65000, '3_msi': 65000, '6_msi': 65000, '12_msi': 76000, '18_msi': 78000, '2_pagos': 71000, '4_pagos': 82500
    };

    let total = 0;
    const esPaqueteLegal65 = servicioBaseId === 'constitucion' || servicioBaseId === 'acta_extra';

    if (esPaqueteLegal65 && planPagos && MATRIZ_PLANES[planPagos]) {
      total = MATRIZ_PLANES[planPagos];
    } else {
      total = PRECIOS_BASE[servicioBaseId] || 0;
      if (planPagos && planPagos !== 'unico' && total > 0 && !esPaqueteLegal65) total *= 1.15;
    }

    extrasSeleccionados.forEach(extraId => {
      const extra = Object.values(SERVICIOS_EXTRAS).find(e => e.id === extraId);
      if (!extra) return;
      if (esPaqueteLegal65) {
        if (extraId === 'cluni') total += 10000;
        else if (extraId === 'web') total += 5000;
        else total += extra.precio;
      } else total += extra.precio;
    });

    return Math.round(total);
  }, [formData.planPagos, formData.extrasSeleccionados, formData.servicioBaseId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = (step: number) => {
    if (step === 2 && (!formData.nombreEmpresa || !formData.figuraId || !formData.planPagos)) {
      setLocalError('Por favor complete todos los campos obligatorios.');
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleSubmit = () => {
    if (!validate(3)) return;
    startTransition(async () => {
      const dataPersonales = {
        nombre_completo: formData.nombreCompleto,
        telefono: formData.telefono,
        rfc: formData.rfc,
        curp: formData.curp,
        estado_civil: formData.estadoCivil,
        domicilio_completo: formData.domicilioCompleto,
      };
      const payload = {
        nombre_empresa: formData.nombreEmpresa,
        figura_id: formData.figuraId as number,
        plan_pagos: formData.planPagos as PlanPagos,
        servicio_base: formData.servicioBaseId,
        modulos_extra: formData.extrasSeleccionados,
        monto_total: presupuestoTotal,
        tipo_tramite: tipoTramite,
        servicios_extra: formData.extrasSeleccionados.map(id => id.toUpperCase()),
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
        setTimeout(onComplete, 1000);
      } else setLocalError(result.error || 'Error al procesar.');
    });
  };

  if (isSuccess) return (
    <div className="card-base p-16 text-center max-w-2xl mx-auto mt-12">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Registro Exitoso</h2>
      <p className="text-slate-500 mb-8">Tus datos han sido guardados. Sincronizando con el portal legal...</p>
      <Loader2 className="animate-spin text-blue-600 mx-auto" size={24} />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {localError && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3 text-red-700 shadow-sm animate-shake">
          <AlertCircle size={20} />
          <span className="text-sm font-bold uppercase tracking-tight">{localError}</span>
        </div>
      )}

      <div className="card-base">
        <div className="card-header">
          <div className="flex items-center gap-3">
            {subStep === 1 && <User className="text-blue-600" size={20} />}
            {subStep === 2 && <Building2 className="text-blue-600" size={20} />}
            {subStep === 3 && <Calculator className="text-blue-600" size={20} />}
            <span className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">
              {subStep === 1 ? '1. Perfil del Titular' : subStep === 2 ? '2. Estructura Jurídica' : '3. Configuración de Servicios'}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-10 h-1.5 rounded-full transition-colors ${subStep >= i ? 'bg-blue-600' : 'bg-slate-100'}`} />
            ))}
          </div>
        </div>

        <div className="card-content">
          <AnimatePresence mode="wait">
            {subStep === 1 && (
              <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <InputCol span={2} label="Nombre Completo" name="nombreCompleto" value={formData.nombreCompleto} onChange={handleInputChange} placeholder="Como aparece en su identificación" />
                <InputCol label="WhatsApp" name="telefono" value={formData.telefono} onChange={handleInputChange} placeholder="10 dígitos" />
                <InputCol label="RFC" name="rfc" value={formData.rfc} onChange={handleInputChange} placeholder="ABCD900101XXX" />
                <InputCol label="CURP" name="curp" value={formData.curp} onChange={handleInputChange} placeholder="18 caracteres" />
                <InputCol label="Estado Civil" name="estadoCivil" value={formData.estadoCivil} onChange={handleInputChange} placeholder="Soltero, Casado..." />
                <InputCol span={2} label="Domicilio Fiscal" name="domicilioCompleto" value={formData.domicilioCompleto} onChange={handleInputChange} isTextArea placeholder="Dirección completa" />
              </motion.div>
            )}

            {subStep === 2 && (
              <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                  <ToggleButton active={tipoServicio === 'legal'} onClick={() => setTipoServicio('legal')}>Servicios Legales (A.C.)</ToggleButton>
                  <ToggleButton active={tipoServicio === 'contabilidad'} onClick={() => setTipoServicio('contabilidad')}>Gestión Contable</ToggleButton>
                </div>
                
                <div className="space-y-6">
                  <InputCol label="Denominación o Razón Social" name="nombreEmpresa" value={formData.nombreEmpresa} onChange={handleInputChange} placeholder="Nombre de su proyecto u organización" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SelectCol 
                      label="Figura Jurídica" 
                      name="figuraId" 
                      value={formData.figuraId} 
                      onChange={handleInputChange} 
                      options={figuras.map(f => ({ value: f.id, label: `${f.siglas} — ${f.descripcion}` }))} 
                    />
                    <SelectCol 
                      label="Plan de Liquidación" 
                      name="planPagos" 
                      value={formData.planPagos} 
                      onChange={handleInputChange} 
                      options={Object.keys(PLANES_PAGO_LABELS).map(key => ({ value: key, label: (PLANES_PAGO_LABELS as any)[key] }))} 
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {subStep === 3 && (
              <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className="bg-blue-600 rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-md text-white">
                  <div>
                    <h4 className="text-[10px] font-black tracking-widest uppercase opacity-70 mb-1">Inversión Total Estimada</h4>
                    <p className="text-xs opacity-90 uppercase font-bold tracking-tight">Incluye honorarios y trámites oficiales</p>
                  </div>
                  <div className="text-5xl font-black tabular-nums flex items-baseline gap-2">
                    <span className="text-2xl opacity-50">$</span>
                    {presupuestoTotal.toLocaleString()}
                    <span className="text-xs opacity-50 uppercase">MXN</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400 ml-1">Estatus del Acta</p>
                    <div className="flex gap-2 p-1 bg-slate-50 rounded-lg border border-slate-100">
                      <ToggleButton active={tieneActa === true} onClick={() => setTieneActa(true)}>Existente</ToggleButton>
                      <ToggleButton active={tieneActa === false} onClick={() => { setTieneActa(false); setNecesitaRenovar(null); }}>Nueva</ToggleButton>
                    </div>
                  </div>

                  {tieneActa !== null && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                      <p className="text-[10px] font-bold uppercase text-slate-400 ml-1">Modalidad de Trámite</p>
                      <div className="flex flex-col gap-2">
                        {tieneActa === false ? (
                          <div className="py-3 px-4 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase border border-blue-100 text-center tracking-widest">Constitución Integral</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <OptionButton active={necesitaRenovar === false} onClick={() => setNecesitaRenovar(false)}>Modificación Estatutos</OptionButton>
                            <OptionButton active={necesitaRenovar === true} onClick={() => setNecesitaRenovar(true)}>Recuperación Vigencia</OptionButton>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400 ml-1">Servicios Adicionales</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between h-28 ${formData.extrasSeleccionados.includes(extra.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-[10px] font-bold uppercase ${formData.extrasSeleccionados.includes(extra.id) ? 'text-blue-700' : 'text-slate-600'}`}>{extra.nombre}</span>
                          {formData.extrasSeleccionados.includes(extra.id) && <CheckCircle2 size={12} className="text-blue-600" />}
                        </div>
                        <span className="text-sm font-black text-blue-600">${extra.precio.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="card-footer bg-slate-50/50 p-6 flex justify-between border-t border-slate-100">
          <button 
            onClick={() => setSubStep(s => s - 1)} 
            disabled={subStep === 1 || isPending}
            className={`btn-secondary ${subStep === 1 ? 'invisible' : ''}`}
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          
          <button 
            onClick={() => subStep < 3 ? (validate(subStep) && setSubStep(s => s + 1)) : handleSubmit()} 
            disabled={isPending}
            className="btn-primary min-w-[160px]"
          >
            {isPending ? (
              <><Loader2 className="animate-spin" size={18} /> Procesando</>
            ) : subStep < 3 ? (
              <>Siguiente <ArrowRight size={18} /></>
            ) : (
              <>Guardar y Finalizar <CheckCircle2 size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function InputCol({ label, span = 1, isTextArea = false, ...props }: any) {
  const Component = isTextArea ? 'textarea' : 'input';
  return (
    <div className={span === 2 ? 'md:col-span-2' : ''}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{label}</label>
      <Component 
        {...props} 
        className={`input-field ${isTextArea ? 'min-h-[100px] resize-none' : ''}`} 
      />
    </div>
  );
}

function SelectCol({ label, options, ...props }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">{label}</label>
      <select {...props} className="input-field cursor-pointer">
        <option value="">Seleccione...</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ToggleButton({ active, children, onClick }: any) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase transition-all ${active ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
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
      className={`w-full py-3 px-4 rounded-lg text-[10px] text-left font-bold uppercase border transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
    >
      {children}
    </button>
  );
}
