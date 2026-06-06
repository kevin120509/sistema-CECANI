'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { asignarAbogada, crearClienteManualAction, eliminarExpedienteAction, aprobarSolicitudAltaAction, rechazarSolicitudAltaAction } from '@/actions/directora';
import { logoutAbogada } from '@/actions/auth-abogada';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Search, 
  FileText, 
  ShieldCheck, 
  Loader2, 
  X, 
  Eye, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

export type PerfilAbogada = { id: string; nombre_completo: string };
export type ExpedienteDirector = any; // Simplificado para refactor visual

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsesoraName, setSelectedAsesoraName] = useState<string>('all');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const validacion = useMemo(() => porAsignar.filter(exp => exp.estatus === 'revision_directora' || exp.documentos?.some((d: any) => !!d.motivo_rechazo)), [porAsignar]);
  const listosParaAsignar = useMemo(() => porAsignar.filter(exp => exp.estatus === 'en_proceso' && !exp.documentos?.some((d: any) => !!d.motivo_rechazo)), [porAsignar]);

  const filteredData = useMemo(() => {
    let result = activeTab === 'por_asignar' ? listosParaAsignar : activeTab === 'validacion' ? validacion : concentrado;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(exp => exp.nombre_empresa?.toLowerCase().includes(q) || exp.cliente?.nombre_completo?.toLowerCase().includes(q));
    }
    return result;
  }, [activeTab, listosParaAsignar, concentrado, validacion, searchQuery]);

  const sidebarItems = [
    { label: 'Por Asignar', icon: LayoutDashboard, active: activeTab === 'por_asignar', onClick: () => setActiveTab('por_asignar') },
    { label: 'Validación', icon: ShieldCheck, active: activeTab === 'validacion', onClick: () => setActiveTab('validacion') },
    { label: 'Concentrado', icon: Users, active: activeTab === 'concentrado', onClick: () => setActiveTab('concentrado') },
    { label: 'Altas Pendientes', icon: UserPlus, active: activeTab === 'solicitudes', onClick: () => setActiveTab('solicitudes') },
  ];

  return (
    <DashboardLayout
      title="Panel de Dirección Operativa"
      sidebarItems={sidebarItems}
      userProfile={{ name: 'Directora General', role: 'Administrador' }}
      onLogout={async () => { if(confirm('¿Cerrar sesión?')) { await logoutAbogada(); window.location.reload(); } }}
    >
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar expediente o cliente..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <UserPlus size={18} /> Alta Maestra
          </button>
        </header>

        {activeTab === 'solicitudes' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solicitudesAlta.map((sol: any) => (
              <div key={sol.id} className="card-base">
                <div className="card-header py-4 bg-slate-50/50">
                  <span className="text-[10px] font-black uppercase text-slate-500">Solicitud de Alta</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${sol.estatus === 'pendiente' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{sol.estatus}</span>
                </div>
                <div className="card-content">
                  <p className="font-bold text-slate-800 uppercase text-sm mb-1">{sol.nombre_cliente}</p>
                  <p className="text-xs text-slate-500 uppercase mb-4">{sol.nombre_empresa}</p>
                  <div className="pt-4 border-t border-slate-50 flex gap-2">
                    {sol.estatus === 'pendiente' && (
                      <>
                        <button onClick={async () => { await aprobarSolicitudAltaAction(sol.id); toast.success('Aprobada'); router.refresh(); }} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase">Aprobar</button>
                        <button onClick={async () => { const m = prompt('Motivo:'); if(m) await rechazarSolicitudAltaAction(sol.id, m); router.refresh(); }} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">Rechazar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-base">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto / Cliente</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 uppercase text-sm">{exp.nombre_empresa}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{exp.cliente?.nombre_completo || '---'}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase border border-slate-200">{exp.estatus.replace('_', ' ')}</span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setSelectedExpediente(exp); setIsValidationModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Ver Documentos"><Eye size={18}/></button>
                          <button onClick={() => { setSelectedExpediente(exp); setIsAssignModalOpen(true); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Gestionar"><ClipboardList size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modales simplificados para Admin One */}
      <AnimatePresence>
        {isValidationModalOpen && selectedExpediente && (
          <Modal title="Expediente Digital" onClose={() => setIsValidationModalOpen(false)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedExpediente.documentos?.map((doc: any) => (
                <div key={doc.id} className="p-4 border rounded-xl flex items-center justify-between group hover:border-blue-500 transition-all">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-slate-400" />
                    <span className="text-[10px] font-bold uppercase text-slate-700">{doc.tipo.replace('_', ' ')}</span>
                  </div>
                  <a href={`/api/r2/download?url=${encodeURIComponent(doc.url_archivo)}`} target="_blank" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={16}/></a>
                </div>
              ))}
            </div>
          </Modal>
        )}

        {isAssignModalOpen && selectedExpediente && (
          <Modal title="Asignación y Gestión" onClose={() => setIsAssignModalOpen(false)}>
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Asignar Abogada Titular</label>
                <div className="flex gap-2">
                  <select 
                    className="input-field flex-1" 
                    onChange={e => {
                      const id = e.target.value;
                      if(id) startTransition(async () => { 
                        const fd = new FormData();
                        fd.append('expediente_id', selectedExpediente.id);
                        fd.append('asesora_id', id);
                        await asignarAbogada(fd); 
                        toast.success('Asignada'); 
                        router.refresh(); 
                      });
                    }}
                  >
                    <option value="">Seleccionar...</option>
                    {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 border rounded-xl">
                 <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Información de Pago</p>
                 <p className="text-lg font-black text-slate-800">${selectedExpediente.contratos?.[0]?.monto_total?.toLocaleString() || '0.00'}</p>
              </div>
              <button onClick={() => handleEliminar(selectedExpediente.id, selectedExpediente.cliente_id)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100 transition-all border border-red-100">Eliminar Expediente</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );

  async function handleEliminar(id: string, cid: string) {
    if(confirm('¿Desea eliminar este expediente permanentemente?')) {
      const res = await eliminarExpedienteAction(id, cid);
      if(res.success) { toast.error('Expediente eliminado'); router.refresh(); setIsAssignModalOpen(false); }
      else alert(res.error);
    }
  }
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100">
        <div className="card-header bg-slate-50/50">
          <span>{title}</span>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  );
}
