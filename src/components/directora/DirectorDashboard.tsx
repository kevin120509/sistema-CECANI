'use client';

import { useState, useTransition, useMemo } from 'react';
import { asignarAbogada, subirContratoDobleFirma, crearClienteManualAction, eliminarExpedienteAction } from '@/actions/directora';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { logoutAbogada } from '@/actions/auth-abogada';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';
import { motion, AnimatePresence } from 'framer-motion';
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
  Menu
} from 'lucide-react';

export type PerfilAbogada = { id: string; nombre_completo: string };
export type ExpedienteDirector = Record<string, unknown> & {
  id: string;
  cliente_id: string;
  nombre_empresa: string;
  estatus: string;
  created_at: string;
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
  pagos?: Array<{ monto: number; url_comprobante?: string; fecha_pago?: string }>;
  documentos?: Array<{ id: string; tipo: string; url_archivo: string; validado: boolean }>;
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
}: {
  abogadas: PerfilAbogada[];
  porAsignar: ExpedienteDirector[];
  concentrado: ExpedienteDirector[];
}) {
  const [activeTab, setActiveTab] = useState<'por_asignar' | 'concentrado' | 'validacion'>('por_asignar');
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
    ine_reverso?: File,
    domicilio?: File
  }>({});
  const [finalAsesoraId, setFinalAsesoraId] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [asesoraId, setAsesoraId] = useState('');
  const [dobleFirmaFile, setDobleFirmaFile] = useState<File | null>(null);
  const [isUploadingDobleFirma, setIsUploadingDobleFirma] = useState(false);

  const validacion = useMemo(() => {
    return porAsignar.filter(exp => exp.estatus === 'revision_directora');
  }, [porAsignar]);

  const listosParaAsignar = useMemo(() => {
    return porAsignar.filter(exp => exp.estatus !== 'revision_directora');
  }, [porAsignar]);

  const filteredData = useMemo(() => {
    let result = activeTab === 'por_asignar' ? listosParaAsignar : activeTab === 'validacion' ? validacion : concentrado;
    
    if (activeTab === 'concentrado' && selectedAsesoraName !== 'all') {
      const q = selectedAsesoraName.toLowerCase();
      result = result.filter(exp => 
        exp.expediente_asesoras?.some(ea => ea.asesora?.nombre_completo?.toLowerCase().includes(q)) ||
        exp.asesora?.nombre_completo?.toLowerCase().includes(q)
      );
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(exp => 
        exp.nombre_empresa?.toLowerCase().includes(q) || 
        exp.cliente?.nombre_completo?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeTab, listosParaAsignar, concentrado, validacion, selectedAsesoraName, searchQuery]);

  const individualAsesoras = useMemo(() => {
    const names = new Set<string>();
    abogadas.forEach(a => {
      const parts = a.nombre_completo.split(/[\/\-]| y /i).map(n => n.trim()).filter(Boolean);
      parts.forEach(part => names.add(part.toUpperCase()));
    });
    return Array.from(names).sort();
  }, [abogadas]);

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión administrativa?')) {
      setIsLoggingOut(true);
      await logoutAbogada();
      window.location.reload();
    }
  };

  const handleEliminar = async (expedienteId: string, clienteId: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente el expediente de "${nombre}"? Esta acción borrará todos los documentos y el acceso del cliente.`)) return;
    startTransition(async () => {
      const res = await eliminarExpedienteAction(expedienteId, clienteId);
      if (res.error) alert(res.error);
    });
  };

  const resetCreateState = () => {
    setCreateStep(1);
    setNewClientInfo(null);
    setFiles({});
    setFinalAsesoraId('');
    setUploadProgress('');
    setCreateError(null);
    setIsCreateModalOpen(false);
  };

  const onInitManualRegistry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await crearClienteManualAction(formData);
      if (res.success && res.data) {
        setNewClientInfo({
          ...res.data,
          nombre_empresa: formData.get('nombre_empresa') as string
        });
        setCreateStep(2);
      } else {
        setCreateError(res.error || 'Error al crear base del cliente');
      }
    });
  };

  const onUploadMasterDocs = async () => {
    if (!newClientInfo) return;
    setCreateError(null);
    startTransition(async () => {
      try {
        const empresaKey = newClientInfo.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
        const docFolder = `expedientes/${empresaKey}/documentacion`;
        const conFolder = `expedientes/${empresaKey}/contratos`;
        const uploadFile = async (file: File, folder: string, label: string) => {
          setUploadProgress(`Digitalizando ${label}...`);
          const fd = new FormData();
          fd.append('file', file);
          const res = await subirArchivoR2Action(fd, folder);
          if (!res.success || !res.data) throw new Error(`Fallo en ${label}: ${res.error}`);
          return res.data.url;
        };
        if (files.contrato) {
          const url = await uploadFile(files.contrato, conFolder, 'Contrato Firmado');
          const { guardarContratoFirmado } = await import('@/actions/contrato');
          await guardarContratoFirmado(newClientInfo.contrato_id, url);
          await registrarDocumento(newClientInfo.expediente_id, 'contrato_firmado', url);
        }
        if (files.ine_frente) {
          const url = await uploadFile(files.ine_frente, docFolder, 'INE Frente');
          await registrarDocumento(newClientInfo.expediente_id, 'ine_frente', url);
        }
        if (files.ine_reverso) {
          const url = await uploadFile(files.ine_reverso, docFolder, 'INE Reverso');
          await registrarDocumento(newClientInfo.expediente_id, 'ine_reverso', url);
        }
        if (files.domicilio) {
          const url = await uploadFile(files.domicilio, docFolder, 'Comprobante Domicilio');
          await registrarDocumento(newClientInfo.expediente_id, 'comprobante_domicilio', url);
        }
        setCreateStep(3);
      } catch (err: any) {
        setCreateError(err.message || 'Error en la sincronización con R2');
      } finally {
        setUploadProgress('');
      }
    });
  };

  const onFinalizeAndAssign = async () => {
    if (!newClientInfo || !finalAsesoraId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append('expediente_id', newClientInfo.expediente_id);
      fd.append('asesora_id', finalAsesoraId);
      const res = await asignarAbogada(fd);
      if (res.success) {
        resetCreateState();
        setActiveTab('concentrado');
      } else {
        setCreateError(res.error || 'Error en asignación final');
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 selection:bg-sky-500/20 overflow-x-hidden">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={
        "fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-slate-950 text-white flex flex-col border-r border-white/5 shadow-2xl transition-transform duration-300 transform " + 
        (isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
      }>
        <div className="p-6 md:p-8 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-default">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg"><span className="font-black text-xl md:text-2xl">D</span></div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tighter leading-none">CECANI</h2>
              <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] text-sky-400 mt-2 opacity-80">Central Directive</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white lg:hidden"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-4 md:px-6 space-y-2 overflow-y-auto custom-scrollbar min-h-0">
          <SidebarLink icon={<LayoutDashboard size={20} />} label="Por Asignar" active={activeTab === 'por_asignar'} onClick={() => { setActiveTab('por_asignar'); setIsSidebarOpen(false); }} badge={listosParaAsignar.length} />
          <SidebarLink icon={<ShieldCheck size={20} />} label="Validación" active={activeTab === 'validacion'} onClick={() => { setActiveTab('validacion'); setIsSidebarOpen(false); }} badge={validacion.length} />
          <SidebarLink icon={<Users size={20} />} label="Concentrado" active={activeTab === 'concentrado'} onClick={() => { setActiveTab('concentrado'); setIsSidebarOpen(false); }} />
          
          <AnimatePresence>
            {activeTab === 'concentrado' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-4 space-y-1 border-t border-white/5 mt-4">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 ml-4">Filtrar por Asesora</p>
                {individualAsesoras.map(name => (
                  <SidebarFilterLink key={name} label={name} active={selectedAsesoraName === name} onClick={() => { setSelectedAsesoraName(name); setIsSidebarOpen(false); }} />
                ))}
                <SidebarFilterLink label="Todas las Asesoras" active={selectedAsesoraName === 'all'} onClick={() => { setSelectedAsesoraName('all'); setIsSidebarOpen(false); }} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-6">
            <button onClick={() => { setIsCreateModalOpen(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-300 hover:bg-sky-500 hover:text-white transition-all text-left group">
              <div className="p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors shrink-0"><UserPlus size={18} /></div>
              <span className="text-[11px] font-black uppercase tracking-widest leading-tight">Alta Maestra</span>
            </button>
          </div>
        </nav>

        <div className="p-6 md:p-8 border-t border-white/5 mt-auto">
          <button onClick={handleLogout} disabled={isLoggingOut} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[11px] font-black uppercase tracking-widest">{isLoggingOut ? '...' : 'Salir'}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 xl:ml-80 p-4 md:p-10 transition-all w-full">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white border border-slate-200 rounded-xl lg:hidden shadow-sm"><Menu size={24} /></button>
            <div>
              <h1 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">{activeTab === 'por_asignar' ? 'Por Asignar' : 'Concentrado'}</h1>
              <p className="text-[10px] lg:text-xs font-black text-slate-400 mt-2 uppercase tracking-widest">{activeTab === 'por_asignar' ? 'Expedientes sin asesora titular' : `Total: ${filteredData.length} expedientes`}</p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-all"><Search size={18} /></div>
            <input type="text" placeholder="Buscar cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full md:w-80 bg-white border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-8 text-xs font-black uppercase tracking-widest outline-none focus:border-sky-500 shadow-sm transition-all" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab + selectedAsesoraName} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Cliente y Proyecto</th>
                    {selectedAsesoraName === 'all' && <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsables</th>}
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((exp) => (
                    <tr key={exp.id} className="group hover:bg-slate-50/5 transition-colors">
                      <td className="px-6 py-6 align-top">
                        <div className="flex flex-col gap-3">
                          <div className="space-y-1">
                            <p className="text-lg font-black text-slate-900 uppercase break-words max-w-[450px] leading-tight">
                              {exp.nombre_empresa || 'SIN NOMBRE'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {exp.cliente?.nombre_completo || 'SIN TITULAR'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[8px] font-black uppercase px-3 py-1.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg max-w-[250px] leading-relaxed">
                              {exp.figura?.descripcion || 'FIGURA NO DEFINIDA'}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                              {(exp.estatus || 'EN_PROCESO').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </td>
                      {selectedAsesoraName === 'all' && (
                        <td className="px-6 py-6 align-top">
                          <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                            {exp.expediente_asesoras && exp.expediente_asesoras.length > 0 ? exp.expediente_asesoras.map(ea => (
                              <div key={ea.asesora?.id || Math.random()} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                                <UserCircle size={14} className="text-sky-500" />
                                <span className="text-[9px] font-black uppercase text-slate-700 truncate max-w-[100px]">{ea.asesora?.nombre_completo || 'S/N'}</span>
                              </div>
                            )) : exp.asesora ? (
                              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                                <UserCircle size={14} className="text-sky-500" />
                                <span className="text-[9px] font-black uppercase text-slate-700 truncate max-w-[100px]">{exp.asesora.nombre_completo}</span>
                              </div>
                            ) : (() => {
                              const v = Array.isArray(exp.datos_concentrado) ? exp.datos_concentrado[0]?.vendedora : (exp.datos_concentrado as any)?.vendedora;
                              return v ? (
                                <div className="flex items-center gap-2 opacity-60 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                                  <UserCircle size={14} className="text-amber-600" />
                                  <span className="text-[9px] font-black uppercase text-slate-700 truncate max-w-[100px]">{v}</span>
                                </div>
                              ) : <span className="text-[9px] font-black text-slate-300 uppercase italic ml-2">Pendiente</span>;
                            })()}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-6 align-top">
                        <div className="flex items-center gap-2">
                          {activeTab === 'validacion' ? (
                            <button onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }} className="bg-sky-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-950 transition-all flex items-center gap-2">Validar <ShieldCheck size={14}/></button>
                          ) : (
                            <button onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }} className="bg-slate-950 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center gap-2">Gestión <ArrowRight size={14}/></button>
                          )}
                          <button onClick={() => handleEliminar(exp.id, exp.cliente_id, exp.nombre_empresa)} disabled={isPending} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr><td colSpan={5} className="px-10 py-40 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.5em]">Sin registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isValidationModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isPending && setIsValidationModalOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full flex flex-col max-h-[95vh] overflow-hidden">
               <div className="bg-slate-950 p-6 md:p-8 flex items-center justify-between">
                 <div className="flex items-center gap-6">
                   <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><ShieldCheck size={24}/></div>
                   <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">Validación de Expediente</h2>
                 </div>
                 <button onClick={() => setIsValidationModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar space-y-12">
                 <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-6">
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-4">Datos del Cliente</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <DataField label="Representante" value={selectedExpediente.cliente?.nombre_completo} icon={<Users size={14}/>} />
                       <DataField label="WhatsApp" value={selectedExpediente.cliente?.telefono} icon={<Users size={14}/>} />
                       <DataField label="RFC" value={selectedExpediente.cliente?.rfc} icon={<FileText size={14}/>} />
                       <DataField label="CURP" value={selectedExpediente.cliente?.curp} icon={<ShieldCheck size={14}/>} />
                     </div>
                     <DataField label="Domicilio" value={selectedExpediente.cliente?.domicilio_completo} icon={<MapPin size={14}/>} />
                   </div>

                   <div className="space-y-6">
                     <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-4">Documentación Cargada</h3>
                     <div className="space-y-3">
                       {selectedExpediente.documentos?.map((doc: any) => (
                         <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl group">
                           <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-lg ${doc.validado ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                               {doc.validado ? <ShieldCheck size={16}/> : <FileText size={16}/>}
                             </div>
                             <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-900">{doc.tipo.replace(/_/g, ' ')}</p>
                               <a href={`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`} target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-sky-500 uppercase hover:underline">Ver Documento</a>
                             </div>
                           </div>
                           <div className="flex gap-1">
                             <button 
                               onClick={async () => {
                                 const { validarDocumentoAction } = await import('@/actions/directora');
                                 startTransition(async () => { await validarDocumentoAction(doc.id, !doc.validado); });
                               }}
                               className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${doc.validado ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-500 hover:text-emerald-500'}`}
                             >
                               {doc.validado ? 'Aprobado' : 'Aprobar'}
                             </button>
                             {!doc.validado && (
                               <button 
                                 onClick={async () => {
                                   const motivo = prompt('Motivo de rechazo para ' + doc.tipo.replace(/_/g, ' ').toUpperCase() + ':');
                                   if (!motivo) return;
                                   const { rechazarDocumentoR2Action } = await import('@/actions/directora');
                                   startTransition(async () => {
                                     const res = await rechazarDocumentoR2Action(doc.id, doc.tipo, selectedExpediente.id, selectedExpediente.cliente_id, motivo, doc.url_archivo);
                                     if (res.success) {
                                       setIsValidationModalOpen(false);
                                     } else {
                                       alert('Error: ' + res.error);
                                     }
                                   });
                                 }}
                                 className="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all bg-white text-slate-400 border border-slate-200 hover:border-red-500 hover:text-red-500"
                               >
                                 Rechazar
                               </button>
                             )}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 </section>

                 <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-4">Contrato Generado</h3>
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                      <div className="relative z-10 space-y-4">
                        <div className="w-14 h-14 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center"><FileSignature size={28}/></div>
                        <div>
                          <h4 className="text-xl font-black uppercase tracking-tighter leading-none">Contrato de Servicios</h4>
                          <p className="text-slate-400 text-xs font-medium mt-2">Revisa que los datos en el PDF sean correctos antes de liberar la descarga al cliente.</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                        {(() => {
                          const contrato = Array.isArray(selectedExpediente.contratos) ? selectedExpediente.contratos[0] : (selectedExpediente.contratos as any);
                          const urlPDF = contrato?.url_pdf_generado || contrato?.url_pdf_doble_firma || contrato?.url_pdf_firmado_cliente;
                          if (!urlPDF) return (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-bold px-4 py-4">PDF no generado</span>
                              <button 
                                onClick={async () => {
                                  if (!contrato?.id) return alert('No hay registro de contrato para este cliente.');
                                  const { generarContratoAutomatico } = await import('@/actions/contrato');
                                  startTransition(async () => {
                                    const res = await generarContratoAutomatico(selectedExpediente.cliente_id, selectedExpediente.id, contrato.id);
                                    if (!res.success) alert('Error al generar: ' + res.error);
                                    else setIsValidationModalOpen(false);
                                  });
                                }}
                                className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                              >
                                Generar Ahora
                              </button>
                            </div>
                          );
                          return (
                            <a href={`/api/r2/download?url=${encodeURIComponent(urlPDF)}`} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 backdrop-blur-md transition-all">
                              <Download size={16}/> Previsualizar PDF
                            </a>
                          );
                        })()}
                        <button 
                          disabled={isPending}
                          onClick={async () => {
                            if (!confirm('¿Aprobar este expediente y liberar el contrato para el cliente?')) return;
                            const { aprobarExpedienteAction } = await import('@/actions/directora');
                            startTransition(async () => {
                              const res = await aprobarExpedienteAction(selectedExpediente.id);
                              if (res.success) {
                                setIsValidationModalOpen(false);
                                setActiveTab('concentrado');
                              } else {
                                alert('Error: ' + res.error);
                              }
                            });
                          }}
                          className="bg-sky-500 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center gap-3"
                        >
                          {isPending ? <Loader2 className="animate-spin" size={16}/> : <ShieldCheck size={16}/>} 
                          Aprobar y Notificar
                        </button>
                        <button 
                          disabled={isPending}
                          onClick={async () => {
                            const motivo = prompt('Motivo del rechazo (se enviará al cliente):');
                            if (!motivo) return;
                            const { rechazarExpedienteAction } = await import('@/actions/directora');
                            startTransition(async () => {
                              const res = await rechazarExpedienteAction(selectedExpediente.id, motivo);
                              if (res.success) {
                                setIsValidationModalOpen(false);
                                setActiveTab('concentrado');
                              } else {
                                alert('Error: ' + res.error);
                              }
                            });
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center gap-3"
                        >
                          {isPending ? <Loader2 className="animate-spin" size={16}/> : <X size={16}/>} 
                          Rechazar
                        </button>
                      </div>
                      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-sky-500/10 rounded-full blur-[80px]" />
                    </div>
                 </section>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isPending && resetCreateState()} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl" />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[3rem] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-950 p-6 md:p-8 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24}/></div>
                   <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">Alta Maestra</h2>
                 </div>
                 <div className="flex gap-2">
                   {[1, 2, 3].map(s => <div key={s} className={"w-2.5 h-2.5 rounded-full transition-all duration-500 " + (createStep === s ? "bg-sky-500 scale-125" : createStep > s ? "bg-emerald-500" : "bg-white/10")} />)}
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
                 <AnimatePresence mode="wait">
                   {createStep === 1 && (
                     <motion.form key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={onInitManualRegistry} className="space-y-6">
                       <ManualInput label="Razón Social / Empresa *" name="nombre_empresa" icon={<Building2 size={16}/>} required />
                       <ManualInput label="Representante *" name="nombre_completo" icon={<Users size={16}/>} required />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <ManualInput label="WhatsApp" name="telefono" icon={<Users size={16}/>} />
                         <ManualInput label="RFC" name="rfc" icon={<FileText size={16}/>} />
                       </div>
                       <button type="submit" disabled={isPending} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-4">{isPending ? <Loader2 className="animate-spin" size={16}/> : 'Continuar'}</button>
                     </motion.form>
                   )}
                   {createStep === 2 && (
                     <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FileUploader label="Contrato" icon={<FileSignature size={18}/>} onChange={f => setFiles({...files, contrato: f})} file={files.contrato} />
                         <FileUploader label="INE Frente" icon={<ShieldCheck size={18}/>} onChange={f => setFiles({...files, ine_frente: f})} file={files.ine_frente} />
                         <FileUploader label="INE Reverso" icon={<ShieldCheck size={18}/>} onChange={f => setFiles({...files, ine_reverso: f})} file={files.ine_reverso} />
                         <FileUploader label="Domicilio" icon={<MapPin size={18}/>} onChange={f => setFiles({...files, domicilio: f})} file={files.domicilio} />
                       </div>
                       {uploadProgress && <div className="p-4 bg-sky-50 text-sky-600 rounded-xl flex items-center gap-3 border border-sky-100 animate-pulse"><Loader2 size={16} className="animate-spin"/><span className="text-[10px] font-black uppercase">{uploadProgress}</span></div>}
                       <button onClick={onUploadMasterDocs} disabled={isPending} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all">Sincronizar y Continuar</button>
                     </motion.div>
                   )}
                   {createStep === 3 && (
                     <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                       <select value={finalAsesoraId} onChange={e => setFinalAsesoraId(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold uppercase text-xs outline-none focus:border-sky-500">
                         <option value="">Asignar Asesora Titular...</option>
                         {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                       </select>
                       <button onClick={onFinalizeAndAssign} disabled={isPending || !finalAsesoraId} className="w-full bg-sky-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all">Finalizar Alta</button>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
             </motion.div>
           </div>
        )}

        {isAssignModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isPending && !isUploadingDobleFirma && setIsAssignModalOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[3rem] shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden">
               <div className="bg-slate-950 p-6 md:p-8 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-6">
                   <div className="w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileText size={24}/></div>
                   <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">Gestión y Asignación</h2>
                 </div>
                 <button onClick={() => { setIsAssignModalOpen(false); setDobleFirmaFile(null); }} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar space-y-12">
                 
                 {/* Sección 1: Contrato y Pago */}
                 <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Contrato Firmado */}
                   <div className="bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 flex flex-col justify-between">
                     <div>
                       <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><FileSignature size={16}/> Contrato Cliente</h3>
                       {(() => {
                         const contrato = Array.isArray(selectedExpediente.contratos) ? selectedExpediente.contratos[0] : (selectedExpediente.contratos as any);
                         if (contrato?.url_pdf_firmado_cliente) {
                           return (
                             <a href={`/api/r2/download?url=${encodeURIComponent(contrato.url_pdf_firmado_cliente)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white border-2 border-sky-100 text-sky-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-sky-500 hover:bg-sky-50 transition-all shadow-sm">
                               <Download size={18}/> Descargar Contrato Firmado
                             </a>
                           );
                         }
                         return <p className="text-xs font-bold text-slate-400 uppercase">El cliente aún no ha subido el contrato firmado.</p>;
                       })()}
                     </div>
                   </div>

                   {/* Validación de Pago */}
                   <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] p-8 flex flex-col justify-between">
                     <div>
                       <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-6 flex items-center gap-2"><ShieldCheck size={16}/> Validación de Pago</h3>
                       {(() => {
                         const contrato = Array.isArray(selectedExpediente.contratos) ? selectedExpediente.contratos[0] : (selectedExpediente.contratos as any);
                         const pago = Array.isArray(selectedExpediente.pagos) ? selectedExpediente.pagos[0] : (selectedExpediente.pagos as any);
                         
                         return (
                           <div className="space-y-4">
                             <div className="flex justify-between items-center bg-white/60 p-4 rounded-2xl border border-emerald-100/50">
                               <span className="text-[10px] font-black uppercase text-emerald-800/60">Total Contrato:</span>
                               <span className="text-sm font-black text-slate-900">${contrato?.monto_total?.toLocaleString('es-MX', {minimumFractionDigits: 2}) || '0.00'}</span>
                             </div>
                             {pago ? (
                               <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-emerald-200">
                                 <span className="text-[10px] font-black uppercase text-emerald-600">Monto Pagado:</span>
                                 <span className="text-lg font-black text-emerald-600">${pago.monto?.toLocaleString('es-MX', {minimumFractionDigits: 2}) || '0.00'}</span>
                               </div>
                             ) : (
                               <p className="text-xs font-bold text-slate-400 uppercase">Sin registro de pago.</p>
                             )}
                             {pago?.url_comprobante && (
                               <a href={`/api/r2/download?url=${encodeURIComponent(pago.url_comprobante)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 hover:underline">
                                 <Download size={14}/> Ver Comprobante
                               </a>
                             )}
                           </div>
                         );
                       })()}
                     </div>
                   </div>
                 </section>

                 {/* Sección 2: Subir Doble Firma */}
                 <section className="bg-sky-50 border-2 border-sky-100 rounded-[2rem] p-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-sky-600 mb-6 flex items-center gap-2"><UploadCloud size={16}/> Contrato Doble Firma</h3>
                    {(() => {
                       const contrato = Array.isArray(selectedExpediente.contratos) ? selectedExpediente.contratos[0] : (selectedExpediente.contratos as any);
                       if (contrato?.url_pdf_doble_firma) {
                         return (
                           <div className="flex items-center gap-4">
                             <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><ShieldCheck size={20}/></div>
                             <div>
                               <p className="text-xs font-black uppercase text-slate-900">Doble Firma Registrada</p>
                               <a href={`/api/r2/download?url=${encodeURIComponent(contrato.url_pdf_doble_firma)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-sky-500 uppercase hover:underline">Descargar PDF</a>
                             </div>
                           </div>
                         );
                       }
                       return (
                         <div className="flex flex-col sm:flex-row gap-4 items-center">
                           <div className="flex-1 w-full">
                             <FileUploader label="PDF Doble Firma" icon={<FileSignature size={18}/>} onChange={f => setDobleFirmaFile(f || null)} file={dobleFirmaFile || undefined} />
                           </div>
                           <button 
                             disabled={!dobleFirmaFile || isUploadingDobleFirma}
                             onClick={async () => {
                               if (!dobleFirmaFile || !contrato?.id) return;
                               setIsUploadingDobleFirma(true);
                               try {
                                 const fdDb = new FormData();
                                 fdDb.append('expediente_id', selectedExpediente.id);
                                 fdDb.append('contrato_id', contrato.id);
                                 fdDb.append('file', dobleFirmaFile);
                                 
                                 const resDb = await subirContratoDobleFirma(fdDb);
                                 if (!resDb.success) throw new Error(resDb.error || 'Error guardando en BD');
                                 
                                 setDobleFirmaFile(null);
                                 setIsAssignModalOpen(false); 
                                 setActiveTab('concentrado');
                                 setTimeout(() => { setActiveTab('por_asignar'); setIsAssignModalOpen(true); }, 100);
                               } catch (err: any) {
                                 alert(err.message);
                               } finally {
                                 setIsUploadingDobleFirma(false);
                               }
                             }}
                             className="w-full sm:w-auto bg-sky-600 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-sky-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             {isUploadingDobleFirma ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16}/>} Subir y Guardar
                           </button>
                         </div>
                       );
                    })()}
                 </section>

                 {/* Sección 3: Asignar Asesora */}
                 <section className="bg-slate-950 rounded-[2rem] p-8 md:p-10 text-white text-center space-y-8">
                   <h3 className="text-xl font-black uppercase tracking-tighter leading-none">Designar Asesora Titular</h3>
                      <form onSubmit={async (e) => { 
                        e.preventDefault(); 
                        startTransition(async () => { 
                          const fd = new FormData(); 
                          fd.append('expediente_id', selectedExpediente.id); 
                          fd.append('asesora_id', asesoraId); 
                          const res = await asignarAbogada(fd); 
                          if (res.success) {
                            setIsAssignModalOpen(false);
                            setAsesoraId(''); 
                          } else {
                            alert('Error: ' + res.error);
                          }
                        }); 
                      }} className="space-y-4 max-w-sm mx-auto">
                      <select required value={asesoraId} onChange={e => setAsesoraId(e.target.value)} className="w-full p-5 bg-white/5 border-2 border-white/10 rounded-2xl font-black text-xs uppercase outline-none focus:border-sky-500 text-white appearance-none text-center">
                        <option value="" className="bg-slate-900">Seleccionar...</option>
                        {abogadas.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.nombre_completo}</option>)}
                      </select>
                      <button type="submit" disabled={isPending} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-3">{isPending ? <Loader2 className="animate-spin" size={16}/> : 'Confirmar Asignación'}</button>
                   </form>
                 </section>

                 {/* Sección 4: Referencias */}
                 <section className="pt-8 border-t border-slate-100">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Datos de Identidad (Referencia)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      <DataField label="Representante" value={selectedExpediente.cliente?.nombre_completo} icon={<Users size={14}/>} />
                      <DataField label="RFC" value={selectedExpediente.cliente?.rfc} icon={<FileText size={14}/>} />
                      <DataField label="CURP" value={selectedExpediente.cliente?.curp} icon={<ShieldCheck size={14}/>} />
                      <DataField label="WhatsApp" value={selectedExpediente.cliente?.telefono} icon={<Users size={14}/>} />
                      <DataField label="Ocupación" value={selectedExpediente.cliente?.ocupacion} icon={<Scale size={14}/>} />
                      <DataField label="Estado Civil" value={selectedExpediente.cliente?.estado_civil} icon={<Users size={14}/>} />
                      <div className="sm:col-span-2 lg:col-span-3"><DataField label="Domicilio" value={selectedExpediente.cliente?.domicilio_completo} icon={<MapPin size={14}/>} /></div>
                    </div>
                    
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Documentos Básicos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedExpediente.documentos?.map((doc: any) => (
                        <a key={doc.id} href={`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl hover:border-sky-500 transition-all group">
                          <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-sky-500 shadow-sm"><Download size={16}/></div><div className="text-left"><p className="text-[9px] font-black uppercase tracking-widest text-slate-900">{doc.tipo.replace(/_/g, ' ')}</p></div></div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-500" />
                        </a>
                      ))}
                    </div>
                 </section>

               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={"w-full flex items-center justify-between px-4 md:px-6 py-4 rounded-2xl transition-all duration-500 group " + (active ? "bg-white text-slate-900 shadow-xl scale-105" : "text-slate-500 hover:text-white hover:bg-white/5")}>
      <div className="flex items-center gap-4">
        <div className={(active ? "text-sky-500" : "text-slate-600 group-hover:text-slate-300") + " transition-colors"}>{icon}</div>
        <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
      </div>
      {badge !== undefined && <span className={"text-[9px] font-black px-2 py-0.5 rounded-full " + (active ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-500")}>{badge}</span>}
    </button>
  );
}

function SidebarFilterLink({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={"w-full flex items-center px-6 py-3 rounded-xl transition-all duration-300 " + (active ? "bg-sky-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-300 hover:bg-white/5")}><span className="text-[9px] font-black uppercase tracking-widest truncate">{label}</span></button>
  );
}

function ManualInput({ label, name, icon, ...props }: any) {
  return (
    <div className="space-y-3 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 transition-all">{icon}</div>
        <input name={name} {...props} className="w-full bg-slate-50 border-2 border-slate-100/50 focus:border-sky-500 focus:bg-white rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-200" />
      </div>
    </div>
  );
}

function FileUploader({ label, icon, onChange, file }: {label: string, icon: any, onChange: (f: File) => void, file?: File}) {
  return (
    <div className="space-y-3 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className={"relative h-28 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all " + (file ? "border-emerald-500 bg-emerald-50" : "border-slate-100 bg-slate-50 hover:border-sky-500")}>
        <div className={"mb-1 " + (file ? "text-emerald-500" : "text-slate-300")}>{icon}</div>
        <span className={"text-[8px] font-black uppercase tracking-widest text-center px-4 " + (file ? "text-emerald-700" : "text-slate-400")}>{file ? file.name : 'Subir'}</span>
        <input type="file" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}

function DataField({ label, value, icon }: { label: string, value?: string, icon: any }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">{icon} {label}</p>
      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[50px] flex items-center"><p className="text-xs font-bold text-slate-800 uppercase truncate">{value || '---'}</p></div>
    </div>
  );
}
