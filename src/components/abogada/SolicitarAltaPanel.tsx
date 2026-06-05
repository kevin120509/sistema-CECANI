'use client';

import { useState, useTransition } from 'react';
import { solicitarAltaClienteAction } from '@/actions/directora';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, X, Loader2, CheckCircle2, Clock, XCircle, ArrowRight, AlertCircle, Trash2
} from 'lucide-react';

interface Solicitud {
  id: string;
  nombre_cliente: string;
  nombre_empresa: string;
  estatus: 'pendiente' | 'aprobada' | 'rechazada';
  notas_rechazo?: string | null;
  created_at: string;
}

interface Props {
  solicitudesIniciales?: Solicitud[];
}

/**
 * Panel de Solicitud de Alta de Cliente para la Asesora/Abogada.
 * La asesora llena el formulario → se envía a la directora para aprobación.
 * Muestra el historial con opción de borrar solicitudes resueltas.
 */
export default function SolicitarAltaPanel({ solicitudesIniciales = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(solicitudesIniciales);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await solicitarAltaClienteAction(formData);
      if (res.success) {
        setSuccess(true);
        const nueva: Solicitud = {
          id: Date.now().toString(),
          nombre_cliente: formData.get('nombre_cliente') as string,
          nombre_empresa: formData.get('nombre_empresa') as string,
          estatus: 'pendiente',
          created_at: new Date().toISOString(),
        };
        setSolicitudes(prev => [nueva, ...prev]);
        setTimeout(() => { setSuccess(false); setIsOpen(false); }, 2500);
      } else {
        setError(res.error || 'Error al enviar la solicitud');
      }
    });
  };

  const handleDelete = async (id: string) => {
    // Borrar optimistamente; si es ID numérico (optimista) solo local
    setSolicitudes(prev => prev.filter(s => s.id !== id));
    if (id.length > 13) { // UUID real
      try {
        const supabase = createClient();
        await supabase.from('solicitudes_alta').delete().eq('id', id);
      } catch { /* ignorar */ }
    }
  };

  const badgeStyles: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
    aprobada:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    rechazada: 'bg-rose-100 text-rose-600 border-rose-200',
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
      {/* Botón principal */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-6 py-4 bg-sky-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/30"
      >
        <UserPlus size={18} />
        Nueva Solicitud
      </button>

      {/* ── HISTORIAL ── */}
      <div className="mt-8 space-y-6">
        {/* Pendientes */}
        {pendientes.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={10}/> En espera de aprobación
            </p>
            {pendientes.map(sol => (
              <div key={sol.id} className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-slate-900">{sol.nombre_cliente}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{sol.nombre_empresa}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 shrink-0">
                  <Clock size={10}/> Pendiente
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Resueltas con opción de borrar */}
        {resueltas.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Historial — puedes eliminar las resueltas
            </p>
            {resueltas.map(sol => (
              <div key={sol.id} className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${sol.estatus === 'aprobada' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase text-slate-900 truncate">{sol.nombre_cliente}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5 truncate">{sol.nombre_empresa}</p>
                  {sol.notas_rechazo && (
                    <p className="text-[9px] font-bold text-rose-600 uppercase mt-1">↳ {sol.notas_rechazo}</p>
                  )}
                </div>
                <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border shrink-0 ${badgeStyles[sol.estatus]}`}>
                  {badgeIcons[sol.estatus]} {sol.estatus}
                </span>
                <button
                  onClick={() => handleDelete(sol.id)}
                  className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all"
                  title="Eliminar del historial"
                >
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {solicitudes.length === 0 && (
          <div className="bg-white border-2 border-slate-100 rounded-3xl p-12 text-center space-y-3">
            <UserPlus size={36} className="mx-auto text-slate-200"/>
            <p className="text-slate-400 font-black uppercase text-sm">Sin solicitudes enviadas</p>
            <p className="text-[10px] text-slate-300 font-bold uppercase">Usa el botón de arriba para solicitar el alta de un cliente</p>
          </div>
        )}
      </div>

      {/* Modal del formulario */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isPending && setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="bg-slate-900 p-8 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase">Solicitar Alta</h2>
                    <p className="text-sky-400 text-[9px] font-black uppercase tracking-widest mt-1">
                      Requiere aprobación de la directora
                    </p>
                  </div>
                </div>
                <button onClick={() => !isPending && setIsOpen(false)}><X size={28} /></button>
              </div>

              <div className="flex items-start gap-3 px-8 py-4 bg-amber-50 border-b border-amber-100">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                  Esta solicitud será enviada a la directora para su aprobación antes de crear el expediente.
                </p>
              </div>

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="text-emerald-500" size={36} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 uppercase">¡Solicitud Enviada!</h3>
                      <p className="text-slate-500 font-bold text-sm">La directora revisará tu solicitud y recibirás una notificación.</p>
                    </motion.div>
                  ) : (
                    <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit} className="space-y-5">
                      {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
                          <XCircle className="text-rose-500 shrink-0" size={18} />
                          <p className="text-xs font-bold text-rose-700 uppercase">{error}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo *</label>
                        <input required name="nombre_cliente" placeholder="Ej. Juan Pérez López" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400 transition-colors"/>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Teléfono *</label>
                        <input required name="telefono" placeholder="10 dígitos" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400 transition-colors"/>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Empresa / Proyecto *</label>
                        <input required name="nombre_empresa" placeholder="Ej. Comercializadora XYZ" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400 transition-colors"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RFC (opcional)</label>
                          <input name="rfc" placeholder="RFC" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400 transition-colors"/>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notas</label>
                          <input name="notas" placeholder="Observaciones..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400 transition-colors"/>
                        </div>
                      </div>
                      <button type="submit" disabled={isPending} className="w-full py-5 bg-sky-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {isPending ? <><Loader2 className="animate-spin" size={18}/> Enviando...</> : <>Enviar a Directora <ArrowRight size={18}/></>}
                      </button>
                    </motion.form>
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
