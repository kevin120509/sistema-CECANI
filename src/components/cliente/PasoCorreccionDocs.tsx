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
} from 'lucide-react';

interface Props {
  expediente: Expediente;
  onComplete: () => Promise<void>;
}

interface ArchivoLocal {
  file: File | null;
  preview: string | null;
}

const VACIO: ArchivoLocal = { file: null, preview: null };

/**
 * Pantalla exclusiva para REENVÍO de documentos rechazados.
 * Solo muestra y permite subir los documentos que fueron rechazados
 * (url_archivo vacía o motivo_rechazo presente).
 * Los documentos ya validados o en revisión se muestran como solo lectura.
 */
export default function PasoCorrecionDocs({ expediente, onComplete }: Props) {
  const docs = expediente.documentos || [];

  const docIneFrente   = docs.find(d => d.tipo === 'ine_frente');
  const docIneVuelta   = docs.find(d => d.tipo === 'ine_reverso');
  const docComprobante = docs.find(d => d.tipo === 'comprobante_domicilio');

  // Determinar cuáles fueron rechazados (tienen motivo_rechazo o url vacía)
  const rechazados = {
    ineFrente:   docIneFrente   && (!docIneFrente.url_archivo   || docIneFrente.motivo_rechazo),
    ineVuelta:   docIneVuelta   && (!docIneVuelta.url_archivo   || docIneVuelta.motivo_rechazo),
    comprobante: docComprobante && (!docComprobante.url_archivo || docComprobante.motivo_rechazo),
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
    setProgress(`Subiendo ${label}…`);
    const carpeta = expediente.nombre_empresa
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/, '');

    const ext    = file.name.split('.').pop() || 'bin';
    const nombre = `${clave}_${carpeta}.${ext}`;
    const fd     = new FormData();
    fd.append('file', new File([file], nombre, { type: file.type }));

    const up = await subirArchivoR2Action(fd, `expedientes/${carpeta}/documentacion`);
    if (!up.success || !up.data) throw new Error(`Error al subir ${label}: ${up.error}`);

    setProgress(`Registrando ${label}…`);
    const reg = await registrarDocumento(expediente.id, tipo, up.data.url);
    if (!reg.success) throw new Error(`Error al registrar ${label}: ${reg.error}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Solo validar los rechazados que no tienen nuevo archivo
    if (rechazados.ineFrente   && !ineFrente.file)   { setError('Selecciona el archivo de INE Frente rechazado.'); return; }
    if (rechazados.ineVuelta   && !ineVuelta.file)   { setError('Selecciona el archivo de INE Vuelta rechazado.'); return; }
    if (rechazados.comprobante && !comprobante.file) { setError('Selecciona el Comprobante de Domicilio rechazado.'); return; }

    startTransition(async () => {
      try {
        if (rechazados.ineFrente   && ineFrente.file)
          await subirYRegistrar(ineFrente.file,   'ine_frente',            'INE Frente',   'INE_Frente');
        if (rechazados.ineVuelta   && ineVuelta.file)
          await subirYRegistrar(ineVuelta.file,   'ine_reverso',           'INE Vuelta',   'INE_Vuelta');
        if (rechazados.comprobante && comprobante.file)
          await subirYRegistrar(comprobante.file, 'comprobante_domicilio', 'Comprobante',  'Comprobante_Domicilio');

        setProgress('Actualizando estado…');
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
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Título */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-rose-100">
          <RotateCcw size={32} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Corrección de Documentos</h2>
        <p className="text-slate-500 font-medium text-base max-w-md mx-auto">
          Solo necesitas reenviar los documentos que fueron rechazados. Los demás ya están resguardados.
        </p>
      </motion.div>

      {/* Error global */}
      {error && (
        <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="text-rose-500 shrink-0" size={24} />
          <p className="text-sm font-bold text-rose-700 uppercase">{error}</p>
        </div>
      )}

      {!hayAlgunRechazado && (
        <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-6 text-center">
          <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
          <p className="text-sm font-bold text-emerald-700 uppercase">Todos los documentos están en orden. Esperando validación.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Documento: INE Frente */}
        <DocRow
          label="INE Frente"
          doc={docIneFrente}
          rechazado={!!rechazados.ineFrente}
          archivo={ineFrente}
          isPending={isPending}
          onFileChange={(e) => handleFileChange(e, setIneFrente)}
          onClear={() => setIneFrente(VACIO)}
        />

        {/* Documento: INE Vuelta */}
        <DocRow
          label="INE Vuelta"
          doc={docIneVuelta}
          rechazado={!!rechazados.ineVuelta}
          archivo={ineVuelta}
          isPending={isPending}
          onFileChange={(e) => handleFileChange(e, setIneVuelta)}
          onClear={() => setIneVuelta(VACIO)}
        />

        {/* Documento: Comprobante de Domicilio */}
        <DocRow
          label="Comprobante de Domicilio"
          doc={docComprobante}
          rechazado={!!rechazados.comprobante}
          archivo={comprobante}
          isPending={isPending}
          onFileChange={(e) => handleFileChange(e, setComprobante)}
          onClear={() => setComprobante(VACIO)}
        />

        {hayAlgunRechazado && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-sky-600 transition-all flex items-center gap-4 group disabled:opacity-50"
            >
              {isPending ? (
                <><Loader2 className="animate-spin" size={16} /> {progress}</>
              ) : (
                <>Reenviar Documentos <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ─────────────── Sub-componente por documento ─────────────── */
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
    // Documento OK — mostrar como solo lectura
    return (
      <div className="flex items-center justify-between p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{label}</p>
            <p className="text-[9px] font-semibold text-slate-400 uppercase mt-0.5">
              {doc?.validado ? 'Validado' : 'En revisión'}
            </p>
          </div>
        </div>
        <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full border ${doc?.validado ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-sky-50 text-sky-500 border-sky-100'}`}>
          {doc?.validado ? '✓ Aprobado' : '⏳ En revisión'}
        </span>
      </div>
    );
  }

  // Documento RECHAZADO — permitir re-subir
  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 overflow-hidden">
      {/* Cabecera del rechazo */}
      <div className="flex items-start gap-4 p-5 border-b border-rose-100">
        <div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-xl flex items-center justify-center shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{label}</p>
          {doc?.motivo_rechazo && (
            <p className="text-[11px] font-bold text-rose-600 mt-1 uppercase">
              Motivo: {doc.motivo_rechazo}
            </p>
          )}
        </div>
        <span className="text-[8px] font-black uppercase px-3 py-1 rounded-full bg-rose-100 text-rose-600 border border-rose-200 shrink-0">
          ✕ Rechazado
        </span>
      </div>

      {/* Zona de carga */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {archivo.file ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-4 bg-sky-50 border-2 border-sky-200 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-sky-500" size={20} />
                <p className="text-[10px] font-black text-sky-700 uppercase truncate max-w-[200px]">{archivo.file.name}</p>
              </div>
              <button
                type="button"
                onClick={onClear}
                disabled={isPending}
                className="w-8 h-8 rounded-lg bg-white text-red-400 border border-red-100 flex items-center justify-center hover:bg-red-50 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ) : (
            <motion.label
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`relative flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-rose-300 bg-white/60 cursor-pointer hover:border-sky-400 hover:bg-sky-50/40 transition-all ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FileUp className="text-slate-400 mb-2" size={28} />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seleccionar archivo nuevo</p>
              <p className="text-[9px] text-slate-400 mt-1">PDF o imagen</p>
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
