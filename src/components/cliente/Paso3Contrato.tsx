'use client';

import { useState, useTransition } from 'react';
import { guardarContratoFirmado } from '@/actions/contrato';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento, subirYRegistrarPago } from '@/actions/documentos';
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
  Trash2
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
  const hasContratoFirmado = !!contrato.url_pdf_firmado_cliente;
  const hasPago = !!pago;
  const isPagoVerificado = !!pago?.verificado;

  // Lógica de "En Revisión": Si ya mandó todo pero la directora no ha validado el pago ni el contrato
  // O si el estatus es 'en_proceso' pero aún no se le asigna abogada.
  const isUnderReview = hasContratoFirmado && hasPago && !isPagoVerificado && !expediente.motivo_rechazo;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasContratoFirmado && !contratoFirmado.file) { setError('Falta subir el contrato firmado.'); return; }
    if (!hasPago && !comprobantePago.file) { setError('Falta subir el comprobante de pago.'); return; }
    if (!hasPago && (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0)) {
      setError('Monto de inversión inválido.'); return;
    }

    startTransition(async () => {
      try {
        const carpetaEmpresa = expediente.nombre_empresa
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');

        if (!hasContratoFirmado && contratoFirmado.file) {
          setProgress('Resguardando contrato legal...');
          const ext = contratoFirmado.file.name.split('.').pop() || 'pdf';
          const fileR = new File([contratoFirmado.file], `Contrato_FIRMADO_${carpetaEmpresa}.${ext}`, { type: contratoFirmado.file.type });
          const fd = new FormData(); fd.append('file', fileR);
          const res = await subirArchivoR2Action(fd, `expedientes/${carpetaEmpresa}/contratos`);
          if (!res.success || !res.data) throw new Error(res.error || 'Fallo subida contrato');
          await registrarDocumento(expediente.id, 'contrato_firmado', res.data.url);
          await guardarContratoFirmado(contrato.id, res.data.url);
        }

        if (!hasPago && comprobantePago.file) {
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
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-emerald-100 animate-pulse">
          <Clock size={48} />
        </motion.div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Validación de Formalización</h2>
          <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            Hemos recibido tu contrato firmado y comprobante de inversión. Dirección está validando los fondos para asignarte una abogada titular.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <ReviewCard label="Contrato Firmado" status="resguardado" icon={<FileSignature size={24}/>} />
          <ReviewCard label="Inversión Inicial" status="en_verificacion" icon={<CreditCard size={24}/>} subtext={`$${pago?.monto?.toLocaleString()}`} />
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 text-white max-w-xl mx-auto flex items-center gap-6 relative overflow-hidden">
          <div className="w-12 h-12 bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center shrink-0"><ShieldCheck size={24}/></div>
          <div className="text-left relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1">Próximo Paso:</p>
            <p className="text-sm font-bold opacity-80 uppercase leading-snug text-slate-300">Asignación de Abogada y Seguimiento de Hitos Jurídicos.</p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100"><FileSignature size={32} /></div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Formalización de Contrato</h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto leading-relaxed">Descarga tu contrato personalizado, fírmalo y adjunta el comprobante de tu inversión inicial.</p>
      </motion.div>

      {expediente.motivo_rechazo && (
        <div className="max-w-5xl mx-auto mb-8 bg-rose-50 border-4 border-rose-100 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0" size={32} />
          <div className="space-y-2 relative z-10">
            <h3 className="text-xl font-bold text-rose-900 uppercase tracking-tight">Correcciones Requeridas</h3>
            <p className="text-sm font-semibold text-rose-700 leading-relaxed uppercase">{expediente.motivo_rechazo}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-8">
          <AnimatePresence mode="wait">
            {isWaitingForDirector ? (
              <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 rounded-3xl p-10 text-white shadow-xl border border-white/5 relative overflow-hidden text-center md:text-left">
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
                  <button onClick={handleDescargar} className="w-full bg-white text-sky-600 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all"><Download size={18} /> Descargar PDF</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-8 md:p-14 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <AnimatePresence>
              {isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
                  <Loader2 className="text-sky-600 animate-spin mb-4" size={48} />
                  <p className="text-sky-600 font-black text-[10px] uppercase tracking-[0.3em]">{progress}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-12">
              <div className="grid grid-cols-1 gap-10">
                <UploadMini label="Contrato Firmado *" archivo={contratoFirmado} dbDoc={hasContratoFirmado} disabled={isPending || isWaitingForDirector || hasContratoFirmado} onFileChange={(e) => handleFileChange(e, setContratoFirmado)} />
                <UploadMini label="Comprobante de Inversión *" archivo={comprobantePago} dbDoc={hasPago} disabled={isPending || isWaitingForDirector || hasPago} onFileChange={(e) => handleFileChange(e, setComprobantePago)} />
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">Importe de Inversión ($) *</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">$</div>
                    <input type="number" min="1" step="0.01" value={hasPago ? pago.monto : montoPago} onChange={(e) => setMontoPago(e.target.value)} disabled={isPending || isWaitingForDirector || hasPago} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-8 text-sm font-bold outline-none focus:border-sky-500 transition-all" />
                  </div>
                </div>
              </div>

              {error && <p className="text-[10px] font-black uppercase text-rose-500 text-center">{error}</p>}

              <footer className="pt-10 border-t border-slate-100">
                <button type="submit" disabled={isPending || isWaitingForDirector || (hasContratoFirmado && hasPago)} className="w-full bg-slate-900 text-white py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-600 transition-all flex items-center justify-center gap-4 disabled:opacity-50">
                  {hasContratoFirmado && !hasPago ? 'Enviar Comprobante' : 'Finalizar Formalización'} <ArrowRight size={16} />
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ label, status, icon, subtext }: any) {
  return (
    <div className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex flex-col items-center gap-3 shadow-sm">
      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-1">{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{label}</p>
      {subtext && <p className="text-lg font-black text-sky-600">{subtext}</p>}
      <div className="flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-600 rounded-full border border-sky-100">
        <Loader2 size={10} className="animate-spin" />
        <span className="text-[8px] font-black uppercase tracking-tighter">{status.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

function UploadMini({ label, archivo, dbDoc, disabled, onFileChange }: any) {
  return (
    <div className="relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      <div className={`relative rounded-3xl border-2 border-dashed transition-all p-6 flex items-center gap-5 ${archivo.file || dbDoc ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-300'} ${disabled && !archivo.file ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${archivo.file || dbDoc ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>{archivo.file || dbDoc ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}</div>
        <p className={`text-[10px] font-black uppercase tracking-tight truncate flex-1 ${archivo.file || dbDoc ? 'text-emerald-700' : 'text-slate-500'}`}>{archivo.file ? archivo.file.name : (dbDoc ? 'Archivo Resguardado' : 'Seleccionar Archivo')}</p>
        <input type="file" onChange={onFileChange} disabled={disabled} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
      </div>
    </div>
  );
}
