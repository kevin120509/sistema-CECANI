'use client';

import { useState } from 'react';
import { enviarContratoCliente, asignarAbogada, subirContratoDobleFirma, aprobarContratoGeneradoCliente } from '@/actions/directora';

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
    plan_pagos?: string 
  }>;
  pagos?: Array<{ monto: number; url_comprobante?: string; fecha_pago?: string }>;
  documentos?: Array<{ tipo: string; url_archivo: string }>;
};

export default function DirectorDashboard({
  abogadas,
  pendientes,
  porAsignar,
  concentrado,
}: {
  abogadas: PerfilAbogada[];
  pendientes: ExpedienteDirector[];
  porAsignar: ExpedienteDirector[];
  concentrado: ExpedienteDirector[];
}) {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'por_asignar' | 'concentrado'>('pendientes');
  const [selectedExpediente, setSelectedExpediente] = useState<ExpedienteDirector | null>(null);
  const [modalType, setModalType] = useState<'validar' | 'asignar_y_doble_firma' | null>(null);
  
  const [fileOficial, setFileOficial] = useState<File | null>(null);
  const [fileDobleFirma, setFileDobleFirma] = useState<File | null>(null);
  const [asesoraId, setAsesoraId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const handleOpenModal = (exp: ExpedienteDirector, type: 'validar' | 'asignar_y_doble_firma') => {
    setSelectedExpediente(exp);
    setModalType(type);
    setFileOficial(null);
    setFileDobleFirma(null);
    setAsesoraId('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setSelectedExpediente(null);
      setModalType(null);
      setFileOficial(null);
    }
  };

  const handleAprobarGenerado = async () => {
    if (!selectedExpediente || !selectedExpediente.contratos?.[0]?.id) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await aprobarContratoGeneradoCliente(selectedExpediente.id, selectedExpediente.contratos[0].id);
    if (result.error) {
      setSubmitError(result.error);
    } else {
      setSubmitSuccess(true);
      setTimeout(() => { closeModal(); setActiveTab('por_asignar'); }, 2000);
    }
    setIsSubmitting(false);
  };

  const handleValidarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpediente || !fileOficial) return;
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('expediente_id', selectedExpediente.id);
    formData.append('contrato_id', selectedExpediente.contratos?.[0]?.id || '');
    formData.append('file', fileOficial);
    
    // Aquí podríamos mandar también el presupuestoTotal y los extras elegidos
    // formData.append('monto_total', presupuestoTotal.toString());
    // formData.append('modulos', JSON.stringify(extrasSeleccionados));

    const result = await enviarContratoCliente(formData);
    if (result.error) setSubmitError(result.error);
    else { setSubmitSuccess(true); setTimeout(() => { closeModal(); setActiveTab('por_asignar'); }, 2000); }
    setIsSubmitting(false);
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
      <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Panel de Dirección</h1>
      
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('pendientes')} className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'pendientes' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>PENDIENTES VALIDAR ({pendientes.length})</button>
        <button onClick={() => setActiveTab('por_asignar')} className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'por_asignar' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>PENDIENTES ASIGNAR ({porAsignar.length})</button>
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
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Estatus Firma</th>
                  <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase">Acciones de Dirección</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {porAsignar.map((exp) => {
                  const contrato = exp.contratos?.[0];
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 uppercase">{exp.nombre_empresa}</div>
                        <div className="text-xs text-gray-500 font-medium">{exp.perfiles?.nombre_completo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contrato?.url_pdf_firmado_cliente ? (
                          <span className="text-green-700 bg-green-100 px-3 py-1 rounded-full text-[10px] font-black uppercase">✓ Cliente Firmó</span>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-black uppercase">Esperando Cliente</span>
                        )}
                        {contrato?.url_pdf_doble_firma && (
                          <span className="ml-2 text-purple-700 bg-purple-100 px-3 py-1 rounded-full text-[10px] font-black uppercase">✓ Doble Firma Lista</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {contrato?.url_pdf_firmado_cliente ? (
                            <button onClick={() => handleOpenModal(exp, 'asignar_y_doble_firma')} className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-purple-100 border border-purple-200 transition-all">👁️ Ver Contrato y Asignar Abogada</button>
                          ) : (
                            <span className="text-gray-400 font-bold text-xs uppercase">⏳ Esperando Firma</span>
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

      {activeTab === 'pendientes' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 uppercase tracking-tight">Expedientes Pendientes de Validar</h2>
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Empresa / Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Figura Legal</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase">Servicios Elegidos</th>
                  <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {pendientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500 font-bold">No hay expedientes pendientes de validar.</td>
                  </tr>
                ) : pendientes.map((exp) => {
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
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <button onClick={() => handleOpenModal(exp, 'validar')} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-blue-100 border border-blue-200 transition-all">👁️ Ver Detalles y Mandar Contrato</button>
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

      {selectedExpediente && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className={`relative bg-white rounded-3xl shadow-2xl ${modalType !== 'asignar_y_doble_firma' && modalType !== 'validar' ? 'max-w-lg' : 'max-w-4xl'} w-full p-8 max-h-[90vh] overflow-y-auto flex flex-col`}>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-6 shrink-0">
              {modalType === 'asignar_y_doble_firma' ? 'Ver Contrato y Asignar Abogada' : modalType === 'validar' ? 'Validar Contrato' : ''}
            </h2>

            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 font-black text-2xl">✓</div>
                <p className="font-bold text-gray-800">¡Operación exitosa!</p>
              </div>
            ) : (
              <form onSubmit={modalType === 'asignar_y_doble_firma' ? handleAsignarYDobleFirmaSubmit : handleValidarSubmit} className="space-y-6">
                
                {modalType === 'asignar_y_doble_firma' && (
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
                          {selectedExpediente.documentos && selectedExpediente.documentos.length > 0 ? (
                            selectedExpediente.documentos.map((doc, idx) => (
                              <a key={idx} href={doc.url_archivo} target="_blank" className="flex items-center gap-2 bg-white text-blue-700 p-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 border border-blue-200 transition-all" title={doc.tipo}>
                                <span>📄</span> <span className="truncate">{doc.tipo.replace(/_/g, ' ')}</span>
                              </a>
                            ))
                          ) : (
                            <p className="text-xs text-blue-600 font-medium col-span-4">El cliente no ha subido documentos aún.</p>
                          )}
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
                        {abogadas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                      </select>
                      <p className="text-[10px] text-blue-600 mt-3 font-bold uppercase text-center">⚠️ Al confirmar, se notificará automáticamente a la abogada elegida.</p>
                    </div>
                  </div>
                )}

                {modalType === 'validar' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
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

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <h3 className="text-sm font-black text-blue-900 uppercase mb-3 border-b border-blue-200 pb-2">Documentos del Cliente</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedExpediente.documentos && selectedExpediente.documentos.length > 0 ? (
                          selectedExpediente.documentos.map((doc, idx) => (
                            <a key={idx} href={doc.url_archivo} target="_blank" className="flex items-center gap-2 bg-white text-blue-700 p-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 border border-blue-200 transition-all" title={doc.tipo}>
                              <span>📄</span> <span className="truncate">{doc.tipo.replace(/_/g, ' ')}</span>
                            </a>
                          ))
                        ) : (
                          <p className="text-xs text-blue-600 font-medium col-span-2">El cliente no ha subido documentos aún.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <h3 className="text-sm font-black text-emerald-900 uppercase mb-3 border-b border-emerald-200 pb-2">Revisión y Aprobación del Contrato</h3>
                      
                      {selectedExpediente.contratos?.[0]?.url_pdf_generado && (
                        <div className="mb-6 p-4 bg-white rounded-xl border border-emerald-200 shadow-sm">
                          <h4 className="text-[11px] font-black text-emerald-800 uppercase mb-2">Opción A: Aprobar contrato automático</h4>
                          <p className="text-[10px] text-gray-500 mb-3">Revisa el PDF que el sistema generó. Si toda la información es correcta, puedes aprobarlo directamente para que el cliente lo firme.</p>
                          <a href={selectedExpediente.contratos?.[0]?.url_pdf_generado} target="_blank" className="w-full mb-3 bg-emerald-100 text-emerald-800 py-2 rounded-lg font-black text-xs uppercase hover:bg-emerald-200 transition-all flex items-center justify-center gap-2">
                            📄 1. Ver Contrato Generado
                          </a>
                          <button type="button" onClick={handleAprobarGenerado} disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-black text-xs uppercase hover:bg-emerald-700 transition-all shadow-md">
                            ✅ 2. Aprobar sin subir cambios
                          </button>
                        </div>
                      )}

                      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="text-[11px] font-black text-gray-800 uppercase mb-2">Opción B: Reemplazar contrato</h4>
                        <p className="text-[10px] text-gray-500 mb-3">Si hiciste correcciones o cambios manuales al contrato, sube el nuevo PDF validado aquí.</p>
                        <input type="file" accept=".pdf" onChange={e => setFileOficial(e.target.files?.[0] || null)} className="w-full text-xs text-gray-500 file:bg-gray-200 file:text-gray-700 file:border-0 file:px-4 file:py-2 file:rounded-lg file:font-black file:uppercase file:mr-4 hover:file:bg-gray-300 transition-all cursor-pointer mb-3" />
                        <button type="submit" disabled={isSubmitting || !fileOficial} className="w-full bg-slate-800 text-white py-2 rounded-lg font-black text-xs uppercase hover:bg-slate-700 disabled:opacity-50 transition-all">
                          ⬆️ Subir y Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {submitError && <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 shrink-0">{submitError}</p>}

                <div className="flex gap-3 pt-4 shrink-0 mt-auto border-t border-gray-100 pt-6">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-gray-400 hover:text-gray-600 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">Cancelar</button>
                  {modalType === 'asignar_y_doble_firma' && (
                    <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all">
                      {isSubmitting ? 'Procesando...' : 'Confirmar Asignación'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
