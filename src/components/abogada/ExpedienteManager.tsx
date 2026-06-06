'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  LayoutDashboard, 
  Briefcase, 
  Clock, 
  Bell, 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Plus,
  ChevronRight,
  MoreVertical,
  Calendar,
  User,
  MapPin,
  Scale
} from 'lucide-react';
import type { CatalogoHito, Recordatorio } from '@/types/database';
import { logoutAbogada } from '@/actions/auth-abogada';

export default function ExpedienteManager({
  expedientes,
  hitos,
  alertasHoy,
  solicitarAltaPanel
}: {
  expedientes: any[];
  hitos: CatalogoHito[];
  alertasHoy: any[];
  solicitarAltaPanel: React.ReactNode;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'lista' | 'calendario' | 'altas'>('lista');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExp, setSelectedExp] = useState<any | null>(null);

  const filteredExps = useMemo(() => {
    return expedientes.filter(exp => 
      exp.nombre_empresa?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      exp.cliente?.nombre_completo?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [expedientes, searchQuery]);

  const sidebarItems = [
    { label: 'Mis Expedientes', icon: Briefcase, active: activeTab === 'lista', onClick: () => setActiveTab('lista') },
    { label: 'Recordatorios', icon: Bell, active: activeTab === 'calendario', onClick: () => setActiveTab('calendario') },
    { label: 'Solicitar Alta', icon: Plus, active: activeTab === 'altas', onClick: () => setActiveTab('altas') },
  ];

  return (
    <DashboardLayout
      title="Gestión de Expedientes Legales"
      sidebarItems={sidebarItems}
      userProfile={{ name: 'Abogada Titular', role: 'Área Legal' }}
      onLogout={async () => { if(confirm('¿Cerrar sesión?')) { await logoutAbogada(); window.location.reload(); } }}
    >
      <div className="space-y-6">
        {activeTab === 'lista' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por empresa o titular..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 shadow-sm">
                  <Clock size={16} />
                  <span className="text-xs font-bold uppercase">{alertasHoy.length} Seguimientos Hoy</span>
                </div>
              </div>
            </header>

            <div className="card-base">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto / Cliente</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus Legal</th>
                      <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredExps.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center font-bold text-xs uppercase">{exp.nombre_empresa.substring(0,2)}</div>
                            <div>
                              <p className="font-bold text-slate-800 uppercase text-sm">{exp.nombre_empresa}</p>
                              <p className="text-[10px] text-slate-500 uppercase">{exp.cliente?.nombre_completo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase border border-slate-200">{exp.estatus.replace('_', ' ')}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => setSelectedExp(exp)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'altas' && (
          <div className="max-w-3xl mx-auto">
            {solicitarAltaPanel}
          </div>
        )}

        {activeTab === 'calendario' && (
          <div className="card-base p-12 text-center text-slate-400 italic">
            Visualización de calendario en desarrollo para el estándar Admin One...
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedExp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedExp(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="card-header bg-slate-900 text-white border-none flex justify-between p-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><Briefcase size={20}/></div>
                  <div><h2 className="text-lg font-bold uppercase">{selectedExp.nombre_empresa}</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedExp.cliente?.nombre_completo}</p></div>
                </div>
                <button onClick={() => setSelectedExp(null)}><AlertCircle className="rotate-45" size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50 custom-scrollbar space-y-6">
                 {/* Aquí iría la lógica de bitácora y documentos del ExpedienteManager original */}
                 <div className="card-base bg-white p-6">
                    <h3 className="font-bold text-slate-700 uppercase text-xs mb-4 flex items-center gap-2 text-blue-600"><FileText size={16}/> Documentación Resguardada</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedExp.documentos?.map((doc: any) => (
                        <div key={doc.id} className="p-3 border rounded-lg flex items-center justify-between hover:border-blue-500 transition-all">
                          <span className="text-[10px] font-bold uppercase text-slate-600">{doc.tipo.replace('_', ' ')}</span>
                          <a href={doc.url_archivo} target="_blank" className="text-blue-600"><Eye size={14}/></a>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div className="card-base bg-white p-6">
                    <h3 className="font-bold text-slate-700 uppercase text-xs mb-4 flex items-center gap-2 text-blue-600"><CheckCircle2 size={16}/> Hitos del Proceso</h3>
                    <div className="space-y-3">
                      {hitos.map(h => (
                        <div key={h.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-all cursor-pointer">
                          <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                          <span className="text-xs text-slate-600 font-bold uppercase">{h.nombre}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
