'use client';

import { useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { marcarHitoCompletado, agregarNotaBitacora, guardarDatosConcentrado } from '@/actions/abogada';
import type { CatalogoHito } from '@/types/database';
import type { ExpedienteAbogada } from '@/app/abogada/page';

interface ExpedienteManagerProps {
  expedientes: ExpedienteAbogada[];
  hitos: CatalogoHito[];
  alertasHoy: ExpedienteAbogada[];
}

function SubmitButton({ label = 'Guardar', className = "" }: { label?: string, className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors ${className}`}>
      {pending ? '...' : label}
    </button>
  );
}

export default function ExpedienteManager({ expedientes, hitos, alertasHoy }: ExpedienteManagerProps) {
  const [selectedExpedienteId, setSelectedExpedienteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etapa_legal' | 'entregables' | 'bitacora'>('etapa_legal');
  const [updatingHitoId, setUpdatingHitoId] = useState<string | null>(null);
  
  const CAMPOS_CONCENTRADO = [
    'estado', 'actividad', 'cluni', 'estatus_rpp', 'notaria', 'pago_notario', 'total_contrato', 
    'periodicidad_pagos', 'pago_entrega_donataria', 'cantidad_cobrar_proximo', 'estatus_detalle', 
    'accion_realizar', 'num_pagos_realizados', 'cantidad_pagada_acumulada', 'saldo_cliente', 
    'fecha_ultimo_pago', 'quien_cobra', 'vendedora', 'telefono_cliente', 'fecha_contrato', 
    'link_reunion', 'fecha_reunion_acuerdos'
  ];

  const [concentradoForm, setConcentradoForm] = useState<Record<string, string>>(
    CAMPOS_CONCENTRADO.reduce((acc, campo) => ({ ...acc, [campo]: '' }), {})
  );
  const [isSavingConcentrado, setIsSavingConcentrado] = useState(false);

  const selectedExpediente = expedientes.find(e => e.id === selectedExpedienteId) || null;

  useEffect(() => {
    if (selectedExpediente) {
      const dbData = selectedExpediente.datos_concentrado?.[0] || {};
      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach(campo => { newForm[campo] = (dbData as any)[campo] || ''; });
      setConcentradoForm(newForm);
    }
  }, [selectedExpedienteId, expedientes]);

  const handleConcentradoChange = (campo: string, valor: string) => {
    setConcentradoForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handleSaveConcentrado = async () => {
    if (!selectedExpediente) return;
    setIsSavingConcentrado(true);
    const res = await guardarDatosConcentrado(selectedExpediente.id, concentradoForm);
    if (!res.success) alert(res.error || 'Error al guardar');
    setIsSavingConcentrado(false);
  };

  const handleToggleHito = async (hitoId: string, isCompleted: boolean) => {
    if (!selectedExpediente) return;
    setUpdatingHitoId(hitoId);
    await marcarHitoCompletado(selectedExpediente.id, hitoId, isCompleted);
    setUpdatingHitoId(null);
  };

  const closeDetail = () => { setSelectedExpedienteId(null); setActiveTab('etapa_legal'); };
  const hitosCapacitacion = hitos.filter(h => h.orden >= 101);

  // VISTA 1: DASHBOARD
  if (!selectedExpediente) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <h1 className="text-3xl font-extrabold text-gray-900 uppercase tracking-tighter">Panel Operativo Legal</h1>
        <div className="bg-white border-2 border-gray-100 rounded-3xl shadow-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-slate-50 font-black text-slate-600 uppercase text-[11px] tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6 text-left">Empresa / Proyecto</th>
                <th className="px-8 py-6 text-left">Nombre del Cliente</th>
                <th className="px-8 py-6 text-center">Contacto WhatsApp</th>
                <th className="px-8 py-6 text-left">Figura Legal</th>
                <th className="px-8 py-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {expedientes.map(exp => {
                // USAR EL ALIAS 'cliente' QUE VIENE DE LA CONSULTA
                const nombreCliente = (exp as any).cliente?.nombre_completo || 'Sin nombre';
                const tel = (exp as any).cliente?.telefono;
                const whatsappUrl = tel ? `https://wa.me/52${tel.replace(/\D/g, '')}` : null;
                
                return (
                  <tr key={exp.id} className="hover:bg-blue-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 uppercase tracking-tighter text-base group-hover:text-blue-600 transition-colors">
                        {exp.nombre_empresa}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-slate-900 font-bold uppercase text-xs tracking-tight bg-slate-100 px-4 py-2 rounded-xl inline-block">
                        {nombreCliente}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {tel ? (
                        <a 
                          href={whatsappUrl!} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-5 py-2.5 rounded-2xl text-xs font-black hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100 uppercase tracking-widest"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {tel}
                        </a>
                      ) : (
                        <span className="text-slate-300 font-black italic text-xs uppercase tracking-widest">Sin Contacto</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm tracking-widest">
                        {exp.figura?.descripcion || 'FIGURA NO DEFINIDA'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => setSelectedExpedienteId(exp.id)} 
                        className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-xs font-black transition-all shadow-xl hover:bg-slate-800 hover:scale-105 active:scale-95 uppercase tracking-widest"
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // VISTA 2: DETALLE DEL EXPEDIENTE
  const docIneFrente = selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente')?.url_archivo;
  const docIneReverso = selectedExpediente.documentos?.find(d => d.tipo === 'ine_reverso')?.url_archivo;
  const docComprobante = selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_domicilio')?.url_archivo;
  const contrato = selectedExpediente.contratos?.[0];
  const urlContratoOficial = contrato?.url_pdf_doble_firma || contrato?.url_pdf_firmado_cliente;
  const bitacoraOrdenada = [...(selectedExpediente.bitacora || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="max-w-[100vw] px-4 md:px-8 py-6">
      <button onClick={closeDetail} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 font-black text-xs uppercase tracking-widest group">
        <svg className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        Volver al Panel
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="bg-slate-900 p-10 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex-1">
            <h1 className="text-4xl font-black mb-3 uppercase tracking-tighter">{selectedExpediente.nombre_empresa}</h1>
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest flex items-center gap-3">
                CLIENTE: <span className="text-white text-base tracking-normal">{(selectedExpediente as any).cliente?.nombre_completo}</span>
              </p>
              <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
              <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest flex items-center gap-3">
                FIGURA: <span className="text-white text-base tracking-normal">{selectedExpediente.figura?.descripcion}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[280px]">
            {urlContratoOficial && (
              <a href={urlContratoOficial} target="_blank" className="bg-blue-600 px-8 py-4 rounded-2xl font-black text-center text-xs uppercase shadow-2xl hover:bg-blue-700 hover:-translate-y-1 transition-all tracking-[0.2em]">
                Descargar Contrato
              </a>
            )}
            <div className="grid grid-cols-3 gap-2">
              {docIneFrente && <a href={docIneFrente} target="_blank" className="bg-slate-800 text-[10px] py-3 rounded-xl text-center uppercase font-black hover:bg-slate-700 border-2 border-slate-700 transition-all">INE F</a>}
              {docIneReverso && <a href={docIneReverso} target="_blank" className="bg-slate-800 text-[10px] py-3 rounded-xl text-center uppercase font-black hover:bg-slate-700 border-2 border-slate-700 transition-all">INE R</a>}
              {docComprobante && <a href={docComprobante} target="_blank" className="bg-slate-800 text-[10px] py-3 rounded-xl text-center uppercase font-black hover:bg-slate-700 border-2 border-slate-700 transition-all">DOM.</a>}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 bg-slate-50/50">
          <nav className="flex overflow-x-auto px-6">
            {['etapa_legal', 'entregables', 'bitacora'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`py-6 px-12 text-xs font-black uppercase tracking-[0.25em] border-b-4 transition-all ${activeTab === tab ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                {tab === 'etapa_legal' ? 'Concentración' : tab === 'entregables' ? 'Capacitación' : 'Bitácora'}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-0 bg-white">
          {activeTab === 'etapa_legal' && (
            <div className="w-full">
              <div className="p-10 border-b flex justify-between items-center bg-white sticky left-0 z-30">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">CONCENTRACIÓN DE CONTRATOS</h2>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] mt-1">Seguimiento Operativo y Financiero</p>
                </div>
                <button 
                  onClick={handleSaveConcentrado} 
                  disabled={isSavingConcentrado} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-5 rounded-[1.25rem] font-black shadow-2xl flex items-center gap-4 transition-all uppercase text-xs tracking-widest hover:scale-105 active:scale-95"
                >
                  {isSavingConcentrado ? 'Procesando...' : 'Guardar Información'}
                </button>
              </div>
              
              <div className="overflow-x-auto excel-table-container">
                <table className="min-w-[2600px] border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-black">
                    <tr>
                      <th className="border-2 border-slate-200 p-6 w-[350px] sticky left-0 z-20 bg-slate-200 shadow-2xl">NOMBRE DEL CLIENTE (A.C)</th>
                      <th className="border-2 border-slate-200 p-6 w-[200px] bg-slate-50">ASESORA ENCARGADA</th>
                      <th className="border-2 border-slate-200 p-6 w-[150px] bg-blue-100/50 text-blue-900">ESTADO / ENTIDAD</th>
                      <th className="border-2 border-slate-200 p-6 w-[250px] bg-blue-100/50 text-blue-900">ACTIVIDAD</th>
                      <th className="border-2 border-slate-200 p-6 w-[150px] bg-blue-100/50 text-blue-900">CLUNI</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-purple-100/50 text-purple-900">ESTATUS RPP</th>
                      <th className="border-2 border-slate-200 p-6 w-[250px] bg-purple-100/50 text-purple-900">NOTARIA</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-purple-100/50 text-purple-900">PAGO A NOTARIO</th>
                      <th className="border-2 border-emerald-300 p-6 w-[220px] bg-emerald-100/50 text-emerald-900 font-black">TOTAL DE CONTRATO</th>
                      <th className="border-2 border-emerald-300 p-6 w-[220px] bg-emerald-100/50 text-emerald-900 font-bold">PERIODICIDAD DE PAGOS</th>
                      <th className="border-2 border-emerald-300 p-6 w-[220px] bg-emerald-100/50 text-emerald-900 font-bold text-center">CANTIDAD A COBRAR PROXIMO PAGO</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-slate-50 text-center font-bold"># DE PAGOS REALIZADOS</th>
                      <th className="border-2 border-slate-200 p-6 w-[220px] bg-slate-50 text-green-700 font-black">CANTIDAD PAGADA ACUMULADA</th>
                      <th className="border-2 border-red-300 p-6 w-[220px] bg-red-100/50 text-red-900 font-black text-sm">SALDO DEL CLIENTE</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-slate-50 font-bold">FECHA DE ULTIMO PAGO</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-slate-50 text-slate-400">QUIEN COBRA</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-slate-50 text-slate-400">VENDEDORA</th>
                      <th className="border-2 border-slate-200 p-6 w-[180px] bg-slate-50 font-bold">FECHA DE CONTRATO</th>
                      <th className="border-2 border-slate-200 p-6 w-[350px] bg-blue-100/30 text-blue-800">LINK DE REUNIÓN</th>
                      <th className="border-2 border-slate-200 p-6 w-[250px] bg-blue-100/30 text-blue-800">FECHA REUNIÓN ACUERDOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="border-2 border-slate-200 p-0 sticky left-0 z-10 bg-white shadow-2xl">
                        <input type="text" readOnly value={selectedExpediente.nombre_empresa} className="w-full p-8 font-black text-slate-900 bg-slate-50/50 outline-none uppercase text-sm tracking-tight" />
                      </td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" readOnly value={(selectedExpediente as any).asesora?.nombre_completo || 'SIN ASIGNAR'} className="w-full p-8 font-bold text-slate-500 bg-slate-50/50 outline-none uppercase text-xs" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-blue-50/5"><input type="text" value={concentradoForm.estado} onChange={e => handleConcentradoChange('estado', e.target.value)} placeholder="Ej: CDMX" className="w-full p-8 outline-none focus:bg-white text-blue-800 font-bold uppercase" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-blue-50/5"><input type="text" value={concentradoForm.actividad} onChange={e => handleConcentradoChange('actividad', e.target.value)} placeholder="Ej: CONSTRUCCIÓN" className="w-full p-8 outline-none focus:bg-white uppercase font-medium" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-blue-50/5"><input type="text" value={concentradoForm.cluni} onChange={e => handleConcentradoChange('cluni', e.target.value)} placeholder="Ej: CLU12345" className="w-full p-8 outline-none focus:bg-white uppercase font-medium" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-purple-50/5"><input type="text" value={concentradoForm.estatus_rpp} onChange={e => handleConcentradoChange('estatus_rpp', e.target.value)} placeholder="Ej: INSCRITO" className="w-full p-8 outline-none focus:bg-white font-black text-purple-900 uppercase" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-purple-50/5"><input type="text" value={concentradoForm.notaria} onChange={e => handleConcentradoChange('notaria', e.target.value)} placeholder="Ej: NOTARÍA 45" className="w-full p-8 outline-none focus:bg-white uppercase font-medium" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-purple-50/5"><input type="text" value={concentradoForm.pago_notario} onChange={e => handleConcentradoChange('pago_notario', e.target.value)} placeholder="Ej: $3,500" className="w-full p-8 outline-none focus:bg-white uppercase font-bold" /></td>
                      <td className="border-2 border-emerald-300 p-0 bg-emerald-50/5"><input type="text" value={concentradoForm.total_contrato} onChange={e => handleConcentradoChange('total_contrato', e.target.value)} placeholder="Ej: $150,000" className="w-full p-8 outline-none focus:bg-white font-black text-blue-950 text-base" /></td>
                      <td className="border-2 border-emerald-300 p-0 bg-emerald-50/5"><input type="text" value={concentradoForm.periodicidad_pagos} onChange={e => handleConcentradoChange('periodicidad_pagos', e.target.value)} placeholder="Ej: MENSUAL" className="w-full p-8 outline-none focus:bg-white uppercase font-bold" /></td>
                      <td className="border-2 border-emerald-300 p-0 bg-emerald-50/5"><input type="text" value={concentradoForm.cantidad_cobrar_proximo} onChange={e => handleConcentradoChange('cantidad_cobrar_proximo', e.target.value)} placeholder="Ej: $10,000" className="w-full p-8 outline-none focus:bg-white text-emerald-800 font-black text-center" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.num_pagos_realizados} onChange={e => handleConcentradoChange('num_pagos_realizados', e.target.value)} placeholder="Ej: 3" className="w-full p-8 outline-none focus:bg-white text-center font-black text-slate-800" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.cantidad_pagada_acumulada} onChange={e => handleConcentradoChange('cantidad_pagada_acumulada', e.target.value)} placeholder="Ej: $45,000" className="w-full p-8 outline-none focus:bg-white text-green-700 font-black text-center" /></td>
                      <td className="border-2 border-red-300 p-0 bg-red-50/5"><input type="text" value={concentradoForm.saldo_cliente} onChange={e => handleConcentradoChange('saldo_cliente', e.target.value)} placeholder="Ej: $105,000" className="w-full p-8 outline-none focus:bg-white text-red-600 font-black text-base text-center" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.fecha_ultimo_pago} onChange={e => handleConcentradoChange('fecha_ultimo_pago', e.target.value)} placeholder="DD/MM/AAAA" className="w-full p-8 outline-none focus:bg-white font-black text-center" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.quien_cobra} onChange={e => handleConcentradoChange('quien_cobra', e.target.value)} placeholder="NOMBRE" className="w-full p-8 outline-none focus:bg-white uppercase" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.vendedora} onChange={e => handleConcentradoChange('vendedora', e.target.value)} placeholder="NOMBRE" className="w-full p-8 outline-none focus:bg-white uppercase" /></td>
                      <td className="border-2 border-slate-200 p-0"><input type="text" value={concentradoForm.fecha_contrato} onChange={e => handleConcentradoChange('fecha_contrato', e.target.value)} placeholder="DD/MM/AAAA" className="w-full p-8 outline-none focus:bg-white font-black text-center" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-blue-50/10"><input type="text" value={concentradoForm.link_reunion} onChange={e => handleConcentradoChange('link_reunion', e.target.value)} placeholder="URL REUNIÓN" className="w-full p-8 outline-none focus:bg-white text-blue-600 underline font-black" /></td>
                      <td className="border-2 border-slate-200 p-0 bg-blue-50/10"><input type="text" value={concentradoForm.fecha_reunion_acuerdos} onChange={e => handleConcentradoChange('fecha_reunion_acuerdos', e.target.value)} placeholder="Ej: 20 MAY 11AM" className="w-full p-8 outline-none focus:bg-white uppercase font-black" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECCIÓN DE ESTATUS Y ACCIONES (PROMINENTES) */}
              <div className="p-12 bg-slate-50 border-t-8 border-white space-y-12 sticky left-0 z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-[0.3em] flex items-center gap-4">
                      <span className="w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-pulse"></span>
                      Estatus del Seguimiento del Cliente
                    </label>
                    <textarea 
                      value={concentradoForm.estatus_detalle} 
                      onChange={e => handleConcentradoChange('estatus_detalle', e.target.value)}
                      placeholder="Escribe el estado actual detallado..."
                      className="w-full h-48 p-8 rounded-[2rem] border-4 border-white shadow-2xl focus:border-blue-500 focus:ring-0 outline-none text-lg font-bold text-slate-800 resize-none transition-all placeholder:text-slate-200"
                    ></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-[0.3em] flex items-center gap-4">
                      <span className="w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]"></span>
                      Acción Inmediata a Realizar
                    </label>
                    <textarea 
                      value={concentradoForm.accion_realizar} 
                      onChange={e => handleConcentradoChange('accion_realizar', e.target.value)}
                      placeholder="Escribe la siguiente tarea clave..."
                      className="w-full h-48 p-8 rounded-[2rem] border-4 border-white shadow-2xl focus:border-blue-500 focus:ring-0 outline-none text-lg font-bold text-blue-900 resize-none transition-all placeholder:text-slate-200"
                    ></textarea>
                  </div>
                </div>

                <div className="flex justify-center pt-6">
                  <button 
                    onClick={handleSaveConcentrado} 
                    disabled={isSavingConcentrado} 
                    className="bg-blue-600 text-white px-32 py-8 rounded-[2.5rem] font-black uppercase tracking-[0.4em] shadow-[0_30px_60px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all text-base border-b-[12px] border-blue-800"
                  >
                    {isSavingConcentrado ? 'SINCRONIZANDO...' : 'Finalizar y Guardar Cambios'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entregables' && (
            <div className="max-w-3xl p-12">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-10 text-slate-900">Control de Capacitación</h2>
              <div className="space-y-5">
                {hitosCapacitacion.map((h) => {
                  const s = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id);
                  const done = s?.estatus === 'completado';
                  return (
                    <label key={h.id} className={`flex items-center p-8 border-4 rounded-3xl cursor-pointer transition-all ${done ? 'bg-green-50 border-green-300 shadow-inner' : 'hover:bg-slate-50 border-slate-100 shadow-sm'}`}>
                      <input type="checkbox" checked={done} onChange={e => handleToggleHito(h.id.toString(), e.target.checked)} className="w-8 h-8 mr-6 rounded-xl border-2 border-slate-300 text-blue-600 focus:ring-blue-500 transition-all" />
                      <span className={`font-black uppercase text-base tracking-tighter ${done ? 'line-through text-green-700 opacity-40' : 'text-slate-800'}`}>{h.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'bitacora' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 p-12">
              <div className="bg-slate-50 p-12 rounded-[3rem] border-4 border-white shadow-2xl">
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-10 flex items-center gap-4">
                  <span className="w-5 h-5 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></span>
                  Nuevo Registro
                </h3>
                <form action={async f => { const r = await agregarNotaBitacora(f); if(r.success) (document.getElementById('form-bitacora') as HTMLFormElement)?.reset(); else alert(r.error); }} id="form-bitacora" className="space-y-10">
                  <input type="hidden" name="expediente_id" value={selectedExpediente.id} />
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Resumen de Actividad</label>
                    <textarea name="nota" required rows={7} className="w-full p-8 border-4 border-white rounded-[2rem] shadow-inner focus:border-blue-500 outline-none text-lg font-bold text-slate-800 transition-all" placeholder="Describe los avances logrados hoy..."></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Próximo Contacto</label>
                    <input type="date" name="fecha_proximo_seguimiento" required className="w-full p-8 border-4 border-white rounded-[2rem] shadow-inner focus:border-blue-500 outline-none text-xl font-black text-slate-900" />
                  </div>
                  <div className="flex justify-end pt-6"><SubmitButton label="GUARDAR EN BITÁCORA" className="w-full py-8 rounded-[2rem] font-black tracking-widest shadow-2xl shadow-blue-200 text-base" /></div>
                </form>
              </div>
              <div className="space-y-10 relative">
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 flex items-center gap-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Línea de Tiempo del Expediente
                </h3>
                
                <div className="relative overflow-y-auto max-h-[800px] pr-6 pl-4 custom-scrollbar">
                  {/* Línea vertical central/lateral */}
                  <div className="absolute left-9 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-slate-200 to-transparent rounded-full"></div>

                  <div className="space-y-12 relative">
                    {bitacoraOrdenada.map((n, index) => (
                      <div key={n.id} className="relative pl-20 group">
                        {/* Nodo de la línea de tiempo */}
                        <div className={`absolute left-7 top-0 w-5 h-5 rounded-full border-4 border-white shadow-lg transition-all duration-500 z-10 
                          ${index === 0 ? 'bg-blue-600 scale-125 ring-4 ring-blue-100' : 'bg-slate-300 group-hover:bg-blue-400 group-hover:scale-110'}`}>
                        </div>

                        {/* Etiqueta de Fecha Flotante */}
                        <div className="absolute left-[-10px] top-[-5px] hidden xl:block w-24 text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">
                            {new Date(n.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </p>
                          <p className="text-[14px] font-black text-slate-900">
                            {new Date(n.created_at).getFullYear()}
                          </p>
                        </div>

                        <div className="p-8 border-4 border-slate-50 rounded-[2.5rem] bg-white shadow-md hover:border-blue-100 hover:shadow-2xl transition-all group-hover:-translate-y-1">
                          <div className="flex justify-between items-center mb-6">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                  {n.autor?.nombre_completo?.split(' ')[0] || 'SISTEMA'}
                                </span>
                                <strong className="text-slate-900 text-xs uppercase font-black tracking-widest">
                                  {n.autor?.nombre_completo}
                                </strong>
                              </div>
                              <p className="text-[10px] text-blue-600 font-black uppercase tracking-[0.2em]">
                                {new Date(n.created_at).toLocaleDateString('es-MX', { dateStyle: 'full' })}
                              </p>
                            </div>
                            {n.fecha_proximo_seguimiento && (
                              <div className="bg-amber-50 border-2 border-amber-100 px-4 py-2 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Próximo Seguimiento</p>
                                <p className="text-[11px] font-black text-amber-900 uppercase">
                                  {new Date(n.fecha_proximo_seguimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="relative">
                            <svg className="absolute -left-4 -top-4 w-10 h-10 text-slate-50 opacity-50" fill="currentColor" viewBox="0 0 32 32"><path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H7c0-1.7 1.3-3 3-3V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-7c0-1.7 1.3-3 3-3V8z"></path></svg>
                            <p className="text-lg text-slate-700 leading-relaxed font-bold group-hover:text-slate-900 transition-colors uppercase tracking-tight relative z-10">
                              {n.nota}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {bitacoraOrdenada.length === 0 && (
                      <div className="text-center py-32">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        </div>
                        <p className="text-slate-200 font-black uppercase text-xl tracking-[0.5em]">Sin registros aún</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
