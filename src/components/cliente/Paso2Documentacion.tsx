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

/**
 * Componente: Paso2Documentacion
 * Habilidades Aplicadas:
 * - frontend-design (Premium File Upload UI)
 * - tailwind-css-patterns (Glassmorphism & Shadows)
 * - next-best-practices (Transition states)
 */
export default function Paso2Documentacion({
  expediente,
  onComplete,
}: Paso2Props) {
  const [ineFrente, setIneFrente] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [ineReverso, setIneReverso] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [comprobanteDomicilio, setComprobanteDomicilio] = useState<ArchivoSeleccionado>({ file: null, preview: null });

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isUnderReview = expediente.estatus === 'revision_directora';
  const docs = expediente.documentos || [];
  
  const docIneFrente = docs.find(d => d.tipo === 'ine_frente');
  const docIneReverso = docs.find(d => d.tipo === 'ine_reverso');
  const docComprobante = docs.find(d => d.tipo === 'comprobante_domicilio');

  const allApproved = docIneFrente?.validado && docIneReverso?.validado && docComprobante?.validado;

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

    // Solo requerir los que no están aprobados
    if (!docIneFrente?.validado && !ineFrente.file) { setError('Falta INE Frente'); return; }
    if (!docIneReverso?.validado && !ineReverso.file) { setError('Falta INE Reverso'); return; }
    if (!docComprobante?.validado && !comprobanteDomicilio.file) { setError('Falta Comprobante'); return; }

    startTransition(async () => {
      try {
        if (ineFrente.file) await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE Frente', 'INE_Frente');
        if (ineReverso.file) await subirYRegistrar(ineReverso.file, 'ine_reverso', 'INE Reverso', 'INE_Reverso');
        if (comprobanteDomicilio.file) await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante de Domicilio', 'Comprobante_Domicilio');

        await actualizarEstatusExpediente(expediente.id, 'revision_directora');

        if (allApproved) {
            setProgress('Generando contrato inteligente...');
            const contratoId = expediente.contratos?.[0]?.id;
            if (contratoId) {
            await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
            }
        }

        await onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado en la bóveda de archivos.');
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
            Hemos recibido tus documentos correctamente. La Dirección Central está validando la información para proceder con la generación de tu contrato.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
          {[
            { label: 'INE Frente', validado: docIneFrente?.validado },
            { label: 'INE Reverso', validado: docIneReverso?.validado },
            { label: 'Domicilio', validado: docComprobante?.validado },
          ].map((d, i) => (
            <div key={i} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 ${d.validado ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              {d.validado ? <CheckCircle2 size={24} /> : <Loader2 className="animate-spin" size={24} />}
              <span className="text-[10px] font-black uppercase tracking-widest">{d.label}</span>
              <span className="text-[8px] font-bold uppercase">{d.validado ? 'Validado' : 'Pendiente'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-sky-100">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Bóveda de Documentos</h2>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
          Para proceder con la formalización legal, requerimos la digitalización de sus documentos oficiales. Sus datos están protegidos bajo cifrado de grado militar.
        </p>
      </motion.div>

      <div className="bg-white rounded-[3.5rem] p-8 md:p-14 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] border border-slate-100 relative overflow-hidden">
        {/* Progress Overlay */}
        <AnimatePresence>
          {isPending && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center"
            >
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-sky-100 animate-pulse"></div>
                <Loader2 className="w-full h-full text-sky-600 animate-spin" size={48} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Procesando Archivos</h3>
              <p className="text-sky-600 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">{progress}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-10 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-center gap-4 text-red-900 shadow-sm">
            <div className="p-2 bg-red-100 rounded-xl"><AlertCircle size={20} /></div>
            <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-12">
          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">01. Identificación Oficial</h4>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <UploadCard 
                label="INE / Pasaporte (Frente) *" 
                archivo={ineFrente} 
                disabled={isPending}
                onFileChange={(e) => handleFileChange(e, setIneFrente)}
                onClear={() => setIneFrente({ file: null, preview: null })}
              />
              <UploadCard 
                label="INE / Pasaporte (Reverso) *" 
                archivo={ineReverso} 
                disabled={isPending}
                onFileChange={(e) => handleFileChange(e, setIneReverso)}
                onClear={() => setIneReverso({ file: null, preview: null })}
              />
            </div>
          </section>

          <section className="space-y-8">
            <header className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><ImageIcon size={18} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">02. Domicilio Vigente</h4>
            </header>
            
            <div className="grid grid-cols-1 gap-8">
              <UploadCard 
                label="Comprobante de Domicilio (Agua, Luz, Tel.) *" 
                archivo={comprobanteDomicilio} 
                disabled={isPending}
                onFileChange={(e) => handleFileChange(e, setComprobanteDomicilio)}
                onClear={() => setComprobanteDomicilio({ file: null, preview: null })}
              />
            </div>
          </section>

          <footer className="pt-10 border-t border-slate-100 flex justify-end items-center gap-8">
            <div className="hidden sm:block text-right">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-2">Formato aceptado</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-none">PDF, JPG, PNG (Máx 10MB)</p>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="bg-slate-950 text-white px-12 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-sky-600 transition-all duration-500 shadow-2xl shadow-slate-200 flex items-center gap-4 group disabled:opacity-50"
            >
              Enviar a Revisión <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// --- Componente de Tarjeta de Subida Premium ---

function UploadCard({ label, archivo, disabled, onFileChange, onClear }: { 
  label: string, 
  archivo: ArchivoSeleccionado, 
  disabled: boolean, 
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  onClear: () => void 
}) {
  return (
    <div className="group relative">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block ml-1">{label}</label>
      
      <div className={`
        relative h-48 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 overflow-hidden flex flex-col items-center justify-center p-6
        ${archivo.file ? 'border-sky-500 bg-sky-50/20 shadow-inner' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}>
        {archivo.preview ? (
          <div className="absolute inset-0 w-full h-full group-hover:scale-110 transition-transform duration-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={archivo.preview} alt="Preview" className="w-full h-full object-cover opacity-30 grayscale" />
            <div className="absolute inset-0 bg-gradient-to-t from-sky-50 via-transparent to-transparent" />
          </div>
        ) : null}

        <div className="relative z-10 text-center space-y-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto transition-all duration-500 ${archivo.file ? 'bg-sky-500 text-white rotate-12 shadow-lg shadow-sky-500/30' : 'bg-white text-slate-400 shadow-sm'}`}>
            {archivo.file ? <CheckCircle2 size={28} /> : <FileUp size={28} />}
          </div>
          
          <div className="space-y-1">
            <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${archivo.file ? 'text-sky-600' : 'text-slate-500'}`}>
              {archivo.file ? archivo.file.name : 'Click para digitalizar'}
            </p>
            {!archivo.file && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">Seleccionar archivo</p>}
          </div>
        </div>

        <input 
          type="file" 
          onChange={onFileChange} 
          disabled={disabled}
          accept="image/*,.pdf"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
        />

        {archivo.file && !disabled && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute top-6 right-6 z-30 w-10 h-10 rounded-xl bg-white text-red-500 shadow-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 active:scale-90"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
