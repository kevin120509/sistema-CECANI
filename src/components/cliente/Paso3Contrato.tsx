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
  History
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

/**
 * Componente: Paso3Contrato
 * Habilidades Aplicadas:
 * - frontend-design (Luxury Financial UI)
 * - tailwind-css-patterns (Shadows & Micro-interactions)
 * - next-best-practices (Transition management)
 */
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

    if (!contratoFirmado.file) { setError('Por favor, sube el contrato firmado.'); return; }
    if (!comprobantePago.file) { setError('Por favor, sube el comprobante de pago.'); return; }
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) {
      setError('Por favor, ingresa un monto de pago válido.'); return;
    }

    startTransition(async () => {
      try {
        const carpetaEmpresa = expediente.nombre_empresa
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');

        setProgress('Validando contrato firmado...');
        const extContrato = contratoFirmado.file!.name.split('.').pop() || 'pdf';
        const fileRenombradoContrato = new File(
          [contratoFirmado.file!], 
          `Contrato_FIRMADO_CLIENTE_${carpetaEmpresa}.${extContrato}`, 
          { type: contratoFirmado.file!.type }
        );

        const fdContrato = new FormData();
        fdContrato.append('file', fileRenombradoContrato);
        
        const resContrato = await subirArchivoR2Action(fdContrato, `expedientes/${carpetaEmpresa}/contratos`);
        if (!resContrato.success || !resContrato.data) throw new Error(resContrato.error || 'Fallo en la subida del contrato.');
        
        await registrarDocumento(expediente.id, 'contrato_firmado', resContrato.data.url);
        await guardarContratoFirmado(contrato.id, resContrato.data.url);

        setProgress('Procesando boucher bancario...');
        const fdPago = new FormData();
        fdPago.append('file', comprobantePago.file!);
        
        const resPago = await subirYRegistrarPago(fdPago, expediente.id, Number(montoPago), expediente.nombre_empresa);
        if (!resPago.success) throw new Error(resPago.error || 'Error al validar el pago.');

        setProgress('Finalizando formalización...');
        await actualizarEstatusExpediente(expediente.id, 'en_proceso');
        
        await onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en la sincronización de documentos.');
      } finally {
        setProgress('');
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
          <FileSignature size={32} />
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Formalización de Contrato</h2>
        <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto leading-relaxed">
          Has llegado a la fase final del registro. Descarga tu contrato personalizado, fírmalo y adjunta el comprobante de tu inversión inicial.
        </p>
      </motion.div>

      {expediente.motivo_rechazo && !isWaitingForDirector && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto mb-8 bg-rose-50 border-4 border-rose-100 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-rose-100/50"><AlertCircle size={100} /></div>
          <div className="w-16 h-16 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-xl relative z-10"><AlertCircle size={32} /></div>
          <div className="space-y-2 relative z-10">
            <h3 className="text-xl font-bold text-rose-900 uppercase tracking-tight">Validación Rechazada</h3>
            <p className="text-sm font-semibold text-rose-700 leading-relaxed uppercase">{expediente.motivo_rechazo}</p>
            <p className="text-[10px] font-bold uppercase text-rose-500 tracking-widest pt-2">Por favor, corrija la firma o el comprobante y vuelva a subir los archivos solicitados.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Lado Izquierdo: Información y Descarga */}
        <div className="lg:col-span-5 space-y-8">
          <AnimatePresence mode="wait">
            {isWaitingForDirector ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="bg-slate-900 rounded-3xl p-10 text-white shadow-xl border border-white/5 relative overflow-hidden"
              >
                <div className="relative z-10 space-y-6">
                  <div className="w-14 h-14 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center animate-pulse">
                    <History size={28} />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Bajo Revisión Legal</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Nuestros analistas están verificando tu información para generar el contrato digital. 
                  </p>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">
                    <Loader2 className="animate-spin" size={14} />
                    Sincronizando con Dirección...
                  </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-sky-500/10 rounded-full blur-[100px]" />
              </motion.div>
            ) : (
              <motion.div 
                key="ready"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-sky-600 rounded-3xl p-10 text-white shadow-xl shadow-sky-200/50 border border-sky-500 relative overflow-hidden group"
              >
                <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <FileCheck size={28} />
                    </div>
                    <div className="px-4 py-1.5 bg-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">Listo</div>
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Contrato Generado</h3>
                    <p className="text-sky-100 text-sm leading-relaxed opacity-80">
                      Su instrumento legal ha sido emitido con éxito. Descargue el documento para su revisión y firma autógrafa.
                    </p>
                  </div>

                  <button 
                    onClick={handleDescargar}
                    className="w-full bg-white text-sky-600 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                  >
                    <Download size={18} /> Descargar PDF Oficial
                  </button>
                </div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-[100px] group-hover:bg-white/20 transition-all duration-1000" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Instrucciones de Formalización</h4>
            <ul className="space-y-4">
              {[
                { icon: <ShieldCheck size={16} />, text: "Firma todas las hojas en el margen izquierdo." },
                { icon: <CreditCard size={16} />, text: "Realiza tu inversión inicial a la cuenta CLABE indicada." },
                { icon: <UploadCloud size={16} />, text: "Escanea ambos documentos en PDF o foto clara." }
              ].map((item, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">{item.icon}</div>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tight">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Lado Derecho: Formulario de Subida */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-8 md:p-14 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <AnimatePresence>
              {isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
                  <div className="relative w-24 h-24 mb-8">
                    <Loader2 className="w-full h-full text-sky-600 animate-spin" size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Resguardando Expediente</h3>
                  <p className="text-sky-600 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">{progress}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-12">
              <section className="space-y-8">
                <header className="flex items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><UploadCloud size={18} /></div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Carga de Documentación Final</h4>
                </header>

                <div className="grid grid-cols-1 gap-10">
                  <UploadMini 
                    label="Contrato con Firma Autógrafa *" 
                    archivo={contratoFirmado} 
                    disabled={isPending || isWaitingForDirector}
                    onFileChange={(e) => handleFileChange(e, setContratoFirmado)}
                  />
                  
                  <UploadMini 
                    label="Comprobante de Inversión / Boucher *" 
                    archivo={comprobantePago} 
                    disabled={isPending || isWaitingForDirector}
                    onFileChange={(e) => handleFileChange(e, setComprobantePago)}
                  />

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">Importe de Inversión Realizada ($) *</label>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-colors font-black text-lg">$</div>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={montoPago}
                        onChange={(e) => setMontoPago(e.target.value)}
                        disabled={isPending || isWaitingForDirector}
                        className="w-full bg-slate-50/50 border-2 border-slate-100/50 focus:border-sky-500 focus:bg-white rounded-3xl py-5 pl-14 pr-8 text-sm font-bold text-slate-800 outline-none transition-all"
                        placeholder="Ej. 15,000.00"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {error && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-900 shadow-sm">
                  <div className="p-2 bg-red-100 rounded-xl"><AlertCircle size={20} /></div>
                  <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                </motion.div>
              )}

              <footer className="pt-10 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isPending || isWaitingForDirector}
                  className="w-full bg-slate-900 text-white py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-600 transition-all duration-500 shadow-2xl shadow-slate-200 flex items-center justify-center gap-4 group disabled:opacity-50"
                >
                  {isPending ? 'Sincronizando...' : 'Completar Registro Legal'} 
                  {!isPending && <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />}
                </button>
              </footer>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Componentes Atómicos ---

function UploadMini({ label, archivo, disabled, onFileChange }: {
  label: string,
  archivo: ArchivoSeleccionado,
  disabled: boolean,
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      <div className={`
        relative rounded-3xl border-2 border-dashed transition-all duration-500 p-6 flex items-center gap-5
        ${archivo.file ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${archivo.file ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
          {archivo.file ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-tight truncate ${archivo.file ? 'text-emerald-700' : 'text-slate-500'}`}>
            {archivo.file ? archivo.file.name : 'Seleccionar archivo digital'}
          </p>
          {!archivo.file && <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest opacity-60">PDF o Imagen admitida</p>}
        </div>
        <input 
          type="file" 
          onChange={onFileChange} 
          disabled={disabled}
          accept="image/*,.pdf"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
        />
      </div>
    </div>
  );
}
