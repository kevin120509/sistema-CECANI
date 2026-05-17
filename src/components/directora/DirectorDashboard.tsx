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
  Settings, 
  LogOut, 
  Search, 
  FileText, 
  ShieldCheck, 
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Scale,
  MoreVertical,
  X,
  FileSignature,
  Download,
  Trash2,
  UploadCloud,
  MapPin,
  ChevronRight,
  Filter,
  UserCircle
} from 'lucide-react';

export type PerfilAbogada = { id: string; nombre_completo: string };
export type ExpedienteDirector = Record<string, unknown> & {
  id: string;
  cliente_id: string;
  nombre_empresa: string;
  estatus: string;
  created_at: string;
  perfiles?: { nombre_completo: string };
  asesora?: { id: string; nombre_completo: string };
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
  documentos?: Array<{ tipo: string; url_archivo: string }>;
  servicios_extra?: string[];
};

interface NewClientMasterInfo {
  expediente_id: string;
  cliente_id: string;
  contrato_id: string;
  nombre_empresa: string;
}

/**
 * Componente: DirectorDashboard (Refactorizado con Filtros por Asesora y Optimización de Tablas)
 */
export default function DirectorDashboard({
  abogadas,
  porAsignar,
  concentrado,
}: {
  abogadas: PerfilAbogada[];
  porAsignar: ExpedienteDirector[];
  concentrado: ExpedienteDirector[];
}) {
  const [activeTab, setActiveTab] = useState<'por_asignar' | 'concentrado'>('por_asignar');
  const [selectedExpediente, setSelectedExpediente] = useState<ExpedienteDirector | null>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsesoraFilter, setSelectedAsesoraFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  
  // Modales
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // --- Estados del Registro Maestro ---
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

  // --- Mapa de Normalización de Asesoras ---
  // Agrupa nombres duplicados/inconsistentes bajo el nombre canónico
  const ASESORA_CANONICAL: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of abogadas) {
      const n = a.nombre_completo.trim().toUpperCase();
      if (n.includes('SANDRA') && n.includes('ODETTE')) map[a.id] = 'SANDRA / ODETTE';
      else if (n.includes('SANDRA') && n.includes('ARACELI')) map[a.id] = 'SANDRA / ARACELI';
      else if (n.includes('ABIGAIL') && n.includes('SELENA')) map[a.id] = 'ABIGAIL / SELENA';
      else if (n.includes('ABIGAIL') && n.includes('SANDRA')) map[a.id] = 'ABIGAIL / SANDRA';
      else if (n.includes('YARASET') && n.includes('ABI')) map[a.id] = 'YARASET REYES / ABIGAIL';
      else if (n.includes('YARASET') && n.includes('NIZA')) map[a.id] = 'YARASET REYES / NIZA';
      else if (n.includes('CHAVIRA')) map[a.id] = 'CHAVIRA / NIZA GUERRA';
      else if (n.includes('FLOR') && n.includes('VALERIA')) map[a.id] = 'FLOR / VALERIA / NIZA';
      else if (n.includes('ARECELI') || (n.includes('ARACELI') && n.includes('LUIZ'))) map[a.id] = 'ARACELI / LUISA';
      else if (n === 'NZA GUERRA' || n === 'NZA GUERRA ') map[a.id] = 'NIZA GUERRA';
      else if (n === 'ABY') map[a.id] = 'ABIGAIL';
      else if (n === 'NIZA') map[a.id] = 'NIZA GUERRA';
      else if (['KEVIN VARGAS','MIGUELITO','JORGE EDUARDO','BLANCA'].some(t => n.includes(t))) map[a.id] = '__TEST__';
      else if (['YAEL MATADAMAS','FILIBERTA REYES'].some(t => n.includes(t))) map[a.id] = '__TEST__';
      else map[a.id] = a.nombre_completo.trim().toUpperCase();
    }
    return map;
  }, [abogadas]);

  // Lista de asesoras únicas para el sidebar (sin duplicados ni tests)
  const uniqueAsesoras = useMemo(() => {
    const seen = new Map<string, { canonical: string; ids: string[] }>();
    for (const a of abogadas) {
      const canonical = ASESORA_CANONICAL[a.id] || a.nombre_completo;
      if (canonical === '__TEST__') continue;
      if (seen.has(canonical)) {
        seen.get(canonical)!.ids.push(a.id);
      } else {
        seen.set(canonical, { canonical, ids: [a.id] });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.canonical.localeCompare(b.canonical));
  }, [abogadas, ASESORA_CANONICAL]);

  // Función para obtener nombre normalizado de un expediente
  const getNormalizedAsesoraName = (exp: ExpedienteDirector) => {
    if (!exp.asesora?.id) return null;
    const canonical = ASESORA_CANONICAL[exp.asesora.id];
    if (canonical === '__TEST__') return exp.asesora.nombre_completo;
    return canonical || exp.asesora.nombre_completo;
  };

  // --- Lógica de Filtrado + Paginación ---
  const filteredConcentrado = useMemo(() => {
    let result = concentrado;
    
    // Filtro por Asesora (por grupo de IDs)
    if (selectedAsesoraFilter !== 'all') {
      const group = uniqueAsesoras.find(a => a.canonical === selectedAsesoraFilter);
      if (group) {
        const idSet = new Set(group.ids);
        result = result.filter(exp => exp.asesora?.id && idSet.has(exp.asesora.id));
      }
    }
    
    // Filtro por Búsqueda
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(exp => 
        exp.nombre_empresa?.toLowerCase().includes(q) || 
        exp.perfiles?.nombre_completo?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [concentrado, selectedAsesoraFilter, searchQuery, uniqueAsesoras]);

  const totalPages = Math.ceil(filteredConcentrado.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredConcentrado.slice(start, start + PAGE_SIZE);
  }, [filteredConcentrado, page]);

  // Reset page when filters change
  const setFilterAndReset = (filter: string) => { setSelectedAsesoraFilter(filter); setPage(1); };
  const setSearchAndReset = (q: string) => { setSearchQuery(q); setPage(1); };

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
    <div className="flex min-h-screen bg-slate-50 selection:bg-sky-500/20">
      {/* --- Sidebar --- */}
      <aside className="w-80 bg-slate-950 text-white flex flex-col p-8 fixed h-full z-40 border-r border-white/5 shadow-2xl">
        <div className="flex items-center gap-4 mb-14 group cursor-default">
          <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)] group-hover:scale-105 transition-transform duration-500">
            <span className="font-black text-2xl tracking-tighter">D</span>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter leading-none">CECANI</h2>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-sky-400 mt-2 opacity-80">Central Directive</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink icon={<LayoutDashboard size={20} />} label="Por Asignar" active={activeTab === 'por_asignar'} onClick={() => setActiveTab('por_asignar')} badge={porAsignar.length} />
          <SidebarLink icon={<Users size={20} />} label="Concentrado" active={activeTab === 'concentrado'} onClick={() => setActiveTab('concentrado')} />
          
          <AnimatePresence>
            {activeTab === 'concentrado' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-6 space-y-2 border-t border-white/5 mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 ml-4">Filtrar por Asesora</p>
                <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-1">
                  <SidebarFilterLink 
                    label={`Todas (${concentrado.length})`} 
                    active={selectedAsesoraFilter === 'all'} 
                    onClick={() => setFilterAndReset('all')} 
                  />
                  {uniqueAsesoras.map(group => {
                    const count = concentrado.filter(e => e.asesora?.id && group.ids.includes(e.asesora.id)).length;
                    return (
                      <SidebarFilterLink 
                        key={group.canonical}
                        label={`${group.canonical} (${count})`}
                        active={selectedAsesoraFilter === group.canonical}
                        onClick={() => setFilterAndReset(group.canonical)}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-8 pb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 ml-4">Operaciones</p>
            <button onClick={() => setIsCreateModalOpen(true)} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-300 hover:bg-sky-500 hover:text-white hover:border-sky-400 transition-all duration-300 group shadow-lg">
              <div className="p-2 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors"><UserPlus size={18} /></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-nowrap">Alta Maestra</span>
            </button>
          </div>
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          <button onClick={handleLogout} disabled={isLoggingOut} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 group">
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[11px] font-black uppercase tracking-widest">{isLoggingOut ? 'Saliendo...' : 'Finalizar Sesión'}</span>
          </button>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="ml-80 flex-1 p-10 md:p-14">
        <header className="mb-14 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              {activeTab === 'por_asignar' ? 'Mesa de Asignación' : 'Control Global'}
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-4 max-w-lg leading-relaxed uppercase tracking-tight">
              {activeTab === 'por_asignar' 
                ? 'Expedientes que requieren la designación de una asesora titular.' 
                : `${filteredConcentrado.length} expedientes · Página ${page} de ${totalPages || 1}`}
            </p>
          </motion.div>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-all"><Search size={18} /></div>
              <input 
                type="text" 
                placeholder="Buscar cliente o empresa..." 
                value={searchQuery}
                onChange={e => setSearchAndReset(e.target.value)}
                className="bg-white border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-8 text-xs font-black uppercase tracking-widest outline-none focus:border-sky-500 shadow-sm transition-all w-80"
              />
            </div>
            <NotificationStatusIndicator />
          </div>
        </header>

        {/* --- Table --- */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab + selectedAsesoraFilter + page} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden min-h-[400px]">
            {(() => {
              const showAsesoraCol = selectedAsesoraFilter === 'all';
              const rows = activeTab === 'por_asignar' ? porAsignar : paginatedData;
              return (
                <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className={`${showAsesoraCol ? 'w-[30%]' : 'w-[40%]'} pl-10 pr-4 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]`}>Razón Social / Titular</th>
                      <th className={`${showAsesoraCol ? 'w-[25%]' : 'w-[30%]'} px-4 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]`}>Figura Legal</th>
                      {showAsesoraCol && (
                        <th className="w-[25%] px-4 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asesora Asignada</th>
                      )}
                      <th className="w-[20%] px-4 pr-10 py-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((exp) => (
                      <tr key={exp.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="pl-10 pr-4 py-6">
                          <p className="text-sm font-black text-slate-900 tracking-tight uppercase truncate leading-snug">{exp.nombre_empresa}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{exp.perfiles?.nombre_completo}</p>
                        </td>
                        <td className="px-4 py-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black uppercase px-3 py-1.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg inline-block w-fit leading-relaxed">
                              {exp.figura?.descripcion || 'Genérica'}
                            </span>
                          </div>
                        </td>
                        {showAsesoraCol && (
                          <td className="px-4 py-6">
                            {exp.asesora ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center flex-shrink-0"><UserCircle size={16}/></div>
                                <span className="text-[10px] font-black uppercase text-slate-700 tracking-tight truncate">{getNormalizedAsesoraName(exp)}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-black uppercase text-slate-300 tracking-[0.2em]">Pendiente</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 pr-10 py-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }} className="bg-slate-950 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-sky-600 transition-all shadow-xl flex items-center gap-2 whitespace-nowrap">Gestionar <ArrowRight size={14}/></button>
                            <button onClick={() => handleEliminar(exp.id, exp.cliente_id, exp.nombre_empresa)} disabled={isPending} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={showAsesoraCol ? 4 : 3} className="px-10 py-40 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.5em]">No se encontraron registros</td></tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* --- Paginación --- */}
        {activeTab === 'concentrado' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-sky-500 hover:text-sky-600 disabled:opacity-30 transition-all shadow-sm">← Anterior</button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-sky-500 hover:text-sky-600 disabled:opacity-30 transition-all shadow-sm">Siguiente →</button>
          </div>
        )}
      </main>

      {/* --- Modales (Registro y Asignación) --- */}
      <AnimatePresence>
        {/* Registro Maestro Stepper (Simplificado para brevedad, igual al anterior pero con los IDs corregidos) */}
        {isCreateModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => !isPending && resetCreateState()} />
             <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[4rem] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-950 p-8 flex items-center justify-between">
                 <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24}/></div>
                   <div>
                     <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Alta Maestra</h2>
                     <p className="text-[9px] font-black uppercase tracking-[0.4em] text-sky-400 mt-2">Sincronización Digital</p>
                   </div>
                 </div>
                 <div className="flex gap-4">
                   {[1, 2, 3].map(s => <div key={s} className={`w-3 h-3 rounded-full transition-all duration-500 ${createStep === s ? 'bg-sky-500 scale-125' : createStep > s ? 'bg-emerald-500' : 'bg-white/10'}`} />)}
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-12 md:p-16 custom-scrollbar">
                 <AnimatePresence mode="wait">
                   {createStep === 1 && (
                     <motion.form key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={onInitManualRegistry} className="space-y-8">
                       <div className="space-y-6">
                         <ManualInput label="Razón Social / Empresa *" name="nombre_empresa" icon={<Building2 size={16}/>} required />
                         <ManualInput label="Nombre del Representante *" name="nombre_completo" icon={<Users size={16}/>} required />
                         <div className="grid grid-cols-2 gap-6">
                           <ManualInput label="WhatsApp / Teléfono" name="telefono" icon={<Users size={16}/>} />
                           <ManualInput label="RFC" name="rfc" icon={<FileText size={16}/>} />
                         </div>
                       </div>
                       <button type="submit" disabled={isPending} className="w-full bg-slate-950 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-4">
                         {isPending ? <Loader2 className="animate-spin" size={16}/> : <>Continuar <ChevronRight size={16}/></>}
                       </button>
                     </motion.form>
                   )}

                   {createStep === 2 && (
                     <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <FileUploader label="Contrato Legalizado" icon={<FileSignature size={18}/>} onChange={f => setFiles({...files, contrato: f})} file={files.contrato} />
                         <FileUploader label="INE Frente" icon={<ShieldCheck size={18}/>} onChange={f => setFiles({...files, ine_frente: f})} file={files.ine_frente} />
                         <FileUploader label="INE Reverso" icon={<ShieldCheck size={18}/>} onChange={f => setFiles({...files, ine_reverso: f})} file={files.ine_reverso} />
                         <FileUploader label="Comprobante Domicilio" icon={<MapPin size={18}/>} onChange={f => setFiles({...files, domicilio: f})} file={files.domicilio} />
                       </div>
                       {uploadProgress && <div className="p-4 bg-sky-50 text-sky-600 rounded-2xl flex items-center gap-3 border border-sky-100 animate-pulse"><Loader2 size={16} className="animate-spin"/><span className="text-[10px] font-black uppercase tracking-widest">{uploadProgress}</span></div>}
                       <button onClick={onUploadMasterDocs} disabled={isPending} className="w-full bg-slate-950 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-sky-600 transition-all flex items-center justify-center gap-4">Subir y Continuar</button>
                     </motion.div>
                   )}

                   {createStep === 3 && (
                     <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                       <select value={finalAsesoraId} onChange={e => setFinalAsesoraId(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold uppercase text-xs tracking-widest outline-none focus:border-sky-500">
                         <option value="">Asignar Asesora Titular...</option>
                         {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                       </select>
                       <button onClick={onFinalizeAndAssign} disabled={isPending || !finalAsesoraId} className="w-full bg-sky-600 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all">Finalizar Expediente</button>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
             </motion.div>
           </div>
        )}

        {/* Asignación Tradicional */}
        {isAssignModalOpen && selectedExpediente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => !isPending && setIsAssignModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[4rem] shadow-2xl max-w-2xl w-full p-12 md:p-16 overflow-hidden">
               <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-8">Gestión de Expediente</h2>
               <form onSubmit={async (e) => {
                 e.preventDefault();
                 startTransition(async () => {
                   const fd = new FormData();
                   fd.append('expediente_id', selectedExpediente.id);
                   fd.append('asesora_id', asesoraId);
                   const res = await asignarAbogada(fd);
                   if (res.success) setIsAssignModalOpen(false);
                 });
               }} className="space-y-8">
                  <select required value={asesoraId} onChange={e => setAsesoraId(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-3xl font-black text-xs uppercase tracking-widest outline-none focus:border-sky-500">
                    <option value="">Seleccionar Asesora Titular...</option>
                    {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                  </select>
                  <button type="submit" disabled={isPending} className="w-full bg-slate-950 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-sky-600 transition-all">Confirmar Asignación</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Componentes Atómicos ---

function SidebarLink({ icon, label, active, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all duration-500 group ${active ? 'bg-white text-slate-900 shadow-[0_15px_30px_rgba(0,0,0,0.2)] scale-105 rotate-1' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
      <div className="flex items-center gap-4">
        <div className={`${active ? 'text-sky-500' : 'text-slate-600 group-hover:text-slate-300'} transition-colors`}>{icon}</div>
        <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
      </div>
      {badge !== undefined && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{badge}</span>}
    </button>
  );
}

function SidebarFilterLink({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center px-6 py-3 rounded-xl transition-all duration-300 ${active ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
    >
      <span className="text-[9px] font-black uppercase tracking-widest truncate">{label}</span>
      {active && <motion.div layoutId="active-filter" className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
    </button>
  );
}

function ManualInput({ label, name, icon, ...props }: any) {
  return (
    <div className="space-y-3 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-sky-500 transition-all">{icon}</div>
        <input name={name} {...props} className="w-full bg-slate-50 border-2 border-slate-100/50 focus:border-sky-500 focus:bg-white rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-200" />
      </div>
    </div>
  );
}

function FileUploader({ label, icon, onChange, file }: {label: string, icon: any, onChange: (f: File) => void, file?: File}) {
  return (
    <div className="space-y-3 text-left">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className={`relative h-28 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center transition-all ${file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:border-sky-500'}`}>
        <div className={`mb-1 ${file ? 'text-emerald-500' : 'text-slate-300'}`}>{icon}</div>
        <span className={`text-[8px] font-black uppercase tracking-widest text-center px-4 ${file ? 'text-emerald-700' : 'text-slate-400'}`}>
          {file ? file.name : 'Subir archivo'}
        </span>
        <input type="file" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && onChange(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      </div>
    </div>
  );
}
