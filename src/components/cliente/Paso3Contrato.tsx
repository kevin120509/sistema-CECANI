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
  
  const docContratoFirmado = expediente.documentos?.find(d => d.tipo === 'contrato_firmado');
  const docPago = expediente.documentos?.find(d => d.tipo === 'comprobante_pago');

  const hasContratoEnBD = !!contrato.url_pdf_firmado_cliente || !!docContratoFirmado?.url_archivo;
  const isContratoValidado = !!docContratoFirmado?.validado;
  const isContratoRechazado = !!docContratoFirmado?.motivo_rechazo && !isContratoValidado;

  const hasPagoEnBD = !!pago || !!docPago?.url_archivo;
  const isPagoVerificado = !!pago?.verificado || !!docPago?.validado;
  const isPagoRechazado = (!!pago?.motivo_rechazo || !!docPago?.motivo_rechazo) && !isPagoVerificado;

  const isUnderReview = hasContratoEnBD && hasPagoEnBD && !isContratoRechazado && !isPagoRechazado;
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
        if (res.success) await onComplete();
        else setError('Error al eliminar: ' + res.error);
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
      setError('Monto de pago inválido.'); return;
    }

    startTransition(async () => {
      try {
        const carpetaEmpresa = expediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

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
          setProgress('Validando pago inicial...');
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
      <div className="max-w-4xl mx-auto py-24 text-center space-y-12">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`w-28 h-28 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border transition-all duration-1000 ${isPagoVerificado ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-[#0197D2]/10 text-sky-600 border-sky-600/20 animate-pulse'}`}>
          {isPagoVerificado ? <ShieldCheck size={56} /> : <Clock size={56} />}
        </motion.div>
        
        <div className="space-y-6">
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-tight">
            {isPagoVerificado ? '¡Pago Validado!' : 'Validación de Fondos'}
          </h2>
          <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            {isPagoVerificado 
              ? 'Su inversión ha sido verificada exitosamente. Estamos finalizando la asignación de su abogada titular.' 
              : 'Hemos recibido su documentación. Nuestra dirección está validando la inversión para formalizar su expediente.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <ReviewCard label="Contrato Firmado" status="resguardado" icon={<FileSignature size={28}/>} color="sky" />
          <ReviewCard 
            label="Inversión Inicial" 
            status={isPagoVerificado ? 'validado' : 'en_verificacion'} 
            icon={<CreditCard size={28}/>} 
            subtext={`$${pago?.monto?.toLocaleString() || '---'}`} 
            color={isPagoVerificado ? 'emerald' : 'sky'} 
          />
        </div>

        <div className="bg-slate-900 p-10 rounded-3xl text-white max-w-xl mx-auto flex items-center gap-8 relative overflow-hidden border border-slate-800 shadow-2xl">
          <div className="w-14 h-14 bg-[#0197D2]/10 text-sky-400 rounded-2xl flex items-center justify-center shrink-0 border border-sky-600/20"><ShieldCheck size={28}/></div>
          <div className="text-left relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-500 mb-2">Estatus del Proceso:</p>
            <p className="text-sm font-bold opacity-80 uppercase leading-snug text-slate-300">
              {isPagoVerificado ? 'Sincronizando con el equipo legal de CECANI...' : 'Análisis financiero en curso por dirección.'}
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[#0197D2]/10 rounded-full blur-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-24 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-emerald-500/20"><FileSignature size={36} /></div>
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Formalización Legal</h2>
        <div className="space-y-4 max-w-2xl mx-auto">
          <p className="text-slate-500 font-medium text-lg leading-relaxed italic">
            "Le informamos que su contrato debe ser validado y aprobado por nuestra dirección antes de que pueda proceder con la firma y el pago inicial."
          </p>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-relaxed">
            Una vez aprobado, podrá descargar su instrumento legal, proceder con la firma autógrafa y sincronizar su comprobante.
          </p>
        </div>
      </motion.div>

      {(isContratoRechazado || isPagoRechazado) && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto mb-12 bg-rose-500/10 border border-rose-500/20 rounded-3xl p-10 flex items-start gap-8 shadow-2xl relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0 mt-1" size={32} />
          <div className="space-y-2 relative z-10">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Atención Requerida</h3>
            <p className="text-sm font-bold text-rose-200 leading-relaxed uppercase">Se han detectado inconsistencias en su formalización. Por favor, realice las correcciones indicadas para reactivar el proceso.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-10">
          <AnimatePresence mode="wait">
            {isWaitingForDirector ? (
              <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 rounded-3xl p-12 text-white shadow-2xl border border-slate-800 relative overflow-hidden text-center md:text-left">
                <div className="relative z-10 space-y-8">
                  <div className="w-16 h-16 bg-[#0197D2]/10 text-sky-400 rounded-2xl flex items-center justify-center animate-pulse mx-auto md:mx-0 border border-sky-600/20"><History size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Emisión en Curso</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-bold uppercase tracking-widest text-[10px]">Nuestro equipo está redactando las cláusulas finales de su contrato legal.</p>
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#0197D2]/10 rounded-full blur-[100px]" />
              </motion.div>
            ) : (
              <motion.div key="ready" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-[#0197D2] rounded-3xl p-12 text-white shadow-2xl border border-sky-400/20 relative overflow-hidden group">
                <div className="relative z-10 space-y-10 text-center md:text-left">
                  <div className="flex justify-between items-start">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mx-auto md:mx-0 border border-white/30"><FileCheck size={32} /></div>
                    <div className="hidden md:flex px-5 py-2 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg items-center gap-2">
                      <CheckCircle2 size={12}/> Listo para Firma
                    </div>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-3">Descargar Contrato</h3>
                    <p className="text-sky-100 text-sm leading-relaxed opacity-90 font-bold uppercase tracking-widest text-[10px]">Su contrato ha sido emitido con validez legal completa.</p>
                  </div>
                  <button onClick={handleDescargar} className="w-full bg-slate-950 text-sky-400 py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.03] transition-all border border-sky-500/20 active:scale-[0.97]"><Download size={20} /> Descargar PDF Oficial</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
             <StatusBadge label="Documentación Legal" active={expediente.estatus !== 'en_registro'} />
             <StatusBadge label="Emisión de Contrato" active={!!contrato.url_pdf_generado} />
             <StatusBadge label="Firma Autógrafa" active={isContratoValidado} rejected={isContratoRechazado} />
             <StatusBadge label="Inversión Inicial" active={isPagoVerificado} rejected={isPagoRechazado} />
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 shadow-2xl border border-slate-800 relative overflow-hidden">
            <AnimatePresence>
              {isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-sky-600/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileSignature className="text-sky-600" size={32} />
                    </div>
                  </div>
                  <p className="text-sky-600 font-black text-xs uppercase tracking-[0.5em] animate-pulse">{progress}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-16">
              <div className="grid grid-cols-1 gap-12">
                <UploadMini 
                  label="Contrato Firmado *" 
                  archivo={contratoFirmado} 
                  dbDoc={docContratoFirmado} 
                  isValidated={isContratoValidated}
                  isRejected={isContratoRechazado}
                  disabled={isPending || isWaitingForDirector || (hasContratoEnBD && !isContratoRechazado)} 
                  onFileChange={(e: any) => handleFileChange(e, setContratoFirmado)} 
                  onDelete={() => handleEliminarDocumento('contrato_firmado')}
                />
                
                <UploadMini 
                  label="Comprobante de Pago *" 
                  archivo={comprobantePago} 
                  dbDoc={docPago || (pago ? { url_archivo: pago.url_comprobante, motivo_rechazo: pago.motivo_rechazo } : null)} 
                  isValidated={isPagoVerificado}
                  isRejected={isPagoRechazado}
                  disabled={isPending || isWaitingForDirector || (hasPagoEnBD && !isPagoRechazado)} 
                  onFileChange={(e: any) => handleFileChange(e, setComprobantePago)} 
                  onDelete={() => handleEliminarDocumento('comprobante_pago')}
                />

                <div className={hasPagoEnBD && !isPagoRechazado ? 'opacity-50' : ''}>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 block ml-1">Importe de Inversión (MXN) *</label>
                  <div className="relative group">
                    <div className="absolute left-8 top-1/2 -translate-y-1/2 text-sky-600 font-black text-2xl group-focus-within:scale-110 transition-transform">$</div>
                    <input 
                      type="number" 
                      min="1" 
                      step="0.01" 
                      placeholder="0.00"
                      value={hasPagoEnBD && !isPagoRechazado ? pago?.monto : montoPago} 
                      onChange={(e) => setMontoPago(e.target.value)} 
                      disabled={isPending || isWaitingForDirector || (hasPagoEnBD && !isPagoRechazado)} 
                      className="w-full bg-slate-950/50 border-2 border-slate-800 focus:border-sky-600 focus:bg-slate-950 focus:shadow-xl rounded-3xl py-7 pl-16 pr-10 text-xl font-black text-white outline-none transition-all duration-300 placeholder-slate-800" 
                    />
                  </div>
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                   <p className="text-[10px] font-black uppercase text-rose-500 tracking-[0.2em]">{error}</p>
                </motion.div>
              )}

              <footer className="pt-12 border-t border-slate-800">
                <button 
                  type="submit" 
                  disabled={isPending || isWaitingForDirector || (hasContratoEnBD && hasPagoEnBD && !isContratoRechazado && !isPagoRechazado)} 
                  className="w-full bg-[#0197D2] text-white py-8 rounded-3xl text-[12px] font-black uppercase tracking-[0.5em] hover:shadow-[0_20px_60px_rgba(14,165,233,0.4)] transition-all duration-500 flex items-center justify-center gap-6 disabled:opacity-30 group active:scale-[0.98]"
                >
                  {(isContratoRechazado || isPagoRechazado) ? 'Reenviar Formalización' : (hasContratoEnBD && !hasPagoEnBD ? 'Sincronizar Comprobante' : 'Finalizar Proceso Legal')} 
                  <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
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
    sky: 'bg-[#0197D2]/10 text-sky-400 border-sky-600/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };

  const statusLabel = status === 'validado' ? 'VALIDADO' : 'RESGUARDADO';

  return (
    <div className="p-10 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col items-center gap-5 shadow-2xl transition-all hover:scale-[1.02]">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-inner border ${colors[color]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">{label}</p>
      {subtext && <p className="text-2xl font-black text-white tracking-tighter">{subtext}</p>}
      <div className={`flex items-center gap-3 px-5 py-2 rounded-full border shadow-lg ${colors[color]}`}>
        {status === 'validado' ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="animate-spin" />}
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{statusLabel}</span>
      </div>
    </div>
  );
}

function StatusBadge({ label, active, rejected }: { label: string, active: boolean, rejected?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-8 py-5 rounded-3xl border-2 transition-all duration-500 ${rejected ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{label}</span>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${rejected ? 'bg-rose-500/20' : active ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
        {rejected ? <AlertCircle size={16}/> : active ? <CheckCircle2 size={16}/> : <Clock size={16} className="opacity-40"/>}
      </div>
    </div>
  );
}

function UploadMini({ label, archivo, dbDoc, isValidated, isRejected, disabled, onFileChange, onDelete }: any) {
  const showSuccess = (archivo.file || (dbDoc?.url_archivo && !isRejected));
  
  return (
    <div className="relative group">
      <div className="flex justify-between items-end mb-5 ml-1">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] block">{label}</label>
        {isValidated && (
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2 shadow-lg">
            <CheckCircle2 size={12} /> VERIFICADO
          </span>
        )}
        {isRejected && (
          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20 flex items-center gap-2 shadow-lg">
            <AlertCircle size={12} /> RECHAZADO
          </span>
        )}
      </div>

      <div className={`relative rounded-3xl border-2 border-dashed transition-all duration-500 p-8 flex items-center gap-6 
        ${showSuccess ? 'border-emerald-500 bg-emerald-500/5 shadow-xl' : isRejected ? 'border-rose-500 bg-rose-500/5' : 'border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-sky-600/40'} 
        ${disabled && !archivo.file ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}>
        
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500
          ${showSuccess ? 'bg-emerald-500 text-white shadow-emerald-500/40' : isRejected ? 'bg-rose-500 text-white shadow-rose-500/40' : 'bg-slate-950 text-slate-600 shadow-inner border border-slate-800 group-hover:bg-[#0197D2]/20 group-hover:text-sky-400 group-hover:scale-110'}`}>
          {showSuccess ? <CheckCircle2 size={28} /> : isRejected ? <AlertCircle size={28} /> : <UploadCloud size={28} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-black uppercase tracking-widest truncate mb-1 ${showSuccess ? 'text-emerald-400' : isRejected ? 'text-rose-400' : 'text-slate-400 group-hover:text-slate-200 transition-colors'}`}>
            {archivo.file ? archivo.file.name : (isValidated ? 'DOCUMENTO VERIFICADO' : (isRejected ? 'REINTENTAR CARGA' : 'SELECCIONAR CONTRATO'))}
          </p>
          {isRejected && !archivo.file && (
            <p className="text-[9px] font-bold text-rose-400 uppercase mt-1 leading-relaxed line-clamp-1 italic">MOTIVO: {dbDoc?.motivo_rechazo || 'REVISAR OBSERVACIONES'}</p>
          )}
        </div>

        <input type="file" onChange={onFileChange} disabled={disabled} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
        
        {isRejected && dbDoc?.url_archivo && !archivo.file && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="relative z-20 w-12 h-12 bg-slate-950 text-rose-400 rounded-2xl shadow-2xl border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-12 flex items-center justify-center active:scale-90"
          >
            <RotateCcw size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
