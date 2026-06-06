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
  Clock,
  RotateCcw
} from 'lucide-react';

interface Paso3Props {
  expediente: Expediente;
  contrato: Contrato;
  onComplete: () => Promise<void>;
}

export default function Paso3Contrato({ expediente, contrato, onComplete }: Paso3Props) {
  const [contratoFirmado, setContratoFirmado] = useState<{ file: File | null }>({ file: null });
  const [comprobantePago, setComprobantePago] = useState<{ file: File | null }>({ file: null });
  const [montoPago, setMontoPago] = useState<string>('');

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const pago = Array.isArray(expediente.pagos) ? expediente.pagos[0] : (expediente.pagos as any);
  const docContratoFirmado = expediente.documentos?.find(d => d.tipo === 'contrato_firmado');
  const docPago = expediente.documentos?.find(d => d.tipo === 'comprobante_pago');

  const isContratoValidado = !!docContratoFirmado?.validado;
  const isContratoRechazado = !!docContratoFirmado?.motivo_rechazo && !isContratoValidado;
  const isPagoVerificado = !!pago?.verificado || !!docPago?.validado;
  const isPagoRechazado = (!!pago?.motivo_rechazo || !!docPago?.motivo_rechazo) && !isPagoVerificado;

  const isUnderReview = (!!contrato.url_pdf_firmado_cliente || !!docContratoFirmado) && (!!pago || !!docPago) && !isContratoRechazado && !isPagoRechazado;

  const handleDescargar = () => contrato.url_pdf_generado && window.open(`/api/r2/download?url=${encodeURIComponent(contrato.url_pdf_generado)}`, '_blank');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if ((!docContratoFirmado || isContratoRechazado) && !contratoFirmado.file) { setError('Falta contrato firmado.'); return; }
    if ((!pago || isPagoRechazado) && !comprobantePago.file) { setError('Falta comprobante de pago.'); return; }
    
    startTransition(async () => {
      try {
        const carpeta = expediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
        if (contratoFirmado.file) {
          setProgress('Resguardando contrato...');
          const fd = new FormData(); fd.append('file', contratoFirmado.file);
          const res = await subirArchivoR2Action(fd, `expedientes/${carpeta}/contratos`);
          if (!res.success || !res.data) throw new Error(res.error);
          await registrarDocumento(expediente.id, 'contrato_firmado', res.data.url);
          await guardarContratoFirmado(contrato.id, res.data.url);
        }
        if (comprobantePago.file) {
          setProgress('Registrando pago...');
          const fdP = new FormData(); fdP.append('file', comprobantePago.file);
          await subirYRegistrarPago(fdP, expediente.id, Number(montoPago), expediente.nombre_empresa);
        }
        await actualizarEstatusExpediente(expediente.id, 'en_proceso');
        await onComplete();
      } catch (err: any) { setError(err.message); } finally { setProgress(''); }
    });
  };

  if (isUnderReview && !isPending) return (
    <div className="card-base p-16 text-center max-w-2xl mx-auto mt-12">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Formalización en Revisión</h2>
      <p className="text-slate-500 mb-8">Estamos verificando tu firma e inversión inicial. Una vez aprobado, tu abogada titular se pondrá en contacto contigo.</p>
      <div className="flex justify-center gap-6">
        <StatusPill label="Contrato" ok />
        <StatusPill label="Pago" ok={isPagoVerificado} />
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Formalización Legal</h2>
          <p className="text-slate-500 text-sm">Descargue, firme y sincronice su documentación de inversión.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card-base bg-blue-600 text-white p-6 shadow-lg border-none">
            <Download size={32} className="mb-4 opacity-50" />
            <h3 className="font-bold text-lg mb-2">Descargar Instrumento</h3>
            <p className="text-blue-100 text-xs mb-6 leading-relaxed">Su contrato oficial de prestación de servicios ha sido emitido con validez legal.</p>
            <button onClick={handleDescargar} className="w-full py-3 bg-white text-blue-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
              <Download size={14} /> Descargar PDF
            </button>
          </div>

          <div className="card-base p-6 bg-white space-y-4">
             <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estatus del Flujo</h4>
             <StepIndicator label="Documentación" done />
             <StepIndicator label="Emisión Contrato" done={!!contrato.url_pdf_generado} />
             <StepIndicator label="Firma Autógrafa" done={isContratoValidado} error={isContratoRechazado} />
             <StepIndicator label="Inversión Inicial" done={isPagoVerificado} error={isPagoRechazado} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card-base bg-white">
            <div className="card-header bg-slate-50/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronización de Archivos</span>
              {isPending && <Loader2 className="animate-spin text-blue-600" size={16} />}
            </div>
            <div className="card-content p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <UploadSection 
                  label="Contrato Firmado (.pdf, .jpg, .png)"
                  onFile={(f: File) => setContratoFirmado({ file: f })}
                  file={contratoFirmado.file}
                  isOk={isContratoValidado}
                  isErr={isContratoRechazado}
                  msg={docContratoFirmado?.motivo_rechazo}
                  disabled={isPending || (!!docContratoFirmado && !isContratoRechazado)}
                />
                
                <div className="space-y-6">
                  <UploadSection 
                    label="Comprobante de Inversión (.pdf, .jpg, .png)"
                    onFile={(f: File) => setComprobantePago({ file: f })}
                    file={comprobantePago.file}
                    isOk={isPagoVerificado}
                    isErr={isPagoRechazado}
                    msg={pago?.motivo_rechazo || docPago?.motivo_rechazo}
                    disabled={isPending || (!!pago && !isPagoRechazado)}
                  />
                  
                  {(!pago || isPagoRechazado) && (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block">Monto de la Inversión (MXN)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                        <input type="number" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} placeholder="0.00" className="input-field pl-8 font-bold text-lg" />
                      </div>
                    </div>
                  )}
                </div>

                {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase border border-red-100">{error}</div>}

                <button type="submit" disabled={isPending || (isContratoValidado && isPagoVerificado)} className="btn-primary w-full py-4 uppercase tracking-widest text-xs">
                  {isPending ? <><Loader2 className="animate-spin" size={16} /> {progress}</> : <><CheckCircle2 size={16} /> Finalizar Formalización</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ label, done, error }: any) {
  return (
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
      <span className={error ? 'text-red-500' : done ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
      {error ? <AlertCircle size={14} className="text-red-500" /> : done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock size={14} className="text-slate-200" />}
    </div>
  );
}

function StatusPill({ label, ok }: any) {
  return (
    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${ok ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
      {label}: {ok ? 'Validado' : 'Revisión'}
    </div>
  );
}

function UploadSection({ label, onFile, file, isOk, isErr, msg, disabled }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">{label}</label>
      <div className={`relative p-6 rounded-xl border-2 border-dashed transition-all ${file ? 'border-blue-500 bg-blue-50/20' : isErr ? 'border-red-300 bg-red-50/20' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isOk ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}>
            {isOk ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-700 truncate">{file ? file.name : isOk ? 'Verificado y Resguardado' : 'Click o arrastre para cargar'}</p>
            {isErr && !file && <p className="text-[9px] text-red-500 font-bold uppercase mt-0.5 italic">Motivo: {msg}</p>}
          </div>
        </div>
        <input type="file" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} disabled={disabled} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
