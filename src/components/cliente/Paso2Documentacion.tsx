'use client';

import { useState, useTransition } from 'react';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import { generarContratoAutomatico } from '@/actions/contrato';
import type { Expediente, TipoDocumento } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  FileText, 
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';

interface Paso2Props {
  expediente: Expediente;
  onComplete: () => Promise<void>;
}

interface ArchivoSeleccionado {
  file: File | null;
  preview: string | null;
}

export default function Paso2Documentacion({
  expediente,
  onComplete,
}: Paso2Props) {
  const [ineFrente, setIneFrente] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [ineVuelta, setIneVuelta] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [comprobanteDomicilio, setComprobanteDomicilio] = useState<ArchivoSeleccionado>({ file: null, preview: null });

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isUnderReview = expediente.estatus === 'revision_directora';
  const docs = expediente.documentos || [];
  
  const docIneFrente = docs.find(d => d.tipo === 'ine_frente');
  const docIneVuelta = docs.find(d => d.tipo === 'ine_reverso');
  const docComprobante = docs.find(d => d.tipo === 'comprobante_domicilio');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: ArchivoSeleccionado) => void) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setter({ file, preview });
    }
  };

  const subirYRegistrar = async (file: File, tipo: TipoDocumento, descripcion: string, nombreClave: string): Promise<string> => {
    setProgress(`Digitalizando ${descripcion}...`);
    
    const carpetaEmpresa = expediente.nombre_empresa
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const extension = file.name.split('.').pop() || 'bin';
    const nuevoNombre = `${nombreClave}_${carpetaEmpresa}.${extension}`;
    const fileRenombrado = new File([file], nuevoNombre, { type: file.type });
    
    const formData = new FormData();
    formData.append('file', fileRenombrado);
    
    const uploadResult = await subirArchivoR2Action(formData, `expedientes/${carpetaEmpresa}/documentacion`);
    
    if (!uploadResult.success || !uploadResult.data) {
      throw new Error(`Error al subir ${descripcion}: ${uploadResult.error}`);
    }

    const urlPublicaR2 = uploadResult.data.url;

    setProgress(`Resguardando ${descripcion}...`);
    const registerResult = await registrarDocumento(expediente.id, tipo, urlPublicaR2);
    if (!registerResult.success) {
      throw new Error(`Error al registrar ${descripcion}: ${registerResult.error}`);
    }
    return urlPublicaR2;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!docIneFrente?.validado && !ineFrente.file) { setError('Falta INE Frente'); return; }
    if (!docIneVuelta?.validado && !ineVuelta.file) { setError('Falta INE Vuelta'); return; }
    if (!docComprobante?.validado && !comprobanteDomicilio.file) { setError('Falta Comprobante Domicilio'); return; }

    startTransition(async () => {
      try {
        if (ineFrente.file) await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE Frente', 'INE_Frente');
        if (ineVuelta.file) await subirYRegistrar(ineVuelta.file, 'ine_reverso', 'INE Vuelta', 'INE_Vuelta');
        if (comprobanteDomicilio.file) await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante Domicilio', 'Comprobante_Domicilio');

        await actualizarEstatusExpediente(expediente.id, 'revision_directora');

        setProgress('Generando contrato inteligente...');
        const contratoId = expediente.contratos?.[0]?.id;
        if (contratoId) {
          await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
        }

        await onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado.');
      } finally {
        setProgress('');
      }
    });
  };

  if (isUnderReview && !error && !isPending) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-8">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-sky-100 animate-pulse">
          <Clock size={48} />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Documentación en Revisión</h2>
          <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            Estamos validando tus documentos para generar tu contrato oficial.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
          {[
            { label: 'INE Frente', validado: docIneFrente?.validado },
            { label: 'INE Vuelta', validado: docIneVuelta?.validado },
            { label: 'Domicilio', validado: docComprobante?.validado },
          ].map((d, i) => (
            <div key={i} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 ${d.validado ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              {d.validado ? <CheckCircle2 size={24} /> : <Loader2 className="animate-spin" size={24} />}
              <span className="text-[10px] font-black uppercase tracking-widest">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-sky-100">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Bóveda de Documentos</h2>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">Sube copias legibles de tus documentos oficiales.</p>
      </motion.div>

      {expediente.motivo_rechazo && (
        <div className="bg-rose-50 border-4 border-rose-100 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0" size={32} />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-rose-900 uppercase tracking-tight">Documentación Rechazada</h3>
            <p className="text-sm font-semibold text-rose-700 leading-relaxed uppercase">{expediente.motivo_rechazo}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 md:p-14 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        <AnimatePresence>
          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center">
              <Loader2 className="text-sky-600 animate-spin mb-4" size={48} />
              <p className="text-sky-600 font-black text-[10px] uppercase tracking-[0.3em]">{progress}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-12">
          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Identificación Oficial</h4>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <UploadCard label="INE Frente *" archivo={ineFrente} disabled={isPending} onFileChange={(e: any) => handleFileChange(e, setIneFrente)} onClear={() => setIneFrente({ file: null, preview: null })} />
              <UploadCard label="INE Vuelta *" archivo={ineVuelta} disabled={isPending} onFileChange={(e: any) => handleFileChange(e, setIneVuelta)} onClear={() => setIneVuelta({ file: null, preview: null })} />
            </div>
          </section>

          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Fiscal y Domicilio</h4>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <UploadCard label="Comprobante Domicilio *" archivo={comprobanteDomicilio} disabled={isPending} onFileChange={(e: any) => handleFileChange(e, setComprobanteDomicilio)} onClear={() => setComprobanteDomicilio({ file: null, preview: null })} />
            </div>
          </section>

          <footer className="pt-10 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={isPending} className="bg-slate-900 text-white px-12 py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-600 transition-all flex items-center gap-4 group disabled:opacity-50">
              Enviar a Revisión <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function UploadCard({ label, archivo, disabled, onFileChange, onClear }: any) {
  return (
    <div className="group relative">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      <div className={`relative h-48 rounded-3xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center p-6 ${archivo.file ? 'border-sky-500 bg-sky-50/20' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-300'}`}>
        {archivo.preview && <img src={archivo.preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className="relative z-10 text-center space-y-2">
          {archivo.file ? <CheckCircle2 className="text-sky-500 mx-auto" size={32} /> : <FileUp className="text-slate-400 mx-auto" size={32} />}
          <p className="text-[10px] font-bold uppercase truncate max-w-[200px]">{archivo.file ? archivo.file.name : 'Click para subir'}</p>
        </div>
        <input type="file" onChange={onFileChange} disabled={disabled} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
        {archivo.file && !disabled && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute top-4 right-4 z-30 w-8 h-8 rounded-lg bg-white text-red-500 shadow-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  );
}
