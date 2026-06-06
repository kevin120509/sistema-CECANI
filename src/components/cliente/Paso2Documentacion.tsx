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
  ArrowRight,
  ShieldCheck,
  Clock,
  CloudUpload,
  Camera,
  ChevronRight
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

  const subirYRegistrar = async (file: File, tipo: TipoDocumento, descripcion: string, nombreClave: string) => {
    setProgress(`Subiendo ${descripcion}...`);
    const carpeta = expediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    const ext = file.name.split('.').pop() || 'bin';
    const fd = new FormData();
    fd.append('file', new File([file], `${nombreClave}_${carpeta}.${ext}`, { type: file.type }));
    
    const up = await subirArchivoR2Action(fd, `expedientes/${carpeta}/documentacion`);
    if (!up.success || !up.data) throw new Error(up.error);
    
    const reg = await registrarDocumento(expediente.id, tipo, up.data.url);
    if (!reg.success) throw new Error(reg.error);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const check = (doc: any, file: any) => !doc || !doc.url_archivo || !!doc.motivo_rechazo ? !!file : true;
    if (!check(docIneFrente, ineFrente.file) || !check(docIneVuelta, ineVuelta.file) || !check(docComprobante, comprobanteDomicilio.file)) {
      setError('Por favor cargue todos los documentos requeridos.'); return;
    }

    startTransition(async () => {
      try {
        if (ineFrente.file) await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE Frente', 'INE_Frente');
        if (ineVuelta.file) await subirYRegistrar(ineVuelta.file, 'ine_reverso', 'INE Vuelta', 'INE_Vuelta');
        if (comprobanteDomicilio.file) await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante', 'Comprobante_Domicilio');

        await actualizarEstatusExpediente(expediente.id, 'revision_directora');
        const contratoId = expediente.contratos?.[0]?.id;
        if (contratoId && expediente.estatus === 'en_registro') {
          await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
        }
        await onComplete();
      } catch (err: any) {
        setError(err.message || 'Error inesperado.');
      } finally { setProgress(''); }
    });
  };

  if (isUnderReview && !error && !isPending) return (
    <div className="card-base p-16 text-center max-w-2xl mx-auto mt-12">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Clock size={40} className="animate-pulse" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Expediente en Validación</h2>
      <p className="text-slate-500 mb-8">Nuestros analistas están verificando tu documentación. Recibirás una notificación cuando el contrato esté listo para firma.</p>
      <div className="flex justify-center gap-4">
        {[docIneFrente, docIneVuelta, docComprobante].map((d, i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${d?.validado ? 'bg-emerald-500' : 'bg-blue-200'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bóveda Documental</h2>
          <p className="text-slate-500 text-sm">Resguarde copias legibles de su documentación oficial.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
          <ShieldCheck size={18} className="text-blue-600" />
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Cifrado Bancario Activo</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span className="text-sm font-bold uppercase">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UploadCard 
            label="INE (Frente)" 
            archivo={ineFrente} 
            dbDoc={docIneFrente} 
            onFileChange={(e: any) => handleFileChange(e, setIneFrente)} 
            onClear={() => setIneFrente({ file: null, preview: null })} 
            disabled={isPending || (!!docIneFrente?.url_archivo && docIneFrente?.validado)}
          />
          <UploadCard 
            label="INE (Vuelta)" 
            archivo={ineVuelta} 
            dbDoc={docIneVuelta} 
            onFileChange={(e: any) => handleFileChange(e, setIneVuelta)} 
            onClear={() => setIneVuelta({ file: null, preview: null })} 
            disabled={isPending || (!!docIneVuelta?.url_archivo && docIneVuelta?.validado)}
          />
          <UploadCard 
            label="Comprobante Domicilio" 
            archivo={comprobanteDomicilio} 
            dbDoc={docComprobante} 
            onFileChange={(e: any) => handleFileChange(e, setComprobanteDomicilio)} 
            onClear={() => setComprobanteDomicilio({ file: null, preview: null })} 
            disabled={isPending || (!!docComprobante?.url_archivo && docComprobante?.validado)}
          />
        </div>

        <div className="card-base p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-white shadow-md">
          <div className="flex items-center gap-4 text-slate-400">
            <InfoIcon size={20} />
            <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-md">Una vez sincronizados, sus documentos pasarán a revisión por el área jurídica de CECANI.</p>
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full md:w-auto min-w-[200px]">
            {isPending ? <Loader2 className="animate-spin" size={20} /> : <CloudUpload size={20} />}
            {isPending ? progress : hasAnyRejection ? 'Reenviar Correcciones' : 'Sincronizar Bóveda'}
          </button>
        </div>
      </form>
    </div>
  );
}

function UploadCard({ label, archivo, dbDoc, onFileChange, onClear, disabled }: any) {
  const isRejected = dbDoc?.motivo_rechazo && !dbDoc?.validado;
  const isOk = dbDoc?.validado;

  return (
    <div className="card-base flex flex-col h-full bg-white transition-all hover:shadow-md">
      <div className="card-header py-4 px-6 flex items-center justify-between bg-slate-50/50">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
        {isOk && <CheckCircle2 size={16} className="text-emerald-500" />}
        {isRejected && <AlertCircle size={16} className="text-red-500" />}
      </div>
      
      <div className="card-content flex-1 flex flex-col gap-4 p-6">
        <div className={`relative h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${archivo.file ? 'border-blue-500 bg-blue-50/30' : isRejected ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}>
          {archivo.preview ? (
            <img src={archivo.preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-40" />
          ) : (dbDoc?.url_archivo && !isRejected) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 rounded-lg">
              <FileText size={48} className="text-slate-300" />
            </div>
          )}

          <div className="relative z-10 text-center">
            {isOk ? <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" /> : archivo.file ? <FileUp size={32} className="text-blue-500 mx-auto mb-2" /> : <CloudUpload size={32} className="text-slate-300 mx-auto mb-2" />}
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[120px] mx-auto">
              {archivo.file ? archivo.file.name : isOk ? 'Verificado' : 'Click para subir'}
            </p>
          </div>

          <input type="file" onChange={onFileChange} disabled={disabled} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
        </div>

        {isRejected && !archivo.file && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-[9px] font-black text-red-600 uppercase mb-1">Rechazado:</p>
            <p className="text-[10px] text-red-800 leading-tight italic">"{dbDoc.motivo_rechazo}"</p>
          </div>
        )}

        {archivo.file && (
          <button type="button" onClick={onClear} className="w-full py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100">
            <Trash2 size={14} /> Eliminar selección
          </button>
        )}
      </div>
    </div>
  );
}

function InfoIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
