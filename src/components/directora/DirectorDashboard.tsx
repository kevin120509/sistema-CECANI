'use client';

import { useState } from 'react';
import { asignarAbogada, subirContratoDobleFirma } from '@/actions/directora';
import { logoutAbogada } from '@/actions/auth-abogada';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';

export type PerfilAbogada = { id: string; nombre_completo: string };
export type ExpedienteDirector = Record<string, unknown> & {
  id: string;
  cliente_id: string;
  nombre_empresa: string;
  estatus: string;
  created_at: string;
  perfiles?: { nombre_completo: string };
  asesora?: { nombre_completo: string };
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [fileDobleFirma, setFileDobleFirma] = useState<File | null>(null);
  const [asesoraId, setAsesoraId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      setIsLoggingOut(true);
      await logoutAbogada();
      window.location.reload();
    }
  };

  const handleOpenModal = (exp: ExpedienteDirector) => {
    setSelectedExpediente(exp);
    setIsModalOpen(true);
    setFileDobleFirma(null);
    setAsesoraId('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setSelectedExpediente(null);
      setIsModalOpen(false);
    }
  };

  const handleAsignarYDobleFirmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpediente || !asesoraId) return;
    setIsSubmitting(true);
    
    // Si hay archivo de doble firma, subirlo primero
    if (fileDobleFirma) {
      const formDataFirma = new FormData();
      formDataFirma.append('expediente_id', selectedExpediente.id);
      formDataFirma.append('contrato_id', selectedExpediente.contratos?.[0]?.id || '');
      formDataFirma.append('file', fileDobleFirma);
      const resultFirma = await subirContratoDobleFirma(formDataFirma);
      if (resultFirma.error) {
        setSubmitError(`Error Subiendo Contrato: ${resultFirma.error}`);
        setIsSubmitting(false);
        return;
      }
    }

    const formDataAsignar = new FormData();
    formDataAsignar.append('expediente_id', selectedExpediente.id);
    formDataAsignar.append('asesora_id', asesoraId);
    const resultAsignar = await asignarAbogada(formDataAsignar);
    
    if (resultAsignar.error) setSubmitError(`Error Asignando: ${resultAsignar.error}`);
    else { setSubmitSuccess(true); setTimeout(() => { closeModal(); setActiveTab('concentrado'); }, 2000); }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <span className="font-black text-2xl">D</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Panel de Dirección</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Administración Central CECANI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationStatusIndicator />
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 bg-white border-2 border-slate-100 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all group disabled:opacity-50 shadow-sm"
          >
            {isLoggingOut ? 'Saliendo...' : (
              <>
                <span className="group-hover:-translate-x-1 transition-transform">🚪</span>
                Cerrar Sesión
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('por_asignar')} className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'por_asignar' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>POR ASIGNAR ABOGADA ({porAsignar.length})</button>
        <button onClick={() => setActiveTab('concentrado')} className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'concentrado' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>CONCENTRADO GLOBAL</button>
      </div>

      {activeTab === 'por_asignar' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 uppercase tracking-tight">Contratos Firmados y Por Asignar</h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Empresa / Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Figura Legal</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Servicios Elegidos</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Estatus Firma</th>
                  <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase">Acciones de Dirección</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {porAsignar.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 font-bold">No hay expedientes pendientes de asignar abogada.</td>
                  </tr>
                ) : porAsignar.map((exp) => {
                  const contrato = exp.contratos?.[0];
                  
                  // Map de servicio_base a algo legible
                  const servBaseStr = contrato?.servicio_base === 'constitucion' ? 'Constitución' : 
                                      contrato?.servicio_base === 'acta_extra' ? 'Acta Extraordinaria' : 
                                      contrato?.servicio_base === 'recuperacion' ? 'Recuperación Donataria' : 
                                      contrato?.servicio_base || 'Sin servicio base';
                  
                  // Modulos extra
                  const extras = (contrato?.modulos_extra || []) as string[];
                  const extrasStr = extras.map(ex => ex.replace(/_/g, ' ')).join(', ');

                  return (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 uppercase">{exp.nombre_empresa}</div>
                        <div className="text-xs text-gray-500 font-medium">{exp.perfiles?.nombre_completo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full font-black uppercase inline-block">
                          {exp.figura?.descripcion || 'No seleccionada'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-800 uppercase">{servBaseStr}</div>
                        {extrasStr && <div className="text-[10px] text-slate-500 font-medium uppercase mt-1">Extras: {extrasStr}</div>}
                        {exp.servicios_extra?.includes('REGULARIZACION') && (
                          <div className="text-[10px] text-amber-600 font-black uppercase mt-1">⚠️ Requiere Cotización Contable</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contrato?.url_pdf_firmado_cliente ? (
                          <span className="text-green-700 bg-green-100 px-3 py-1 rounded-full text-[10px] font-black uppercase">✓ Cliente Firmó</span>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-black uppercase">Esperando Cliente</span>
                        )}
                        {contrato?.url_pdf_doble_firma && (
                          <span className="ml-2 mt-1 block text-purple-700 bg-purple-100 px-3 py-1 rounded-full text-[10px] font-black uppercase w-max">✓ Doble Firma Lista</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {contrato?.url_pdf_firmado_cliente ? (
                            <button onClick={() => handleOpenModal(exp)} className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-purple-100 border border-purple-200 transition-all flex items-center gap-2">
                              <span>👁️</span> Ver Detalles y Asignar
                            </button>
                          ) : (
                            <span className="text-gray-400 font-bold text-xs uppercase text-center block w-full">⏳ Esperando Firma</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'concentrado' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 uppercase tracking-tight">Concentrado Global de Expedientes</h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Empresa</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Abogada Asignada</th>
                  <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase">Estatus</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {concentrado.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500 font-bold">No hay expedientes registrados.</td>
                  </tr>
                ) : concentrado.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900 uppercase">{exp.nombre_empresa}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{exp.perfiles?.nombre_completo || 'N/A'}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{exp.asesora?.nombre_completo || 'Sin Asignar'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-gray-700 bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        {exp.estatus?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedExpediente && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto flex flex-col">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-6 shrink-0">
              Ver Contrato y Asignar Abogada
            </h2>

            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 font-black text-2xl">✓</div>
                <p className="font-bold text-gray-800">¡Operación exitosa!</p>
              </div>
            ) : (
              <form onSubmit={handleAsignarYDobleFirmaSubmit} className="space-y-6">
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <h3 className="text-sm font-black text-gray-800 uppercase mb-3 border-b pb-2">Información del Cliente</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><span className="block text-gray-500 font-bold mb-1">Empresa:</span> <span className="font-medium text-gray-900">{selectedExpediente.nombre_empresa}</span></div>
                        <div><span className="block text-gray-500 font-bold mb-1">Representante:</span> <span className="font-medium text-gray-900">{selectedExpediente.perfiles?.nombre_completo || 'N/A'}</span></div>
                        <div className="col-span-2"><span className="block text-gray-500 font-bold mb-1">Figura Legal:</span> <span className="font-medium text-gray-900">{selectedExpediente.figura?.descripcion || 'No seleccionada'}</span></div>
                        {selectedExpediente.servicios_extra?.includes('REGULARIZACION') && (
                          <div className="col-span-2">
                            <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-md text-[10px] font-black tracking-widest border border-amber-200 mt-2">
                              ⚠️ REQUIERE COTIZACIÓN CONTABLE
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <h3 className="text-sm font-black text-blue-900 uppercase mb-3 border-b border-blue-200 pb-2">Documentos del Cliente</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(() => {
                          if (!selectedExpediente.documentos || selectedExpediente.documentos.length === 0) {
                            return <p className="text-xs text-blue-600 font-medium col-span-4">El cliente no ha subido documentos aún.</p>;
                          }
                          const uniqueDocsMap = new Map();
                          selectedExpediente.documentos.forEach(doc => {
                            uniqueDocsMap.set(doc.tipo, doc);
                          });
                          const uniqueDocs = Array.from(uniqueDocsMap.values());
                          
                          return uniqueDocs.map((doc, idx) => (
                            <a key={idx} href={doc.url_archivo} target="_blank" className="flex items-center gap-2 bg-white text-blue-700 p-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 border border-blue-200 transition-all" title={doc.tipo}>
                              <span>📄</span> <span className="truncate">{doc.tipo.replace(/_/g, ' ')}</span>
                            </a>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl mb-2">📑</span>
                      <h3 className="text-xs font-black text-emerald-900 uppercase tracking-tight mb-2">1. Contrato Firmado (Cliente)</h3>
                      <p className="text-xs text-emerald-700 mb-4 px-2">Descarga y revisa el PDF que el cliente ya firmó y autorizó.</p>
                      <div className="flex flex-col gap-2 w-full">
                        <a href={selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente} target="_blank" className="w-full bg-white text-emerald-700 py-3 rounded-xl font-black text-xs uppercase shadow-sm border border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                          📥 Descargar PDF Firmado
                        </a>
                        {selectedExpediente.contratos?.[0]?.url_pdf_generado && (
                          <a href={selectedExpediente.contratos?.[0]?.url_pdf_generado} target="_blank" className="w-full bg-white text-blue-700 py-2 rounded-xl font-bold text-[10px] uppercase shadow-sm border border-blue-200 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                            📄 Ver Contrato Original Generado
                          </a>
                        )}
                      </div>
                    </div>
                      
                      <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-100 flex flex-col justify-center">
                        <span className="text-3xl mb-2 text-center">✍️</span>
                        <h3 className="text-xs font-black text-purple-900 uppercase tracking-tight mb-2 text-center">2. Subir Doble Firma (Opcional)</h3>
                        <p className="text-xs text-purple-700 mb-4 px-2 text-center">Si tienes el documento firmado por CECANI, súbelo aquí.</p>
                        <input type="file" accept=".pdf" onChange={e => setFileDobleFirma(e.target.files?.[0] || null)} className="w-full text-xs text-gray-500 file:bg-purple-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg file:font-black file:uppercase file:mr-4 hover:file:bg-purple-700 cursor-pointer" />
                      </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100">
                      <h3 className="text-sm font-black text-blue-900 uppercase tracking-tight mb-4">3. Asignar Abogada</h3>
                      <p className="text-sm font-medium text-blue-800 mb-4">Selecciona a la abogada que se encargará del seguimiento para <span className="font-black uppercase">{selectedExpediente.nombre_empresa}</span>:</p>
                      <select value={asesoraId} onChange={e => setAsesoraId(e.target.value)} required className="w-full p-4 bg-white border-2 border-blue-200 rounded-2xl font-bold text-gray-800 outline-none focus:border-blue-500 hover:bg-blue-50 transition-all">
                        <option value="">-- Seleccionar una abogada --</option>
                        {abogadas.length === 0 && <option value="" disabled>No hay abogadas registradas</option>}
                        {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                      </select>
                      <p className="text-[10px] text-blue-600 mt-3 font-bold uppercase text-center">⚠️ Al confirmar, se notificará automáticamente a la abogada elegida.</p>
                    </div>
                  </div>
                {submitError && <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 shrink-0">{submitError}</p>}

                <div className="flex gap-3 pt-4 shrink-0 mt-auto border-t border-gray-100 pt-6">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-gray-400 hover:text-gray-600 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all">
                    {isSubmitting ? 'Procesando...' : 'Confirmar Asignación'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
