import { useState, useMemo, useEffect } from 'react';
import { crearExpedienteCompleto, actualizarExpedienteCompleto } from '@/actions/expediente';
import type { CatalogoFigura, PlanPagos, Expediente, Perfil, Contrato, TipoTramite } from '@/types/database';
import { SERVICIOS_PRINCIPALES, SERVICIOS_EXTRAS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Phone, 
  MapPin, 
  Building2, 
  Scale, 
  CreditCard, 
  ArrowRight,
  CheckCircle2,
  Loader2,
  Calculator,
  FileText,
  Briefcase,
  Users,
  AlertCircle
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
  // Datos Personales y Legales
  const [nombreCompleto, setNombreCompleto] = useState(perfil?.nombre_completo || '');
  const [telefono, setTelefono] = useState(perfil?.telefono || '');
  const [estado, setEstado] = useState(perfil?.estado || '');
  const [rfc, setRfc] = useState(perfil?.rfc || '');
  const [curp, setCurp] = useState(perfil?.curp || '');
  const [ocupacion, setOcupacion] = useState(perfil?.ocupacion || '');
  const [estadoCivil, setEstadoCivil] = useState(perfil?.estado_civil || '');
  const [domicilioCompleto, setDomicilioCompleto] = useState(perfil?.domicilio_completo || '');

  // Datos de la Empresa
  const [nombreEmpresa, setNombreEmpresa] = useState(expediente?.nombre_empresa || '');
  const [figuraId, setFiguraId] = useState<number | ''>(expediente?.figura_id || '');
  const [planPagos, setPlanPagos] = useState<PlanPagos | ''>(contrato?.plan_pagos || '');
  
  // Estados para la Calculadora Modular
  const [servicioBaseId, setServicioBaseId] = useState<string>(contrato?.servicio_base || '');
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<string[]>(contrato?.modulos_extra || []);

  // Estados para preguntas del tipo de trámite
  const [tieneActa, setTieneActa] = useState<boolean | null>(
    expediente?.tipo_tramite ? (expediente.tipo_tramite !== 'CONSTITUCION') : null
  );
  const [necesitaRenovar, setNecesitaRenovar] = useState<boolean | null>(
    expediente?.tipo_tramite === 'RECUPERACION' ? true : 
    expediente?.tipo_tramite === 'EXTRAORDINARIA' ? false : null
  );

  let tipoTramite: TipoTramite | undefined = undefined;
  if (tieneActa === false) tipoTramite = 'CONSTITUCION';
  else if (tieneActa === true && necesitaRenovar === true) tipoTramite = 'RECUPERACION';
  else if (tieneActa === true && necesitaRenovar === false) tipoTramite = 'EXTRAORDINARIA';

  useEffect(() => {
    if (tipoTramite === 'CONSTITUCION') setServicioBaseId('constitucion');
    else if (tipoTramite === 'RECUPERACION') setServicioBaseId('recuperacion');
    else if (tipoTramite === 'EXTRAORDINARIA') setServicioBaseId('acta_extra');
    else setServicioBaseId('');
  }, [tipoTramite]);

  const [subStep, setSubStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const esPagoContado = planPagos === 'unico';

  const presupuestoTotal = useMemo(() => {
    let total = 0;
    
    // 1. Calcular Base
    const base = Object.values(SERVICIOS_PRINCIPALES).find(s => s.id === servicioBaseId);
    if (base) {
      total += esPagoContado ? base.precioEspecial : base.precioLista;
    }

    // 2. Calcular Extras con reglas lógicas
    extrasSeleccionados.forEach(extraId => {
      const extra = Object.values(SERVICIOS_EXTRAS).find(e => e.id === extraId);
      if (!extra) return;

      if (extraId === 'cluni') {
        // Regla: $10,000 si es paquete con trámite mayor, $11,600 independiente
        const esPaquete = ['constitucion', 'acta_extra'].includes(servicioBaseId);
        total += esPaquete ? 10000 : 11600;
      } else if (extraId === 'web') {
        // Regla: $4,999 + 16% IVA
        total += 4999 * 1.16;
      } else {
        total += extra.precio;
      }
    });

    return Math.round(total);
  }, [servicioBaseId, extrasSeleccionados, esPagoContado]);

  const toggleExtra = (id: string) => {
    setExtrasSeleccionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const validateSubStep = (step: number) => {
    setError(null);
    if (step === 1) {
      if (!nombreCompleto.trim()) { setError('El nombre completo es requerido.'); return false; }
      if (!telefono.trim()) { setError('El teléfono es necesario para contactarte.'); return false; }
      if (!rfc.trim()) { setError('El RFC es obligatorio para el contrato.'); return false; }
      if (!curp.trim()) { setError('La CURP es obligatoria.'); return false; }
      if (!estadoCivil.trim()) { setError('El estado civil es obligatorio para el contrato.'); return false; }
      if (!domicilioCompleto.trim()) { setError('El domicilio completo es necesario para las declaraciones.'); return false; }
    } else if (step === 2) {
      if (!nombreEmpresa.trim()) { setError('El nombre de la empresa es requerido.'); return false; }
      if (!figuraId) { setError('Selecciona un tipo de figura legal.'); return false; }
      if (!planPagos) { setError('Selecciona un plan de pagos.'); return false; }
    } else if (step === 3) {
      if (!servicioBaseId) { setError('Selecciona el servicio principal antes de finalizar.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (validateSubStep(subStep)) {
      setSubStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setSubStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSubStep(3)) return;

    setIsLoading(true);

    try {
      const dataPersonales = {
        nombre_completo: nombreCompleto,
        telefono,
        estado,
        rfc,
        curp,
        ocupacion,
        estado_civil: estadoCivil,
        domicilio_completo: domicilioCompleto,
      };

      const serviciosExtraMapped = [];
      if (extrasSeleccionados.includes('web')) serviciosExtraMapped.push('WEB');
      if (extrasSeleccionados.includes('cluni')) serviciosExtraMapped.push('CLUNI');
      if (extrasSeleccionados.includes('regularizacion')) serviciosExtraMapped.push('REGULARIZACION');
      if (extrasSeleccionados.includes('informe_anual')) serviciosExtraMapped.push('INFORME_ANUAL');
      if (extrasSeleccionados.includes('cambio_rep')) serviciosExtraMapped.push('CAMBIO_REPRESENTANTE');

      const formData = {
        nombre_empresa: nombreEmpresa,
        figura_id: figuraId as number,
        plan_pagos: planPagos as PlanPagos,
        servicio_base: servicioBaseId,
        modulos_extra: extrasSeleccionados,
        monto_total: presupuestoTotal,
        tipo_tramite: tipoTramite,
        servicios_extra: serviciosExtraMapped,
      };

      let result;
      if (expediente?.id && userId) {
        result = await actualizarExpedienteCompleto(userId, expediente.id, dataPersonales, formData);
      } else {
        result = await crearExpedienteCompleto(dataPersonales, formData);
      }

      if (result.success) {
        if (!expediente?.id && result.data?.user_id) {
          localStorage.setItem('cecani_cliente_id', result.data.user_id);
          window.dispatchEvent(new Event('storage'));
        }
        
        setIsSuccess(true);
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

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto glass-card rounded-3xl p-12 text-center"
      >
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          {expediente?.id ? '¡Expediente Actualizado!' : '¡Expediente Creado!'}
        </h2>
        <p className="text-slate-600 text-lg">Tus datos legales han sido procesados correctamente.</p>
        <div className="mt-8 flex items-center justify-center gap-2 text-blue-600 font-medium">
          <Loader2 className="animate-spin" size={20} />
          <span>Generando estructura legal...</span>
        </div>
      </motion.div>
    );
  }

  const subStepsLabels = ['Identidad', 'Organización', 'Presupuesto'];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start w-full max-w-[1600px] mx-auto">
      {/* Columna de Información / Progreso Lateral */}
      <div className="xl:col-span-3 space-y-6">
        <div className="glass-card rounded-[2.5rem] p-8 bg-slate-900 text-white overflow-hidden relative shadow-2xl border border-white/5">
          <div className="relative z-10">
            <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-sky-400">Progreso de Registro</h2>
            
            <div className="space-y-8">
              {subStepsLabels.map((label, idx) => {
                const stepNum = idx + 1;
                const isCurrent = subStep === stepNum;
                const isPast = subStep > stepNum;
                
                return (
                  <div key={label} className="flex items-center gap-4 group">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
                      ${isCurrent ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.5)] scale-110' : 
                        isPast ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}
                    `}>
                      {isPast ? '✓' : stepNum}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 pt-8 border-t border-white/5">
              <p className="text-slate-400 text-[10px] leading-relaxed italic">
                {subStep === 1 && "Ingresa tus datos personales tal cual aparecen en tu identificación oficial."}
                {subStep === 2 && "Define el nombre y la figura legal bajo la cual operará tu organización."}
                {subStep === 3 && "Personaliza los servicios adicionales y verifica tu inversión total."}
              </p>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Columna del Formulario */}
      <div className="xl:col-span-9 space-y-8">
        <div className="glass-card rounded-[3rem] p-6 md:p-12 shadow-2xl border border-slate-100 bg-white relative overflow-hidden">
          {/* Barra de progreso superior sutil */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-50">
            <motion.div 
              className="h-full bg-sky-500"
              initial={{ width: '0%' }}
              animate={{ width: `${(subStep / 3) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-2 border-red-100 text-red-700 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3 shadow-sm"
            >
              <AlertCircle size={20} className="shrink-0" />
              <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
            </motion.div>
          )}

          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {/* SUB-PASO 1: Identidad */}
              {subStep === 1 && (
                <motion.section
                  key="substep1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-4 bg-sky-50 text-sky-600 rounded-3xl shadow-sm">
                      <User size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Identidad del Representante</h3>
                      <p className="text-sm text-slate-500 font-medium">Información para declaraciones del contrato</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                      <label className="input-label">Nombre completo (Como aparece en INE) *</label>
                      <div className="relative group">
                        <User className="input-icon" size={18} />
                        <input
                          type="text"
                          value={nombreCompleto}
                          onChange={(e) => setNombreCompleto(e.target.value)}
                          placeholder="Ej. Juan Pérez López"
                          className="input-field pl-12"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Teléfono (WhatsApp) *</label>
                      <div className="relative group">
                        <Phone className="input-icon" size={18} />
                        <input
                          type="tel"
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value)}
                          placeholder="Ej. 5512345678"
                          className="input-field pl-12"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">RFC (con homoclave) *</label>
                      <div className="relative group">
                        <FileText className="input-icon" size={18} />
                        <input
                          type="text"
                          value={rfc}
                          onChange={(e) => setRfc(e.target.value.toUpperCase())}
                          placeholder="ABCD900101XXX"
                          className="input-field pl-12 uppercase"
                          maxLength={13}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">CURP *</label>
                      <div className="relative group">
                        <FileText className="input-icon" size={18} />
                        <input
                          type="text"
                          value={curp}
                          onChange={(e) => setCurp(e.target.value.toUpperCase())}
                          placeholder="ABCD900101HXXXXX00"
                          className="input-field pl-12 uppercase"
                          maxLength={18}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Ocupación / Profesión</label>
                      <div className="relative group">
                        <Briefcase className="input-icon" size={18} />
                        <input
                          type="text"
                          value={ocupacion}
                          onChange={(e) => setOcupacion(e.target.value)}
                          placeholder="Ej. Abogado, Comerciante, etc."
                          className="input-field pl-12"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label">Estado Civil * </label>
                      <div className="relative group">
                        <User className="input-icon" size={18} />
                        <input
                          type="text"
                          value={estadoCivil}
                          onChange={(e) => setEstadoCivil(e.target.value)}
                          placeholder="Ej. Soltero, Casado, Divorciado, Viudo"
                          className="input-field pl-12"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="input-label">Domicilio Completo *</label>
                      <div className="relative group">
                        <MapPin className="input-icon" size={18} />
                        <textarea
                          value={domicilioCompleto}
                          onChange={(e) => setDomicilioCompleto(e.target.value)}
                          placeholder="Calle, Núm, Col, CP, Ciudad, Estado"
                          className="input-field pl-12 pt-4 min-h-[100px]"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* SUB-PASO 2: Organización */}
              {subStep === 2 && (
                <motion.section
                  key="substep2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="flex items-center gap-4 mb-10">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl shadow-sm">
                      <Building2 size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Datos de la Organización</h3>
                      <p className="text-sm text-slate-500 font-medium">Configuración legal y financiera</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="input-label">Nombre de la Empresa / Asociación *</label>
                      <div className="relative group">
                        <Building2 className="input-icon" size={18} />
                        <input
                          type="text"
                          value={nombreEmpresa}
                          onChange={(e) => setNombreEmpresa(e.target.value)}
                          placeholder="Ej. Fundación de Ayuda A.C."
                          className="input-field pl-12"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="input-label">Figura Legal Deseada *</label>
                        <div className="relative group">
                          <Scale className="input-icon" size={18} />
                          <select
                            value={figuraId}
                            onChange={(e) => setFiguraId(Number(e.target.value))}
                            className="input-field pl-12 appearance-none"
                            disabled={isLoading}
                          >
                            <option value="">Selecciona...</option>
                            {figuras.map((fig) => (
                              <option key={fig.id} value={fig.id}>
                                {fig.siglas} — {fig.descripcion}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="input-label">Modalidad de Pago *</label>
                        <div className="relative group">
                          <CreditCard className="input-icon" size={18} />
                          <select
                            value={planPagos}
                            onChange={(e) => setPlanPagos(e.target.value as PlanPagos)}
                            className="input-field pl-12 appearance-none"
                            disabled={isLoading}
                          >
                            <option value="">Selecciona un plan...</option>
                            <option value="unico">Pago Único de Contado (Precio Especial)</option>
                            <option value="2_meses">A 2 Mensualidades</option>
                            <option value="4_meses">A 4 Mensualidades</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* SUB-PASO 3: Presupuesto */}
              {subStep === 3 && (
                <motion.section
                  key="substep3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-sky-100 text-sky-600 rounded-3xl shadow-sm">
                      <Calculator size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Presupuesto Modular</h3>
                      <p className="text-sm text-slate-500 font-medium">Personalización de servicios y trámites</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl space-y-12 border border-white/5 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-500/10 rounded-full blur-[80px]"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/5 pb-10">
                      <div className="text-center md:text-left">
                        <h3 className="text-lg font-black uppercase tracking-[0.3em] text-sky-400">Total Inversión</h3>
                        <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-widest opacity-60">IVA INCLUIDO SEGÚN CORRESPONDA</p>
                      </div>
                      <div className="bg-sky-500/10 px-12 py-6 rounded-[2.5rem] font-black text-5xl text-sky-300 border border-sky-400/20 flex items-baseline gap-4 shadow-[0_0_40px_rgba(14,165,233,0.1)]">
                        <span className="text-xl opacity-30">$</span>
                        {presupuestoTotal.toLocaleString()}
                        <span className="text-xs opacity-50 tracking-[0.2em] font-bold">MXN</span>
                      </div>
                    </div>

                    <div className="space-y-10 relative z-10">
                      {/* Trámite Principal */}
                      <div className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Selección de Trámite Principal *</label>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                            <p className="text-sm font-bold mb-4 text-slate-200">¿Tu organización ya cuenta con Acta Constitutiva?</p>
                            <div className="grid grid-cols-2 gap-4">
                              <button
                                type="button"
                                onClick={() => setTieneActa(true)}
                                className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${tieneActa === true ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                              >
                                Sí, ya existe
                              </button>
                              <button
                                type="button"
                                onClick={() => { setTieneActa(false); setNecesitaRenovar(null); }}
                                className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${tieneActa === false ? 'bg-sky-500 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                              >
                                No, desde cero
                              </button>
                            </div>
                          </div>

                          {tieneActa === true && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-white/5 p-6 rounded-3xl border border-white/5">
                              <p className="text-sm font-bold mb-4 text-slate-200">Objetivo del trámite:</p>
                              <div className="space-y-3">
                                <button
                                  type="button"
                                  onClick={() => setNecesitaRenovar(false)}
                                  className={`w-full py-4 px-6 rounded-2xl text-[10px] text-left font-black uppercase tracking-widest transition-all ${necesitaRenovar === false ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                                >
                                  Actualización de Estatutos / Donataria
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNecesitaRenovar(true)}
                                  className={`w-full py-4 px-6 rounded-2xl text-[10px] text-left font-black uppercase tracking-widest transition-all ${necesitaRenovar === true ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                                >
                                  Recuperación / Renovación de Donataria
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Extras */}
                      <div className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">2. Servicios Adicionales</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.values(SERVICIOS_EXTRAS).map(extra => {
                            const isSelected = extrasSeleccionados.includes(extra.id);
                            return (
                              <div 
                                key={extra.id} 
                                onClick={() => toggleExtra(extra.id)}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group ${isSelected ? 'bg-sky-500/10 border-sky-500/50' : 'bg-slate-900 border-white/5'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 transition-all ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-700 group-hover:border-slate-500'}`} />
                                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-300">{extra.nombre}</span>
                                </div>
                                <span className="text-[9px] font-black text-sky-400 opacity-80">
                                  {extra.id === 'web' ? '+$4,999 (+ IVA)' : 
                                   extra.id === 'cluni' && ['constitucion', 'acta_extra'].includes(servicioBaseId) ? '+$10,000 (OFERTA)' :
                                   extra.precio > 0 ? `+$${extra.precio.toLocaleString()}` : 'COTIZAR'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Navegación de Sub-pasos */}
          <div className="mt-12 pt-10 border-t border-slate-100 flex items-center justify-between gap-4">
            {subStep > 1 ? (
              <button
                onClick={handlePrev}
                className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
              >
                Anterior
              </button>
            ) : <div />}

            {subStep < 3 ? (
              <button
                onClick={handleNext}
                className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition shadow-xl shadow-slate-200 flex items-center gap-3"
              >
                Siguiente Paso
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-sky-600 text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-sky-700 transition shadow-xl shadow-sky-200 flex items-center gap-3 disabled:opacity-50"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" size={16} /> Procesando...</>
                ) : (
                  <>Finalizar Registro <CheckCircle2 size={16} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
