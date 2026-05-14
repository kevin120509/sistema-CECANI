import { useState, useMemo, useEffect } from 'react';
import { crearExpedienteCompleto, actualizarExpedienteCompleto } from '@/actions/expediente';
import type { CatalogoFigura, PlanPagos, Expediente, Perfil, Contrato, TipoTramite } from '@/types/database';
import { SERVICIOS_PRINCIPALES, SERVICIOS_EXTRAS } from '@/lib/constants';
import { motion } from 'framer-motion';
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
  Users
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
  const [folioIne, setFolioIne] = useState(perfil?.folio_ine || '');

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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const esPagoContado = planPagos === 'unico';

  const presupuestoTotal = useMemo(() => {
    let total = 0;
    const base = Object.values(SERVICIOS_PRINCIPALES).find(s => s.id === servicioBaseId);
    if (base) {
      total += esPagoContado ? base.precioEspecial : base.precioLista;
    }
    extrasSeleccionados.forEach(extraId => {
      const extra = Object.values(SERVICIOS_EXTRAS).find(e => e.id === extraId);
      if (extra) total += extra.precio;
    });
    return total;
  }, [servicioBaseId, extrasSeleccionados, esPagoContado]);

  const toggleExtra = (id: string) => {
    setExtrasSeleccionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones básicas
    if (!nombreCompleto.trim()) { setError('El nombre completo es requerido.'); return; }
    if (!rfc.trim()) { setError('El RFC es obligatorio para el contrato.'); return; }
    if (!curp.trim()) { setError('La CURP es obligatoria.'); return; }
    if (!domicilioCompleto.trim()) { setError('El domicilio completo es necesario para las declaraciones.'); return; }
    if (!nombreEmpresa.trim()) { setError('El nombre de la empresa es requerido.'); return; }
    if (!figuraId) { setError('Selecciona un tipo de figura legal.'); return; }
    if (!servicioBaseId) { setError('Selecciona el servicio principal.'); return; }
    if (!planPagos) { setError('Selecciona un plan de pagos.'); return; }

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
        folio_ine: folioIne,
      };

      const serviciosExtraMapped = [];
      if (extrasSeleccionados.includes('web')) serviciosExtraMapped.push('WEB');
      if (extrasSeleccionados.includes('cluni')) serviciosExtraMapped.push('CLUNI');

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Columna de Información */}
      <div className="lg:col-span-4 space-y-6">
        <div className="glass-card rounded-3xl p-8 bg-blue-600 text-white overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-4">Registro Legal</h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              Para generar un contrato con validez plena, es necesario proporcionar la información legal completa del representante y la organización.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-xs font-medium bg-white/10 p-3 rounded-xl border border-white/10">
                <FileText size={16} className="text-blue-200" />
                Declaraciones oficiales
              </li>
              <li className="flex items-center gap-3 text-xs font-medium bg-white/10 p-3 rounded-xl border border-white/10">
                <Briefcase size={16} className="text-blue-200" />
                Personalidad jurídica
              </li>
              <li className="flex items-center gap-3 text-xs font-medium bg-white/10 p-3 rounded-xl border border-white/10">
                <MapPin size={16} className="text-blue-200" />
                Domicilio legal verificado
              </li>
            </ul>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Columna del Formulario */}
      <div className="lg:col-span-8">
        <div className="glass-card rounded-3xl p-8 md:p-10">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 border border-red-100 text-red-700 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3"
            >
              <div className="bg-red-100 p-2 rounded-full"><Scale size={16} /></div>
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Sección: Identidad del Representante */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Identidad del Representante</h3>
                  <p className="text-xs text-slate-500">Datos para declaraciones contractuales</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="input-label">Nombre completo (Como aparece en INE) *</label>
                  <div className="relative group">
                    <User className="input-icon" size={18} />
                    <input
                      type="text"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                      placeholder="Ej. Juan Pérez López"
                      className="input-field pl-11"
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
                      className="input-field pl-11 uppercase"
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
                      className="input-field pl-11 uppercase"
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
                      className="input-field pl-11"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Estado Civil</label>
                  <div className="relative group">
                    <Users className="input-icon" size={18} />
                    <select
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value)}
                      className="input-field pl-11"
                      disabled={isLoading}
                    >
                      <option value="">Selecciona...</option>
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="input-label">Domicilio Completo (Calle, Núm, Col, CP, Ciudad) *</label>
                  <div className="relative group">
                    <MapPin className="input-icon" size={18} />
                    <textarea
                      value={domicilioCompleto}
                      onChange={(e) => setDomicilioCompleto(e.target.value)}
                      placeholder="Calle Falsa 123, Col. Centro, CP 01000, CDMX"
                      className="input-field pl-11 pt-3 min-h-[80px]"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Sección: Organización */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Datos de la Organización</h3>
                  <p className="text-xs text-slate-500">Configuración legal y comercial</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="input-label">Nombre de la Empresa / Asociación *</label>
                  <div className="relative group">
                    <Building2 className="input-icon" size={18} />
                    <input
                      type="text"
                      value={nombreEmpresa}
                      onChange={(e) => setNombreEmpresa(e.target.value)}
                      placeholder="Ej. Fundación de Ayuda A.C."
                      className="input-field pl-11"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="input-label">Figura Legal Deseada *</label>
                    <div className="relative group">
                      <Scale className="input-icon" size={18} />
                      <select
                        value={figuraId}
                        onChange={(e) => setFiguraId(Number(e.target.value))}
                        className="input-field pl-11 appearance-none"
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
                        className="input-field pl-11 appearance-none"
                        disabled={isLoading}
                      >
                        <option value="">Selecciona un plan...</option>
                        <option value="unico">Pago Único de Contado (-15%)</option>
                        <option value="2_meses">A 2 Mensualidades</option>
                        <option value="4_meses">A 4 Mensualidades</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* CALCULADORA DE PRESUPUESTO MODULAR */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Servicios a Contratar</h3>
                  <p className="text-xs text-slate-500">Configura tu contrato de forma modular</p>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl space-y-8">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <h3 className="text-lg font-black uppercase tracking-widest text-indigo-400">Cotización Total</h3>
                  <div className="bg-indigo-600 px-6 py-2 rounded-full font-black text-xl shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                    ${presupuestoTotal.toLocaleString()} <span className="text-[10px] opacity-60">MXN</span>
                  </div>
                </div>

                <div className="flex flex-col gap-10">
                  {/* Fila 1: Selección de Trámite (Ancho Completo) */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">1. Tipo de Trámite *</label>
                      
                      <div className="space-y-4">
                        <div className="bg-slate-800 p-4 rounded-2xl border border-white/5">
                          <p className="text-sm font-medium mb-3 text-white">¿Tu organización ya cuenta con Acta Constitutiva?</p>
                          <div className="flex gap-4">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => { setTieneActa(true); }}
                              className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                                tieneActa === true ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-slate-400 hover:border-indigo-500/50'
                              }`}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => { setTieneActa(false); setNecesitaRenovar(null); }}
                              className={`flex-1 py-2 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                                tieneActa === false ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-slate-400 hover:border-indigo-500/50'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>

                        {tieneActa === true && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-800 p-4 rounded-2xl border border-white/5 mt-4"
                          >
                            <p className="text-sm font-medium mb-3 text-white">¿Qué necesitas hacer ahora?</p>
                            <div className="flex flex-col gap-3">
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setNecesitaRenovar(false)}
                                className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                                  necesitaRenovar === false ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'border-slate-600 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-700/50'
                                }`}
                              >
                                Necesito modificar mi acta para que el SAT me acepte
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => setNecesitaRenovar(true)}
                                className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                                  necesitaRenovar === true ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'border-slate-600 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-700/50'
                                }`}
                              >
                                Perdí mi permiso de Donataria o necesito renovarlo
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      <p className="text-[11px] text-indigo-300 mt-4 ml-2 italic font-medium">
                        {servicioBaseId 
                          ? `Servicio asignado: ${Object.values(SERVICIOS_PRINCIPALES).find(s => s.id === servicioBaseId)?.nombre}`
                          : 'Por favor, responde las preguntas para asignar tu trámite automáticamente.'}
                      </p>
                    </div>
                  </div>

                  <hr className="border-white/5" />

                  {/* Fila 2: Extras (Ancho Completo) */}
                  <div className="space-y-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 text-center md:text-left">2. ¿Deseas agregar servicios extra?</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.values(SERVICIOS_EXTRAS).map(extra => {
                        const isSelected = extrasSeleccionados.includes(extra.id);
                        return (
                          <div 
                            key={extra.id} 
                            onClick={() => !isLoading && toggleExtra(extra.id)}
                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-600/20 border-indigo-500/50' 
                                : 'bg-slate-800/50 border-white/5 hover:border-white/20'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                              }`}>
                                {isSelected && <span className="text-[10px] text-white">✓</span>}
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-tight text-slate-200">{extra.nombre}</span>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-300 text-right ml-4">
                              {extra.precioVariable 
                                ? 'REQUIERE COTIZACIÓN PERSONALIZADA' 
                                : extra.esRegalo 
                                  ? 'GRATIS' 
                                  : extra.id === 'web' 
                                    ? `+$${extra.precio.toLocaleString()} (MÁS IVA)` 
                                    : `+$${extra.precio.toLocaleString()}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4 shadow-xl shadow-blue-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>{expediente?.id ? 'Actualizar Expediente' : 'Continuar con el Registro'}</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
