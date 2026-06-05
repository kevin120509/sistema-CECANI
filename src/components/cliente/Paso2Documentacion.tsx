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

  const docs = expediente.documentos || [];
  
  // Lógica de revisión: Si está en estatus revisión PERO algún documento tiene motivo de rechazo, 
  // significa que la directora ya interactuó y rechazó algo. En ese caso NO mostramos la pantalla de "En Revisión",
  // sino que permitimos que el cliente corrija.
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

  // Helper: un doc necesita re-subirse si no existe, si fue rechazado (motivo_rechazo), o si su url está vacía
  const docNecesitaArchivo = (doc: any) =>
    !doc || !doc.url_archivo || !!doc.motivo_rechazo;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación inteligente: Solo exigir archivo si no existe ya en la DB y no está validado
    if (docNecesitaArchivo(docIneFrente) && !ineFrente.file) { setError('Falta INE Frente o corregir el actual.'); return; }
    if (docNecesitaArchivo(docIneVuelta) && !ineVuelta.file) { setError('Falta INE Vuelta o corregir el actual.'); return; }
    if (docNecesitaArchivo(docComprobante) && !comprobanteDomicilio.file) { setError('Falta Comprobante Domicilio o corregir el actual.'); return; }

    startTransition(async () => {
      try {
        console.log('Iniciando proceso de subida quirúrgica...');
        
        // Solo subimos lo que el usuario seleccionó de nuevo
        if (ineFrente.file) {
          console.log('Subiendo nueva INE Frente...');
          await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE Frente', 'INE_Frente');
        }
        
        if (ineVuelta.file) {
          console.log('Subiendo nueva INE Vuelta...');
          await subirYRegistrar(ineVuelta.file, 'ine_reverso', 'INE Vuelta', 'INE_Vuelta');
        }
        
        if (comprobanteDomicilio.file) {
          console.log('Subiendo nuevo Comprobante Domicilio...');
          await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante Domicilio', 'Comprobante_Domicilio');
        }

        console.log('Actualizando estatus del expediente a revisión...');
        const resEstatus = await actualizarEstatusExpediente(expediente.id, 'revision_directora');
        if (!resEstatus.success) throw new Error(resEstatus.error || 'Error al actualizar estatus.');

        // Si es la primera vez que sube todo, intentamos generar el contrato
        const contratoId = expediente.contratos?.[0]?.id;
        if (contratoId && expediente.estatus === 'en_registro') {
          setProgress('Generando contrato inteligente...');
          const resContrato = await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
          if (!resContrato.success) console.warn('Error no crítico al generar contrato:', resContrato.error);
        }

        console.log('Proceso completado exitosamente.');
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
      <div className="max-w-4xl mx-auto py-20 text-center space-y-8">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-sky-950/40 text-sky-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-sky-900 animate-pulse">
          <Clock size={48} />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Documentación en Revisión</h2>
          <p className="text-slate-400 font-medium text-lg max-w-xl mx-auto leading-relaxed">
            Estamos validando tus documentos para generar tu contrato oficial.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
          {[
            { label: 'INE Frente', validado: docIneFrente?.validado },
            { label: 'INE Vuelta', validado: docIneVuelta?.validado },
            { label: 'Domicilio', validado: docComprobante?.validado },
          ].map((d, i) => (
            <div key={i} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 ${d.validado ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
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
        <div className="w-16 h-16 bg-sky-950/40 text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-sky-900">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Bóveda de Documentos</h2>
        <p className="text-slate-400 font-medium text-lg max-w-xl mx-auto leading-relaxed">
          {hasAnyRejection ? 'Por favor, corrige los documentos marcados en rojo para continuar.' : 'Sube copias legibles de tus documentos oficiales.'}
        </p>
      </motion.div>

      {error && (
        <div className="bg-rose-950/40 border-4 border-rose-900 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <AlertCircle className="text-rose-400 shrink-0" size={32} />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-rose-200 uppercase tracking-tight">Ocurrió un error</h3>
            <p className="text-sm font-semibold text-rose-300 leading-relaxed uppercase">{error}</p>
          </div>
        </div>
      )}

      {expediente.motivo_rechazo && (
        <div className="bg-rose-950/40 border-4 border-rose-900 rounded-3xl p-8 flex items-start gap-6 shadow-lg relative overflow-hidden">
          <AlertCircle className="text-rose-400 shrink-0" size={32} />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-rose-200 uppercase tracking-tight">Documentación Rechazada</h3>
            <p className="text-sm font-semibold text-rose-300 leading-relaxed uppercase">{expediente.motivo_rechazo}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-3xl p-8 md:p-14 shadow-2xl shadow-slate-950/50 border border-slate-800 relative overflow-hidden">
        <AnimatePresence>
          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center">
              <Loader2 className="text-sky-500 animate-spin mb-4" size={48} />
              <p className="text-sky-500 font-black text-[10px] uppercase tracking-[0.3em]">{progress}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-12">
          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-800 pb-6">
              <div className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Identificación Oficial</h4>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-800 pb-6">
              <div className="w-10 h-10 bg-slate-950 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Fiscal y Domicilio</h4>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

          <footer className="pt-10 border-t border-slate-800 flex justify-end">
            <button type="submit" disabled={isPending} className="bg-sky-600 text-white px-12 py-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-500 transition-all flex items-center gap-4 group disabled:opacity-50">
              {hasAnyRejection ? 'Enviar Correcciones' : 'Enviar a Revisión'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function UploadCard({ label, archivo, dbDoc, disabled, onFileChange, onClear }: any) {
  // Estado del documento:
  // - validado: aprobado por directora (bloqueado)
  // - rechazado: tiene motivo_rechazo o url vacía con registro existente (editable con aviso)
  // - resguardado: subido pero pendiente de revisión (bloqueado visualmente, no editable)
  // - vacío: nunca subido (editable)
  const isRejected = dbDoc && dbDoc.motivo_rechazo && !dbDoc.validado;
  const isResguardado = dbDoc && dbDoc.url_archivo && !dbDoc.motivo_rechazo && !dbDoc.validado;

  return (
    <div className="group relative">
      <div className="flex justify-between items-end mb-4 ml-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{label}</label>
        {dbDoc?.validado && (
          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900 flex items-center gap-1">
            <CheckCircle2 size={10} /> Validado
          </span>
        )}
        {isResguardado && (
          <span className="text-[8px] font-black text-sky-400 uppercase tracking-tighter bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-900 flex items-center gap-1">
            <Clock size={10} /> En revisión
          </span>
        )}
        {isRejected && (
          <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-900 flex items-center gap-1">
            <AlertCircle size={10} /> Rechazado
          </span>
        )}
      </div>

      <div className={`relative h-48 rounded-3xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center p-6 
        ${archivo.file ? 'border-sky-500 bg-sky-900/20' : 
          dbDoc?.validado ? 'border-emerald-800 bg-emerald-900/10 opacity-60' :
          isRejected ? 'border-rose-800 bg-rose-900/20' :
          isResguardado ? 'border-sky-800 bg-sky-900/20 opacity-70' :
          'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-sky-500'}
        ${disabled && !archivo.file ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        
        {archivo.preview && <img src={archivo.preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        {!archivo.preview && (dbDoc?.validado || isResguardado || (isRejected && !archivo.file)) && dbDoc?.url_archivo && (
          <div className="absolute inset-0 w-full h-full bg-slate-900/5 flex items-center justify-center">
            <FileText className="text-slate-200" size={64} />
          </div>
        )}

        <div className="relative z-10 text-center space-y-2">
          {dbDoc?.validado ? (
            <CheckCircle2 className="text-emerald-500 mx-auto" size={32} />
          ) : archivo.file ? (
            <CheckCircle2 className="text-sky-500 mx-auto" size={32} />
          ) : isRejected ? (
            <AlertCircle className="text-rose-500 mx-auto" size={32} />
          ) : isResguardado ? (
            <Clock className="text-sky-400 mx-auto" size={32} />
          ) : (
            <FileUp className="text-slate-400 mx-auto" size={32} />
          )}
          <p className="text-[10px] font-bold uppercase truncate max-w-[200px]">
            {archivo.file ? archivo.file.name : 
             dbDoc?.validado ? 'Documento Resguardado' :
             isRejected ? 'Requiere Corrección' :
             isResguardado ? 'En Revisión' :
             'Click para subir'}
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
          <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute top-4 right-4 z-30 w-8 h-8 rounded-lg bg-white text-red-500 shadow-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
        )}
      </div>

      <AnimatePresence>
        {isRejected && !archivo.file && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-4 bg-rose-950/40 border border-rose-900/50 rounded-2xl shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={12} className="text-rose-400" />
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Motivo de Rechazo:</p>
            </div>
            <p className="text-[11px] font-bold text-rose-200 leading-tight uppercase pl-5">{dbDoc.motivo_rechazo}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
