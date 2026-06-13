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
  const [activeTab, setActiveTab] = useState<'por_asignar' | 'concentrado' | 'validacion' | 'solicitudes' | 'bajas_docs'>('por_asignar');
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

  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

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
  
  // Listos para asignar: Incluye los que pasaron el flujo estándar Y los de Excel (que están en_proceso pero no tienen asesora)
  const listosParaAsignar = useMemo(() => porAsignar.filter(exp => {
    // Si ya está en validación, no va aquí
    if (validacion.some(v => v.id === exp.id)) return false;
    
    // Si es un expediente en proceso y no tiene asesora, debe ser visible para asignar
    if (exp.estatus === 'en_proceso') return true;
    
    // Flujo estándar
    return exp.contratos?.[0]?.url_pdf_firmado_cliente && (exp.pagos?.length || 0) > 0;
  }), [porAsignar, validacion]);

  const solicitudesBaja = useMemo(() => {
    return concentrado.reduce((acc, exp) => {
      const docs = exp.documentos?.filter(d => d.solicitud_borrado && d.estatus_borrado === 'pendiente') || [];
      return acc.concat(docs.map(d => ({ ...d, expediente: exp })));
    }, [] as any[]);
  }, [concentrado]);

  const filteredData = useMemo(() => {
    let result = activeTab === 'por_asignar' ? listosParaAsignar : activeTab === 'validacion' ? validacion : activeTab === 'bajas_docs' ? [] : concentrado;
    
    // --- DEDUPLICACIÓN POR ID ---
    const seen = new Set();
    result = result.filter(exp => {
      const duplicate = seen.has(exp.id);
      seen.add(exp.id);
      return !duplicate;
    });

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
        if (files.contrato) { const url = await upload(files.contrato, `expedientes/${empresaKey}/contratos`, 'Contrato'); await (await import('@/actions/contrato')).guardarContratoFirmado(newClientInfo.contrato_id, url); await registrarDocumento(newClientInfo.expediente_id, 'contrato_firmado', url, null, true); }
        if (files.ine_frente) await registrarDocumento(newClientInfo.expediente_id, 'ine_frente', await upload(files.ine_frente, `expedientes/${empresaKey}/documentacion`, 'INE'), null, true);
        if (files.curp) await registrarDocumento(newClientInfo.expediente_id, 'curp', await upload(files.curp, `expedientes/${empresaKey}/documentacion`, 'CURP'), null, true);
        if (files.domicilio) await registrarDocumento(newClientInfo.expediente_id, 'comprobante_domicilio', await upload(files.domicilio, `expedientes/${empresaKey}/documentacion`, 'Domicilio'), null, true);
        setCreateStep(3);
      } catch (err: any) { alert(err.message); } finally { setUploadProgress(''); }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans overflow-x-hidden">
      <AnimatePresence>{isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden" />}</AnimatePresence>

      <aside className={"fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 transform " + (isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="p-6 flex items-center justify-end border-b border-slate-800">
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 flex-1 overflow-y-auto custom-scrollbar">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Menú Principal</p>
           <nav className="space-y-1">
             <SidebarLink icon={<LayoutDashboard size={18} />} label="Por Asignar" active={activeTab === 'por_asignar'} onClick={() => setActiveTab('por_asignar')} badge={listosParaAsignar.length} />
             <SidebarLink icon={<ShieldCheck size={18} />} label="Validación" active={activeTab === 'validacion'} onClick={() => setActiveTab('validacion')} badge={validacion.length} />
             <SidebarLink icon={<Users size={18} />} label="Concentrado" active={activeTab === 'concentrado'} onClick={() => setActiveTab('concentrado')} />
             <SidebarLink icon={<UserPlus size={18} />} label="Altas Pendientes" active={activeTab === 'solicitudes'} onClick={() => setActiveTab('solicitudes')} badge={solicitudesAlta.filter((s: any) => s.estatus === 'pendiente').length || undefined} />
             <SidebarLink icon={<Trash2 size={18} />} label="Bajas Docs" active={activeTab === 'bajas_docs'} onClick={() => setActiveTab('bajas_docs')} badge={solicitudesBaja.length || undefined} />
           </nav>
           {activeTab === 'concentrado' && (
             <div className="mt-4 space-y-1 ml-4 border-l-2 border-slate-800 pl-4">
               {individualAsesoras.map(n => <SidebarFilterLink key={n} label={n} active={selectedAsesoraName === n} onClick={() => setSelectedAsesoraName(n)} />)}
               <SidebarFilterLink label="Todas" active={selectedAsesoraName === 'all'} onClick={() => setSelectedAsesoraName('all')} />
             </div>
           )}
        </div>
        <div className="px-6 py-6 mt-auto border-t border-slate-800">
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#0197D2] text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-sky-600/20 hover:bg-sky-500 transition-all">
             <LogOut size={18}/> Salir
           </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 p-6 md:p-8 w-full max-w-[1600px] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-900 text-slate-300 rounded-lg lg:hidden hover:text-white"><Menu size={20}/></button>
            {(activeTab === 'concentrado' || activeTab === 'solicitudes') && (
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                <input type="text" placeholder="Search (ctrl+k)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-sm font-medium text-slate-200 outline-none focus:border-sky-600 w-full placeholder-slate-500 transition-all shadow-inner" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 hidden md:flex">
             <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold">D</div>
                <span className="font-black uppercase tracking-widest text-xs">Directora</span>
             </div>
             <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/25 hover:from-red-500 hover:to-red-400 transition-all">
               <UserPlus size={14}/> Alta Maestra
             </button>
          </div>
        </header>

        {/* OVERVIEW CARDS */}
        {activeTab !== 'concentrado' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-500/20 flex items-center gap-1">↑ Activos</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Por Asignar</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{listosParaAsignar.length}</h3>
                <Users size={32} className="text-[#0197D2]/20" />
             </div>
           </div>
           
           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-1">↓ Revisión</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Validación Pendiente</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{validacion.length}</h3>
                <ShieldCheck size={32} className="text-[#0197D2]/20" />
             </div>
           </div>

           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-500/20 flex items-center gap-1">✓ Activos</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Concentrado Activo</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{concentrado.length}</h3>
                <ClipboardList size={32} className="text-[#0197D2]/20" />
             </div>
           </div>
        </div>
        )}

        {/* LISTADOS */}
        {activeTab === 'solicitudes' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">Solicitudes de Alta Pendientes</h2>
            {solicitudesAlta.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-xl">
                <UserPlus size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No hay solicitudes de alta pendientes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {solicitudesAlta.map((sol: any) => (
                  <div key={sol.id} className={`bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-xl hover:border-sky-500/30 transition-colors`}>
                    <div>
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-slate-300 font-black border border-slate-800 uppercase">{sol.nombre_cliente.charAt(0)}</div>
                           <div>
                             <h4 className="text-white font-black uppercase tracking-tight text-sm">{sol.nombre_cliente}</h4>
                             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{sol.nombre_empresa}</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800`}>
                             {sol.estatus}
                           </span>
                           <button 
                             onClick={async () => {
                               if(!confirm('¿Eliminar esta solicitud?')) return;
                               const res = await (await import('@/actions/directora')).eliminarSolicitudAltaAction(sol.id);
                               if(res.success) toast.success('Solicitud eliminada');
                               else toast.error(res.error || 'Error');
                             }}
                             className="text-slate-600 hover:text-red-500 transition-colors"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-4">Asesora: {sol.asesora?.nombre_completo || '---'}</p>
                      
                      <button 
                        onClick={() => { setSelectedRequest(sol); setIsRequestDetailModalOpen(true); }}
                        className="w-full py-3 mb-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 font-black uppercase tracking-widest text-[9px] hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={14}/> Ver Solicitud Completa
                      </button>

                      {sol.notas && <p className="text-[11px] text-slate-400 italic bg-slate-950 p-4 rounded-xl border border-slate-800">"{sol.notas}"</p>}
                    </div>
                    {sol.estatus === 'pendiente' && (
                      <div className="grid grid-cols-2 gap-3 mt-6">
                        <button
                          onClick={async () => {
                            const res = await (await import('@/actions/directora')).aprobarSolicitudAltaAction(sol.id);
                            if (res.success) toast.success('¡Alta aprobada! El expediente fue creado.');
                            else toast.error(res.error || 'Error');
                          }}
                          className="py-3 bg-[#0197D2] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/10"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={async () => {
                            const motivo = prompt('Motivo del rechazo:');
                            if (!motivo) return;
                            const res = await (await import('@/actions/directora')).rechazarSolicitudAltaAction(sol.id, motivo);
                            if (res.success) toast.error('Solicitud rechazada');
                            else toast.error(res.error || 'Error');
                          }}
                          className="py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all border border-slate-700"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'bajas_docs' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">Solicitudes de Baja de Documentos</h2>
            {solicitudesBaja.length === 0 ? (
               <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-xl">
                 <Trash2 size={48} className="mx-auto text-slate-700 mb-4" />
                 <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No hay solicitudes pendientes.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 gap-4">
                 {solicitudesBaja.map(doc => (
                   <div key={doc.id} className="bg-slate-900 rounded-2xl border border-red-500/30 p-6 flex flex-col justify-between shadow-xl">
                     <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 flex items-center justify-center"><AlertTriangle size={20}/></div>
                         <div>
                           <h4 className="font-black uppercase tracking-tight text-slate-200">Baja: {doc.nombre_personalizado || doc.tipo.replace(/_/g, ' ').toUpperCase()}</h4>
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{doc.expediente?.nombre_empresa}</p>
                         </div>
                       </div>
                       <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`)} className="px-4 py-2 bg-slate-950 text-sky-400 font-black uppercase tracking-widest text-[10px] rounded-xl border border-slate-800 hover:bg-slate-800 transition-all flex items-center gap-2"><ExternalLink size={14}/> Ver Documento</button>
                     </div>
                     <p className="text-xs text-slate-400 italic bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">Motivo: "{doc.motivo_borrado || 'Sin especificar'}"</p>
                     <div className="flex gap-3 mt-auto">
                       <button
                         onClick={async () => {
                           toast.loading('Aprobando...', { id: 'aprobar-doc' });
                           const res = await (await import('@/actions/documentos')).aprobarBorradoAction(doc.id);
                           if (res.success) toast.success('Autorizado', { id: 'aprobar-doc' });
                           else toast.error(res.error || 'Error', { id: 'aprobar-doc' });
                         }}
                         className="flex-1 py-3 bg-[#0197D2]/10 text-sky-400 border border-sky-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#0197D2] hover:text-white transition-all shadow-lg"
                       >Aprobar Eliminación</button>
                       <button
                         onClick={async () => {
                           toast.loading('Rechazando...', { id: 'rechazar-doc' });
                           const res = await (await import('@/actions/documentos')).rechazarBorradoAction(doc.id);
                           if (res.success) toast.error('Rechazado', { id: 'rechazar-doc' });
                           else toast.error(res.error || 'Error', { id: 'rechazar-doc' });
                         }}
                         className="flex-1 py-3 bg-red-600/10 text-red-400 border border-red-500/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all shadow-lg"
                       >Rechazar Baja</button>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
             {filteredData.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-xl">
                  <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No hay expedientes en esta categoría</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredData.map(exp => (
                    <div key={exp.id} className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col gap-6 hover:border-sky-500/30 transition-all shadow-xl group relative overflow-hidden">
                      {/* Decoración sutil de fondo */}
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all"></div>
                      
                      <div className="flex items-start gap-4 relative">
                        <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-300 font-black text-xl uppercase shrink-0 border border-slate-800 group-hover:border-sky-500/50 transition-all shadow-inner">
                           {exp.nombre_empresa.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-black uppercase tracking-tight text-sm break-words leading-tight group-hover:text-sky-400 transition-colors">{exp.nombre_empresa}</h4>
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1.5 break-words line-clamp-1">{exp.cliente?.nombre_completo || 'Sin titular'}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-4">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap">{exp.estatus.replace(/_/g, ' ').toUpperCase()}</span>
                            {activeTab === 'concentrado' && (
                               <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-sky-950/30 text-sky-400 border border-sky-900/30 whitespace-nowrap">Asesora: {exp.asesora?.nombre_completo?.split(' ')[0] || '---'}</span>
                            )}
                            {exp.documentos?.some(d => d.solicitud_borrado) && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-red-950/50 text-red-400 border border-red-900/30 animate-pulse whitespace-nowrap">BAJA PENDIENTE</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-auto pt-5 border-t border-slate-800/50">
                         {activeTab === 'concentrado' && (
                           <>
                            <button 
                              onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }} 
                              className="w-11 h-11 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:text-sky-400 hover:border-sky-500/50 transition-all shadow-lg shrink-0 group/btn"
                              title="Ver Gestión y Concentrado"
                            >
                              <Eye size={18} className="group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button 
                              onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }} 
                              className="flex-1 justify-center px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] bg-slate-950 text-sky-400 hover:bg-slate-800 transition-all flex items-center gap-2 border border-slate-800 group/docs"
                            >
                              <FileText size={14} className="shrink-0 group-hover/docs:scale-110 transition-transform"/> <span className="truncate">Documentación</span>
                            </button>
                           </>
                         )}

                         <button 
                           onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }} 
                           className={`flex-1 justify-center px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 shadow-lg ${exp.documentos?.some(d => d.solicitud_borrado) ? 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-500' : 'bg-[#0197D2] text-white border border-[#0197D2] hover:bg-sky-500 shadow-sky-600/10'}`}
                         >
                           {exp.documentos?.some(d => d.solicitud_borrado) ? <AlertTriangle size={14} className="shrink-0"/> : <ExternalLink size={14} className="shrink-0"/>} 
                           <span className="truncate">{activeTab === 'por_asignar' ? 'Validar' : 'Abrir'}</span>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        )}
      </main>

      {/* --- MODAL 1: EXPEDIENTE --- */}
      <AnimatePresence>
        {isValidationModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsValidationModalOpen(false)} className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
               <div className="bg-slate-950 p-6 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                 <div className="flex items-center gap-4"><div className="w-12 h-12 bg-[#0197D2]/10 border border-sky-600/20 text-sky-400 rounded-2xl flex items-center justify-center shadow-lg"><FileText size={24}/></div><div><h2 className="text-lg font-black uppercase tracking-tight">Expediente Documental</h2><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">{selectedExpediente.nombre_empresa}</p></div></div>
                 <button onClick={() => setIsValidationModalOpen(false)} className="text-slate-500 hover:text-white transition-colors p-2"><X size={24}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-900/50">
                 {/* SECCIÓN DE CONTRATOS */}
                 <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-inner space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0197D2] border-b border-slate-800 pb-4 flex items-center gap-3">
                       <FileSignature size={18}/> Contratos Oficiales
                    </h3>
                    <div className="flex flex-col gap-5">
                        
                        {/* 1. Contrato Generado */}
                        {(activeTab === 'validacion' || activeTab === 'concentrado') && selectedExpediente.contratos?.[0]?.url_pdf_generado && (
                          <div className="flex items-center justify-between bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                            <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_generado!)}`)} className="flex items-center gap-3 px-6 py-3 bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-600 hover:text-white transition-all shadow-lg">
                              <FileText size={16}/> Ver Contrato (Sistema)
                            </button>
                            
                            {!selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={async () => {
                                    const contratoId = selectedExpediente.contratos![0].id;
                                    toast.loading('Aprobando contrato...', { id: 'approve-contract' });
                                    try {
                                      const { aprobarContratoGeneradoCliente } = await import('@/actions/directora');
                                      const res = await aprobarContratoGeneradoCliente(selectedExpediente.id, contratoId);
                                      if (!res.success) throw new Error(res.error);
                                      toast.success('Contrato aprobado. El cliente ha sido notificado para firmar.', { id: 'approve-contract' });
                                    } catch (err: any) {
                                      toast.error(err.message, { id: 'approve-contract' });
                                    }
                                  }}
                                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
                                >
                                  <CheckCircle2 size={16}/> Aprobar Contrato
                                </button>

                                <div className="h-8 w-px bg-slate-800 mx-2" />
                                
                                <input 
                                  type="file" 
                                  accept=".pdf" 
                                  id="upload-nuevo-generado" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const contratoId = selectedExpediente.contratos![0].id;
                                    toast.loading('Reemplazando contrato...', { id: 'replace-contract' });
                                    try {
                                      const ext = file.name.split('.').pop() || 'pdf';
                                      const empresaFormat = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
                                      const newFile = new File([file], `Contrato_CORREGIDO_${empresaFormat}.${ext}`, { type: file.type });
                                      const fd = new FormData();
                                      fd.append('file', newFile);
                                      
                                      const { subirArchivoR2Action } = await import('@/actions/r2-actions');
                                      const uploadRes = await subirArchivoR2Action(fd, `expedientes/${empresaFormat}/contratos`);
                                      
                                      if (!uploadRes.success || !uploadRes.data) throw new Error(uploadRes.error || 'Error subiendo archivo');
                                      
                                      const { actualizarContratoGeneradoAction } = await import('@/actions/directora');
                                      const linkRes = await actualizarContratoGeneradoAction(contratoId, uploadRes.data.url);
                                      
                                      if (!linkRes.success) throw new Error(linkRes.error || 'Error vinculando contrato');
                                      
                                      toast.success('Contrato corregido y reemplazado', { id: 'replace-contract' });
                                      router.refresh();
                                    } catch (err: any) {
                                      toast.error(err.message || 'Error inesperado', { id: 'replace-contract' });
                                    } finally {
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <label htmlFor="upload-nuevo-generado" className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 hover:text-white transition-all cursor-pointer shadow-lg">
                                  <UploadCloud size={16}/> Subir Corrección
                                </label>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Contrato Firmado Cliente */}
                        {(activeTab === 'por_asignar' || activeTab === 'concentrado') && selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (
                          <div className="flex items-center gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                            <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_firmado_cliente!)}`)} className="flex items-center gap-3 px-6 py-3 bg-[#0197D2]/10 text-sky-400 border border-sky-600/20 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#0197D2] hover:text-white transition-all shadow-lg">
                              <FileSignature size={16}/> Ver Firma Cliente
                            </button>
                          </div>
                        )}

                        {/* 3. Doble Firma */}
                        {(activeTab === 'por_asignar' || activeTab === 'concentrado') && selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (
                          <div className="flex items-center gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                            {selectedExpediente.contratos?.[0]?.url_pdf_doble_firma ? (
                              <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_doble_firma!)}`)} className="flex items-center gap-3 px-6 py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 transition-all shadow-2xl shadow-red-600/20">
                                <Shield size={18}/> Ver Firma CECANI (Final)
                              </button>
                            ) : (
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="file" 
                                    accept=".pdf" 
                                    id="upload-doble-firma" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      
                                      const contratoId = selectedExpediente.contratos![0].id;
                                      setIsUploadingDobleFirma(true);
                                      try {
                                        const ext = file.name.split('.').pop() || 'pdf';
                                        const empresaFormat = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
                                        const newFile = new File([file], `Contrato_DOBLE_FIRMA_${empresaFormat}.${ext}`, { type: file.type });
                                        const fd = new FormData();
                                        fd.append('file', newFile);
                                        
                                        const { subirArchivoR2Action } = await import('@/actions/r2-actions');
                                        const uploadRes = await subirArchivoR2Action(fd, `expedientes/${empresaFormat}/contratos`);
                                        
                                        if (!uploadRes.success || !uploadRes.data) throw new Error(uploadRes.error || 'Error subiendo archivo');
                                        
                                        const { vincularContratoDobleFirmaAction } = await import('@/actions/directora');
                                        const linkRes = await vincularContratoDobleFirmaAction(contratoId, uploadRes.data.url);
                                        
                                        if (!linkRes.success) throw new Error(linkRes.error || 'Error vinculando contrato');
                                        
                                        toast.success('Contrato con Doble Firma subido exitosamente');
                                        router.refresh();
                                      } catch (err: any) {
                                        toast.error(err.message || 'Error inesperado');
                                      } finally {
                                        setIsUploadingDobleFirma(false);
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                  <label htmlFor="upload-doble-firma" className={`flex items-center gap-3 px-6 py-4 bg-red-600 text-white border border-red-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 transition-all cursor-pointer shadow-xl shadow-red-600/20 ${isUploadingDobleFirma ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploadingDobleFirma ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} 
                                    {isUploadingDobleFirma ? 'Subiendo...' : 'Subir Doble Firma (Documento Final)'}
                                  </label>
                                </div>
                              )
                            }
                          </div>
                        )}
                        
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {(activeTab === 'validacion' || activeTab === 'concentrado') && selectedExpediente.documentos?.map(doc => {
                     const viewUrl = `/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`;
                     const isPdf = doc.url_archivo?.toLowerCase().endsWith('.pdf');
                     const tipoLabel = doc.tipo.replace(/_/g, ' ').toUpperCase();
                     const isRejected = doc.motivo_rechazo && !doc.validado;

                     return (
                       <div key={doc.id} className={`rounded-3xl border overflow-hidden transition-all shadow-xl bg-slate-950/50 ${
                         isRejected ? 'border-red-600/40 bg-red-950/5' :
                         doc.solicitud_borrado ? 'border-red-600/40 bg-red-950/5' :
                         doc.validado ? 'border-sky-600/20' :
                         'border-slate-800'
                       }`}>
                         <div
                           className="relative w-full h-52 bg-slate-950 cursor-pointer group overflow-hidden"
                           onClick={() => setQuickViewUrl(viewUrl)}
                         >
                           {isPdf ? (
                             <iframe
                               src={viewUrl}
                               className="w-full h-full pointer-events-none opacity-80"
                               title={tipoLabel}
                             />
                           ) : (
                             <img
                               src={viewUrl}
                               alt={tipoLabel}
                               className="w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110"
                               onError={(e) => {
                                 (e.target as HTMLImageElement).style.display = 'none';
                                 (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                               }}
                             />
                           )}
                           <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 hidden`}>
                             <FileText size={40} className="text-slate-800" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Sin previsualización</p>
                           </div>

                           <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/70 transition-all flex items-center justify-center">
                             <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                               <div className="bg-slate-900/90 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-slate-800">
                                 <Eye size={18} className="text-sky-400" />
                                 <span className="text-[11px] font-black uppercase tracking-widest text-white">Ver Documento</span>
                               </div>
                             </div>
                           </div>

                           <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                             {doc.validado && (
                               <span className="bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">✓ Validado</span>
                             )}
                             {isRejected && (
                               <span className="bg-red-600/20 border border-red-600/30 text-red-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">✕ Rechazado</span>
                             )}
                             {!doc.validado && !isRejected && (
                               <span className="bg-[#0197D2]/10 border border-sky-600/20 text-sky-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">⏳ Revisión</span>
                             )}
                           </div>
                         </div>

                           <div className="p-6">
                             <div className="flex items-center justify-between mb-6">
                               <div className="min-w-0 flex-1">
                                 <p className="text-[11px] font-black uppercase tracking-widest text-slate-200 truncate">{tipoLabel}</p>
                                 {isRejected && doc.motivo_rechazo && (
                                   <p className="text-[10px] font-bold text-red-400 mt-2 bg-red-950/30 p-2 rounded-lg border border-red-900/20">↳ {doc.motivo_rechazo}</p>
                                 )}
                               </div>
                               <button
                                 onClick={() => setQuickViewUrl(viewUrl)}
                                 className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-sky-400 hover:bg-slate-800 transition-all shadow-xl ml-4 shrink-0"
                               >
                                 <Eye size={18} />
                               </button>
                             </div>
                             
                             {!doc.validado && !isRejected && !doc.solicitud_borrado && (
                               <div className="grid grid-cols-2 gap-3 mt-4">
                                 <button onClick={async () => {
                                   try {
                                     const { validarDocumentoAction } = await import('@/actions/directora');
                                     const res = await validarDocumentoAction(doc.id, true);
                                     if(res.success) { toast.success('Documento aprobado'); router.refresh(); }
                                     else throw new Error(res.error);
                                   } catch(err: any) { toast.error(err.message); }
                                 }} className="bg-[#0197D2] text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/10">Aprobar</button>
                                 
                                 <button onClick={async () => {
                                   const motivo = prompt('Motivo de rechazo:');
                                   if (!motivo) return;
                                   try {
                                     const { rechazarDocumentoR2Action } = await import('@/actions/directora');
                                     const res = await rechazarDocumentoR2Action(doc.id, doc.tipo, selectedExpediente.id, selectedExpediente.cliente_id, motivo, doc.url_archivo);
                                     if(res.success) { toast.error('Documento rechazado'); router.refresh(); }
                                     else throw new Error(res.error);
                                   } catch(err: any) { toast.error(err.message); }
                                 }} className="bg-slate-800 text-slate-400 border border-slate-700 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all">Rechazar</button>
                               </div>
                             )}

                             {doc.validado && (
                               <div className="mt-4 px-4 py-3 bg-emerald-950/10 border border-emerald-900/30 rounded-xl flex justify-center items-center gap-3 text-emerald-400">
                                 <CheckCircle2 size={18}/>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Documento Verificado</span>
                               </div>
                             )}

                           {doc.solicitud_borrado && (
                             <div className="mt-6 p-5 bg-slate-950 rounded-2xl border border-red-900/40 space-y-4">
                               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                                 <AlertTriangle size={14}/> Solicitud de Baja
                               </p>
                               <p className="text-xs text-slate-400 italic leading-relaxed">"{doc.motivo_borrado || 'SIN MOTIVO ESPECIFICADO'}"</p>
                               <div className="grid grid-cols-2 gap-3 mt-4">
                                 <button onClick={async () => { if(confirm('¿Autorizar eliminación definitiva?')) { const res = await (await import('@/actions/documentos')).aprobarBorradoAction(doc.id); if(res.success) toast.success('Autorizado'); else alert(res.error); } }} className="bg-red-600 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 shadow-lg shadow-red-600/10">Autorizar</button>
                                 <button onClick={async () => { const res = await (await import('@/actions/documentos')).rechazarBorradoAction(doc.id); if(res.success) toast.error('Rechazado'); else alert(res.error); }} className="bg-slate-900 text-slate-500 border border-slate-800 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all">Ignorar</button>
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                   {/* PAGOS */}
                   {(activeTab === 'por_asignar' || activeTab === 'concentrado') && selectedExpediente.pagos?.map((pago: any) => {
                     if (!pago.url_comprobante) return null;
                     const viewUrl = `/api/r2/download?url=${encodeURIComponent(pago.url_comprobante)}`;
                     const isPdf = pago.url_comprobante?.toLowerCase().endsWith('.pdf');
                     const isRejected = pago.motivo_rechazo && !pago.verificado;

                     return (
                       <div key={pago.id || Math.random().toString()} className={`rounded-3xl border overflow-hidden transition-all shadow-xl bg-slate-950/50 ${
                         isRejected ? 'border-red-600/40 bg-red-950/5' :
                         pago.verificado ? 'border-sky-600/20' :
                         'border-slate-800'
                       }`}>
                         <div
                           className="relative w-full h-52 bg-slate-950 cursor-pointer group overflow-hidden"
                           onClick={() => setQuickViewUrl(viewUrl)}
                         >
                           {isPdf ? (
                             <iframe
                               src={viewUrl}
                               className="w-full h-full pointer-events-none opacity-80"
                               title="Comprobante de Pago"
                             />
                           ) : (
                             <img
                               src={viewUrl}
                               alt="Comprobante de Pago"
                               className="w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110"
                               onError={(e) => {
                                 (e.target as HTMLImageElement).style.display = 'none';
                                 (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                               }}
                             />
                           )}
                           <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 hidden`}>
                             <FileText size={40} className="text-slate-800" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Sin previsualización</p>
                           </div>

                           <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/70 transition-all flex items-center justify-center">
                             <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                               <div className="bg-slate-900/90 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-slate-800">
                                 <Eye size={18} className="text-sky-400" />
                                 <span className="text-[11px] font-black uppercase tracking-widest text-white">Ver Comprobante</span>
                               </div>
                             </div>
                           </div>

                           <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                             {pago.verificado && (
                               <span className="bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">✓ Verificado</span>
                             )}
                             {isRejected && (
                               <span className="bg-red-600/20 border border-red-600/30 text-red-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">✕ Rechazado</span>
                             )}
                             {!pago.verificado && !isRejected && (
                               <span className="bg-[#0197D2]/10 border border-sky-600/20 text-sky-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">⏳ Revisión</span>
                             )}
                           </div>
                         </div>

                           <div className="p-6">
                             <div className="flex items-center justify-between mb-6">
                               <div className="min-w-0 flex-1">
                                 <p className="text-[11px] font-black uppercase tracking-widest text-slate-200">COMPROBANTE DE PAGO</p>
                                 <p className="text-[14px] font-black text-sky-400 mt-1.5">${pago.monto?.toLocaleString() || '0.00'}</p>
                                 {isRejected && pago.motivo_rechazo && (
                                   <p className="text-[10px] font-bold text-red-400 mt-2 bg-red-950/30 p-2 rounded-lg border border-red-900/20">↳ {pago.motivo_rechazo}</p>
                                 )}
                               </div>
                               <button
                                 onClick={() => setQuickViewUrl(viewUrl)}
                                 className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-sky-400 hover:bg-slate-800 transition-all shadow-xl ml-4 shrink-0"
                               >
                                 <Eye size={18} />
                               </button>
                             </div>
                             
                             {!pago.verificado && !isRejected && (
                               <div className="grid grid-cols-1 gap-3 mt-4">
                                 <button onClick={async () => {
                                   if (!pago.id) {
                                     toast.error('ID de pago no encontrado');
                                     return;
                                   }
                                   try {
                                     const { validarPagoAction } = await import('@/actions/directora');
                                     const res = await validarPagoAction(pago.id, selectedExpediente.id, selectedExpediente.cliente_id);
                                     if(res.success) { toast.success('Pago verificado'); router.refresh(); }
                                     else throw new Error(res.error);
                                   } catch(err: any) { toast.error(err.message); }
                                 }} className="bg-[#0197D2] text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/10">Confirmar Recepción de Pago</button>
                               </div>
                             )}

                             {pago.verificado && (
                               <div className="mt-4 px-4 py-3 bg-emerald-950/10 border border-emerald-900/30 rounded-xl flex justify-center items-center gap-3 text-emerald-400">
                                 <CheckCircle2 size={18}/>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Pago Validado</span>
                               </div>
                             )}
                           </div>
                       </div>
                     );
                   })}
                 </div>
                 
                 {/* ASIGNACIÓN DE ABOGADA */}
                 {activeTab === 'por_asignar' && !selectedExpediente.asesora_id && (
                   <div className="mt-12 border-t border-slate-800 pt-10">
                     {(() => {
                       const docsValid = selectedExpediente.documentos?.length ? selectedExpediente.documentos.every(d => d.validado) : true;
                       const pagosValid = selectedExpediente.pagos?.length ? selectedExpediente.pagos.every(p => p.verificado) : true;
                       const allDocsValidated = docsValid && pagosValid && ((selectedExpediente.documentos?.length || 0) > 0 || (selectedExpediente.pagos?.length || 0) > 0);
                       const hasDobleFirma = !!selectedExpediente.contratos?.[0]?.url_pdf_doble_firma;
                       
                       // Permitir asignación si es un registro de Excel/Manual (ya en_proceso) o si pasó el flujo digital completo
                       const isLegacy = selectedExpediente.estatus === 'en_proceso';
                       const isReadyToAssign = isLegacy || (allDocsValidated && hasDobleFirma);

                       if (!isReadyToAssign) {
                         return (
                           <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
                             <div className="space-y-2 text-center md:text-left">
                               <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Asignación Restringida</h3>
                               <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest max-w-md">Valida toda la documentación y sube el contrato oficial firmado por CECANI para habilitar el equipo legal.</p>
                             </div>
                             <div className="flex gap-4">
                               <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border-2 ${allDocsValidated ? 'bg-emerald-900/10 text-emerald-500 border-emerald-900/30' : 'bg-red-900/10 text-red-500 border-red-900/30 animate-pulse'}`}>
                                 {allDocsValidated ? 'Docs Listos' : 'Validación Pendiente'}
                               </div>
                               <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border-2 ${hasDobleFirma ? 'bg-emerald-900/10 text-emerald-500 border-emerald-900/30' : 'bg-red-900/10 text-red-500 border-red-900/30 animate-pulse'}`}>
                                 {hasDobleFirma ? 'CECANI Firma OK' : 'Falta Doble Firma'}
                               </div>
                             </div>
                           </div>
                         );
                       }

                       return (
                         <div className="bg-sky-950/10 p-10 rounded-[2.5rem] border-4 border-sky-900/20 shadow-2xl">
                           <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-[#0197D2] mb-8 flex items-center gap-3">
                             <UserPlus size={20}/> Designar Equipo Operativo (Abogada)
                           </h3>
                           <form action={async (formData) => {
                             toast.loading('Procesando asignación...', { id: 'assign' });
                             try {
                               const { asignarAbogada } = await import('@/actions/directora');
                               const res = await asignarAbogada(formData);
                               if (!res.success) throw new Error(res.error);
                               toast.success('Abogada asignada correctamente. El expediente ahora es visible en su panel.', { id: 'assign' });
                               setIsValidationModalOpen(false);
                               router.refresh();
                             } catch (err: any) {
                               toast.error(err.message, { id: 'assign' });
                             }
                           }} className="flex flex-col md:flex-row items-end gap-6">
                             <input type="hidden" name="expediente_id" value={selectedExpediente.id} />
                             <div className="flex-1 w-full space-y-3">
                               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Seleccionar Abogada Responsable</label>
                               <select name="asesora_id" required className="w-full p-4 bg-slate-950/80 border-2 border-slate-800 rounded-2xl text-sm font-black uppercase tracking-widest text-white outline-none focus:border-sky-600 transition-all appearance-none cursor-pointer shadow-inner">
                                 <option value="">-- ELIGE UNA ABOGADA --</option>
                                 {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                               </select>
                             </div>
                             <button type="submit" className="w-full md:w-auto py-4 px-10 bg-[#0197D2] text-white rounded-2xl font-black uppercase tracking-[0.25em] text-xs shadow-2xl shadow-sky-600/30 hover:bg-sky-500 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                               Confirmar Asignación <ArrowRight size={18}/>
                             </button>
                           </form>
                         </div>
                       );
                     })()}
                   </div>
                 )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: GESTIÓN Y CONCENTRADO --- */}
      <AnimatePresence>
        {isAssignModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-6xl w-full flex flex-col max-h-[95vh] overflow-hidden border border-slate-800">
               <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                 <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center shadow-lg"><ClipboardList size={28}/></div>
                   <div>
                     <h2 className="text-xl font-black uppercase tracking-tight">Gestión y Concentrado Operativo</h2>
                     <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{selectedExpediente.nombre_empresa}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsAssignModalOpen(false)} className="bg-slate-900 p-3 rounded-2xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all shadow-xl"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-10 bg-slate-900/50">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    
                    {/* COLUMNA IZQUIERDA: PERFIL Y CONTACTO */}
                    <div className="xl:col-span-5 space-y-8">
                      <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 shadow-inner relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-sky-500/10 transition-all"></div>
                        
                        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-5">
                           <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400 flex items-center gap-3">
                              <UserCircle size={18}/> Perfil del Cliente
                           </h3>
                           <a 
                             href={`https://wa.me/52${selectedExpediente.cliente?.telefono?.replace(/\D/g, '')}`} 
                             target="_blank" 
                             className="flex items-center gap-2.5 px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-emerald-600 hover:text-white transition-all shadow-lg"
                           >
                             <MessageCircle size={14}/> WhatsApp
                           </a>
                        </div>
                        
                        <div className="space-y-6">
                           <TextData label="Nombre Completo" value={selectedExpediente.cliente?.nombre_completo} />
                           <div className="grid grid-cols-2 gap-6">
                             <TextData label="RFC" value={selectedExpediente.cliente?.rfc} />
                             <TextData label="CURP" value={selectedExpediente.cliente?.curp} />
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                             <TextData label="Teléfono" value={selectedExpediente.cliente?.telefono} />
                             <TextData label="Ocupación" value={selectedExpediente.cliente?.ocupacion} />
                           </div>
                           <TextData label="Domicilio Completo" value={selectedExpediente.cliente?.domicilio_completo} />
                        </div>
                      </div>

                      <div className="bg-sky-950/20 p-8 rounded-[2rem] border border-sky-900/30 flex flex-col justify-center text-center shadow-2xl relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-sky-600/5 to-transparent"></div>
                         <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-500 mb-4 relative">Inversión Total del Proyecto</h3>
                         <p className="text-5xl font-black text-white tracking-tighter relative drop-shadow-2xl">${selectedExpediente.contratos?.[0]?.monto_total?.toLocaleString() || '0.00'}</p>
                         <p className="text-[9px] font-black uppercase tracking-[0.3em] text-sky-700 mt-5 relative">Pesos Mexicanos (M.N.)</p>
                      </div>
                    </div>

                    {/* COLUMNA DERECHA: DATOS OPERATIVOS */}
                    <div className="xl:col-span-7 space-y-8">
                      <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden h-full">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 flex items-center gap-3">
                           <FileText size={18}/> Información Operativa en Bitácora
                        </h3>
                        
                        {(() => {
                          const datos = Array.isArray(selectedExpediente.datos_concentrado) ? selectedExpediente.datos_concentrado[0] : (selectedExpediente.datos_concentrado as any);
                          return (
                            <div className="space-y-8">
                              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-4 bg-sky-500 rounded-full"></div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Objeto Social Transcrito</p>
                                </div>
                                <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl text-slate-300 text-sm font-bold italic leading-relaxed whitespace-pre-wrap shadow-inner min-h-[120px] max-h-[250px] overflow-y-auto custom-scrollbar">{datos?.objeto_social_ventas || 'SIN TRANSCRIPCIÓN TODAVÍA'}</div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-10">
                                <TextData label="Asesora Asignada" value={selectedExpediente.asesora?.nombre_completo || 'No asignada'} />
                                <TextData label="Vendedora" value={datos?.vendedora} />
                                <TextData label="Notaría" value={datos?.notaria} />
                                <div className="md:col-span-3 h-px bg-slate-800/50 my-2"></div>
                                <TextData label="Folio RPP" value={datos?.folio_rpp} />
                                <TextData label="Libro" value={datos?.libro_rpp} />
                                <TextData label="Volumen" value={datos?.volumen_rpp} />
                                <TextData label="Estatus RPP" value={datos?.estatus_rpp} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
               </div>
               
               <div className="bg-slate-950 p-6 px-10 flex items-center justify-between border-t border-slate-800 shrink-0">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">ID Expediente: {selectedExpediente.id}</p>
                 <button onClick={() => setIsAssignModalOpen(false)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all border border-slate-800 shadow-xl">Cerrar Concentrado</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: ALTA MAESTRA --- */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetCreateState} className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
              <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-red-600/10 border border-red-600/20 text-red-500 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24}/></div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Alta Maestra</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Paso {createStep} de 3</p>
                  </div>
                </div>
                <button onClick={resetCreateState} className="text-slate-600 hover:text-white transition-colors"><X size={28}/></button>
              </div>

              <div className="flex bg-slate-950/30 border-b border-slate-800">
                {[1,2,3].map(s => (
                  <div key={s} className={`flex-1 py-4 text-center text-[9px] font-black uppercase tracking-[0.3em] transition-all ${ createStep === s ? 'bg-red-600/10 text-red-400 border-b-4 border-red-600' : createStep > s ? 'text-sky-400' : 'text-slate-700' }`}>
                    {s === 1 ? 'Datos Cliente' : s === 2 ? 'Documentos' : 'Confirmado'}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-900/50">
                {/* PASO 1 */}
                {createStep === 1 && (
                  <form onSubmit={onInitManualRegistry} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre Completo *</label><input required name="nombre_completo" placeholder="Nombre del cliente" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-red-600 transition-all placeholder:text-slate-800" /></div>
                      <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono Móvil *</label><input required name="telefono" placeholder="10 dígitos" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-red-600 transition-all placeholder:text-slate-800" /></div>
                      <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre de la Asociación *</label><input required name="nombre_empresa" placeholder="Denominación o proyecto" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-red-600 transition-all placeholder:text-slate-800" /></div>
                      <div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">RFC del Titular</label><input name="rfc" placeholder="Opcional" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:border-red-600 transition-all placeholder:text-slate-800" /></div>
                      <div className="space-y-3 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Pre-asignar Abogada</label>
                        <select name="asesora_id" className="w-full p-4 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-sm font-black uppercase tracking-widest text-white outline-none focus:border-red-600 transition-all appearance-none cursor-pointer">
                          <option value="">-- Sin asignar todavía --</option>
                          {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                        </select>
                      </div>
                    </div>
                    <button type="submit" disabled={isPending} className="w-full mt-6 py-5 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-xl shadow-red-600/30 hover:bg-red-500 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                      {isPending ? <><Loader2 className="animate-spin" size={18}/>Creando Expediente...</> : <>Iniciar Proceso Legal <ArrowRight size={18}/></>}
                    </button>
                  </form>
                )}

                {/* PASO 2 */}
                {createStep === 2 && newClientInfo && (
                  <div className="space-y-8">
                    <div className="bg-[#0197D2]/10 p-6 rounded-2xl border-2 border-sky-600/20 flex items-center gap-4 shadow-inner">
                      <CheckCircle2 className="text-sky-400" size={24}/>
                      <div><p className="text-[10px] font-black uppercase tracking-widest text-sky-400">Expediente Maestro Creado</p><p className="text-sm font-black text-white uppercase mt-1">{newClientInfo.nombre_empresa}</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FileUploader label="Contrato Firmado (PDF)" icon={<FileSignature size={32}/>} file={files.contrato} onChange={f => setFiles(p => ({...p, contrato: f}))}/>
                      <FileUploader label="INE Frente" icon={<UserCircle size={32}/>} file={files.ine_frente} onChange={f => setFiles(p => ({...p, ine_frente: f}))}/>
                      <FileUploader label="CURP" icon={<FileText size={32}/>} file={files.curp} onChange={f => setFiles(p => ({...p, curp: f}))}/>
                      <FileUploader label="Comprobante Domicilio" icon={<MapPin size={32}/>} file={files.domicilio} onChange={f => setFiles(p => ({...p, domicilio: f}))}/>
                    </div>
                    {uploadProgress && <div className="text-center text-[10px] font-black uppercase tracking-widest text-sky-400 animate-pulse bg-sky-950 p-4 rounded-xl border border-sky-900/30">{uploadProgress}</div>}
                    <button onClick={onUploadMasterDocs} disabled={isPending} className="w-full py-5 bg-[#0197D2] text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-xl shadow-sky-600/20 hover:bg-sky-500 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                      {isPending ? <><Loader2 className="animate-spin" size={18}/>Subiendo Archivos...</> : <>Confirmar Carga de Documentos <ArrowRight size={18}/></>}
                    </button>
                  </div>
                )}

                {/* PASO 3 */}
                {createStep === 3 && (
                  <div className="text-center py-12 space-y-8">
                    <div className="w-20 h-20 bg-[#0197D2]/10 rounded-full flex items-center justify-center mx-auto border-4 border-sky-600/20 shadow-2xl shadow-sky-600/10"><CheckCircle2 className="text-sky-400" size={40}/></div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tight text-white">¡Alta Exitosa!</h3>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">El expediente maestro está listo para ser asignado.</p>
                    </div>
                    <button onClick={resetCreateState} className="px-12 py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-xs hover:bg-slate-800 transition-all border-2 border-slate-800 shadow-xl">Cerrar Panel</button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{quickViewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickViewUrl(null)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full h-full flex flex-col overflow-hidden border border-slate-800">
             <div className="bg-slate-950 p-6 flex items-center justify-between text-slate-200 border-b border-slate-800"><h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0197D2]">Visor de Expediente Digital</h2><button onClick={() => setQuickViewUrl(null)} className="text-slate-500 hover:text-white transition-colors"><X size={28}/></button></div>
             <div className="flex-1 bg-slate-950 p-4 md:p-10"><iframe src={quickViewUrl} className="w-full h-full rounded-[2rem] bg-white shadow-2xl overflow-hidden" /></div>
          </motion.div>
        </div>
      )}</AnimatePresence>

      {/* --- MODAL 4: DETALLE DE SOLICITUD DE ALTA --- */}
      <AnimatePresence>
        {isRequestDetailModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRequestDetailModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
               <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                 <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg"><Info size={28}/></div>
                   <div>
                     <h2 className="text-xl font-black uppercase tracking-tight">Detalles de la Solicitud</h2>
                     <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Enviada por {selectedRequest.asesora?.nombre_completo}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsRequestDetailModalOpen(false)} className="bg-slate-900 p-3 rounded-2xl text-slate-500 hover:text-white transition-all"><X size={24}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10 bg-slate-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-8">
                        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
                           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-400 border-b border-slate-800 pb-3">Información del Perfil</h3>
                           <TextData label="Nombre del Cliente" value={selectedRequest.nombre_cliente} />
                           <TextData label="Asociación / Empresa" value={selectedRequest.nombre_empresa} />
                           <div className="grid grid-cols-2 gap-4">
                             <TextData label="RFC" value={selectedRequest.rfc} />
                             <TextData label="CURP" value={selectedRequest.curp} />
                           </div>
                           <TextData label="Teléfono" value={selectedRequest.telefono} />
                           <TextData label="Domicilio" value={selectedRequest.domicilio_completo} />
                        </div>

                        <div className="bg-sky-950/20 p-6 rounded-3xl border border-sky-900/30">
                           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-500 mb-2">Inversión Propuesta</h3>
                           <p className="text-3xl font-black text-white">${selectedRequest.monto_total?.toLocaleString() || '0.00'}</p>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-2">Documentos Adjuntos</h3>
                        <div className="grid grid-cols-1 gap-4">
                           {selectedRequest.url_ine_frente && <DocLink label="INE FRENTE" url={selectedRequest.url_ine_frente} onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedRequest.url_ine_frente)}`)} />}
                           {selectedRequest.url_ine_reverso && <DocLink label="INE REVERSO" url={selectedRequest.url_ine_reverso} onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedRequest.url_ine_reverso)}`)} />}
                           {selectedRequest.url_curp && <DocLink label="CURP" url={selectedRequest.url_curp} onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedRequest.url_curp)}`)} />}
                           {selectedRequest.url_comprobante_domicilio && <DocLink label="COMPROBANTE DOMICILIO" url={selectedRequest.url_comprobante_domicilio} onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedRequest.url_comprobante_domicilio)}`)} />}
                           {selectedRequest.url_contrato && <DocLink label="CONTRATO (BORRADOR)" url={selectedRequest.url_contrato} onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedRequest.url_contrato)}`)} highlight />}
                        </div>
                        
                        {selectedRequest.notas && (
                          <div className="mt-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 ml-2">Notas de la Asesora:</p>
                            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-slate-400 text-xs italic leading-relaxed">"{selectedRequest.notas}"</div>
                          </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className="bg-slate-950 p-8 flex gap-4 border-t border-slate-800 shrink-0">
                  <button
                    onClick={async () => {
                      setIsRequestDetailModalOpen(false);
                      toast.loading('Aprobando alta maestra...', { id: 'approve-req' });
                      const res = await (await import('@/actions/directora')).aprobarSolicitudAltaAction(selectedRequest.id);
                      if (res.success) toast.success('¡Alta aprobada! Expediente creado y documentos vinculados.', { id: 'approve-req' });
                      else toast.error(res.error || 'Error', { id: 'approve-req' });
                    }}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 size={18}/> Aprobar Todo e Iniciar
                  </button>
                  <button
                    onClick={async () => {
                      const motivo = prompt('Motivo del rechazo:');
                      if (!motivo) return;
                      setIsRequestDetailModalOpen(false);
                      const res = await (await import('@/actions/directora')).rechazarSolicitudAltaAction(selectedRequest.id, motivo);
                      if (res.success) toast.error('Solicitud rechazada');
                      else toast.error(res.error || 'Error');
                    }}
                    className="px-10 py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-600 hover:text-white transition-all border border-slate-700"
                  >
                    Rechazar
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DocLink({ label, onClick, highlight }: { label: string, url: string, onClick: () => void, highlight?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${highlight ? 'bg-sky-600/10 border-sky-600/30 hover:bg-sky-600/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
       <div className="flex items-center gap-3">
         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-900 text-slate-500'}`}><FileText size={20}/></div>
         <span className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-sky-400' : 'text-slate-400'}`}>{label}</span>
       </div>
       <ExternalLink size={14} className={highlight ? 'text-sky-400' : 'text-slate-600'} />
    </button>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: any) {
  return (
    <div className="relative group">
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-[#0197D2] rounded-r-full shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>}
      <button onClick={onClick} className={"w-full flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all " + (active ? "bg-slate-800 text-white shadow-inner" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/40")}>
        <div className="flex items-center gap-4"><div className={active ? "text-sky-400" : "text-slate-600 group-hover:text-slate-400"}>{icon}</div><span className="text-[11px] font-black uppercase tracking-[0.15em]">{label}</span></div>
        {badge !== undefined && <span className={"text-[9px] font-black px-2 py-1 rounded-lg " + (active ? "bg-[#0197D2] text-white shadow-lg shadow-sky-600/20" : "bg-slate-950 text-slate-700 border border-slate-800")}>{badge}</span>}
      </button>
    </div>
  );
}

function SidebarFilterLink({ label, active, onClick }: any) {
  return <button onClick={onClick} className={"w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all " + (active ? "bg-slate-800 text-white shadow-inner" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800/30")}>{label}</button>;
}

function TextData({ label, value, inline }: { label: string, value?: string, inline?: boolean }) {
  return (
    <div className={inline ? "flex justify-between items-center" : "space-y-2"}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 ml-1">{label}:</p>
      <p className="text-sm font-black uppercase tracking-tight text-white truncate">{value || '---'}</p>
    </div>
  );
}

function FileUploader({ label, icon, onChange, file }: {label: string, icon: any, onChange: (f: File) => void, file?: File}) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{label}</label>
      <div className={"relative h-32 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all " + (file ? "border-sky-600 bg-sky-950/20 shadow-inner" : "border-slate-800 bg-slate-950/40 hover:border-slate-700")}>
        <div className={file ? "text-sky-400" : "text-slate-700"}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest mt-3 px-6 w-full text-center truncate text-slate-400">{file ? file.name : 'Click o Arrastra'}</span>
        <input type="file" accept=".pdf" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
