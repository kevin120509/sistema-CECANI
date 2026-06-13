'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { asignarAbogada, subirContratoDobleFirma, crearClienteManualAction, eliminarExpedienteAction, validarDocumentoAction, validarPagoAction, validarContratoAction, rechazarDocumentoR2Action, rechazarPagoAction, rechazarContratoClienteAction } from '@/actions/directora';
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
  ExternalLink,
  CreditCard,
  FileCheck,
  Send,
  Check,
  Ban
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expedienteToDelete, setExpedienteToDelete] = useState<ExpedienteDirector | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

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

  const handleValidarDoc = async (id: string, valid: boolean) => {
    startTransition(async () => {
      const res = await validarDocumentoAction(id, valid);
      if (res.success) toast.success(valid ? 'Documento aprobado' : 'Documento marcado como pendiente');
      else toast.error(res.error);
    });
  };

  const handleRechazarDoc = async (doc: any) => {
    const motivo = prompt('Motivo del rechazo del documento:');
    if (!motivo) return;
    startTransition(async () => {
      const res = await rechazarDocumentoR2Action(doc.id, doc.tipo, selectedExpediente!.id, selectedExpediente!.cliente_id, motivo, doc.url_archivo);
      if (res.success) toast.success('Documento rechazado y notificado al cliente');
      else toast.error(res.error);
    });
  };

  const handleValidarPago = async (pagoId: string) => {
    if (!selectedExpediente) return;
    startTransition(async () => {
      const res = await validarPagoAction(pagoId, selectedExpediente.id, selectedExpediente.cliente_id);
      if (res.success) toast.success('Pago verificado');
      else toast.error(res.error);
    });
  };

  const handleRechazarPago = async (pago: any) => {
    const motivo = prompt('Motivo del rechazo del pago:');
    if (!motivo) return;
    startTransition(async () => {
      const res = await rechazarPagoAction(pago.id, selectedExpediente!.id, selectedExpediente!.cliente_id, motivo, pago.url_comprobante);
      if (res.success) toast.success('Pago rechazado y notificado');
      else toast.error(res.error);
    });
  };

  const handleValidarContrato = async () => {
    if (!selectedExpediente) return;
    startTransition(async () => {
      const res = await validarContratoAction(selectedExpediente.contratos?.[0]?.id || '', selectedExpediente.id, selectedExpediente.cliente_id);
      if (res.success) toast.success('Contrato firmado aprobado');
      else toast.error(res.error);
    });
  };

  const handleRechazarContratoCliente = async () => {
    const motivo = prompt('Motivo del rechazo del contrato firmado:');
    if (!motivo) return;
    const url = selectedExpediente?.contratos?.[0]?.url_pdf_firmado_cliente;
    startTransition(async () => {
      const res = await rechazarContratoClienteAction(selectedExpediente!.contratos?.[0]?.id || '', selectedExpediente!.id, selectedExpediente!.cliente_id, motivo, url || '');
      if (res.success) toast.success('Contrato rechazado y notificado');
      else toast.error(res.error);
    });
  };

  const handleUploadDobleFirma = async () => {
    if (!dobleFirmaFile || !selectedExpediente) return;
    setIsUploadingDobleFirma(true);
    try {
      const formData = new FormData();
      formData.append('file', dobleFirmaFile);
      formData.append('expediente_id', selectedExpediente.id);
      formData.append('contrato_id', selectedExpediente.contratos?.[0]?.id || '');
      
      const res = await subirContratoDobleFirma(formData);
      if (res.success) {
        toast.success('Contrato con doble firma subido correctamente');
        setDobleFirmaFile(null);
      } else {
        toast.error(res.error || 'Error al subir');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsUploadingDobleFirma(false);
    }
  };

  const handleEliminar = async () => {
    if (!expedienteToDelete) return;
    
    // Capturamos el ID para la eliminación optimista
    const idToRemove = expedienteToDelete.id;
    setHiddenIds(prev => [...prev, idToRemove]);
    
    startTransition(async () => {
      // Cerramos el modal inmediatamente
      setIsDeleteModalOpen(false);
      
      const res = await eliminarExpedienteAction(idToRemove, expedienteToDelete.cliente_id);
      
      if (res.success) {
        toast.success('Cliente eliminado correctamente');
        setExpedienteToDelete(null);
        router.refresh(); // Refresco real por detrás
      } else {
        // Si falla, lo mostramos de nuevo
        setHiddenIds(prev => prev.filter(id => id !== idToRemove));
        toast.error(res.error || 'Error al eliminar');
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
                    .filter(exp => !hiddenIds.includes(exp.id))
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
                      <div className="flex items-center gap-2">
                        {activeTab === 'concentrado' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setExpedienteToDelete(exp); setIsDeleteModalOpen(true); }}
                            className="p-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all group-hover:scale-110"
                            title="Eliminar Cliente"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                        <button 
                          onClick={() => { 
                            setSelectedExpediente(exp); 
                            if(activeTab === 'validacion') setIsValidationModalOpen(true); 
                            else setIsAssignModalOpen(true); 
                          }} 
                          className="px-6 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 font-black uppercase tracking-widest text-[10px] hover:text-white hover:bg-sky-600 transition-all"
                        >
                          Gestionar
                        </button>
                      </div>
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
            {/* Sección de Pagos y Firma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2 flex items-center gap-2"><CreditCard size={14}/> Comprobantes de Pago</h3>
                  <div className="space-y-3">
                     {selectedExpediente.pagos?.map((pago: any, idx) => (
                        <div key={idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                           <div>
                              <p className="text-white font-black text-sm">${pago.monto.toLocaleString()}</p>
                              <p className="text-[9px] text-slate-500 uppercase font-bold">{pago.fecha_pago || 'Fecha no registrada'}</p>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(pago.url_comprobante)}`)} className="p-2 bg-slate-900 text-sky-400 rounded-lg hover:text-white"><Eye size={16}/></button>
                              {!pago.verificado && (
                                 <>
                                    <button onClick={() => handleValidarPago(pago.id)} className="p-2 bg-sky-600/10 text-sky-500 rounded-lg hover:bg-sky-600 hover:text-white"><Check size={16}/></button>
                                    <button onClick={() => handleRechazarPago(pago)} className="p-2 bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white"><Ban size={16}/></button>
                                 </>
                              )}
                           </div>
                        </div>
                     ))}
                     {(!selectedExpediente.pagos || selectedExpediente.pagos.length === 0) && <p className="text-[10px] text-slate-600 italic">No hay pagos registrados aún.</p>}
                  </div>
               </div>

               <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2 flex items-center gap-2"><FileSignature size={14}/> Contrato Firmado</h3>
                  {selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente ? (
                     <div className="bg-slate-950 p-6 rounded-3xl border border-sky-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase text-sky-500 bg-sky-500/10 px-3 py-1 rounded-full">Recibido</span>
                           <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente || '')}`)} className="flex items-center gap-2 text-xs font-black text-white hover:text-sky-400"><Eye size={16}/> Ver Documento</button>
                        </div>
                        <div className="flex gap-3">
                           <button onClick={handleValidarContrato} className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-black uppercase text-[10px] hover:bg-sky-500 transition-all">Aprobar Firma</button>
                           <button onClick={handleRechazarContratoCliente} className="flex-1 py-3 bg-slate-800 text-red-500 rounded-xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all">Rechazar</button>
                        </div>
                     </div>
                  ) : (
                     <div className="bg-slate-950/50 p-8 rounded-3xl border border-dashed border-slate-800 text-center">
                        <Clock size={32} className="mx-auto text-slate-700 mb-2"/>
                        <p className="text-[10px] font-black text-slate-600 uppercase">Esperando firma del cliente</p>
                     </div>
                  )}
               </div>
            </div>

            {/* Doble Firma y Asignación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
               <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Doble Firma (CECANI)</h3>
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                     {selectedExpediente.contratos?.[0]?.url_pdf_doble_firma ? (
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3 text-emerald-500"><CheckCircle2 size={20}/> <span className="text-xs font-black uppercase">Contrato Finalizado</span></div>
                           <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_doble_firma || '')}`)} className="text-sky-400 hover:text-white"><Eye size={18}/></button>
                        </div>
                     ) : (
                        <div className="space-y-4">
                           <label className="block w-full cursor-pointer group">
                              <div className="border-2 border-dashed border-slate-800 group-hover:border-sky-500/50 rounded-2xl p-6 transition-all text-center">
                                 <UploadCloud size={24} className="mx-auto text-slate-600 mb-2 group-hover:text-sky-500"/>
                                 <p className="text-[10px] font-black text-slate-500 uppercase group-hover:text-slate-300">{dobleFirmaFile ? dobleFirmaFile.name : 'Subir Contrato con Doble Firma'}</p>
                                 <input type="file" className="hidden" accept=".pdf" onChange={e => setDobleFirmaFile(e.target.files?.[0] || null)} />
                              </div>
                           </label>
                           {dobleFirmaFile && (
                              <button onClick={handleUploadDobleFirma} disabled={isUploadingDobleFirma} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] hover:bg-emerald-500 flex items-center justify-center gap-2">
                                 {isUploadingDobleFirma ? <Loader2 className="animate-spin" size={16}/> : <><Send size={16}/> Enviar Contrato Final</>}
                              </button>
                           )}
                        </div>
                     )}
                  </div>
               </div>

               <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Asignación de Abogada</h3>
                  <form onSubmit={handleAsignar} className="space-y-4">
                     <select value={asesoraId} onChange={e => setAsesoraId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-bold text-white outline-none focus:border-sky-600">
                        <option value="">Seleccionar Abogada...</option>
                        {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                     </select>
                     <button type="submit" disabled={isPending} className="w-full py-4 bg-[#0197D2] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/20">Confirmar Asignación</button>
                  </form>
               </div>
            </div>
         </div>
      </motion.div></div>)}</AnimatePresence>

      <AnimatePresence>{isValidationModalOpen && selectedExpediente && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsValidationModalOpen(false)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-6xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-800">
         <div className="bg-slate-950 p-6 flex items-center justify-between text-slate-200 shrink-0 border-b border-slate-800"><div className="flex items-center gap-4"><Shield size={24} className="text-emerald-500"/><h2 className="text-lg font-black uppercase tracking-tight">Validación: {selectedExpediente.nombre_empresa}</h2></div><button onClick={() => setIsValidationModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X size={24}/></button></div>
         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
            {/* Header Información */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <TextData label="Representante" value={selectedExpediente.cliente?.nombre_completo} />
               <TextData label="RFC" value={selectedExpediente.cliente?.rfc} />
               <TextData label="Teléfono" value={selectedExpediente.cliente?.telefono} />
               <TextData label="Empresa" value={selectedExpediente.nombre_empresa} />
            </div>

            {/* Documentación */}
            <div className="space-y-6">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800 pb-3 flex items-center gap-2"><ClipboardList size={16}/> Revisión Documental</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedExpediente.documentos?.filter(d => ['ine_frente', 'ine_reverso', 'comprobante_domicilio', 'curp'].includes(d.tipo)).map(doc => (
                     <div key={doc.id} className={"bg-slate-950 p-5 rounded-3xl border transition-all " + (doc.validado ? "border-emerald-500/20" : "border-slate-800")}>
                        <div className="flex items-center justify-between mb-4">
                           <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{doc.tipo.replace(/_/g, ' ')}</span>
                           {doc.validado ? <CheckCircle2 size={16} className="text-emerald-500"/> : <Clock size={16} className="text-amber-500"/>}
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`)} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Eye size={14}/> Ver</button>
                           {!doc.validado ? (
                              <button onClick={() => handleValidarDoc(doc.id, true)} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 transition-all">Validar</button>
                           ) : (
                              <button onClick={() => handleValidarDoc(doc.id, false)} className="p-2.5 bg-slate-900 text-slate-500 rounded-xl hover:text-red-500"><X size={16}/></button>
                           )}
                           <button onClick={() => handleRechazarDoc(doc)} className="p-2.5 bg-slate-900 text-slate-600 rounded-xl hover:text-red-500"><Ban size={16}/></button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Contrato de Sistema */}
            <div className="space-y-6">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800 pb-3 flex items-center gap-2"><FileText size={16}/> Contrato Generado por Sistema</h3>
               {selectedExpediente.contratos?.[0]?.url_pdf_generado ? (
                  <div className="bg-slate-950 p-6 rounded-3xl border border-sky-500/20 flex items-center justify-between">
                     <div className="flex items-center gap-4"><FileText size={32} className="text-sky-500"/><div className="text-left"><p className="text-white font-black text-sm uppercase">Contrato Digital</p><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Generado automáticamente</p></div></div>
                     <div className="flex gap-4">
                        <button onClick={() => setQuickViewUrl(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos?.[0]?.url_pdf_generado || '')}`)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all flex items-center gap-2"><Eye size={16}/> Previsualizar</button>
                        <button onClick={() => { setIsValidationModalOpen(false); setIsAssignModalOpen(true); }} className="px-8 py-3 bg-sky-600 text-white rounded-xl font-black uppercase text-[10px] hover:bg-sky-500 transition-all flex items-center gap-2">Siguiente Paso <ArrowRight size={16}/></button>
                     </div>
                  </div>
               ) : (
                  <div className="bg-slate-950/50 p-12 rounded-3xl border border-dashed border-slate-800 text-center">
                     <AlertTriangle size={40} className="mx-auto text-amber-500 mb-4"/>
                     <p className="text-sm font-black text-slate-400 uppercase tracking-widest">El contrato aún no ha sido generado o hubo un error en el proceso.</p>
                  </div>
               )}
            </div>
         </div>
      </motion.div></div>)}</AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && expedienteToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center">
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">¿Confirmar Eliminación?</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">
                Esta acción es <span className="text-red-500 font-bold italic">irreversible</span>. 
                Se borrarán todos los datos de <span className="text-white font-bold">{expedienteToDelete.nombre_empresa}</span>, 
                incluyendo expedientes, pagos, documentos y archivos en la nube.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all">Cancelar</button>
                <button onClick={handleEliminar} disabled={isPending} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50">
                  {isPending ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Sí, Eliminar Todo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>{quickViewUrl && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-6"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickViewUrl(null)} className="fixed inset-0 bg-slate-950/95 backdrop-blur-md" /><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[2rem] shadow-2xl w-full h-full flex flex-col overflow-hidden border border-slate-800"><div className="bg-slate-950 p-4 flex justify-between border-b border-slate-800"><h2 className="text-[10px] font-black uppercase text-sky-500">Visor Digital</h2><button onClick={() => setQuickViewUrl(null)} className="text-slate-500 hover:text-white"><X size={24}/></button></div><div className="flex-1 bg-slate-950"><iframe src={quickViewUrl} className="w-full h-full border-none" /></div></motion.div></div>)}</AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: any) { return (<button onClick={onClick} className={"w-full flex items-center justify-between px-5 py-3 rounded-xl transition-all " + (active ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/40")}><div className="flex items-center gap-3"><div className={active ? "text-sky-400" : "text-slate-600"}>{icon}</div><span className="text-[10px] font-black uppercase tracking-widest">{label}</span></div>{badge !== undefined && <span className={"text-[9px] font-black px-2 py-0.5 rounded-lg " + (active ? "bg-[#0197D2] text-white" : "bg-slate-950 text-slate-700")}>{badge}</span>}</button>); }
function SidebarFilterLink({ label, active, onClick }: any) { return <button onClick={onClick} className={"w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all " + (active ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800/20")}>{label}</button>; }
function SummaryCard({ icon, label, value, color }: any) { const colors: any = { amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20', emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', red: 'text-red-500 bg-red-500/10 border-red-500/20', sky: 'text-sky-500 bg-sky-500/10 border-sky-500/20' }; return (<div className={`bg-slate-900 p-6 rounded-3xl border ${colors[color].split(' ')[2]} shadow-xl flex items-center gap-6 transition-transform hover:-translate-y-1`}><div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color].split(' ')[1]} ${colors[color].split(' ')[0]}`}>{icon}</div><div><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</p><h3 className="text-3xl font-black text-white mt-1">{value}</h3></div></div>); }
function TextData({ label, value }: { label: string, value?: string }) { return (<div className="space-y-1"><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}:</p><p className="text-sm font-black uppercase text-white truncate">{value || '---'}</p></div>); }
