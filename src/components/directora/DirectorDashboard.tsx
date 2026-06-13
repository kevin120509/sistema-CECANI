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
    const channels = [
      supabase.channel('expedientes_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, () => router.refresh()).subscribe(),
      supabase.channel('documentos_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, () => router.refresh()).subscribe(),
      supabase.channel('contratos_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, () => router.refresh()).subscribe(),
      supabase.channel('pagos_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => router.refresh()).subscribe()
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [router]);

  // --- DERIVED DATA ---
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
    const all = [...porAsignar, ...concentrado];
    const docs = [];
    for(const exp of all) {
      if(exp.documentos) {
        for(const doc of exp.documentos) {
          if(doc.solicitud_borrado && doc.estatus_borrado === 'pendiente') {
            docs.push({ ...doc, expediente: exp });
          }
        }
      }
    }
    return docs;
  }, [porAsignar, concentrado]);

  const individualAsesoras = useMemo(() => {
    const names = new Set<string>();
    concentrado.forEach(e => {
       if(e.asesora?.nombre_completo) names.add(e.asesora.nombre_completo);
       e.expediente_asesoras?.forEach(rel => names.add(rel.asesora.nombre_completo));
    });
    return Array.from(names).sort();
  }, [concentrado]);

  // --- ACTIONS ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAbogada();
    router.push('/abogada');
  };

  const handleAsignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpediente || !asesoraId) return;
    startTransition(async () => {
      const res = await asignarAbogada(selectedExpediente.id, asesoraId);
      if (res.success) {
        setIsAssignModalOpen(false);
        setAsesoraId('');
        toast.success('Abogada asignada correctamente');
        router.refresh();
      } else alert(res.error);
    });
  };

  const onEliminarExpediente = async (id: string, cid: string) => {
    if (!confirm("¿Seguro que deseas eliminar este expediente por completo? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      const res = await eliminarExpedienteAction(id, cid);
      if (res.error) alert(res.error);
    });
  };

  const resetCreateState = () => {
    setCreateStep(1);
    setNewClientInfo(null);
    setFiles({});
    setFinalAsesoraId('');
    setIsCreateModalOpen(false);
  };
  const onInitManualRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await crearClienteManualAction(formData);
      if (res.success && res.data) {
        setNewClientInfo({ ...res.data, nombre_empresa: formData.get('nombre_empresa') as string });
        setCreateStep(2);
      } else alert(res.error || 'Error');
    });
  };

  const onUploadMasterDocs = async () => {
    if(!newClientInfo) return;
    startTransition(async () => {
      try {
        const empresaKey = newClientInfo.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
        const upload = async (file: File, folder: string, label: string) => {
          setUploadProgress(`Subiendo ${label}...`);
          const fd = new FormData();
          fd.append('file', file);
          const res = await subirArchivoR2Action(fd, folder);
          if(!res.success || !res.data) throw new Error(res.error);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-500/20 flex items-center gap-1">↑ Activos</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Abogadas</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{abogadas.length}</h3>
                <Users size={32} className="text-[#0197D2]/20" />
             </div>
           </div>
           
           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-1">↓ Bajas</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Bajas Pendientes</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{solicitudesBaja.length}</h3>
                <Trash2 size={32} className="text-[#0197D2]/20" />
             </div>
           </div>

           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest border border-sky-500/20 flex items-center gap-1">✓ Listos</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Por Asignar</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{listosParaAsignar.length}</h3>
                <ClipboardList size={32} className="text-[#0197D2]/20" />
             </div>
           </div>

           <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
             <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 flex items-center gap-1">○ Revisión</span>
             </div>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">En Validación</p>
             <div className="flex items-end justify-between mt-1">
                <h3 className="text-3xl font-black text-white">{validacion.length}</h3>
                <ShieldCheck size={32} className="text-[#0197D2]/20" />
             </div>
           </div>
        </div>
        )}

        {/* SEARCH BAR (Global for list tabs) */}
        {['por_asignar', 'concentrado', 'validacion'].includes(activeTab) && (
          <div className="mb-8 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, empresa o número de control..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl py-5 pl-16 pr-8 text-sm font-bold text-white outline-none focus:border-sky-600/50 transition-all placeholder:text-slate-700 shadow-2xl"
            />
          </div>
        )}

        {/* LISTADOS */}
        {activeTab === 'por_asignar' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">Listos para Asignación Operativa</h2>
            {listosParaAsignar.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-xl">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No hay expedientes listos para asignar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listosParaAsignar.filter(exp => {
                  const search = searchQuery.toLowerCase();
                  return exp.nombre_empresa.toLowerCase().includes(search) || 
                         exp.cliente?.nombre_completo.toLowerCase().includes(search) ||
                         exp.numero_control?.toLowerCase().includes(search);
                }).map(exp => (
                  <div key={exp.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-sky-500/30 transition-all group">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-sky-500 font-black border border-slate-800 uppercase text-lg">{exp.nombre_empresa.charAt(0)}</div>
                      <div>
                        <h4 className="text-white font-black uppercase tracking-tight text-sm group-hover:text-sky-400 transition-colors">{exp.nombre_empresa}</h4>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{exp.cliente?.nombre_completo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="hidden md:block text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Monto Contrato</p>
                        <p className="text-xs font-black text-slate-300">${exp.contratos?.[0]?.monto_total?.toLocaleString()}</p>
                      </div>
                      <div className="hidden md:block text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Estatus Actual</p>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">{exp.estatus}</span>
                      </div>
                      <button 
                        onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }}
                        className="px-6 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 font-black uppercase tracking-widest text-[10px] hover:text-white hover:bg-sky-600 transition-all shadow-lg"
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'concentrado' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">Concentrado de Expedientes Operativos</h2>
            <div className="space-y-3">
              {concentrado.filter(exp => {
                const search = searchQuery.toLowerCase();
                const matchesSearch = exp.nombre_empresa.toLowerCase().includes(search) || 
                                     exp.cliente?.nombre_completo.toLowerCase().includes(search) ||
                                     exp.numero_control?.toLowerCase().includes(search);
                const matchesAsesora = selectedAsesoraName === 'all' || 
                                      exp.asesora?.nombre_completo === selectedAsesoraName || 
                                      exp.expediente_asesoras?.some(rel => rel.asesora.nombre_completo === selectedAsesoraName);
                return matchesSearch && matchesAsesora;
              }).map(exp => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-sky-500/30 transition-all group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-slate-400 font-black border border-slate-800 uppercase text-lg">{exp.nombre_empresa.charAt(0)}</div>
                    <div>
                      <h4 className="text-white font-black uppercase tracking-tight text-sm group-hover:text-sky-400 transition-colors">{exp.nombre_empresa}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{exp.cliente?.nombre_completo}</p>
                        <span className="text-[8px] text-slate-700">•</span>
                        <p className="text-sky-600 text-[10px] font-black uppercase tracking-widest">{exp.asesora?.nombre_completo || 'SIN ASESORA'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-12">
                    <div className="hidden md:block text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Inversión</p>
                      <p className="text-xs font-black text-slate-300">${exp.contratos?.[0]?.monto_total?.toLocaleString()}</p>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Actualizado</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase">{new Date(exp.updated_at).toLocaleDateString('es-MX')}</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }}
                      className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-500 flex items-center justify-center hover:text-white hover:bg-slate-800 transition-all shadow-lg"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'validacion' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100 mb-4">Expedientes en Proceso de Validación</h2>
            <div className="space-y-3">
              {validacion.filter(exp => {
                const search = searchQuery.toLowerCase();
                return exp.nombre_empresa.toLowerCase().includes(search) || 
                       exp.cliente?.nombre_completo.toLowerCase().includes(search) ||
                       exp.numero_control?.toLowerCase().includes(search);
              }).map(exp => (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-emerald-500 font-black border border-slate-800 uppercase text-lg">{exp.nombre_empresa.charAt(0)}</div>
                    <div>
                      <h4 className="text-white font-black uppercase tracking-tight text-sm group-hover:text-emerald-400 transition-colors">{exp.nombre_empresa}</h4>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{exp.cliente?.nombre_completo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-12">
                    <div className="hidden md:block text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Creado</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase">{new Date(exp.created_at).toLocaleDateString('es-MX')}</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }}
                      className="px-6 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-emerald-500 font-black uppercase tracking-widest text-[10px] hover:text-white hover:bg-emerald-600 transition-all shadow-lg"
                    >
                      Revisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'solicitudes' ? (
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
                       <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-red-950 text-red-400 border border-red-900/50">Pendiente</span>
                       </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                       <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Motivo de la Abogada:</p>
                         <p className="text-xs text-slate-300 italic">"{doc.motivo_borrado || 'No especificado'}"</p>
                       </div>
                       <div className="flex flex-col gap-3">
                         <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`)} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"><Eye size={14}/> Ver Documento</button>
                         <div className="flex gap-2">
                           <button onClick={async () => {
                             if(!confirm('¿Confirmar ELIMINACIÓN PERMANENTE de este archivo?')) return;
                             const res = await (await import('@/actions/documentos')).aprobarBorradoAction(doc.id);
                             if(res.success) toast.success('Documento eliminado permanentemente');
                             else toast.error(res.error || 'Error');
                           }} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-600/10">Autorizar Baja</button>
                           <button onClick={async () => {
                             const res = await (await import('@/actions/documentos')).rechazarBorradoAction(doc.id);
                             if(res.success) toast.success('Solicitud rechazada');
                             else toast.error(res.error || 'Error');
                           }} className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-white transition-all border border-slate-700">Ignorar</button>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        ) : null}
      </main>

      <AnimatePresence>
        {isAssignModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-7xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
               <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                 <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-sky-600/10 border border-sky-600/20 text-sky-500 rounded-2xl flex items-center justify-center shadow-lg"><Building2 size={28}/></div>
                   <div>
                     <h2 className="text-xl font-black uppercase tracking-tight">{selectedExpediente.nombre_empresa}</h2>
                     <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">ID: {selectedExpediente.numero_control || 'SIN CONTROL'}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <button onClick={() => onEliminarExpediente(selectedExpediente.id, selectedExpediente.cliente_id)} className="bg-red-600/10 p-3 rounded-2xl text-red-500 hover:bg-red-600 hover:text-white transition-all border border-red-500/20" title="Eliminar Expediente"><Trash2 size={24}/></button>
                   <button onClick={() => setIsAssignModalOpen(false)} className="bg-slate-900 p-3 rounded-2xl text-slate-500 hover:text-white transition-all"><X size={24}/></button>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10 bg-slate-900/50">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    {/* COLUMNA IZQUIERDA: PERFIL Y ASIGNACIÓN */}
                    <div className="xl:col-span-5 space-y-8">
                      <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 flex items-center gap-3">
                           <UserCircle size={18}/> Perfil del Cliente Titular
                        </h3>
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

                      {/* ASIGNACIÓN DE ABOGADA */}
                      {activeTab === 'por_asignar' && (
                        <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6 flex items-center gap-3"><Scale size={18}/> Selección de Asesora Legal</h3>
                          <form onSubmit={handleAsignar} className="space-y-6">
                             <select value={asesoraId} onChange={e => setAsesoraId(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-sky-600 transition-all uppercase tracking-widest">
                               <option value="">Escoger abogada...</option>
                               {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                             </select>
                             <button type="submit" disabled={isPending} className="w-full py-4 bg-[#0197D2] text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-sky-500 transition-all shadow-xl shadow-sky-600/20 disabled:opacity-50">Confirmar Asignación</button>
                          </form>
                        </div>
                      )}
                    </div>

                    {/* COLUMNA DERECHA: DOCUMENTACIÓN Y CONTRATOS */}
                    <div className="xl:col-span-7 space-y-8">
                       <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                         <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 flex items-center gap-3"><FileSignature size={18}/> Formalización y Contratos</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_generado || '')}`)} className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-sky-600 transition-all group">
                               <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-xl flex items-center justify-center"><FileText size={24}/></div>
                                 <div className="text-left"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contrato Original</p><p className="text-xs font-black text-white group-hover:text-sky-400 transition-colors">Ver Borrador</p></div>
                               </div>
                               <ChevronRight size={18} className="text-slate-700 group-hover:text-sky-500"/>
                            </button>

                            {selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (
                              <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente || '')}`)} className="flex items-center justify-between p-5 bg-sky-600/5 border border-sky-600/20 rounded-2xl hover:bg-sky-600/10 transition-all group">
                                 <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center"><CheckCircle2 size={24}/></div>
                                   <div className="text-left"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Firma del Cliente</p><p className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors">Validar Recibido</p></div>
                                 </div>
                                 <ExternalLink size={16} className="text-slate-700 group-hover:text-emerald-500"/>
                              </button>
                            )}
                         </div>

                         {/* DOBLE FIRMA */}
                         {selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (
                           <div className="mt-8 p-8 bg-slate-900/50 rounded-[2rem] border border-slate-800">
                             <div className="flex justify-between items-center mb-6">
                               <div><h4 className="text-xs font-black uppercase tracking-widest text-white">Doble Firma (CECANI)</h4><p className="text-[10px] font-black text-slate-600 uppercase mt-1">Cierre de formalización legal</p></div>
                               {selectedExpediente.contratos?.[0]?.url_pdf_doble_firma && <span className="px-3 py-1 bg-emerald-600/20 text-emerald-500 border border-emerald-600/20 rounded-full text-[9px] font-black uppercase">Completado</span>}
                             </div>

                             {selectedExpediente.contratos?.[0]?.url_pdf_doble_firma ? (
                               <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_doble_firma || '')}`)} className="w-full py-4 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center justify-center gap-3">
                                 <Shield size={16}/> Ver Documento Final
                               </button>
                             ) : (
                               <div className="space-y-4">
                                  <div className="relative h-24 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center hover:border-sky-600 transition-all bg-slate-950/40 group">
                                     {isUploadingDobleFirma ? <Loader2 className="animate-spin text-sky-500" /> : <UploadCloud className="text-slate-600 group-hover:text-sky-500" />}
                                     <span className="text-[10px] font-black uppercase text-slate-500 mt-2">{dobleFirmaFile ? dobleFirmaFile.name : 'Subir contrato firmado por CECANI'}</span>
                                     <input type="file" accept=".pdf" onChange={e => setDobleFirmaFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                  </div>
                                  {dobleFirmaFile && (
                                    <button 
                                      onClick={async () => {
                                        setIsUploadingDobleFirma(true);
                                        const fd = new FormData(); fd.append('file', dobleFirmaFile);
                                        const empresaFormat = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
                                        const res = await subirArchivoR2Action(fd, `expedientes/${empresaFormat}/contratos`);
                                        if(res.success && res.data) {
                                          await subirContratoDobleFirma(selectedExpediente.contratos![0].id, res.data.url);
                                          setDobleFirmaFile(null); toast.success('Doble firma vinculada');
                                        } else toast.error(res.error);
                                        setIsUploadingDobleFirma(false);
                                      }}
                                      className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-sky-600/20"
                                    >Cargar Firma Final</button>
                                  )}
                               </div>
                             )}
                           </div>
                         )}
                       </div>

                       <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                         <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 flex items-center gap-3"><MapPin size={18}/> Soporte de Pagos y Depósitos</h3>
                         <div className="space-y-4">
                            {selectedExpediente.pagos?.map((p, i) => (
                               <div key={i} className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 bg-sky-600/10 text-sky-500 rounded-xl flex items-center justify-center font-black text-xs">${(i+1)}</div>
                                     <div><p className="text-sm font-black text-white">${p.monto.toLocaleString()}</p><p className="text-[10px] font-black text-slate-500 uppercase">{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-MX') : 'FECHA NO REGISTRADA'}</p></div>
                                  </div>
                                  <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(p.url_comprobante || '')}`)} className="p-3 bg-slate-950 border border-slate-800 text-slate-500 rounded-xl hover:text-sky-400 transition-all"><Eye size={18}/></button>
                               </div>
                            ))}
                            {!selectedExpediente.pagos?.length && <div className="p-10 border border-dashed border-slate-800 rounded-3xl text-center"><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sin registros de pago verificados</p></div>}
                         </div>
                       </div>
                    </div>
                  </div>
               </div>
               
               <div className="bg-slate-950 p-6 px-10 flex items-center justify-between border-t border-slate-800 shrink-0">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">ID Expediente: {selectedExpediente.id}</p>
                 <button onClick={() => setIsAssignModalOpen(false)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all border border-slate-800 shadow-xl">Cerrar Gestión</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: VALIDACIÓN INICIAL --- */}
      <AnimatePresence>
        {isValidationModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsValidationModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
               <div className="bg-slate-950 p-8 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800">
                 <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-emerald-600/10 border border-emerald-600/20 text-emerald-500 rounded-2xl flex items-center justify-center shadow-lg"><ShieldCheck size={28}/></div>
                   <div>
                     <h2 className="text-xl font-black uppercase tracking-tight">Validación Documental</h2>
                     <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{selectedExpediente.nombre_empresa}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsValidationModalOpen(false)} className="bg-slate-900 p-3 rounded-2xl text-slate-500 hover:text-white transition-all"><X size={24}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10 bg-slate-900/50">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ml-2">Documentación del Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {selectedExpediente.documentos?.filter(d => ['ine_frente', 'ine_reverso', 'curp', 'comprobante_domicilio'].includes(d.tipo)).map(doc => (
                         <div key={doc.id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-900 text-slate-500 rounded-xl flex items-center justify-center"><FileText size={20}/></div>
                              <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{doc.tipo.replace('_', ' ')}</p><p className="text-xs font-black text-white">Archivo Digital</p></div>
                            </div>
                            <div className="flex items-center gap-2">
                               <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`)} className="p-2.5 bg-slate-900 text-slate-400 rounded-lg hover:text-sky-400 transition-all"><Eye size={18}/></button>
                               <button onClick={async () => {
                                 const res = await (await import('@/actions/documentos')).validarDocumentoAction(doc.id);
                                 if(res.success) toast.success('Documento validado');
                               }} className={`p-2.5 rounded-lg transition-all ${doc.validado ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-700 hover:text-emerald-500'}`}><CheckCircle2 size={18}/></button>
                               <button onClick={async () => {
                                 const mot = prompt('Motivo del rechazo:'); if(!mot) return;
                                 const res = await (await import('@/actions/documentos')).rechazarDocumentoAction(doc.id, mot);
                                 if(res.success) toast.error('Documento rechazado');
                               }} className="p-2.5 bg-slate-900 text-slate-700 hover:text-red-500 rounded-lg transition-all"><Trash2 size={18}/></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6 ml-2">Contrato del Sistema</h3>
                    {selectedExpediente.contratos?.[0] ? (
                      <div className="flex items-center justify-between bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-sky-600/10 text-sky-500 rounded-2xl flex items-center justify-center"><FileSignature size={28}/></div>
                          <div><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Borrador Legal</p><p className="text-sm font-black text-white">Contrato Generado</p></div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_generado || '')}`)} className="px-6 py-3 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">Ver PDF</button>
                          <button onClick={async () => {
                            const res = await (await import('@/actions/directora')).aprobarContratoGeneradoCliente(selectedExpediente.id, selectedExpediente.contratos![0].id);
                            if(res.success) { toast.success('Contrato enviado al cliente'); setIsValidationModalOpen(false); }
                          }} className="px-8 py-3 bg-[#0197D2] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-sky-500 transition-all shadow-xl shadow-sky-600/20">Aprobar y Enviar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-10 border-2 border-dashed border-slate-800 rounded-3xl text-center"><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Contrato no generado todavía</p></div>
                    )}
                  </div>
               </div>
               
               <div className="bg-slate-950 p-8 flex justify-end border-t border-slate-800 shrink-0">
                 <button onClick={() => setIsValidationModalOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all border border-slate-800">Cerrar Revisión</button>
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
