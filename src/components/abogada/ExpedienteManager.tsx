'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { marcarHitoCompletado, agregarNotaBitacora, guardarDatosConcentrado, agregarIntegrante } from '@/actions/abogada';
import { logoutAbogada } from '@/actions/auth-abogada';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';
import type { CatalogoHito, TipoDocumento, ExpedienteIntegrante } from '@/types/database';
import type { ExpedienteAbogada } from '@/app/abogada/page';
import { Search, Building2, User, FileText, ClipboardList, BookOpen, MessageSquare, ExternalLink, ShieldAlert, CheckCircle2, Clock, FileUp, AlertCircle, Users } from 'lucide-react';

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

function DocumentItem({ label, url, type, onUpload, isUploading, integranteId }: { label: string, url?: string | null, type: string, onUpload: (file: File, type: string, integranteId?: string) => void, isUploading: boolean, integranteId?: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-all group relative">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${url ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
          {isUploading ? '...' : url ? '✓' : '—'}
        </div>
        <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {url ? (
          <a href={url} target="_blank" className="text-blue-600 hover:text-blue-800 transition-colors">
            <ExternalLink size={14} />
          </a>
        ) : (
          <label className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors">
            <FileUp size={14} />
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf" 
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file, type, integranteId);
              }} 
            />
          </label>
        )}
      </div>
    </div>
  );
}

function DocumentStage({ title, docs, color, onUpload, uploadingType, integranteId }: { title: string, docs: any[], color: string, onUpload: (file: File, type: string, integranteId?: string) => void, uploadingType: string | null, integranteId?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-50 text-blue-900',
    indigo: 'border-indigo-500 bg-indigo-50 text-indigo-900',
    violet: 'border-violet-500 bg-violet-50 text-violet-900',
    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  };

  return (
    <div className={`rounded-[2rem] border-2 p-6 space-y-4 shadow-sm h-full ${colors[color] || colors.blue}`}>
      <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-current opacity-50"></span>
        {title}
      </h3>
      <div className="space-y-2">
        {docs.map((doc, i) => (
          <DocumentItem 
            key={i} 
            {...doc} 
            onUpload={onUpload} 
            isUploading={uploadingType === (integranteId ? `${doc.type}_${integranteId}` : doc.type)} 
            integranteId={integranteId}
          />
        ))}
      </div>
    </div>
  );
}

export default function ExpedienteManager({ expedientes, hitos, alertasHoy }: ExpedienteManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpedienteId, setSelectedExpedienteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etapa_legal' | 'documentacion' | 'cronograma_legal' | 'entregables' | 'bitacora'>('etapa_legal');
  const [updatingHitoId, setUpdatingHitoId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const CAMPOS_CONCENTRADO = [
    'asesora_encargada', 'estado', 'vendedora', 'telefono_cliente', 'objeto_social_ventas',
    'actividad', 'cluni', 'notaria', 'pago_notario', 'estatus_rpp',
    'total_contrato', 'periodicidad_pagos', 'pago_entrega_donataria', 'cantidad_cobrar_proximo', 
    'num_pagos_realizados', 'cantidad_pagada_acumulada', 'saldo_cliente', 'fecha_ultimo_pago', 'quien_cobra',
    'link_reunion', 'fecha_reunion_acuerdos', 'fecha_contrato',
    'estatus_detalle', 'accion_realizar', 'numero_control'
  ];

  const [concentradoForm, setConcentradoForm] = useState<Record<string, string>>({});
  const [isSavingConcentrado, setIsSavingConcentrado] = useState(false);

  const filteredExpedientes = expedientes.filter(exp => {
    const search = searchTerm.toLowerCase();
    const nombreEmpresa = exp.nombre_empresa.toLowerCase();
    const nombreCliente = (exp as any).cliente?.nombre_completo?.toLowerCase() || '';
    const numControl = (exp as any).numero_control?.toLowerCase() || '';
    return nombreEmpresa.includes(search) || nombreCliente.includes(search) || numControl.includes(search);
  });

  const selectedExpediente = expedientes.find(e => e.id === selectedExpedienteId) || null;

  const bitacoraOrdenada = useMemo(() => {
    if (!selectedExpediente?.bitacora) return [];
    return [...selectedExpediente.bitacora].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [selectedExpediente]);

  useEffect(() => {
    if (selectedExpediente) {
      const dbData = selectedExpediente.datos_concentrado?.[0] || {};
      const cliente = (selectedExpediente as any).cliente;
      const contrato = selectedExpediente.contratos?.[0];
      const pagos = selectedExpediente.pagos || [];
      const asesora = (selectedExpediente as any).asesora;

      const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
      const montoContrato = Number(contrato?.monto_total || 0);
      const saldo = montoContrato - totalPagado;

      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach(campo => {
        const dbValue = (dbData as any)[campo] || '';
        const defaults: any = {
          estado: cliente?.estado || '',
          telefono_cliente: cliente?.telefono || '',
          total_contrato: montoContrato > 0 ? `$${montoContrato.toLocaleString()}` : '',
          saldo_cliente: montoContrato > 0 ? `$${saldo.toLocaleString()}` : '',
          vendedora: asesora?.nombre_completo || '',
          numero_control: (selectedExpediente as any).numero_control || '',
          asesora_encargada: (dbData as any).asesora_encargada || '',
        };
        newForm[campo] = dbValue || defaults[campo] || '';
      });
      setConcentradoForm(newForm);
    }
  }, [selectedExpedienteId]);
  const handleConcentradoChange = (campo: string, valor: string) => {
    setConcentradoForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handleSaveConcentrado = async () => {
    if (!selectedExpediente) return;
    setIsSavingConcentrado(true);
    const res = await guardarDatosConcentrado(selectedExpediente.id, concentradoForm);
    if (!res.success) alert(res.error || 'Error al guardar');
    else {
      // Opcional: mostrar un toast o feedback de éxito
    }
    setIsSavingConcentrado(false);
  };

  const handleUpdateControl = async (val: string) => {
    if (!selectedExpediente) return;
    await guardarDatosConcentrado(selectedExpediente.id, { numero_control: val });
  };

  const handleToggleHito = async (hitoId: string, isCompleted: boolean) => {
    if (!selectedExpediente) return;
    setUpdatingHitoId(hitoId);
    await marcarHitoCompletado(selectedExpediente.id, hitoId, isCompleted);
    setUpdatingHitoId(null);
  };

  const handleLogout = async () => {
    if (confirm('¿Estás segura de que deseas cerrar sesión?')) {
      setIsLoggingOut(true);
      await logoutAbogada();
      window.location.reload();
    }
  };

  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const handleFileUpload = async (file: File, tipo: string) => {
    if (!selectedExpediente) return;
    setUploadingType(tipo);
    
    try {
      const carpetaEmpresa = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await subirArchivoR2Action(formData, `expedientes/${carpetaEmpresa}/documentacion`);
      if (!uploadRes.success || !uploadRes.data) throw new Error(uploadRes.error);

      const regRes = await registrarDocumento(selectedExpediente.id, tipo as TipoDocumento, uploadRes.data.url);
      if (!regRes.success) throw new Error(regRes.error);
    } catch (err: any) {
      alert(`Error al subir: ${err.message}`);
    } finally {
      setUploadingType(null);
    }
  };

  const closeDetail = () => { setSelectedExpedienteId(null); setActiveTab('etapa_legal'); };
  const hitosLegales = hitos.filter(h => h.orden < 100);
  const hitosCapacitacion = hitos.filter(h => h.orden >= 101);

  // --- RENDER DASHBOARD ---
  if (!selectedExpediente) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-slate-200">
              <span className="font-black text-2xl">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Panel Operativo Legal</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Gestión de Expedientes CECANI</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationStatusIndicator />
            <button onClick={handleLogout} className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors">Salir</button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por Empresa, Cliente o Nº Control..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 pl-14 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm transition-all"
          />
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-[2.5rem] shadow-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-slate-50 font-black text-slate-600 uppercase text-[11px] tracking-[0.2em]">
              <tr>
                <th className="px-6 py-5 text-left">Expediente / Control</th>
                <th className="px-6 py-5 text-left">Cliente</th>
                <th className="px-6 py-5 text-center">Avance Legal</th>
                <th className="px-6 py-5 text-center">WhatsApp</th>
                <th className="px-6 py-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredExpedientes.map(exp => {
                const nombreCliente = (exp as any).cliente?.nombre_completo || 'Sin nombre';
                const tel = (exp as any).cliente?.telefono;
                const completados = hitosLegales.filter(h => exp.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length;
                const pct = hitosLegales.length > 0 ? Math.round((completados / hitosLegales.length) * 100) : 0;
                
                return (
                  <tr key={exp.id} className="hover:bg-blue-50/50 transition-all group">
                    <td className="px-6 py-5">
                      <div className="font-black text-slate-900 uppercase tracking-tighter text-sm group-hover:text-blue-600 transition-colors">{exp.nombre_empresa}</div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{(exp as any).numero_control || 'S/N Control'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-slate-800 font-bold text-xs uppercase">{nombreCliente}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                        <span className={`text-sm font-black ${pct === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{pct}%</span>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {tel && (
                        <a href={`https://wa.me/52${tel.replace(/\D/g, '')}`} target="_blank" className="text-green-600 font-black text-[10px] uppercase tracking-widest hover:underline">{tel}</a>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button onClick={() => setSelectedExpedienteId(exp.id)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all uppercase tracking-widest">Gestionar</button>
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

  // --- RENDER DETALLE ---
  const docIneFrente = selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente')?.url_archivo;
  const docIneReverso = selectedExpediente.documentos?.find(d => d.tipo === 'ine_reverso')?.url_archivo;
  const docComprobante = selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_domicilio')?.url_archivo;
  const contrato = selectedExpediente.contratos?.[0];
  const urlContrato = contrato?.url_pdf_doble_firma || contrato?.url_pdf_firmado_cliente || contrato?.url_pdf_generado;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={closeDetail} className="flex items-center text-slate-400 hover:text-slate-800 font-black text-xs uppercase tracking-widest group">
          ← Volver al Panel
        </button>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº Control:</span>
          <input 
            type="text" 
            defaultValue={(selectedExpediente as any).numero_control || ''} 
            onBlur={e => handleUpdateControl(e.target.value)}
            placeholder="P-2026-001"
            className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none focus:border-blue-500 w-40"
          />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row justify-between gap-8 items-center border-4 border-slate-800">
        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{selectedExpediente.nombre_empresa}</h1>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Cliente: <span className="text-white">{(selectedExpediente as any).cliente?.nombre_completo}</span></span>
            <span>Figura: <span className="text-blue-400">{selectedExpediente.figura?.siglas}</span></span>
          </div>
        </div>
        <div className="flex gap-3">
          {urlContrato && <a href={urlContrato} target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20">Ver Contrato</a>}
          <a href={`https://wa.me/52${(selectedExpediente as any).cliente?.telefono?.replace(/\D/g, '')}`} target="_blank" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20">WhatsApp</a>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden min-h-[700px]">
        <nav className="flex overflow-x-auto bg-slate-50 border-b border-slate-100">
          {[
            { id: 'etapa_legal', label: 'Concentración', icon: <ClipboardList size={14} /> },
            { id: 'documentacion', label: 'Documentación', icon: <FileText size={14} /> },
            { id: 'cronograma_legal', label: 'Cronograma', icon: <Clock size={14} /> },
            { id: 'entregables', label: 'Capacitación', icon: <BookOpen size={14} /> },
            { id: 'bitacora', label: 'Bitácora', icon: <MessageSquare size={14} /> },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 py-5 px-8 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 border-b-4 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-8">
          {activeTab === 'etapa_legal' && (
            <div className="space-y-10">
              {/* SECCIÓN CRÍTICA: SITUACIÓN ACTUAL (Separada) */}
              <div className="bg-amber-50 border-4 border-amber-200 rounded-[3rem] p-10 shadow-2xl shadow-amber-900/5 space-y-8">
                <div className="flex items-center gap-4 border-b border-amber-200 pb-6">
                  <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><AlertCircle size={24} /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-amber-900">Situación Operativa Actual</h3>
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mt-1">Estatus Crítico y Próximos Pasos</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-amber-800 tracking-[0.2em] ml-1">Estatus Detallado (Reporte Excel)</label>
                    <textarea 
                      value={concentradoForm.estatus_detalle || ''} 
                      onChange={e => handleConcentradoChange('estatus_detalle', e.target.value)} 
                      className="w-full bg-white border-2 border-amber-100 rounded-[2rem] p-6 text-xs font-bold uppercase text-amber-950 outline-none focus:border-amber-500 min-h-[120px] shadow-inner resize-none"
                      placeholder="Describa el estado actual del trámite..."
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-amber-800 tracking-[0.2em] ml-1">Acción Inmediata a Realizar</label>
                    <textarea 
                      value={concentradoForm.accion_realizar || ''} 
                      onChange={e => handleConcentradoChange('accion_realizar', e.target.value)} 
                      className="w-full bg-white border-2 border-amber-100 rounded-[2rem] p-6 text-xs font-bold uppercase text-amber-950 outline-none focus:border-amber-500 min-h-[120px] shadow-inner resize-none"
                      placeholder="¿Qué se debe hacer a continuación?"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* 1. Perfil y Ventas */}
                <ConcentradoCard title="1. Perfil y Asignación" color="slate">
                  {[
                    { l: 'Asesora Encargada (Legal)', c: 'asesora_encargada' },
                    { l: 'Vendedora (Comercial)', c: 'vendedora' },
                    { l: 'Estado (Ubicación)', c: 'estado' },
                    { l: 'Teléfono Directo', c: 'telefono_cliente' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                </ConcentradoCard>

                {/* 2. Gestión Legal */}
                <ConcentradoCard title="2. Gestión Legal y Notaría" color="blue">
                  {[
                    { l: 'Actividad Principal', c: 'actividad' },
                    { l: 'Número CLUNI', c: 'cluni' },
                    { l: 'Estatus RPP', c: 'estatus_rpp' },
                    { l: 'Notaría Protocolizó', c: 'notaria' },
                    { l: 'Pago Notario (Responsable)', c: 'pago_notario' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                </ConcentradoCard>

                {/* 3. Estructura Financiera */}
                <ConcentradoCard title="3. Estructura de Contrato" color="indigo">
                  {[
                    { l: 'Total del Contrato', c: 'total_contrato' },
                    { l: 'Periodicidad de Pagos', c: 'periodicidad_pagos' },
                    { l: 'Pago Entrega Donataria', c: 'pago_entrega_donataria' },
                    { l: 'Fecha de Contrato', c: 'fecha_contrato' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                </ConcentradoCard>

                {/* 4. Control de Pagos */}
                <ConcentradoCard title="4. Control de Cobranza" color="emerald" className="lg:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { l: 'Saldo del Cliente', c: 'saldo_cliente' },
                      { l: 'Monto Acumulado', c: 'cantidad_pagada_acumulada' },
                      { l: 'Núm. Pagos Realizados', c: 'num_pagos_realizados' },
                      { l: 'Cant. Próximo Cobro', c: 'cantidad_cobrar_proximo' },
                      { l: 'Fecha Último Pago', c: 'fecha_ultimo_pago' },
                      { l: 'Quien Cobra o Negocia', c: 'quien_cobra' },
                    ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                  </div>
                </ConcentradoCard>

                {/* 5. Acuerdos y Logística */}
                <ConcentradoCard title="5. Logística y Acuerdos" color="violet">
                  <div className="space-y-4">
                    {[
                      { l: 'Link de Reunión', c: 'link_reunion' },
                      { l: 'Fecha Reunión Acuerdos', c: 'fecha_reunion_acuerdos' },
                    ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-violet-600 tracking-widest">Objeto Social (Ventas)</label>
                      <textarea 
                        value={concentradoForm.objeto_social_ventas || ''} 
                        onChange={e => handleConcentradoChange('objeto_social_ventas', e.target.value)} 
                        className="w-full bg-violet-50 border border-violet-100 rounded-xl px-4 py-2 text-[10px] font-bold uppercase outline-none focus:border-violet-500 min-h-[80px] resize-none"
                        placeholder="Detalles captados por ventas..."
                      />
                    </div>
                  </div>
                </ConcentradoCard>
              </div>

              <div className="flex justify-end pt-6">
                <button onClick={handleSaveConcentrado} disabled={isSavingConcentrado} className="bg-slate-900 text-white px-16 py-6 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-800 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  {isSavingConcentrado ? 'Sincronizando...' : 'Guardar Cambios en Concentrado'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'documentacion' && (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* 1. Etapa: Venta */}
                <DocumentStage 
                  title="1. Cierre de Venta" color="blue"
                  onUpload={handleFileUpload}
                  uploadingType={uploadingType}
                  docs={[
                    { label: 'Contrato Firmado', type: 'contrato_firmado', url: contrato?.url_pdf_doble_firma || contrato?.url_pdf_firmado_cliente },
                    { label: 'Comprobante de Pago', type: 'comprobante_pago', url: selectedExpediente.pagos?.[0]?.url_comprobante },
                  ]}
                />

                {/* 2. Etapa: Integración Personal (MULTI-PERSONA) */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="flex items-center justify-between bg-indigo-900/5 p-6 rounded-[2rem] border border-indigo-100">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-900">2. Integración del Expediente (Asociados)</h3>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">Se requiere documentación de al menos 3 integrantes</p>
                    </div>
                    <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
                      <Users size={14} /> Añadir Integrante
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Iteración de Integrantes (Simulado por ahora, se conectará a la tabla) */}
                    {[1, 2, 3].map((num) => (
                      <DocumentStage 
                        key={num}
                        title={`Asociado ${num}`} color="indigo"
                        onUpload={handleFileUpload}
                        uploadingType={uploadingType}
                        docs={[
                          { label: 'INE (Frente/Vuelta)', type: `ine_asociado_${num}`, url: null },
                          { label: 'CURP Actualizada', type: `curp_asociado_${num}`, url: null },
                          { label: 'Constancia Fiscal (CSF)', type: `csf_asociado_${num}`, url: null },
                          { label: 'Comprobante Domicilio', type: `domicilio_asociado_${num}`, url: null },
                        ]}
                      />
                    ))}
                  </div>
                </div>

                {/* 3. Etapa: Economía */}
                <DocumentStage 
                  title="3. Nombre y Estructura" color="violet"
                  onUpload={handleFileUpload}
                  uploadingType={uploadingType}
                  docs={[
                    { label: 'Autorización de Nombre', type: 'autorizacion_nombre', url: (selectedExpediente.documentos?.find(d => d.tipo === 'autorizacion_nombre'))?.url_archivo },
                    { label: '3 Propuestas de Nombre', type: 'propuestas_nombre', url: (selectedExpediente.documentos?.find(d => d.tipo === 'propuestas_nombre'))?.url_archivo },
                  ]}
                />

                {/* 4. Etapa: Notaría */}
                <DocumentStage 
                  title="4. Protocolización" color="emerald"
                  onUpload={handleFileUpload}
                  uploadingType={uploadingType}
                  docs={[
                    { label: 'Proyecto de Acta', type: 'proyecto_word', url: (selectedExpediente.documentos?.find(d => d.tipo === 'proyecto_word'))?.url_archivo },
                    { label: 'Acta Firmada', type: 'acta_asamblea', url: (selectedExpediente.documentos?.find(d => d.tipo === 'acta_asamblea'))?.url_archivo },
                    { label: 'Testimonio Notarial', type: 'testimonio_notarial', url: (selectedExpediente.documentos?.find(d => d.tipo === 'testimonio_notarial'))?.url_archivo },
                  ]}
                />

                {/* 5. Etapa: SAT */}
                <DocumentStage 
                  title="5. SAT y Registro" color="blue"
                  onUpload={handleFileUpload}
                  uploadingType={uploadingType}
                  docs={[
                    { label: 'Acuse de Cita SAT', type: 'acuse_cita_sat', url: (selectedExpediente.documentos?.find(d => d.tipo === 'acuse_cita_sat'))?.url_archivo },
                    { label: 'RFC Asociación Civil', type: 'rfc_moral', url: (selectedExpediente.documentos?.find(d => d.tipo === 'rfc_moral'))?.url_archivo },
                    { label: 'Inscripción RPP', type: 'inscripcion_rpp', url: (selectedExpediente.documentos?.find(d => d.tipo === 'inscripcion_rpp'))?.url_archivo },
                  ]}
                />

                {/* 6. Etapa: Donataria */}
                <DocumentStage 
                  title="6. Donataria y CLUNI" color="indigo"
                  onUpload={handleFileUpload}
                  uploadingType={uploadingType}
                  docs={[
                    { label: 'Acreditación Actividades', type: 'constancia_acreditacion', url: (selectedExpediente.documentos?.find(d => d.tipo === 'constancia_acreditacion'))?.url_archivo },
                    { label: 'Oficio de Autorización', type: 'oficio_donataria', url: (selectedExpediente.documentos?.find(d => d.tipo === 'oficio_donataria'))?.url_archivo },
                  ]}
                />
              </div>

              <div className="bg-slate-900 border-4 border-slate-800 rounded-[3rem] p-10 text-white space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <h4 className="text-xs font-black uppercase text-sky-400 tracking-[0.3em] flex items-center gap-3">
                    <ShieldAlert size={20} />
                    Protocolo de Seguridad Documental
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 leading-relaxed max-w-2xl">
                    Para avanzar a la siguiente etapa, todos los documentos de la fase actual deben estar cargados. 
                    <span className="text-white"> Ningún usuario (excepto Administrador) tiene permitido eliminar o sobrescribir archivos</span> una vez validados por el sistema.
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-sky-500/10 transition-all duration-1000" />
              </div>
            </div>
          )}

          {activeTab === 'cronograma_legal' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Avance del Trámite</h2>
                <div className="bg-blue-600 text-white px-6 py-2 rounded-xl text-lg font-black tracking-widest shadow-xl">
                  {hitosLegales.length > 0 ? Math.round((hitosLegales.filter(h => selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length / hitosLegales.length) * 100) : 0}%
                </div>
              </div>
              <div className="space-y-4">
                {hitosLegales.map((h, i) => {
                  const done = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado';
                  return (
                    <div key={h.id} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between ${done ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${done ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{i + 1}</div>
                        <div>
                          <h4 className={`font-black uppercase tracking-tight ${done ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>{h.nombre}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h.descripcion || '—'}</p>
                        </div>
                      </div>
                      <button onClick={() => handleToggleHito(h.id.toString(), !done)} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${done ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-600 text-white'}`}>
                        {done ? 'Completado' : 'Marcar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'entregables' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white flex justify-between items-center shadow-2xl">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Control de Capacitación</h2>
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-2">Seguimiento de entregas operativas</p>
                </div>
                <div className="text-5xl font-black">{hitosCapacitacion.length > 0 ? Math.round((hitosCapacitacion.filter(h => selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length / hitosCapacitacion.length) * 100) : 0}%</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hitosCapacitacion.map(h => {
                  const done = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado';
                  return (
                    <div key={h.id} className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between gap-4 ${done ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div>
                        <h4 className={`font-black uppercase tracking-tight text-sm ${done ? 'text-indigo-900 line-through' : 'text-slate-900'}`}>{h.nombre}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{h.descripcion || '—'}</p>
                      </div>
                      <button onClick={() => handleToggleHito(h.id.toString(), !done)} className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${done ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-600 text-white'}`}>
                        {done ? 'Entregado' : 'Marcar Entrega'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'bitacora' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-slate-100 space-y-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Nuevo Registro de Bitácora</h3>
                <form action={async f => { const r = await agregarNotaBitacora(f); if(r.success) (document.getElementById('form-bitacora') as HTMLFormElement)?.reset(); else alert(r.error); }} id="form-bitacora" className="space-y-4">
                  <input type="hidden" name="expediente_id" value={selectedExpediente.id} />
                  <textarea name="nota" required rows={5} className="w-full p-6 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-xs font-bold text-slate-800 uppercase" placeholder="Describe los avances o acuerdos..."></textarea>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" name="fecha_proximo_seguimiento" required className="w-full p-4 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none text-xs font-black uppercase" />
                    <input type="time" name="hora" className="w-full p-4 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none text-xs font-black uppercase" />
                  </div>
                  <SubmitButton label="GUARDAR EN BITÁCORA" className="w-full py-5 rounded-xl font-black tracking-widest text-[10px]" />
                </form>
              </div>
              <div className="space-y-6 overflow-y-auto max-h-[600px] pr-4 custom-scrollbar">
                {bitacoraOrdenada.map(n => (
                  <div key={n.id} className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                      <span className="text-blue-600">{n.autor?.nombre_completo}</span>
                      <span className="text-slate-400">{new Date(n.created_at).toLocaleDateString()} {n.hora?.substring(0, 5)}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 uppercase leading-relaxed">{n.nota}</p>
                    {n.fecha_proximo_seguimiento && <div className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Prox. Seguimiento: {new Date(n.fecha_proximo_seguimiento).toLocaleDateString()}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Componentes Auxiliares para el Concentrado ---

function ConcentradoCard({ title, children, color, className = "" }: any) {
  const colors: any = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };

  return (
    <div className={`p-8 rounded-[2.5rem] border-2 shadow-sm space-y-6 ${colors[color] || colors.slate} ${className}`}>
      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b border-current/10 pb-4">{title}</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function ConcentradoField({ l, c, value, onChange }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase opacity-50 tracking-widest ml-1">{l}</label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={e => onChange(c, e.target.value)} 
        className="w-full bg-white border border-black/5 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-current/20 transition-all"
      />
    </div>
  );
}
