'use client';

import { useState, useTransition } from 'react';
import { solicitarAltaClienteAction } from '@/actions/directora';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, X, Loader2, CheckCircle2, Clock, XCircle, ArrowRight, AlertCircle, Trash2,
  FileSignature, UserCircle, UploadCloud, MapPin, Building2, CreditCard, FileText, ExternalLink
} from 'lucide-react';

interface Solicitud {
  id: string;
  nombre_cliente: string;
  nombre_empresa: string;
  estatus: 'pendiente' | 'aprobada' | 'rechazada';
  notas_rechazo?: string | null;
  created_at: string;
  // Nuevos campos para vista detallada si se requiere
  rfc?: string | null;
  curp?: string | null;
  monto_total?: number | null;
}

interface Props {
  solicitudesIniciales?: Solicitud[];
}

export default function SolicitarAltaPanel({ solicitudesIniciales = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(solicitudesIniciales);
  
  // Estados para el flujo multi-paso
  const [step, setStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState('');
  const [formData, setFormData] = useState<any>({});
  const [files, setFiles] = useState<{
    contrato?: File,
    ine_frente?: File,
    curp?: File,
    domicilio?: File
  }>({});

  const resetState = () => {
    setIsOpen(false);
    setStep(1);
    setFormData({});
    setFiles({});
    setError(null);
    setSuccess(false);
  };

  const handleNextStep = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const obj: any = {};
    data.forEach((value, key) => { obj[key] = value; });
    setFormData(obj);
    setStep(2);
  };

  const handleSubmitFinal = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const finalFormData = new FormData();
        // Agregar datos de texto
        Object.entries(formData).forEach(([key, value]: [string, any]) => {
          finalFormData.append(key, value);
        });

        // Subir archivos a R2 y agregar URLs al FormData
        const empresaKey = formData.nombre_empresa?.replace(/[^a-zA-Z0-9]/g, '_') || 'temp';
        
        const upload = async (file: File, folder: string, label: string) => {
          setUploadProgress(`Subiendo ${label}...`);
          const fd = new FormData();
          fd.append('file', file);
          const res = await subirArchivoR2Action(fd, folder);
          if (!res.success || !res.data) throw new Error(res.error);
          return res.data.url;
        };

        if (files.contrato) finalFormData.append('url_contrato', await upload(files.contrato, `solicitudes/${empresaKey}/contratos`, 'Contrato'));
        if (files.ine_frente) finalFormData.append('url_ine_frente', await upload(files.ine_frente, `solicitudes/${empresaKey}/documentacion`, 'INE'));
        if (files.curp) finalFormData.append('url_curp', await upload(files.curp, `solicitudes/${empresaKey}/documentacion`, 'CURP'));
        if (files.domicilio) finalFormData.append('url_comprobante_domicilio', await upload(files.domicilio, `solicitudes/${empresaKey}/documentacion`, 'Domicilio'));

        const res = await solicitarAltaClienteAction(finalFormData);
        if (res.success) {
          setSuccess(true);
          const nueva: Solicitud = {
            id: Math.random().toString(36).substr(2, 9),
            nombre_cliente: formData.nombre_cliente,
            nombre_empresa: formData.nombre_empresa,
            estatus: 'pendiente',
            created_at: new Date().toISOString(),
            rfc: formData.rfc,
            curp: formData.curp,
            monto_total: Number(formData.monto_total) || null
          };
          setSolicitudes(prev => [nueva, ...prev]);
          setTimeout(() => { resetState(); }, 2500);
        } else {
          setError(res.error || 'Error al enviar la solicitud');
        }
      } catch (err: any) {
        setError(err.message || 'Error durante la subida de archivos');
      } finally {
        setUploadProgress('');
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta solicitud del historial?')) return;
    setSolicitudes(prev => prev.filter(s => s.id !== id));
    if (id.length > 10) { 
      try {
        const supabase = createClient();
        await supabase.from('solicitudes_alta').delete().eq('id', id);
      } catch { /* ignorar */ }
    }
  };

  const badgeStyles: Record<string, string> = {
    pendiente: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    aprobada:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rechazada: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  const badgeIcons: Record<string, React.ReactNode> = {
    pendiente: <Clock size={10} />,
    aprobada:  <CheckCircle2 size={10} />,
    rechazada: <XCircle size={10} />,
  };

  const pendientes = solicitudes.filter(s => s.estatus === 'pendiente');
  const resueltas  = solicitudes.filter(s => s.estatus !== 'pendiente');

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-3 w-full md:w-auto px-6 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-600/30"
      >
        <UserPlus size={18} />
        Nueva Solicitud de Alta
      </button>

      <div className="mt-8 space-y-6">
        {pendientes.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Clock size={10}/> Solicitudes en espera de aprobación
            </p>
            {pendientes.map(sol => (
              <div key={sol.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between gap-4 hover:border-amber-500/30 transition-all shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20">
                    <Clock size={20}/>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase text-white tracking-tight leading-tight">{sol.nombre_empresa}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Cliente: {sol.nombre_cliente}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0">
                    <Clock size={10}/> Pendiente
                  </span>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">Enviada: {new Date(sol.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {resueltas.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">
              Historial de Solicitudes
            </p>
            {resueltas.map(sol => (
              <div key={sol.id} className={`bg-slate-900 rounded-3xl border p-6 flex items-center gap-4 hover:bg-slate-800/50 transition-all ${sol.estatus === 'aprobada' ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                <div className="flex-1 min-w-0 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${sol.estatus === 'aprobada' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {sol.estatus === 'aprobada' ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase text-white truncate leading-tight">{sol.nombre_empresa}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5 truncate">{sol.nombre_cliente}</p>
                    {sol.notas_rechazo && (
                      <p className="text-[9px] font-bold text-rose-400 uppercase mt-1 italic">↳ Motivo: {sol.notas_rechazo}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border shrink-0 ${badgeStyles[sol.estatus]}`}>
                    {badgeIcons[sol.estatus]} {sol.estatus}
                  </span>
                  <button
                    onClick={() => handleDelete(sol.id)}
                    className="shrink-0 w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 flex items-center justify-center transition-all shadow-lg"
                    title="Eliminar del historial"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {solicitudes.length === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-[2.5rem] p-16 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
              <UserPlus size={32} className="text-slate-700"/>
            </div>
            <div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Sin solicitudes activas</p>
              <p className="text-[10px] text-slate-600 font-bold uppercase mt-2">Usa el botón de alta para registrar un nuevo cliente por aprobación</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isPending && resetState()}
              className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-red-600/10 border border-red-600/20 text-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Solicitud de Alta</h2>
                    <p className="text-red-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1">
                      Paso {step} de 2 • {step === 1 ? 'Datos Generales' : 'Documentación'}
                    </p>
                  </div>
                </div>
                <button onClick={() => !isPending && resetState()} className="text-slate-600 hover:text-white transition-colors"><X size={28} /></button>
              </div>

              <div className="flex items-start gap-3 px-8 py-4 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] font-bold text-amber-400/90 uppercase leading-relaxed tracking-tight">
                  La Directora revisará estos datos y validará los documentos antes de aprobar el expediente.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
                      <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                        <CheckCircle2 className="text-emerald-400" size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">¡Enviado a Dirección!</h3>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Se ha notificado a la Directora sobre tu solicitud.</p>
                      </div>
                    </motion.div>
                  ) : step === 1 ? (
                    <motion.form key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleNextStep} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo del Titular *</label>
                          <input required name="nombre_cliente" defaultValue={formData.nombre_cliente} placeholder="Juan Pérez López" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono Móvil *</label>
                          <input required name="telefono" defaultValue={formData.telefono} placeholder="10 dígitos" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de la Asociación / Empresa *</label>
                          <input required name="nombre_empresa" defaultValue={formData.nombre_empresa} placeholder="Denominación o proyecto" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RFC (Opcional)</label>
                          <input name="rfc" defaultValue={formData.rfc} placeholder="RFC del titular" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CURP (Opcional)</label>
                          <input name="curp" defaultValue={formData.curp} placeholder="CURP del titular" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Inversión Total ($)</label>
                          <input type="number" name="monto_total" defaultValue={formData.monto_total} placeholder="Monto contratado" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-red-600 transition-all placeholder:text-slate-800"/>
                        </div>
                        <div className="md:col-span-2 space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Domicilio Completo</label>
                          <textarea name="domicilio_completo" defaultValue={formData.domicilio_completo} placeholder="Calle, número, colonia, ciudad, estado..." rows={3} className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white uppercase outline-none focus:border-red-600 transition-all placeholder:text-slate-800 resize-none"></textarea>
                        </div>
                      </div>
                      <button type="submit" className="w-full py-5 bg-slate-950 text-white border-2 border-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-red-600 transition-all flex items-center justify-center gap-3">
                        Siguiente: Documentos <ArrowRight size={18}/>
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                      {error && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex items-center gap-4">
                          <XCircle className="text-rose-400 shrink-0" size={20} />
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{error}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FileUploader label="INE Frente" icon={<UserCircle size={32}/>} file={files.ine_frente} onChange={f => setFiles(p => ({...p, ine_frente: f}))}/>
                        <FileUploader label="CURP" icon={<CreditCard size={32}/>} file={files.curp} onChange={f => setFiles(p => ({...p, curp: f}))}/>
                        <FileUploader label="Domicilio" icon={<MapPin size={32}/>} file={files.domicilio} onChange={f => setFiles(p => ({...p, domicilio: f}))}/>
                        <FileUploader label="Contrato (Opcional)" icon={<FileSignature size={32}/>} file={files.contrato} onChange={f => setFiles(p => ({...p, contrato: f}))}/>
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setStep(1)} disabled={isPending} className="flex-1 py-5 bg-slate-950 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-800 hover:text-white transition-all disabled:opacity-50">
                          Atrás
                        </button>
                        <button onClick={handleSubmitFinal} disabled={isPending} className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-red-600/30 hover:bg-red-500 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                          {isPending ? <><Loader2 className="animate-spin" size={18}/> {uploadProgress || 'Enviando...'}</> : <>Finalizar Solicitud <CheckCircle2 size={18}/></>}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function FileUploader({ label, icon, file, onChange }: { label: string, icon: React.ReactNode, file?: File, onChange: (f: File) => void }) {
  return (
    <div className={`p-6 rounded-[2rem] border-2 transition-all group relative ${file ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/50 border-slate-800 hover:border-red-600/30'}`}>
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-600 group-hover:text-red-500 shadow-inner'}`}>{icon}</div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <span className="text-[9px] font-bold uppercase truncate max-w-[150px] block text-slate-400">{file ? file.name : 'Click o Arrastra'}</span>
        </div>
        <input type="file" accept=".pdf,image/*" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
