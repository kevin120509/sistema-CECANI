'use client';

import { useState, useTransition } from 'react';
import { guardarContratoFirmado } from '@/actions/contrato';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento, subirYRegistrarPago, eliminarDocumentoAction } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import type { Contrato, Expediente } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileCheck, 
  Download, 
  UploadCloud, 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileSignature,
  ArrowRight,
  ShieldCheck,
  History,
  Clock,
  Eye,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface Paso3Props {
  expediente: Expediente;
  contrato: Contrato;
  onComplete: () => Promise<void>;
}

interface ArchivoSeleccionado {
  file: File | null;
  preview: string | null;
}

export default function Paso3Contrato({
  expediente,
  contrato,
  onComplete,
}: Paso3Props) {
  const [contratoFirmado, setContratoFirmado] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [comprobantePago, setComprobantePago] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [montoPago, setMontoPago] = useState<string>('');

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const pago = Array.isArray(expediente.pagos) ? expediente.pagos[0] : (expediente.pagos as any);
  
  // Estados de los documentos en BD
  const docContratoFirmado = expediente.documentos?.find(d => d.tipo === 'contrato_firmado');
  const docPago = expediente.documentos?.find(d => d.tipo === 'comprobante_pago');

  // PRIORIDAD: Revisar campo específico en tabla 'contratos' o en tabla 'documentos'
  const hasContratoEnBD = !!contrato.url_pdf_firmado_cliente || !!docContratoFirmado?.url_archivo;
  const isContratoValidado = !!docContratoFirmado?.validado;
  const isContratoRechazado = !!docContratoFirmado?.motivo_rechazo && !isContratoValidado;

  const hasPagoEnBD = !!pago || !!docPago?.url_archivo;
  const isPagoVerificado = !!pago?.verificado || !!docPago?.validado;
  const isPagoRechazado = (!!pago?.motivo_rechazo || !!docPago?.motivo_rechazo) && !isPagoVerificado;

  // Lógica de "En Revisión": El cliente ya subió AMBOS archivos y NO hay rechazos activos.
  // Se mantiene en esta pantalla aunque el pago ya esté validado, hasta que se asigne abogada (siguiente paso).
  const isUnderReview = hasContratoEnBD && hasPagoEnBD && !isContratoRechazado && !isPagoRechazado;

  // Si la directora no ha generado el pdf oficial (para descargar)
  const isWaitingForDirector = !contrato.url_pdf_generado || expediente.estatus === 'revision_directora';

  const handleDescargar = () => {
    if (isWaitingForDirector) return;
    window.open(`/api/r2/download?url=${encodeURIComponent(contrato.url_pdf_generado!)}`, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: ArchivoSeleccionado) => void) => {
    const file = e.target.files?.[0] || null;
    setter({ file, preview: null });
  };

  const handleEliminarDocumento = async (tipo: 'contrato_firmado' | 'comprobante_pago') => {
    const doc = tipo === 'contrato_firmado' ? docContratoFirmado : docPago;
    if (!doc?.id || !doc?.url_archivo) return;

    if (!confirm('¿Deseas eliminar el archivo actual para subir uno nuevo?')) return;

    startTransition(async () => {
      try {
        setProgress('Eliminando archivo anterior...');
        const res = await eliminarDocumentoAction(doc.id, doc.url_archivo);
        if (res.success) {
          await onComplete(); // Refrescar datos
        } else {
          setError('Error al eliminar: ' + res.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setProgress('');
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const necesitaContrato = !hasContratoEnBD || isContratoRechazado;
    const necesitaPago = !hasPagoEnBD || isPagoRechazado;

    if (necesitaContrato && !contratoFirmado.file) { setError('Falta subir el contrato firmado.'); return; }
    if (necesitaPago && !comprobantePago.file) { setError('Falta subir el comprobante de pago.'); return; }
    if (necesitaPago && (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0)) {
      setError('Monto de inversión inválido.'); return;
    }

    startTransition(async () => {
      try {
        const carpetaEmpresa = expediente.nombre_empresa
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');

        if (necesitaContrato && contratoFirmado.file) {
          setProgress('Resguardando contrato legal...');
          const ext = contratoFirmado.file.name.split('.').pop() || 'pdf';
          const fileR = new File([contratoFirmado.file], `Contrato_FIRMADO_${carpetaEmpresa}.${ext}`, { type: contratoFirmado.file.type });
          const fd = new FormData(); fd.append('file', fileR);
          const res = await subirArchivoR2Action(fd, `expedientes/${carpetaEmpresa}/contratos`);
          if (!res.success || !res.data) throw new Error(res.error || 'Fallo subida contrato');
          await registrarDocumento(expediente.id, 'contrato_firmado', res.data.url);
          await guardarContratoFirmado(contrato.id, res.data.url);
        }

        if (necesitaPago && comprobantePago.file) {
          setProgress('Validando inversión inicial...');
          const fdP = new FormData(); fdP.append('file', comprobantePago.file);
          const resP = await subirYRegistrarPago(fdP, expediente.id, Number(montoPago), expediente.nombre_empresa);
          if (!resP.success) throw new Error(resP.error || 'Fallo registro pago');
        }

        setProgress('Sincronizando portal...');
        await actualizarEstatusExpediente(expediente.id, 'en_proceso');
        await onComplete();
      } catch (err: any) {
        setError(err.message || 'Error inesperado.');
      } finally {
        setProgress('');
      }
    });
  };

  if (isUnderReview && !isPending && !error) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-12">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border animate-pulse ${isPagoVerificado ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-sky-950/40 text-sky-400 border-sky-900'}`}>
          {isPagoVerificado ? <ShieldCheck size={48} /> : <Clock size={48} />}
        </motion.div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
            {isPagoVerificado ? '¡Inversión Validada!' : 'Validación de Formalización'}
          </h2>
          <p className="text-slate-400 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            {isPagoVerificado 
              ? 'Tu pago ha sido verificado con éxito. Estamos terminando de preparar la asignación de tu abogada titular.' 
              : 'Hemos recibido tu documentación. Dirección está validando los fondos para asignarte una abogada titular.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <ReviewCard label="Contrato Firmado" status="resguardado" icon={<FileSignature size={24}/>} color="sky" />
          <ReviewCard 
            label="Inversión Inicial" 
            status={isPagoVerificado ? 'validado' : 'en_verificacion'} 
            icon={<CreditCard size={24}/>} 
            subtext={`$${pago?.monto?.toLocaleString() || '---'}`} 
            color={isPagoVerificado ? 'emerald' : 'sky'} 
          />
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 text-white max-w-xl mx-auto flex items-center gap-6 relative overflow-hidden">
          <div className="w-12 h-12 bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center shrink-0"><ShieldCheck size={24}/></div>
          <div className="text-left relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1">Estatus del Portal:</p>
            <p className="text-sm font-bold opacity-80 uppercase leading-snug text-slate-300">
              {isPagoVerificado ? 'Esperando confirmación final de dirección.' : 'Análisis financiero en curso...'}
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-950/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-900"><FileSignature size={32} /></div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Formalización de Contrato</h2>
        <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto leading-relaxed">Descarga tu contrato personalizado, fírmalo y adjunta el comprobante de tu inversión inicial.</p>
      </motion.div>

      {(isContratoRechazado || isPagoRechazado) && (
        <div className="max-w-5xl mx-auto mb-8 bg-rose-950/40 border-4 border-rose-900 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <AlertCircle className="text-rose-400 shrink-0" size={32} />
          <div className="space-y-2 relative z-10">
            <h3 className="text-xl font-bold text-rose-200 uppercase tracking-tight">Atención Requerida</h3>
            <p className="text-sm font-semibold text-rose-300 leading-relaxed uppercase">Uno o más elementos de tu formalización han sido rechazados. Por favor, realiza las correcciones indicadas abajo.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-8">
          <AnimatePresence mode="wait">
            {isWaitingForDirector ? (
              <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-950 rounded-3xl p-10 text-white shadow-xl border border-slate-800 relative overflow-hidden text-center md:text-left">
                <div className="relative z-10 space-y-6">
                  <div className="w-14 h-14 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center animate-pulse mx-auto md:mx-0"><History size={28} /></div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Análisis Documental</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Estamos procesando tu información para emitir el contrato legal. Recibirás una notificación en cuanto esté listo.</p>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sky-500/10 rounded-full blur-[100px]" />
              </motion.div>
            ) : (
              <motion.div key="ready" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-sky-600 rounded-3xl p-10 text-white shadow-xl border border-sky-500 relative overflow-hidden group">
                <div className="relative z-10 space-y-8 text-center md:text-left">
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mx-auto md:mx-0"><FileCheck size={28} /></div>
                    <div className="hidden md:block px-4 py-1.5 bg-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest">Listo</div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Descargar Contrato</h3>
                    <p className="text-sky-100 text-sm leading-relaxed opacity-80">Su contrato ha sido emitido. Proceda a revisarlo y firmarlo.</p>
                  </div>
                  <button onClick={handleDescargar} className="w-full bg-slate-900 text-sky-400 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all border border-slate-800"><Download size={18} /> Descargar PDF</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
             <StatusBadge label="Documentación Legal" active={expediente.estatus !== 'en_registro'} />
             <StatusBadge label="Emisión de Contrato" active={!!contrato.url_pdf_generado} />
             <StatusBadge label="Firma de Cliente" active={isContratoValidado} rejected={isContratoRechazado} />
             <StatusBadge label="Inversión Inicial" active={isPagoVerificado} rejected={isPagoRechazado} />
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl shadow-slate-950/50 border border-slate-800 relative overflow-hidden">
            <AnimatePresence>
              {isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
                  <Loader2 className="text-sky-500 animate-spin mb-4" size={48} />
                  <p className="text-sky-500 font-black text-[10px] uppercase tracking-[0.3em]">{progress}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-12">
              <div className="grid grid-cols-1 gap-10">
                <UploadMini 
                  label="Contrato Firmado *" 
                  archivo={contratoFirmado} 
                  dbDoc={docContratoFirmado} 
                  isValidated={isContratoValidado}
                  isRejected={isContratoRechazado}
                  disabled={isPending || isWaitingForDirector || (hasContratoEnBD && !isContratoRechazado)} 
                  onFileChange={(e: any) => handleFileChange(e, setContratoFirmado)} 
                  onDelete={() => handleEliminarDocumento('contrato_firmado')}
                />
                
                <UploadMini 
                  label="Comprobante de Inversión *" 
                  archivo={comprobantePago} 
                  dbDoc={docPago || (pago ? { url_archivo: pago.url_comprobante, motivo_rechazo: pago.motivo_rechazo } : null)} 
                  isValidated={isPagoVerificado}
                  isRejected={isPagoRechazado}
                  disabled={isPending || isWaitingForDirector || (hasPagoEnBD && !isPagoRechazado)} 
                  onFileChange={(e: any) => handleFileChange(e, setComprobantePago)} 
                  onDelete={() => handleEliminarDocumento('comprobante_pago')}
                />

                <div className={hasPagoEnBD && !isPagoRechazado ? 'opacity-50' : ''}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">Importe de Inversión ($) *</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">$</div>
                    <input 
                      type="number" 
                      min="1" 
                      step="0.01" 
                      value={hasPagoEnBD && !isPagoRechazado ? pago?.monto : montoPago} 
                      onChange={(e) => setMontoPago(e.target.value)} 
                      disabled={isPending || isWaitingForDirector || (hasPagoEnBD && !isPagoRechazado)} 
                      className="w-full bg-slate-950/50 border-2 border-slate-800 rounded-3xl py-5 pl-14 pr-8 text-sm font-bold text-white outline-none focus:border-sky-500 transition-all placeholder-slate-600" 
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-[10px] font-black uppercase text-rose-400 text-center bg-rose-950/40 p-4 rounded-2xl border border-rose-900">{error}</p>}

              <footer className="pt-10 border-t border-slate-800">
                <button 
                  type="submit" 
                  disabled={isPending || isWaitingForDirector || (hasContratoEnBD && hasPagoEnBD && !isContratoRechazado && !isPagoRechazado)} 
                  className="w-full bg-sky-600 text-white py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-500 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {(isContratoRechazado || isPagoRechazado) ? 'Reenviar Correcciones' : (hasContratoEnBD && !hasPagoEnBD ? 'Enviar Comprobante' : 'Finalizar Formalización')} 
                  <ArrowRight size={16} />
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ label, status, icon, subtext, color = "sky" }: any) {
  const colors: any = {
    sky: 'bg-sky-950/40 text-sky-400 border-sky-900',
    emerald: 'bg-emerald-950/40 text-emerald-400 border-emerald-900'
  };

  const statusLabel = status === 'validado' ? 'VALIDADO' : 'EN REVISIÓN';

  return (
    <div className="p-6 bg-slate-900 border-2 border-slate-800 rounded-3xl flex flex-col items-center gap-3 shadow-sm transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1 ${colors[color]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white">{label}</p>
      {subtext && <p className="text-lg font-black text-slate-300">{subtext}</p>}
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${colors[color]}`}>
        {status === 'validado' ? <CheckCircle2 size={10} /> : <Loader2 size={10} className="animate-spin" />}
        <span className="text-[8px] font-black uppercase tracking-tighter">{statusLabel}</span>
      </div>
    </div>
  );
}

function StatusBadge({ label, active, rejected }: { label: string, active: boolean, rejected?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${rejected ? 'bg-rose-950/40 border-rose-900 text-rose-400' : active ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {rejected ? <AlertCircle size={16}/> : active ? <CheckCircle2 size={16}/> : <Clock size={16}/>}
    </div>
  );
}

function UploadMini({ label, archivo, dbDoc, isValidated, isRejected, disabled, onFileChange, onDelete }: any) {
  const showSuccess = (archivo.file || (dbDoc?.url_archivo && !isRejected));
  
  return (
    <div className="relative group">
      <div className="flex justify-between items-end mb-4 ml-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
        {isValidated && (
          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900 flex items-center gap-1">
            <CheckCircle2 size={10} /> VALIDADO
          </span>
        )}
        {isRejected && (
          <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-900 flex items-center gap-1">
            <AlertCircle size={10} /> RECHAZADO
          </span>
        )}
      </div>

      <div className={`relative rounded-3xl border-2 border-dashed transition-all p-6 flex items-center gap-5 
        ${showSuccess ? 'border-emerald-500 bg-emerald-900/20' : isRejected ? 'border-rose-800 bg-rose-900/20' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-sky-500'} 
        ${disabled && !archivo.file ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 
          ${showSuccess ? 'bg-emerald-500 text-white' : isRejected ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-400 shadow-sm border border-slate-700'}`}>
          {showSuccess ? <CheckCircle2 size={24} /> : isRejected ? <AlertCircle size={24} /> : <UploadCloud size={24} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-tight truncate ${showSuccess ? 'text-emerald-400' : isRejected ? 'text-rose-400' : 'text-slate-300'}`}>
            {archivo.file ? archivo.file.name : (isValidated ? 'DOCUMENTO VALIDADO' : (isRejected ? 'REQUIERE NUEVA CARGA' : 'SELECCIONAR ARCHIVO'))}
          </p>
          {isRejected && !archivo.file && (
            <p className="text-[9px] font-bold text-rose-400 uppercase mt-0.5 line-clamp-1">MOTIVO: {dbDoc?.motivo_rechazo || 'REVISAR DETALLES'}</p>
          )}
        </div>

        <input type="file" onChange={onFileChange} disabled={disabled} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 z-10" />
        
        {isRejected && dbDoc?.url_archivo && !archivo.file && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="relative z-20 p-2.5 bg-slate-900 text-rose-400 rounded-xl shadow-lg border border-rose-900 hover:bg-rose-500 hover:text-white transition-all"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
