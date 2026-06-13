'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { asignarAbogada, subirContratoDobleFirma, crearClienteManualAction, eliminarExpedienteAction } from '@/actions/directora';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { logoutAbogada } from '@/actions/auth-abogada';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  LogOut, 
  Search, 
  FileText, 
  ShieldCheck, 
  ArrowRight,
  Loader2,
  Building2,
  Scale,
  X,
  FileSignature,
  Download,
  Trash2,
  UploadCloud,
  MapPin,
  ChevronRight,
  UserCircle,
  CheckCircle2,
  Menu,
  Eye,
  Clock,
  AlertTriangle,
  Info,
  Shield,
  ClipboardList,
  Settings,
  MessageCircle,
  ExternalLink
} from 'lucide-react';

export type PerfilAbogada = { id: string; nombre_completo: string };
export type ExpedienteDirector = Record<string, unknown> & {
  id: string;
  cliente_id: string;
  nombre_empresa: string;
  estatus: string;
  created_at: string;
  numero_control?: string;
  cliente?: { 
    nombre_completo: string;
    rfc?: string;
    curp?: string;
    telefono?: string;
    domicilio_completo?: string;
    ocupacion?: string;
    estado_civil?: string;
  };
  asesora?: { id: string; nombre_completo: string };
  expediente_asesoras?: Array<{
    asesora: { id: string; nombre_completo: string }
  }>;
  datos_concentrado?: Array<{ vendedora: string }> | { vendedora: string };
  figura?: { descripcion: string };
  contratos?: Array<{ 
    id: string; 
    monto_total: number; 
    url_pdf_generado?: string; 
    url_pdf_firmado_cliente?: string; 
    url_pdf_doble_firma?: string;
    plan_pagos?: string;
    servicio_base?: string;
    modulos_extra?: string[];
  }>;
  pagos?: Array<{ monto: number; url_comprobante?: string; fecha_pago?: string; verificado?: boolean }>;
  documentos?: Array<{ 
    id: string; 
    tipo: string; 
    url_archivo: string; 
    validado: boolean; 
    motivo_rechazo?: string | null;
    solicitud_borrado?: boolean;
    motivo_borrado?: string | null;
    estatus_borrado?: string;
  }>;
  servicios_extra?: string[];
};

export default function DirectorDashboard({
  abogadas,
  porAsignar,
  concentrado,
}: {
  abogadas: PerfilAbogada[];
  porAsignar: ExpedienteDirector[];
  concentrado: ExpedienteDirector[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'por_asignar' | 'concentrado' | 'validacion' | 'bajas_docs'>('por_asignar');
  const [selectedExpediente, setSelectedExpediente] = useState<ExpedienteDirector | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsesoraName, setSelectedAsesoraName] = useState<string>('all');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [asesoraId, setAsesoraId] = useState('');
  const [dobleFirmaFile, setDobleFirmaFile] = useState<File | null>(null);
  const [isUploadingDobleFirma, setIsUploadingDobleFirma] = useState(false);
  const [quickViewUrl, setQuickViewUrl] = useState<string | null>(null);

  // --- SYNC SELECTED EXPEDIENTE ---
  useEffect(() => {
    if (selectedExpediente) {
      const allExps = [...porAsignar, ...concentrado];
      const updated = allExps.find(e => e.id === selectedExpediente.id);
      if (updated) setSelectedExpediente(updated);
    }
  }, [porAsignar, concentrado, selectedExpediente?.id]);

  // --- REALTIME ---
  useEffect(() => {
    const supabase = createClient();
    const channels = [
      supabase.channel('exp_dir').on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, () => router.refresh()).subscribe()
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [router]);

  // --- DERIVED DATA ---
  const validacion = useMemo(() => porAsignar.filter(exp => exp.estatus === 'revision_directora' || exp.documentos?.some(d => !!d.motivo_rechazo)), [porAsignar]);
  
  const listosParaAsignar = useMemo(() => porAsignar.filter(exp => {
    if (validacion.some(v => v.id === exp.id)) return false;
    if (exp.estatus === 'en_proceso') return true;
    return exp.contratos?.[0]?.url_pdf_firmado_cliente && (exp.pagos?.length || 0) > 0;
  }), [porAsignar, validacion]);

  const solicitudesBaja = useMemo(() => {
    const all = [...porAsignar, ...concentrado];
    const docs = [];
    for(const exp of all) { if(exp.documentos) { for(const doc of exp.documentos) { if(doc.solicitud_borrado && doc.estatus_borrado === 'pendiente') { docs.push({ ...doc, expediente: exp }); } } } }
    return docs;
  }, [porAsignar, concentrado]);

  const individualAsesoras = useMemo(() => {
    return [...abogadas].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo)).map(a => a.nombre_completo);
  }, [abogadas]);

  // --- ACTIONS ---
  const handleLogout = async () => { setIsLoggingOut(true); await logoutAbogada(); router.push('/abogada'); };
  
  const handleAsignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpediente || !asesoraId) return;
    
    const formData = new FormData();
    formData.append('expediente_id', selectedExpediente.id);
    formData.append('asesora_id', asesoraId);

    startTransition(async () => {
      const res = await asignarAbogada(formData);
      if (res.success) {
        setIsAssignModalOpen(false);
        setAsesoraId('');
        toast.success('Abogada asignada correctamente');
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  };

  const onEliminarExpediente = async (id: string, cid: string) => { if (!confirm("¿Eliminar expediente por completo?")) return; startTransition(async () => { const res = await eliminarExpedienteAction(id, cid); if (res.error) alert(res.error); }); };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans overflow-x-hidden">
      <AnimatePresence>{isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden" />}</AnimatePresence>

      <aside className={"fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 transform " + (isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="p-6 flex items-center justify-end border-b border-slate-800"><button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button></div>
        <div className="px-6 py-4 flex-1 overflow-y-auto custom-scrollbar">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Menú Principal</p>
           <nav className="space-y-1">
             <SidebarLink icon={<LayoutDashboard size={18} />} label="Por Asignar" active={activeTab === 'por_asignar'} onClick={() => setActiveTab('por_asignar')} badge={listosParaAsignar.length} />
             <SidebarLink icon={<ShieldCheck size={18} />} label="Validación" active={activeTab === 'validacion'} onClick={() => setActiveTab('validacion')} badge={validacion.length} />
             <SidebarLink icon={<Users size={18} />} label="Concentrado" active={activeTab === 'concentrado'} onClick={() => setActiveTab('concentrado')} />
             <SidebarLink icon={<Trash2 size={18} />} label="Bajas Docs" active={activeTab === 'bajas_docs'} onClick={() => setActiveTab('bajas_docs')} badge={solicitudesBaja.length || undefined} />
           </nav>
           {activeTab === 'concentrado' && (<div className="mt-4 space-y-1 ml-4 border-l-2 border-slate-800 pl-4">{individualAsesoras.map(n => <SidebarFilterLink key={n} label={n} active={selectedAsesoraName === n} onClick={() => setSelectedAsesoraName(n)} />)}<SidebarFilterLink label="Todas" active={selectedAsesoraName === 'all'} onClick={() => setSelectedAsesoraName('all')} /></div>)}
        </div>
        <div className="px-6 py-6 mt-auto border-t border-slate-800"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#0197D2] text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-sky-600/20 hover:bg-sky-500 transition-all"><LogOut size={18}/> Salir</button></div>
      </aside>

      <main className="flex-1 lg:ml-72 p-6 md:p-8 w-full max-w-[1600px] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto"><button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 text-slate-300 rounded-lg lg:hidden hover:text-white"><Menu size={20}/></button></div>
          <div className="flex flex-col items-end gap-2 hidden md:flex"><div className="flex items-center gap-2 text-sm font-medium text-slate-300"><div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold">D</div><span className="font-black uppercase tracking-widest text-xs">Directora</span></div></div>
        </header>

        {/* OVERVIEW CARDS */}
        {activeTab === 'por_asignar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <SummaryCard icon={<ShieldCheck size={24}/>} label="En Validación" value={validacion.length} color="emerald" />
            <SummaryCard icon={<Trash2 size={24}/>} label="Bajas Pendientes (Docs)" value={solicitudesBaja.length} color="red" />
          </div>
        )}

        {['por_asignar', 'concentrado', 'validacion'].includes(activeTab) && (
          <div className="mb-8 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors" size={20} />
            <input type="text" placeholder="Buscar por cliente, empresa o número de control..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl py-5 pl-16 pr-8 text-sm font-bold text-white outline-none focus:border-sky-600/50 transition-all placeholder:text-slate-700 shadow-2xl" />
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">{activeTab === 'por_asignar' ? 'Listos para Asignación' : activeTab === 'concentrado' ? 'Concentrado Operativo' : activeTab === 'validacion' ? 'En Proceso de Validación' : 'Solicitudes de Baja'}</h2>
          
          <div className="space-y-3">
             {activeTab === 'bajas_docs' ? (
                solicitudesBaja.length === 0 ? (
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-sm">
                    <Trash2 size={48} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Por el momento no hay solicitudes de baja pendientes.</p>
                  </div>
                ) : (
                  solicitudesBaja.map(doc => (
                    <div key={doc.id} className="bg-slate-900 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between hover:bg-slate-900/80 transition-all">
                      <div className="flex items-center gap-4"><div className="w-10 h-10 bg-red-600/10 text-red-500 rounded-xl flex items-center justify-center"><AlertTriangle size={18}/></div><div><h4 className="text-white font-bold text-sm uppercase tracking-tight">Baja: {doc.tipo.replace(/_/g, ' ')}</h4><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{doc.expediente?.nombre_empresa}</p></div></div>
                      <div className="flex items-center gap-4"><button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`)} className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">Ver</button></div>
                    </div>
                  ))
                )
             ) : (
                (() => {
                  const items = (activeTab === 'por_asignar' ? listosParaAsignar : activeTab === 'concentrado' ? concentrado : validacion)
                    .filter(exp => {
                      const search = searchQuery.toLowerCase();
                      const matchesSearch = exp.nombre_empresa.toLowerCase().includes(search) || exp.cliente?.nombre_completo.toLowerCase().includes(search) || exp.numero_control?.toLowerCase().includes(search);
                      if (activeTab !== 'concentrado') return matchesSearch;
                      const matchesAsesora = selectedAsesoraName === 'all' || exp.asesora?.nombre_completo === selectedAsesoraName || exp.expediente_asesoras?.some(rel => rel.asesora.nombre_completo === selectedAsesoraName);
                      return matchesSearch && matchesAsesora;
                    });
                  
                  if (items.length === 0) {
                    return (
                      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-sm">
                        <ShieldCheck size={48} className="mx-auto text-slate-700 mb-4" />
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay expedientes en esta sección por el momento.</p>
                      </div>
                    );
                  }

                  return items.map(exp => (
                  <div key={exp.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-sky-500/30 transition-all group">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-slate-400 font-black border border-slate-800 uppercase text-lg group-hover:text-sky-400">{exp.nombre_empresa.charAt(0)}</div>
                      <div>
                        <h4 className="text-white font-black uppercase tracking-tight text-sm group-hover:text-sky-400 transition-colors">{exp.nombre_empresa}</h4>
                        <div className="flex items-center gap-3 mt-1"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{exp.cliente?.nombre_completo}</p>{exp.asesora?.nombre_completo && <><span className="text-[8px] text-slate-700">•</span><p className="text-sky-600 text-[10px] font-black uppercase tracking-widest">{exp.asesora.nombre_completo}</p></>}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="hidden md:block text-right"><p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Estatus</p><span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">{exp.estatus}</span></div>
                      <button onClick={() => { setSelectedExpediente(exp); if(activeTab === 'validacion') setIsValidationModalOpen(true); else setIsAssignModalOpen(true); }} className="px-6 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 font-black uppercase tracking-widest text-[10px] hover:text-white hover:bg-sky-600 transition-all">Gestionar</button>
                    </div>
                  </div>
                  ));
                })()
             )}
          </div>
        </div>
      </main>

      {/* --- MODALES REUTILIZADOS --- */}
      <AnimatePresence>{isAssignModalOpen && selectedExpediente && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
         <div className="bg-slate-950 p-6 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800"><div className="flex items-center gap-4"><Building2 size={24} className="text-sky-500"/><h2 className="text-lg font-black uppercase tracking-tight">{selectedExpediente.nombre_empresa}</h2></div><div className="flex gap-2"><button onClick={() => onEliminarExpediente(selectedExpediente.id, selectedExpediente.cliente_id)} className="p-2 text-red-500 hover:bg-red-600/10 rounded-lg transition-all"><Trash2 size={20}/></button><button onClick={() => setIsAssignModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X size={24}/></button></div></div>
         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Perfil del Cliente</h3><div className="space-y-4"><TextData label="Nombre" value={selectedExpediente.cliente?.nombre_completo} /><TextData label="RFC" value={selectedExpediente.cliente?.rfc} /><TextData label="Teléfono" value={selectedExpediente.cliente?.telefono} /></div></div>
               <div className="space-y-6"><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Inversión</h3><p className="text-4xl font-black text-white">${selectedExpediente.contratos?.[0]?.monto_total?.toLocaleString() || '0'}</p><form onSubmit={handleAsignar} className="space-y-4 pt-4"><label className="text-[10px] font-black uppercase text-slate-500">Asignar Abogada</label><select value={asesoraId} onChange={e => setAsesoraId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-sky-600"><option value="">Seleccionar...</option>{abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}</select><button type="submit" disabled={isPending} className="w-full py-3 bg-[#0197D2] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-500 transition-all disabled:opacity-50">Confirmar Asignación</button></form></div>
            </div>
         </div>
      </motion.div></div>)}</AnimatePresence>

      <AnimatePresence>{quickViewUrl && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-6"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickViewUrl(null)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" /><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2rem] shadow-2xl w-full h-full flex flex-col overflow-hidden border border-slate-800"><div className="bg-slate-950 p-4 flex justify-between border-b border-slate-800"><h2 className="text-[10px] font-black uppercase text-sky-500">Visor Digital</h2><button onClick={() => setQuickViewUrl(null)} className="text-slate-500 hover:text-white"><X size={24}/></button></div><div className="flex-1 bg-slate-950"><iframe src={quickViewUrl} className="w-full h-full border-none" /></div></motion.div></div>)}</AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: any) { return (<button onClick={onClick} className={"w-full flex items-center justify-between px-5 py-3 rounded-xl transition-all " + (active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/40")}><div className="flex items-center gap-3"><div className={active ? "text-sky-400" : "text-slate-600"}>{icon}</div><span className="text-[10px] font-black uppercase tracking-widest">{label}</span></div>{badge !== undefined && <span className={"text-[9px] font-black px-2 py-0.5 rounded-lg " + (active ? "bg-[#0197D2] text-white" : "bg-slate-950 text-slate-700")}>{badge}</span>}</button>); }
function SidebarFilterLink({ label, active, onClick }: any) { return <button onClick={onClick} className={"w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all " + (active ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800/20")}>{label}</button>; }
function SummaryCard({ icon, label, value, color }: any) { const colors: any = { amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20', emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', red: 'text-red-500 bg-red-500/10 border-red-500/20', sky: 'text-sky-500 bg-sky-500/10 border-sky-500/20' }; return (<div className={`bg-slate-900 p-6 rounded-3xl border ${colors[color].split(' ')[2]} shadow-xl flex items-center gap-6 transition-transform hover:-translate-y-1`}><div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color].split(' ')[1]} ${colors[color].split(' ')[0]}`}>{icon}</div><div><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</p><h3 className="text-3xl font-black text-white mt-1">{value}</h3></div></div>); }
function TextData({ label, value }: { label: string, value?: string }) { return (<div className="space-y-1"><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}:</p><p className="text-sm font-black uppercase text-white truncate">{value || '---'}</p></div>); }
