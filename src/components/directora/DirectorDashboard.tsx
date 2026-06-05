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
  ClipboardList
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

interface NewClientMasterInfo {
  expediente_id: string;
  cliente_id: string;
  contrato_id: string;
  nombre_empresa: string;
}

export default function DirectorDashboard({
  abogadas,
  porAsignar,
  concentrado,
  solicitudesAlta = [],
}: {
  abogadas: PerfilAbogada[];
  porAsignar: ExpedienteDirector[];
  concentrado: ExpedienteDirector[];
  solicitudesAlta?: any[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'por_asignar' | 'concentrado' | 'validacion' | 'solicitudes'>('por_asignar');
  const [selectedExpediente, setSelectedExpediente] = useState<ExpedienteDirector | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsesoraName, setSelectedAsesoraName] = useState<string>('all');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newClientInfo, setNewClientInfo] = useState<NewClientMasterInfo | null>(null);
  const [files, setFiles] = useState<{
    contrato?: File,
    ine_frente?: File,
    curp?: File,
    domicilio?: File
  }>({});
  const [finalAsesoraId, setFinalAsesoraId] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [asesoraId, setAsesoraId] = useState('');
  const [dobleFirmaFile, setDobleFirmaFile] = useState<File | null>(null);
  const [isUploadingDobleFirma, setIsUploadingDobleFirma] = useState(false);
  const [quickViewUrl, setQuickViewUrl] = useState<string | null>(null);

  // --- SYNC SELECTED EXPEDIENTE WITH UPDATED PROPS ---
  useEffect(() => {
    if (selectedExpediente) {
      const allExps = [...porAsignar, ...concentrado];
      const updated = allExps.find(e => e.id === selectedExpediente.id);
      if (updated) setSelectedExpediente(updated);
    }
  }, [porAsignar, concentrado, selectedExpediente?.id]);

  // --- REALTIME INTEGRATION ---
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('director_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          toast.success('¡Nuevo expediente!', { action: { label: 'Ver', onClick: () => setActiveTab('validacion') } });
        }
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, (payload: any) => {
        if (payload.eventType === 'UPDATE' && payload.new.solicitud_borrado === true && payload.old.solicitud_borrado !== true) {
          toast.warning('⚠️ Solicitud de Baja', { action: { label: 'Ver', onClick: () => setActiveTab('concentrado') } });
        }
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  const validacion = useMemo(() => porAsignar.filter(exp => exp.estatus === 'revision_directora' || exp.documentos?.some(d => !!d.motivo_rechazo)), [porAsignar]);
  const listosParaAsignar = useMemo(() => porAsignar.filter(exp => exp.estatus === 'en_proceso' && !exp.documentos?.some(d => !!d.motivo_rechazo)), [porAsignar]);

  const filteredData = useMemo(() => {
    let result = activeTab === 'por_asignar' ? listosParaAsignar : activeTab === 'validacion' ? validacion : concentrado;
    if (activeTab === 'concentrado') {
      result = [...result].sort((a, b) => {
        const aReq = a.documentos?.some(d => d.solicitud_borrado) ? 1 : 0;
        const bReq = b.documentos?.some(d => d.solicitud_borrado) ? 1 : 0;
        return bReq - aReq;
      });
      if (selectedAsesoraName !== 'all') {
        const q = selectedAsesoraName.toLowerCase();
        result = result.filter(exp => exp.asesora?.nombre_completo?.toLowerCase().includes(q) || exp.expediente_asesoras?.some(ea => ea.asesora?.nombre_completo?.toLowerCase().includes(q)));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(exp => exp.nombre_empresa?.toLowerCase().includes(q) || exp.cliente?.nombre_completo?.toLowerCase().includes(q));
    }
    return result;
  }, [activeTab, listosParaAsignar, concentrado, validacion, selectedAsesoraName, searchQuery]);

  const individualAsesoras = useMemo(() => {
    const names = new Set<string>();
    abogadas.forEach(a => a.nombre_completo.split(/[\/\-]| y /i).forEach(part => names.add(part.trim().toUpperCase())));
    return Array.from(names).sort();
  }, [abogadas]);

  const handleLogout = async () => { if (confirm('¿Cerrar sesión?')) { setIsLoggingOut(true); await logoutAbogada(); window.location.reload(); } };
  const handleEliminar = async (id: string, cid: string, n: string) => { if (!confirm(`¿Eliminar expediente de ${n}?`)) return; startTransition(async () => { const res = await eliminarExpedienteAction(id, cid); if (res.error) alert(res.error); }); };

  const resetCreateState = () => { setCreateStep(1); setNewClientInfo(null); setFiles({}); setFinalAsesoraId(''); setIsCreateModalOpen(false); };
  const onInitManualRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await crearClienteManualAction(formData);
      if (res.success && res.data) { setNewClientInfo({ ...res.data, nombre_empresa: formData.get('nombre_empresa') as string }); setCreateStep(2); }
      else alert(res.error || 'Error');
    });
  };

  const onUploadMasterDocs = async () => {
    if (!newClientInfo) return;
    startTransition(async () => {
      try {
        const empresaKey = newClientInfo.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
        const upload = async (file: File, folder: string, label: string) => {
          setUploadProgress(`Subiendo ${label}...`);
          const fd = new FormData(); fd.append('file', file);
          const res = await subirArchivoR2Action(fd, folder);
          if (!res.success || !res.data) throw new Error(res.error);
          return res.data.url;
        };
        if (files.contrato) { const url = await upload(files.contrato, `expedientes/${empresaKey}/contratos`, 'Contrato'); await (await import('@/actions/contrato')).guardarContratoFirmado(newClientInfo.contrato_id, url); await registrarDocumento(newClientInfo.expediente_id, 'contrato_firmado', url); }
        if (files.ine_frente) await registrarDocumento(newClientInfo.expediente_id, 'ine_frente', await upload(files.ine_frente, `expedientes/${empresaKey}/documentacion`, 'INE'));
        if (files.curp) await registrarDocumento(newClientInfo.expediente_id, 'curp', await upload(files.curp, `expedientes/${empresaKey}/documentacion`, 'CURP'));
        if (files.domicilio) await registrarDocumento(newClientInfo.expediente_id, 'comprobante_domicilio', await upload(files.domicilio, `expedientes/${empresaKey}/documentacion`, 'Domicilio'));
        setCreateStep(3);
      } catch (err: any) { alert(err.message); } finally { setUploadProgress(''); }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <AnimatePresence>{isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden" />}</AnimatePresence>

      <aside className={"fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-slate-900 text-white flex flex-col border-r border-white/10 transition-transform duration-300 transform " + (isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-4"><div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center font-black">D</div><h2 className="text-xl font-black">CECANI</h2></div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-6 space-y-2">
          <SidebarLink icon={<LayoutDashboard size={20} />} label="Por Asignar" active={activeTab === 'por_asignar'} onClick={() => setActiveTab('por_asignar')} badge={listosParaAsignar.length} />
          <SidebarLink icon={<ShieldCheck size={20} />} label="Validación" active={activeTab === 'validacion'} onClick={() => setActiveTab('validacion')} badge={validacion.length} />
          <SidebarLink icon={<Users size={20} />} label="Concentrado" active={activeTab === 'concentrado'} onClick={() => setActiveTab('concentrado')} />
          <SidebarLink icon={<UserPlus size={20} />} label="Altas Pendientes" active={activeTab === 'solicitudes'} onClick={() => setActiveTab('solicitudes')} badge={solicitudesAlta.filter((s: any) => s.estatus === 'pendiente').length || undefined} />
          {activeTab === 'concentrado' && (
            <div className="pt-4 space-y-1 ml-4 border-l border-white/10 pl-4">
              {individualAsesoras.map(n => <SidebarFilterLink key={n} label={n} active={selectedAsesoraName === n} onClick={() => setSelectedAsesoraName(n)} />)}
              <SidebarFilterLink label="Todas" active={selectedAsesoraName === 'all'} onClick={() => setSelectedAsesoraName('all')} />
            </div>
          )}
          <button onClick={() => setIsCreateModalOpen(true)} className="w-full mt-6 flex items-center gap-4 px-6 py-4 rounded-2xl bg-sky-500 text-white font-black uppercase text-[10px] tracking-widest hover:bg-sky-400 transition-all"><UserPlus size={18}/> Alta Maestra</button>
        </nav>
        <div className="p-8 border-t border-white/5"><button onClick={handleLogout} className="text-slate-400 hover:text-red-400 flex items-center gap-3 text-xs font-black uppercase"><LogOut size={18}/> Salir</button></div>
      </aside>

      <main className="flex-1 lg:ml-80 p-6 md:p-10 w-full">
        <header className="mb-10 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white border rounded-xl lg:hidden"><Menu size={24}/></button>
            <h1 className="text-3xl font-black uppercase tracking-tighter">{activeTab.replace('_', ' ')}</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-white border rounded-xl py-3 pl-12 pr-6 text-xs font-black uppercase tracking-widest outline-none focus:border-sky-500 w-full md:w-80 shadow-sm" />
          </div>
        </header>

        {/* --- TAB: SOLICITUDES DE ALTA --- */}
        {activeTab === 'solicitudes' ? (
          <div className="space-y-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Solicitudes enviadas por asesoras — Aprobar o Rechazar</p>
            {solicitudesAlta.length === 0 ? (
              <div className="bg-white rounded-[2rem] border shadow-xl p-16 text-center">
                <UserPlus size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase text-sm">No hay solicitudes de alta</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {solicitudesAlta.map((sol: any) => (
                  <div key={sol.id} className={`bg-white rounded-[2rem] border-2 p-8 space-y-5 shadow-sm ${sol.estatus === 'pendiente' ? 'border-amber-200' : sol.estatus === 'aprobada' ? 'border-emerald-200' : 'border-rose-200'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-black uppercase text-slate-900">{sol.nombre_cliente}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{sol.nombre_empresa}</p>
                        <p className="text-[9px] font-bold text-sky-600 uppercase mt-1">Asesora: {sol.asesora?.nombre_completo || '---'}</p>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full border ${sol.estatus === 'pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' : sol.estatus === 'aprobada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                        {sol.estatus}
                      </span>
                    </div>
                    {sol.notas && <p className="text-[10px] font-bold text-slate-500 uppercase italic">"{sol.notas}"</p>}
                    {sol.estatus === 'pendiente' && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={async () => {
                            const res = await (await import('@/actions/directora')).aprobarSolicitudAltaAction(sol.id);
                            if (res.success) toast.success('¡Alta aprobada! El expediente fue creado.');
                            else toast.error(res.error || 'Error');
                          }}
                          className="py-3 bg-emerald-500 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 transition-all"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={async () => {
                            const motivo = prompt('Motivo del rechazo:');
                            if (!motivo) return;
                            const res = await (await import('@/actions/directora')).rechazarSolicitudAltaAction(sol.id, motivo);
                            if (res.success) toast.error('Solicitud rechazada');
                            else toast.error(res.error || 'Error');
                          }}
                          className="py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 hover:text-rose-700 transition-all"
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    )}
                    {sol.notas_rechazo && (
                      <p className="text-[9px] font-bold text-rose-600 uppercase">↳ Rechazado: {sol.notas_rechazo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-xl border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="p-8">Cliente / Proyecto</th><th className="p-8">Acciones Administrativas</th></tr></thead>
              <tbody className="divide-y">
                {filteredData.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-8">
                      <p className="text-lg font-black text-slate-900 uppercase">{exp.nombre_empresa}</p>
                      <p className="text-xs font-bold text-slate-500 uppercase mt-1">{exp.cliente?.nombre_completo}</p>
                      <div className="flex gap-2 mt-4">
                        <span className="text-[8px] font-black px-2 py-1 bg-slate-100 rounded border uppercase">{exp.estatus.replace('_', ' ')}</span>
                        {exp.documentos?.some(d => d.solicitud_borrado) && <span className="text-[8px] font-black px-2 py-1 bg-amber-500 text-white rounded animate-pulse">BAJA SOLICITADA</span>}
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex gap-3">
                        <button onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border ${exp.documentos?.some(d => d.solicitud_borrado) ? 'bg-amber-500 text-white border-amber-600 animate-bounce' : 'bg-white text-sky-600 border-sky-100 hover:bg-sky-50'}`}>
                          {exp.documentos?.some(d => d.solicitud_borrado) ? <AlertTriangle size={14}/> : <FileText size={14}/>} {exp.documentos?.some(d => d.solicitud_borrado) ? 'Revisar Bajas' : 'Expediente'}
                        </button>
                        <button onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center gap-2"><ClipboardList size={14}/> Gestión</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* --- MODAL 1: EXPEDIENTE (SOLO ARCHIVOS Y BAJAS) --- */}
      <AnimatePresence>
        {isValidationModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsValidationModalOpen(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
               <div className="bg-sky-600 p-8 flex items-center justify-between text-white shrink-0">
                 <div className="flex items-center gap-4"><div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><FileText size={24}/></div><div><h2 className="text-2xl font-black uppercase">Expediente Documental</h2><p className="text-sky-100 text-[9px] font-black uppercase tracking-widest mt-1">{selectedExpediente.nombre_empresa}</p></div></div>
                 <button onClick={() => setIsValidationModalOpen(false)}><X size={32}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-12">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {selectedExpediente.documentos?.map(doc => {
                     const viewUrl = `/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`;
                     const isPdf = doc.url_archivo?.toLowerCase().endsWith('.pdf');
                     const tipoLabel = doc.tipo.replace(/_/g, ' ').toUpperCase();
                     const isRejected = doc.motivo_rechazo && !doc.validado;

                     return (
                       <div key={doc.id} className={`rounded-[1.75rem] border-2 overflow-hidden transition-all ${
                         isRejected ? 'border-rose-300 bg-rose-50' :
                         doc.solicitud_borrado ? 'border-amber-300 bg-amber-50' :
                         doc.validado ? 'border-emerald-200 bg-emerald-50/30' :
                         'border-slate-200 bg-white'
                       }`}>
                         {/* Preview area */}
                         <div
                           className="relative w-full h-52 bg-slate-100 cursor-pointer group overflow-hidden"
                           onClick={() => setQuickViewUrl(viewUrl)}
                         >
                           {isPdf ? (
                             <iframe
                               src={viewUrl}
                               className="w-full h-full pointer-events-none"
                               title={tipoLabel}
                             />
                           ) : (
                             <img
                               src={viewUrl}
                               alt={tipoLabel}
                               className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                               onError={(e) => {
                                 (e.target as HTMLImageElement).style.display = 'none';
                                 (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                               }}
                             />
                           )}
                           {/* Fallback sin preview */}
                           <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isPdf ? 'hidden' : 'hidden'}`}>
                             <FileText size={40} className="text-slate-300" />
                             <p className="text-[9px] font-black text-slate-400 uppercase">Sin previsualización</p>
                           </div>

                           {/* Overlay hover */}
                           <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-all flex items-center justify-center">
                             <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                               <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
                                 <Eye size={16} className="text-sky-600" />
                                 <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Ver completo</span>
                               </div>
                             </div>
                           </div>

                           {/* Badge estado */}
                           <div className="absolute top-3 right-3">
                             {doc.validado && (
                               <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg shadow">✓ Validado</span>
                             )}
                             {isRejected && (
                               <span className="bg-rose-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg shadow">✕ Rechazado</span>
                             )}
                             {!doc.validado && !isRejected && (
                               <span className="bg-sky-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg shadow">⏳ Revisión</span>
                             )}
                           </div>
                         </div>

                         {/* Footer de la tarjeta */}
                         <div className="p-5">
                           <div className="flex items-center justify-between">
                             <div>
                               <p className="text-[11px] font-black uppercase tracking-widest text-slate-900">{tipoLabel}</p>
                               {isRejected && doc.motivo_rechazo && (
                                 <p className="text-[9px] font-bold text-rose-600 mt-1 uppercase">↳ {doc.motivo_rechazo}</p>
                               )}
                             </div>
                             <button
                               onClick={() => setQuickViewUrl(viewUrl)}
                               className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition-all shadow-sm"
                             >
                               <Eye size={16} />
                             </button>
                           </div>

                           {doc.solicitud_borrado && (
                             <div className="mt-4 p-4 bg-white rounded-2xl border border-amber-200 space-y-3">
                               <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Solicitud de Baja (Abogada):</p>
                               <p className="text-xs font-bold text-slate-800 uppercase italic">"{doc.motivo_borrado || 'SIN MOTIVO'}"</p>
                               <div className="grid grid-cols-2 gap-2">
                                 <button onClick={async () => { if(confirm('¿Autorizar?')) { const res = await (await import('@/actions/documentos')).aprobarBorradoAction(doc.id); if(res.success) toast.success('Autorizado'); else alert(res.error); } }} className="bg-emerald-500 text-white py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest">Autorizar</button>
                                 <button onClick={async () => { const res = await (await import('@/actions/documentos')).rechazarBorradoAction(doc.id); if(res.success) toast.error('Rechazado'); else alert(res.error); }} className="bg-slate-200 text-slate-600 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest">Ignorar</button>
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: GESTIÓN (SOLO DATOS TEXTO Y ADMINISTRACIÓN) --- */}
      <AnimatePresence>
        {isAssignModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="fixed inset-0 bg-slate-950/40 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
               <div className="bg-slate-900 p-8 flex items-center justify-between text-white shrink-0">
                 <div className="flex items-center gap-4"><div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg"><ClipboardList size={24}/></div><div><h2 className="text-2xl font-black uppercase">Gestión y Concentrado</h2><p className="text-sky-400 text-[9px] font-black uppercase tracking-widest mt-1">Datos Operativos Escritos</p></div></div>
                 <button onClick={() => setIsAssignModalOpen(false)}><X size={32}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-12">
                  <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-slate-100">
                    {(() => {
                      const datos = Array.isArray(selectedExpediente.datos_concentrado) ? selectedExpediente.datos_concentrado[0] : (selectedExpediente.datos_concentrado as any);
                      return (
                        <div className="space-y-10">
                          <div className="space-y-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objeto Social Transcrito</p><div className="bg-white p-8 rounded-2xl border text-sm font-bold uppercase italic leading-relaxed whitespace-pre-wrap">{datos?.objeto_social_ventas || 'PENDIENTE'}</div></div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <TextData label="Folio RPP" value={datos?.folio_rpp} />
                            <TextData label="Libro" value={datos?.libro_rpp} />
                            <TextData label="Volumen" value={datos?.volumen_rpp} />
                            <TextData label="Estatus RPP" value={datos?.estatus_rpp} />
                            <TextData label="Notaría" value={datos?.notaria} />
                            <TextData label="Vendedora" value={datos?.vendedora} />
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-1 gap-8">
                      <div className="bg-emerald-50 p-10 rounded-[2.5rem] border-2 border-emerald-100 flex flex-col justify-center text-center">
                         <h3 className="text-sm font-black uppercase text-emerald-800 mb-4">Estatus Administrativo</h3>
                         <div className="bg-white p-6 rounded-2xl border border-emerald-200"><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Monto Inversión:</p><p className="text-xl font-black text-emerald-600">${selectedExpediente.contratos?.[0]?.monto_total?.toLocaleString() || '0.00'}</p></div>
                      </div>
                   </div>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: ALTA MAESTRA --- */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetCreateState} className="fixed inset-0 bg-slate-950/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
              <div className="bg-slate-900 p-8 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center"><UserPlus size={24}/></div>
                  <div>
                    <h2 className="text-2xl font-black uppercase">Alta Maestra</h2>
                    <p className="text-sky-400 text-[9px] font-black uppercase tracking-widest mt-1">Paso {createStep} de 3</p>
                  </div>
                </div>
                <button onClick={resetCreateState}><X size={32}/></button>
              </div>

              {/* Indicador de pasos */}
              <div className="flex bg-slate-50 border-b">
                {[1,2,3].map(s => (
                  <div key={s} className={`flex-1 py-4 text-center text-[9px] font-black uppercase tracking-widest transition-all ${ createStep === s ? 'bg-sky-500 text-white' : createStep > s ? 'bg-emerald-500 text-white' : 'text-slate-400' }`}>
                    {s === 1 ? 'Datos Cliente' : s === 2 ? 'Documentos' : 'Confirmado'}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {/* PASO 1: DATOS */}
                {createStep === 1 && (
                  <form onSubmit={onInitManualRegistry} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo *</label><input required name="nombre_completo" placeholder="Nombre del cliente" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Teléfono *</label><input required name="telefono" placeholder="10 dígitos" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Empresa / Proyecto *</label><input required name="nombre_empresa" placeholder="Nombre de la empresa" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RFC (opcional)</label><input name="rfc" placeholder="RFC del cliente" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-sky-400" /></div>
                    </div>
                    <button type="submit" disabled={isPending} className="w-full py-5 bg-sky-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                      {isPending ? <><Loader2 className="animate-spin" size={18}/>Creando...</> : <>Crear Expediente <ArrowRight size={18}/></>}
                    </button>
                  </form>
                )}

                {/* PASO 2: DOCUMENTOS */}
                {createStep === 2 && newClientInfo && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-500" size={20}/>
                      <div><p className="text-[10px] font-black text-slate-900 uppercase">Expediente creado</p><p className="text-[9px] text-slate-500 uppercase">{newClientInfo.nombre_empresa}</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FileUploader label="Contrato Firmado (PDF)" icon={<FileSignature size={28}/>} file={files.contrato} onChange={f => setFiles(p => ({...p, contrato: f}))}/>
                      <FileUploader label="INE Frente" icon={<UserCircle size={28}/>} file={files.ine_frente} onChange={f => setFiles(p => ({...p, ine_frente: f}))}/>
                      <FileUploader label="CURP" icon={<FileText size={28}/>} file={files.curp} onChange={f => setFiles(p => ({...p, curp: f}))}/>
                      <FileUploader label="Comprobante Domicilio" icon={<MapPin size={28}/>} file={files.domicilio} onChange={f => setFiles(p => ({...p, domicilio: f}))}/>
                    </div>
                    {uploadProgress && <div className="text-center text-xs font-black text-sky-600 uppercase animate-pulse">{uploadProgress}</div>}
                    <div className="flex gap-4">
                      <button onClick={onUploadMasterDocs} disabled={isPending} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {isPending ? <><Loader2 className="animate-spin" size={18}/>Subiendo...</> : <>Guardar Documentos <ArrowRight size={18}/></>}
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 3: CONFIRMADO */}
                {createStep === 3 && (
                  <div className="text-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="text-emerald-500" size={40}/></div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase">¡Alta Completada!</h3>
                    <p className="text-slate-500 font-bold text-sm">El expediente maestro fue creado exitosamente.</p>
                    <button onClick={resetCreateState} className="px-10 py-4 bg-sky-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all">Cerrar</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{quickViewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickViewUrl(null)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full h-full flex flex-col overflow-hidden">
             <div className="bg-slate-900 p-6 flex items-center justify-between text-white"><h2 className="text-lg font-black uppercase tracking-tight">Visor de Documento</h2><button onClick={() => setQuickViewUrl(null)}><X size={24}/></button></div>
             <div className="flex-1 bg-slate-100 p-8"><iframe src={quickViewUrl} className="w-full h-full rounded-2xl bg-white shadow-inner" /></div>
          </motion.div>
        </div>
      )}</AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={"w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all " + (active ? "bg-white text-slate-900 shadow-xl" : "text-slate-500 hover:text-white")}>
      <div className="flex items-center gap-4"><div className={active ? "text-sky-500" : "text-slate-600"}>{icon}</div><span className="text-[11px] font-black uppercase tracking-widest">{label}</span></div>
      {badge !== undefined && <span className={"text-[9px] font-black px-2 py-0.5 rounded-full " + (active ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-500")}>{badge}</span>}
    </button>
  );
}

function SidebarFilterLink({ label, active, onClick }: any) {
  return <button onClick={onClick} className={"w-full flex items-center px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all " + (active ? "bg-sky-500 text-white shadow-lg" : "text-slate-500 hover:text-white")}>{label}</button>;
}

function TextData({ label, value, inline }: { label: string, value?: string, inline?: boolean }) {
  return (
    <div className={inline ? "flex justify-between items-center" : "space-y-1.5"}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}:</p>
      <p className="text-xs font-bold text-slate-900 uppercase truncate">{value || '---'}</p>
    </div>
  );
}

function FileUploader({ label, icon, onChange, file }: {label: string, icon: any, onChange: (f: File) => void, file?: File}) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className={"relative h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all " + (file ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
        <div className={file ? "text-emerald-500" : "text-slate-300"}>{icon}</div>
        <span className="text-[8px] font-black uppercase mt-1 px-4 truncate">{file ? file.name : 'Seleccionar Archivo'}</span>
        <input type="file" accept=".pdf" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
