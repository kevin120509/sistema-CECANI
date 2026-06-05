'use client';

import { useState, useTransition } from 'react';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import type { Expediente, TipoDocumento } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  FileUp,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Trash2,
  RotateCcw,
  ShieldAlert,
  Camera,
  FileText,
  CloudUpload
} from 'lucide-react';

interface Props {
  expediente: Expediente;
  documentos: any[]; // docs frescos del hook, incluye motivo_rechazo
  onComplete: () => Promise<void>;
}

interface ArchivoLocal {
  file: File | null;
  preview: string | null;
}

const VACIO: ArchivoLocal = { file: null, preview: null };

export default function PasoCorreccionDocs({ expediente, documentos, onComplete }: Props) {
  const docs = documentos.length > 0 ? documentos : (expediente.documentos || []);

  const docIneFrente   = docs.find((d: any) => d.tipo === 'ine_frente');
  const docIneVuelta   = docs.find((d: any) => d.tipo === 'ine_reverso');
  const docComprobante = docs.find((d: any) => d.tipo === 'comprobante_domicilio');

  const esRechazado = (doc: any) =>
    doc && !doc.validado && (!doc.url_archivo || doc.motivo_rechazo);

  const rechazados = {
    ineFrente:   esRechazado(docIneFrente),
    ineVuelta:   esRechazado(docIneVuelta),
    comprobante: esRechazado(docComprobante),
  };

  const [ineFrente,   setIneFrente]   = useState<ArchivoLocal>(VACIO);
  const [ineVuelta,   setIneVuelta]   = useState<ArchivoLocal>(VACIO);
  const [comprobante, setComprobante] = useState<ArchivoLocal>(VACIO);

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: ArchivoLocal) => void
  ) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setter({ file, preview });
    }
  };

  const subirYRegistrar = async (
    file: File,
    tipo: TipoDocumento,
    label: string,
    clave: string
  ) => {
    setProgress(`Digitalizando ${label}...`);
    const carpeta = expediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

    const ext    = file.name.split('.').pop() || 'bin';
    const nombre = `${clave}_${carpeta}.${ext}`;
    const fd     = new FormData();
    fd.append('file', new File([file], nombre, { type: file.type }));

    const up = await subirArchivoR2Action(fd, `expedientes/${carpeta}/documentacion`);
    if (!up.success || !up.data) throw new Error(`Error al subir ${label}: ${up.error}`);

    setProgress(`Resguardando ${label}...`);
    const reg = await registrarDocumento(expediente.id, tipo, up.data.url);
    if (!reg.success) throw new Error(`Error al registrar ${label}: ${reg.error}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rechazados.ineFrente   && !ineFrente.file)   { setError('Capture el archivo de INE Frente rechazado.'); return; }
    if (rechazados.ineVuelta   && !ineVuelta.file)   { setError('Capture el archivo de INE Vuelta rechazado.'); return; }
    if (rechazados.comprobante && !comprobante.file) { setError('Capture el Comprobante de Domicilio rechazado.'); return; }

    startTransition(async () => {
      try {
        if (rechazados.ineFrente   && ineFrente.file)
          await subirYRegistrar(ineFrente.file,   'ine_frente',            'INE Frente',   'INE_Frente');
        if (rechazados.ineVuelta   && ineVuelta.file)
          await subirYRegistrar(ineVuelta.file,   'ine_reverso',           'INE Vuelta',   'INE_Vuelta');
        if (rechazados.comprobante && comprobante.file)
          await subirYRegistrar(comprobante.file, 'comprobante_domicilio', 'Comprobante',  'Comprobante_Domicilio');

        setProgress('Sincronizando portal...');
        await actualizarEstatusExpediente(expediente.id, 'revision_directora');
        await onComplete();
      } catch (err: any) {
        setError(err.message || 'Error inesperado.');
      } finally {
        setProgress('');
      }
    });
  };

  const hayAlgunRechazado = rechazados.ineFrente || rechazados.ineVuelta || rechazados.comprobante;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 py-4">
      {/* Header Premium */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-rose-500/20 premium-border">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Corrección Documental</h2>
        <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto leading-relaxed">
          Se han detectado observaciones técnicas. Por favor, reemplace únicamente los documentos marcados para re-activar su proceso legal.
        </p>
      </motion.div>

      {/* Error global */}
      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] p-8 flex items-start gap-6 shadow-2xl relative overflow-hidden">
          <AlertCircle className="text-rose-500 shrink-0" size={32} />
          <div className="space-y-1">
            <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Inconsistencia Detectada</h3>
            <p className="text-sm font-bold text-rose-200 leading-relaxed uppercase">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="bg-[#0a0f1d]/60 backdrop-blur-3xl rounded-[4rem] p-8 md:p-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 relative overflow-hidden premium-border">
        <AnimatePresence>
          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[#030712]/95 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <RotateCcw className="text-blue-500" size={32} />
                </div>
              </div>
              <p className="text-blue-500 font-black text-xs uppercase tracking-[0.5em] animate-pulse">{progress}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <DocRow
              label="Identificación Oficial (Frente)"
              doc={docIneFrente}
              rechazado={!!rechazados.ineFrente}
              archivo={ineFrente}
              isPending={isPending}
              onFileChange={(e) => handleFileChange(e, setIneFrente)}
              onClear={() => setIneFrente(VACIO)}
            />

            <DocRow
              label="Identificación Oficial (Reverso)"
              doc={docIneVuelta}
              rechazado={!!rechazados.ineVuelta}
              archivo={ineVuelta}
              isPending={isPending}
              onFileChange={(e) => handleFileChange(e, setIneVuelta)}
              onClear={() => setIneVuelta(VACIO)}
            />

            <DocRow
              label="Comprobante de Domicilio"
              doc={docComprobante}
              rechazado={!!rechazados.comprobante}
              archivo={comprobante}
              isPending={isPending}
              onFileChange={(e) => handleFileChange(e, setComprobante)}
              onClear={() => setComprobante(VACIO)}
            />
          </div>

          {hayAlgunRechazado && (
            <footer className="pt-12 border-t border-white/5 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-sky-500 text-white px-16 py-7 rounded-3xl text-[11px] font-black uppercase tracking-[0.4em] hover:shadow-[0_20px_50px_rgba(37,99,235,0.4)] transition-all duration-500 group disabled:opacity-50 flex items-center justify-center gap-5 active:scale-[0.98]"
              >
                {isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> {progress}</>
                ) : (
                  <>Sincronizar Correcciones <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" /></>
                )}
              </button>
            </footer>
          )}
        </form>
      </div>
    </div>
  );
}

function DocRow({ label, doc, rechazado, archivo, isPending, onFileChange, onClear }: {
  label: string;
  doc: any;
  rechazado: boolean;
  archivo: ArchivoLocal;
  isPending: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  if (!rechazado) {
    return (
      <div className="flex items-center justify-between p-8 bg-[#030712]/40 border border-white/5 rounded-[2.5rem] premium-border group transition-all duration-500 hover:bg-[#030712]/60">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-black text-white/80 uppercase tracking-widest leading-none">
              {doc?.validado ? 'Expediente Verificado' : 'Sincronizado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <span className={`px-5 py-2 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border shadow-lg ${doc?.validado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
            {doc?.validado ? 'Aprobado' : 'Validando'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[3rem] border border-rose-500/30 bg-rose-500/5 overflow-hidden premium-border transition-all duration-500 hover:bg-rose-500/[0.07]">
      <div className="flex flex-col md:flex-row md:items-center gap-6 p-8 border-b border-rose-500/10">
        <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center shrink-0 border border-rose-500/20 shadow-xl">
          <AlertCircle size={28} />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500/60">{label}</p>
          {doc?.motivo_rechazo && (
            <p className="text-sm font-bold text-rose-200 uppercase tracking-tight leading-relaxed italic">
              Observación: "{doc.motivo_rechazo}"
            </p>
          )}
        </div>
        <span className="w-fit px-5 py-2 rounded-full text-[8px] font-black uppercase tracking-[0.2em] bg-rose-500/20 text-rose-500 border border-rose-500/30 shadow-lg">
          Rechazado
        </span>
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {archivo.file ? (
              <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-6 bg-[#030712] border border-blue-500/30 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg"><CheckCircle2 size={20} /></div>
                <div>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Archivo Listo</p>
                  <p className="text-xs font-black text-white uppercase truncate max-w-[300px]">{archivo.file.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClear}
                disabled={isPending}
                className="w-12 h-12 rounded-xl bg-white/5 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-12 active:scale-90"
              >
                <Trash2 size={18} />
              </button>
            </motion.div>
          ) : (
            <motion.label
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`relative flex flex-col items-center justify-center h-48 rounded-[2.5rem] border-2 border-dashed border-rose-500/20 bg-[#030712]/40 cursor-pointer hover:border-blue-500/50 hover:bg-[#030712]/60 transition-all duration-500 group ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 text-slate-500 flex items-center justify-center mb-4 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-500/20 group-hover:text-blue-400">
                <CloudUpload size={32} />
              </div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Digitalizar nuevo archivo</p>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 opacity-60">Formatos admitidos: PDF, JPG, PNG</p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={onFileChange}
                disabled={isPending}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </motion.label>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
