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
  Clock,
  CloudUpload,
  User,
  MapPin,
  Camera
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

  const docs = expediente.documentos || [];
  
  const isUnderReview = expediente.estatus === 'revision_directora' && docs.every(d => !d.motivo_rechazo);
  const hasAnyRejection = docs.some(d => !!d.motivo_rechazo) || !!expediente.motivo_rechazo;

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

  const docNecesitaArchivo = (doc: any) =>
    !doc || !doc.url_archivo || !!doc.motivo_rechazo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (docNecesitaArchivo(docIneFrente) && !ineFrente.file) { setError('Falta INE Frente o corregir el actual.'); return; }
    if (docNecesitaArchivo(docIneVuelta) && !ineVuelta.file) { setError('Falta INE Vuelta o corregir el actual.'); return; }
    if (docNecesitaArchivo(docComprobante) && !comprobanteDomicilio.file) { setError('Falta Comprobante Domicilio o corregir el actual.'); return; }

    startTransition(async () => {
      try {
        if (ineFrente.file) await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE Frente', 'INE_Frente');
        if (ineVuelta.file) await subirYRegistrar(ineVuelta.file, 'ine_reverso', 'INE Vuelta', 'INE_Vuelta');
        if (comprobanteDomicilio.file) await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante Domicilio', 'Comprobante_Domicilio');

        const resEstatus = await actualizarEstatusExpediente(expediente.id, 'revision_directora');
        if (!resEstatus.success) throw new Error(resEstatus.error || 'Error al actualizar estatus.');

        const contratoId = expediente.contratos?.[0]?.id;
        if (contratoId && expediente.estatus === 'en_registro') {
          setProgress('Generando contrato inteligente...');
          const resContrato = await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
          if (!resContrato.success) console.warn('Error no crítico al generar contrato:', resContrato.error);
        }

        await onComplete();
      } catch (err) {
        console.error('Error en handleSubmit:', err);
        const msg = err instanceof Error ? err.message : 'Error inesperado.';
        if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
          setError('Tu sesión de expediente ha expirado. Por favor, reinicia el registro.');
        } else {
          setError(msg);
        }
      } finally {
        setProgress('');
      }
    });
  };

  if (isUnderReview && !error && !isPending) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-28 h-28 bg-sky-600/10 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-sky-600/20 animate-pulse">
          <Clock size={56} />
        </motion.div>
        <div className="space-y-6">
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-tight">Documentación en Validación</h2>
          <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            Nuestros expertos legales están verificando sus documentos para la generación del contrato oficial.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto pt-10">
          {[
            { label: 'INE Frente', validado: docIneFrente?.validado },
            { label: 'INE Vuelta', validado: docIneVuelta?.validado },
            { label: 'Domicilio', validado: docComprobante?.validado },
          ].map((d, i) => (
            <div key={i} className={`p-8 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all duration-500 ${d.validado ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
              {d.validado ? <CheckCircle2 size={28} /> : <Loader2 className="animate-spin" size={28} />}
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="pt-10 flex items-center justify-center gap-3 text-sky-500 font-black text-[11px] uppercase tracking-[0.4em]">
          <Loader2 className="animate-spin" size={24} />
          <span>Sincronizando portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
        <div className="w-20 h-20 bg-sky-600/10 text-sky-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-sky-600/20">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Bóveda de Documentos</h2>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
          {hasAnyRejection ? 'Se han detectado observaciones. Por favor, reemplace los documentos marcados para continuar.' : 'Adjunte la documentación oficial requerida para formalizar su expediente corporativo.'}
        </p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 flex items-start gap-6 shadow-2xl relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0" size={32} />
          <div className="space-y-1">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Error de Sistema</h3>
            <p className="text-sm font-bold text-rose-200 leading-relaxed uppercase">{error}</p>
          </div>
        </motion.div>
      )}

      {expediente.motivo_rechazo && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 flex items-start gap-6 shadow-2xl relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0" size={32} />
          <div className="space-y-1">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Observación de Dirección</h3>
            <p className="text-sm font-bold text-rose-200 leading-relaxed uppercase">{expediente.motivo_rechazo}</p>
          </div>
        </motion.div>
      )}

      <div className="bg-slate-900 rounded-3xl p-8 md:p-16 shadow-2xl border border-slate-800 relative overflow-hidden">
        <AnimatePresence>
          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-sky-600/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CloudUpload className="text-sky-600" size={32} />
                </div>
              </div>
              <p className="text-sky-600 font-black text-xs uppercase tracking-[0.5em] animate-pulse">{progress}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-16">
          <section className="space-y-10">
            <header className="flex items-center gap-5 border-b border-slate-800 pb-8">
              <div className="w-12 h-12 bg-slate-950 text-sky-400 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800"><User size={20} /></div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Identidad Legal</h4>
                <p className="text-[9px] font-bold text-slate-600 uppercase">Cargue su identificación oficial vigente (Ambos lados)</p>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <UploadCard 
                label="INE Frente *" 
                archivo={ineFrente} 
                dbDoc={docIneFrente}
                disabled={isPending || (!!docIneFrente?.url_archivo && !docIneFrente?.motivo_rechazo && docIneFrente?.validado)} 
                onFileChange={(e: any) => handleFileChange(e, setIneFrente)} 
                onClear={() => setIneFrente({ file: null, preview: null })} 
              />
              <UploadCard 
                label="INE Vuelta *" 
                archivo={ineVuelta} 
                dbDoc={docIneVuelta}
                disabled={isPending || (!!docIneVuelta?.url_archivo && !docIneVuelta?.motivo_rechazo && docIneVuelta?.validado)} 
                onFileChange={(e: any) => handleFileChange(e, setIneVuelta)} 
                onClear={() => setIneVuelta({ file: null, preview: null })} 
              />
            </div>
          </section>

          <section className="space-y-10">
            <header className="flex items-center gap-5 border-b border-slate-800 pb-8">
              <div className="w-12 h-12 bg-slate-950 text-sky-400 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800"><MapPin size={20} /></div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Localización y Fiscal</h4>
                <p className="text-[9px] font-bold text-slate-600 uppercase">Documentos que acrediten su domicilio actual</p>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <UploadCard 
                label="Comprobante Domicilio *" 
                archivo={comprobanteDomicilio} 
                dbDoc={docComprobante}
                disabled={isPending || (!!docComprobante?.url_archivo && !docComprobante?.motivo_rechazo && docComprobante?.validado)} 
                onFileChange={(e: any) => handleFileChange(e, setComprobanteDomicilio)} 
                onClear={() => setComprobanteDomicilio({ file: null, preview: null })} 
              />
            </div>
          </section>

          <footer className="pt-12 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
             <div className="flex items-center gap-4 text-slate-600">
               <ShieldCheck size={18} />
               <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed max-w-[280px]">Sus archivos son resguardados bajo protocolos de cifrado de grado bancario.</p>
             </div>
            <button type="submit" disabled={isPending} className="w-full md:w-auto bg-sky-600 text-white px-16 py-7 rounded-3xl text-[11px] font-black uppercase tracking-[0.4em] hover:shadow-[0_20px_50px_rgba(14,165,233,0.4)] transition-all duration-500 group disabled:opacity-50 flex items-center justify-center gap-5">
              {hasAnyRejection ? 'Reenviar Correcciones' : 'Sincronizar Bóveda'} <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function UploadCard({ label, archivo, dbDoc, disabled, onFileChange, onClear }: any) {
  const isRejected = dbDoc && dbDoc.motivo_rechazo && !dbDoc.validado;
  const isResguardado = dbDoc && dbDoc.url_archivo && !dbDoc.motivo_rechazo && !dbDoc.validado;

  return (
    <div className="group relative">
      <div className="flex justify-between items-end mb-5 ml-1">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">{label}</label>
        {dbDoc?.validado && (
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 size={12} /> Validado
          </span>
        )}
        {isResguardado && (
          <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest bg-sky-600/10 px-4 py-1.5 rounded-full border border-sky-600/20 flex items-center gap-2">
            <Clock size={12} /> Revisión
          </span>
        )}
        {isRejected && (
          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20 flex items-center gap-2">
            <AlertCircle size={12} /> Corregir
          </span>
        )}
      </div>

      <div className={`relative h-60 rounded-3xl border-2 border-dashed transition-all duration-500 overflow-hidden flex flex-col items-center justify-center p-8 
        ${archivo.file ? 'border-sky-600 bg-sky-600/10 shadow-xl' : 
          dbDoc?.validado ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80' :
          isRejected ? 'border-rose-500/30 bg-rose-500/10' :
          isResguardado ? 'border-sky-600/30 bg-sky-600/5 opacity-90' :
          'border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-sky-600/40'}
        ${disabled && !archivo.file ? 'cursor-not-allowed' : 'cursor-pointer group'}`}>
        
        {archivo.preview && <img src={archivo.preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />}
        {!archivo.preview && (dbDoc?.validado || isResguardado || (isRejected && !archivo.file)) && dbDoc?.url_archivo && (
          <div className="absolute inset-0 w-full h-full bg-slate-950/40 flex items-center justify-center">
            <FileText className="text-sky-600/30" size={80} />
          </div>
        )}

        <div className="relative z-10 text-center space-y-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 ${archivo.file ? 'bg-sky-600 text-white scale-110' : 'bg-slate-900 text-slate-500 group-hover:bg-sky-600/20 group-hover:text-sky-400 group-hover:scale-110'}`}>
            {dbDoc?.validado ? (
              <CheckCircle2 size={32} />
            ) : archivo.file ? (
              <CheckCircle2 size={32} />
            ) : isRejected ? (
              <Camera size={32} className="text-rose-500" />
            ) : isResguardado ? (
              <Clock size={32} className="text-sky-600" />
            ) : (
              <CloudUpload size={32} />
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest truncate max-w-[220px] text-slate-400 group-hover:text-white transition-colors">
            {archivo.file ? archivo.file.name : 
             dbDoc?.validado ? 'Expediente Seguro' :
             isRejected ? 'Reintentar Captura' :
             isResguardado ? 'Validando...' :
             'Sincronizar Archivo'}
          </p>
        </div>

        <input 
          type="file" 
          onChange={onFileChange} 
          disabled={disabled} 
          accept="image/*,.pdf" 
          className={`absolute inset-0 w-full h-full opacity-0 z-20 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} 
        />
        
        {archivo.file && !disabled && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute top-6 right-6 z-30 w-10 h-10 rounded-xl bg-slate-950 text-rose-500 shadow-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-12"><Trash2 size={20} /></button>
        )}
      </div>

      <AnimatePresence>
        {isRejected && !archivo.file && (
          <motion.div 
            initial={{ opacity: 0, y: -15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl shadow-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle size={14} className="text-rose-500" />
              <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Observación Técnica:</p>
            </div>
            <p className="text-[11px] font-bold text-rose-200/80 leading-relaxed uppercase pl-6 italic">"{dbDoc.motivo_rechazo}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
