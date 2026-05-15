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
  const [activeTab, setActiveTab] = useState<'etapa_legal' | 'cronograma_legal' | 'entregables' | 'bitacora'>('etapa_legal');
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
      
      // --- Calcular datos automáticos desde la información del expediente ---
      const cliente = (selectedExpediente as any).cliente;
      const contrato = selectedExpediente.contratos?.[0];
      const pagos = selectedExpediente.pagos || [];
      const asesora = (selectedExpediente as any).asesora;

      // Pagos: separar inicial de subsecuentes
      const pagoInicial = pagos.find(p => p.es_pago_inicial);
      const pagosSubsecuentes = pagos.filter(p => !p.es_pago_inicial);
      const todosPagos = pagos; // Contar TODOS, verificados o no

      // Cálculos financieros sobre TODOS los pagos registrados
      const montoInicial = pagoInicial ? Number(pagoInicial.monto || 0) : 0;
      const totalPagado = todosPagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
      const montoContrato = Number(contrato?.monto_total || 0);
      const saldo = montoContrato - totalPagado;
      
      // Último pago registrado (de cualquier tipo)
      const pagosSorted = [...todosPagos].sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime());
      const ultimoPago = pagosSorted.length > 0 ? pagosSorted[0] : null;

      // Plan de pagos a texto legible
      const planTexto: Record<string, string> = {
        'unico': 'PAGO ÚNICO (CONTADO)',
        '2_meses': '2 MENSUALIDADES',
        '4_meses': '4 MENSUALIDADES',
      };
      const periodicidad = contrato?.plan_pagos ? (planTexto[contrato.plan_pagos] || contrato.plan_pagos) : '';

      // Cantidad a cobrar próximo pago
      let cantidadProximo = '';
      if (contrato?.plan_pagos === 'unico') {
        cantidadProximo = saldo > 0 ? `$${saldo.toLocaleString()}` : '$0';
      } else if (contrato?.plan_pagos === '2_meses' && saldo > 0) {
        cantidadProximo = `$${saldo.toLocaleString()}`;
      } else if (contrato?.plan_pagos === '4_meses' && saldo > 0) {
        const pagosRestantes = Math.max(1, 4 - todosPagos.length);
        cantidadProximo = `$${Math.ceil(saldo / pagosRestantes).toLocaleString()}`;
      }

      // CLUNI: si el servicio extra incluye CLUNI
      const tieneCLUNI = selectedExpediente.servicios_extra?.includes('CLUNI');

      // Fecha de contrato
      const fechaContrato = contrato?.created_at 
        ? new Date(contrato.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

      // Fecha último pago
      const fechaUltimoPago = ultimoPago
        ? new Date(ultimoPago.fecha_pago).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

      // Campos que se calculan en vivo como sugerencia inteligente
      const camposVivos: Record<string, string> = {
        total_contrato: montoContrato > 0 ? `$${montoContrato.toLocaleString()}` : '',
        periodicidad_pagos: periodicidad,
        num_pagos_realizados: todosPagos.length > 0 ? todosPagos.length.toString() : '0',
        cantidad_pagada_acumulada: totalPagado > 0 ? `$${totalPagado.toLocaleString()}` : '$0',
        saldo_cliente: montoContrato > 0 ? `$${saldo.toLocaleString()}` : '',
        fecha_ultimo_pago: fechaUltimoPago,
        cantidad_cobrar_proximo: cantidadProximo,
      };

      // Valores automáticos (se usan si la celda está vacía en la DB)
      const defaults: Record<string, string> = {
        estado: cliente?.estado || '',
        telefono_cliente: cliente?.telefono || '',
        cluni: tieneCLUNI ? 'SÍ - INCLUIDO' : 'NO APLICA',
        vendedora: asesora?.nombre_completo || '',
        fecha_contrato: fechaContrato,
      };

      // Merge: Priorizar lo que ya está en DB. Si está vacío, usar el cálculo vivo/sugerencia.
      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach(campo => {
        const dbValue = (dbData as any)[campo] || '';
        // Si hay valor en DB se respeta, si no, se usa el calculado/default
        newForm[campo] = dbValue || camposVivos[campo] || defaults[campo] || '';
      });
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
  const hitosLegales = hitos.filter(h => h.orden < 100);
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
                <th className="px-6 py-5 text-left">Empresa / Proyecto</th>
                <th className="px-6 py-5 text-left">Cliente</th>
                <th className="px-6 py-5 text-center">Avance Legal</th>
                <th className="px-6 py-5 text-left">Fase Actual</th>
                <th className="px-6 py-5 text-center">WhatsApp</th>
                <th className="px-6 py-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {expedientes.map(exp => {
                const nombreCliente = (exp as any).cliente?.nombre_completo || 'Sin nombre';
                const tel = (exp as any).cliente?.telefono;
                const whatsappUrl = tel ? `https://wa.me/52${tel.replace(/\D/g, '')}` : null;
                
                // Calcular progreso legal
                const completados = hitosLegales.filter(h => exp.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length;
                const totalHL = hitosLegales.length;
                const pct = totalHL > 0 ? Math.round((completados / totalHL) * 100) : 0;
                
                // Determinar fase actual (primer hito NO completado)
                const faseActual = hitosLegales.find(h => exp.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus !== 'completado');
                const faseNombre = pct === 100 ? 'COMPLETADO' : faseActual?.nombre || 'Sin iniciar';
                
                return (
                  <tr key={exp.id} className="hover:bg-blue-50/50 transition-all group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="font-black text-slate-900 uppercase tracking-tighter text-sm group-hover:text-blue-600 transition-colors">
                          {exp.nombre_empresa}
                        </div>
                        {exp.servicios_extra?.includes('REGULARIZACION') && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-amber-200">⚠ REG</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{exp.figura?.descripcion}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-slate-800 font-bold text-xs uppercase">{nombreCliente}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                        <span className={`text-lg font-black ${pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-blue-600' : pct > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{pct}%</span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold">{completados}/{totalHL} hitos</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${pct === 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {faseNombre}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {tel ? (
                        <a href={whatsappUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-green-600 hover:text-white transition-all border border-green-100 uppercase tracking-widest">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {tel}
                        </a>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => setSelectedExpedienteId(exp.id)} 
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black transition-all shadow-lg hover:bg-slate-800 hover:scale-105 active:scale-95 uppercase tracking-widest"
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
  const docPago = selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_pago')?.url_archivo;
  const contrato = selectedExpediente.contratos?.[0];
  const urlContratoFinal = contrato?.url_pdf_doble_firma;
  const urlContratoCliente = contrato?.url_pdf_firmado_cliente;
  const urlContratoBorrador = contrato?.url_pdf_generado;
  const estadoContrato = urlContratoFinal ? 'doble_firma' : urlContratoCliente ? 'firmado_cliente' : urlContratoBorrador ? 'generado' : 'none';
  const urlContratoMostrar = urlContratoFinal || urlContratoCliente || urlContratoBorrador;
  const telCliente = (selectedExpediente as any).cliente?.telefono;
  const waUrl = telCliente ? `https://wa.me/52${telCliente.replace(/\D/g, '')}` : null;
  const bitacoraOrdenada = [...(selectedExpediente.bitacora || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={closeDetail} className="flex items-center text-slate-400 hover:text-slate-800 font-black text-xs uppercase tracking-widest group transition-colors">
          <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Panel
        </button>
        {activeTab === 'etapa_legal' && (
          <button onClick={handleSaveConcentrado} disabled={isSavingConcentrado} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 transition-all uppercase text-[10px] tracking-widest">
            {isSavingConcentrado ? 'Guardando...' : '✓ Guardar Cambios'}
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-8">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black uppercase tracking-tighter">{selectedExpediente.nombre_empresa}</h1>
              {selectedExpediente.servicios_extra?.includes('REGULARIZACION') && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">⚠ Cotizar Contabilidad</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px]">
              <span className="text-slate-500 font-black uppercase tracking-widest">Cliente: <span className="text-white text-sm tracking-normal">{(selectedExpediente as any).cliente?.nombre_completo}</span></span>
              <span className="text-slate-500 font-black uppercase tracking-widest">Figura: <span className="text-sky-400 text-sm tracking-normal">{selectedExpediente.figura?.descripcion}</span></span>
              <span className="text-slate-500 font-black uppercase tracking-widest">Asesora: <span className="text-white text-sm tracking-normal">{(selectedExpediente as any).asesora?.nombre_completo || 'Sin asignar'}</span></span>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[280px]">
            {/* Contrato */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">📄 Contrato</span>
                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${estadoContrato === 'doble_firma' ? 'bg-emerald-500/20 text-emerald-400' : estadoContrato === 'firmado_cliente' ? 'bg-amber-500/20 text-amber-400' : estadoContrato === 'generado' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                  {estadoContrato === 'doble_firma' ? '✓ Doble Firma' : estadoContrato === 'firmado_cliente' ? '⏳ Falta Directora' : estadoContrato === 'generado' ? '⏳ Sin Firmas' : '✕ No Generado'}
                </span>
              </div>
              {urlContratoMostrar && (
                <a href={urlContratoMostrar} target="_blank" className={`block w-full px-4 py-3 rounded-xl font-black text-center text-[10px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 ${estadoContrato === 'doble_firma' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/30' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/30'}`}>
                  {estadoContrato === 'doble_firma' ? '↓ Descargar Contrato Final' : '↗ Ver Contrato'}
                </a>
              )}
            </div>
            {/* Documentos del Expediente */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 pl-1">Documentos del expediente</span>
              <div className="grid grid-cols-3 gap-1.5">
                {docIneFrente && <a href={docIneFrente} target="_blank" className="bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[8px] py-2 rounded-lg text-center uppercase font-black hover:bg-sky-500/20 transition-all">🪪 INE Frente</a>}
                {docIneReverso && <a href={docIneReverso} target="_blank" className="bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[8px] py-2 rounded-lg text-center uppercase font-black hover:bg-sky-500/20 transition-all">🪪 INE Reverso</a>}
                {docComprobante && <a href={docComprobante} target="_blank" className="bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[8px] py-2 rounded-lg text-center uppercase font-black hover:bg-violet-500/20 transition-all">🏠 Domicilio</a>}
                {docPago && <a href={docPago} target="_blank" className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[8px] py-2 rounded-lg text-center uppercase font-black hover:bg-emerald-500/20 transition-all">💰 Pago</a>}
                {waUrl && <a href={waUrl} target="_blank" rel="noreferrer" className="bg-green-500/10 text-green-300 border border-green-500/20 text-[8px] py-2 rounded-lg text-center uppercase font-black hover:bg-green-500/20 transition-all">💬 WhatsApp</a>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <nav className="flex overflow-x-auto border-b border-slate-100">
          {['etapa_legal', 'cronograma_legal', 'entregables', 'bitacora'].map((tab) => {
            const labels: Record<string, string> = { etapa_legal: '📊 Concentración', cronograma_legal: '⚖️ Cronograma Legal', entregables: '🎓 Capacitación', bitacora: '📝 Bitácora' };
            return (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-4 px-8 text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap ${activeTab === tab ? 'border-b-[3px] border-blue-600 text-blue-700 bg-blue-50/50' : 'border-b-[3px] border-transparent text-slate-400 hover:text-slate-600'}`}>
                {labels[tab]}
              </button>
            );
          })}
          </nav>

        <div className="bg-white">
          {activeTab === 'etapa_legal' && (
            <div className="p-6 md:p-8 space-y-5">
              {/* SECCIÓN 1 y 2: Trámite + Finanzas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. Datos del Trámite */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 border-l-4 border-l-blue-500 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500 text-white rounded-md flex items-center justify-center text-[9px]">1</span>
                    Datos del Trámite
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: 'Estado / Entidad', c: 'estado', p: 'Ej: CDMX' },
                      { l: 'Actividad', c: 'actividad', p: 'Ej: Construcción' },
                      { l: 'CLUNI', c: 'cluni', p: 'SÍ / NO' },
                      { l: 'Estatus RPP', c: 'estatus_rpp', p: 'Ej: Inscrito' },
                      { l: 'Notaría', c: 'notaria', p: 'Ej: Notaría 45' },
                      { l: 'Pago a Notario', c: 'pago_notario', p: 'Ej: $3,500' },
                    ].map(f => (
                      <div key={f.c} className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{f.l}</label>
                        <input type="text" value={concentradoForm[f.c] || ''} onChange={e => handleConcentradoChange(f.c, e.target.value)} placeholder={f.p} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 uppercase transition-all placeholder:text-slate-300 placeholder:normal-case" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Finanzas */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 border-l-4 border-l-emerald-500 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-500 text-white rounded-md flex items-center justify-center text-[9px]">2</span>
                    Finanzas del Contrato
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: 'Total de Contrato', c: 'total_contrato', p: '$75,000' },
                      { l: 'Periodicidad', c: 'periodicidad_pagos', p: 'Ej: Pago Único' },
                      { l: 'Próximo Cobro', c: 'cantidad_cobrar_proximo', p: '$0' },
                      { l: '# Pagos Realizados', c: 'num_pagos_realizados', p: '0' },
                      { l: 'Aportación Total Recibida', c: 'cantidad_pagada_acumulada', p: '$0' },
                    ].map(f => (
                      <div key={f.c} className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                          {f.l}
                        </label>
                        <input 
                          type="text" 
                          value={concentradoForm[f.c] || ''} 
                          onChange={e => handleConcentradoChange(f.c, e.target.value)} 
                          placeholder={f.p} 
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 uppercase transition-all" 
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-red-500">
                        Saldo Pendiente
                      </label>
                      <input 
                        type="text" 
                        value={concentradoForm.saldo_cliente || ''} 
                        onChange={e => handleConcentradoChange('saldo_cliente', e.target.value)} 
                        placeholder="$0" 
                        className="w-full px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 focus:border-red-500 focus:bg-white outline-none text-sm font-black text-red-600 uppercase transition-all" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3, 4, 5: Operación + Reuniones + Seguimiento */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 3. Operación */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 border-l-4 border-l-slate-400 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-slate-400 text-white rounded-md flex items-center justify-center text-[9px]">3</span>
                    Operación
                  </h3>
                  <div className="space-y-3">
                    {[
                      { l: 'Fecha Último Pago', c: 'fecha_ultimo_pago', p: 'DD/MM/AAAA' },
                      { l: 'Quién Cobra', c: 'quien_cobra', p: 'Nombre' },
                      { l: 'Vendedora', c: 'vendedora', p: 'Nombre' },
                      { l: 'Fecha Contrato', c: 'fecha_contrato', p: 'DD/MM/AAAA' },
                    ].map(f => (
                      <div key={f.c} className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{f.l}</label>
                        <input type="text" value={concentradoForm[f.c] || ''} onChange={e => handleConcentradoChange(f.c, e.target.value)} placeholder={f.p} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 uppercase transition-all placeholder:text-slate-300 placeholder:normal-case" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Reuniones */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 border-l-4 border-l-indigo-500 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-indigo-500 text-white rounded-md flex items-center justify-center text-[9px]">4</span>
                    Reuniones
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Link de Reunión</label>
                      <input type="text" value={concentradoForm.link_reunion || ''} onChange={e => handleConcentradoChange('link_reunion', e.target.value)} placeholder="URL" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-blue-600 transition-all placeholder:text-slate-300" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Fecha Reunión</label>
                      <input type="text" value={concentradoForm.fecha_reunion_acuerdos || ''} onChange={e => handleConcentradoChange('fecha_reunion_acuerdos', e.target.value)} placeholder="Ej: 20 May 11AM" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 uppercase transition-all placeholder:text-slate-300 placeholder:normal-case" />
                    </div>
                  </div>
                </div>

                {/* 5. Seguimiento */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 border-l-4 border-l-amber-500 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-amber-500 text-white rounded-md flex items-center justify-center text-[9px]">5</span>
                    Seguimiento
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Estatus del Cliente</label>
                      <textarea value={concentradoForm.estatus_detalle || ''} onChange={e => handleConcentradoChange('estatus_detalle', e.target.value)} placeholder="Estado actual..." className="w-full h-24 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 resize-none transition-all placeholder:text-slate-300"></textarea>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Acción Inmediata</label>
                      <textarea value={concentradoForm.accion_realizar || ''} onChange={e => handleConcentradoChange('accion_realizar', e.target.value)} placeholder="Siguiente tarea..." className="w-full h-24 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none text-sm font-semibold text-slate-800 resize-none transition-all placeholder:text-slate-300"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cronograma_legal' && (
            <div className="max-w-4xl p-12">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Cronograma Legal</h2>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em] mt-1">Seguimiento de Proceso SAT / RPP / CLUNI</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 border-2 border-emerald-200 px-6 py-3 rounded-2xl">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Avance</p>
                    <p className="text-2xl font-black text-emerald-700">
                      {hitosLegales.length > 0 
                        ? Math.round((hitosLegales.filter(h => selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length / hitosLegales.length) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Barra de Progreso Visual */}
              <div className="w-full h-3 bg-slate-100 rounded-full mb-12 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${hitosLegales.length > 0 ? (hitosLegales.filter(h => selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length / hitosLegales.length) * 100 : 0}%` }}
                />
              </div>

              <div className="space-y-3">
                {hitosLegales.map((h, index) => {
                  const s = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id);
                  const done = s?.estatus === 'completado';
                  const isUpdating = updatingHitoId === h.id.toString();
                  return (
                    <div key={h.id} className={`p-5 border rounded-2xl transition-all ${done ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 mt-0.5 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {done ? '✓' : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-black uppercase text-sm tracking-tight block ${done ? 'line-through text-emerald-700/50' : 'text-slate-800'}`}>
                            {h.nombre}
                          </span>
                          {h.descripcion && (
                            <p className={`text-[11px] mt-1 leading-relaxed ${done ? 'text-emerald-600/50' : 'text-slate-400'}`}>
                              {h.descripcion}
                            </p>
                          )}
                          {done && s?.fecha_completado && (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1 inline-block">
                              ✓ {new Date(s.fecha_completado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleHito(h.id.toString(), !done)}
                          disabled={isUpdating}
                          className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${
                            done 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600 border border-emerald-200 hover:border-red-200' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                          } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {isUpdating ? '...' : done ? 'Completado' : 'Marcar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {hitosLegales.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-slate-300 font-black uppercase text-lg tracking-widest">No hay hitos legales configurados</p>
                    <p className="text-slate-400 text-xs mt-2">Contacta al administrador para agregar el catálogo de hitos legales.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'entregables' && (
            <div className="max-w-6xl p-8 md:p-12">
              {/* Encabezado Distintivo para Capacitación */}
              <div className="bg-indigo-900 rounded-[2rem] p-8 mb-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="bg-indigo-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] mb-4 inline-block shadow-lg">
                      Módulo Operativo
                    </span>
                    <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Control de Capacitación</h2>
                    <p className="text-indigo-200 text-sm font-medium max-w-md">
                      Seguimiento de la transferencia de conocimientos y entrega de herramientas operativas a la organización.
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-[1.5rem] min-w-[180px] text-center">
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Progreso de Entrega</p>
                    <p className="text-5xl font-black text-white">
                      {hitosCapacitacion.length > 0
                        ? Math.round((hitosCapacitacion.filter(h => selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length / hitosCapacitacion.length) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid de 2 Columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hitosCapacitacion.map((h, index) => {
                  const s = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id);
                  const done = s?.estatus === 'completado';
                  const isUpdating = updatingHitoId === h.id.toString();
                  
                  return (
                    <div 
                      key={h.id} 
                      className={`relative group p-6 rounded-[2rem] border-2 transition-all duration-300 ${
                        done 
                        ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1'
                      }`}
                    >
                      {/* Número Flotante */}
                      <div className={`absolute -top-3 -left-3 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:scale-110 ${
                        done ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-100 text-slate-300'
                      }`}>
                        {index + 1}
                      </div>

                      <div className="ml-8 space-y-4">
                        <div>
                          <h4 className={`font-black uppercase text-base tracking-tight leading-tight ${done ? 'text-indigo-900/40 line-through' : 'text-slate-900'}`}>
                            {h.nombre}
                          </h4>
                          <p className={`text-[11px] mt-2 font-medium leading-relaxed ${done ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {h.descripcion || 'Sin descripción disponible.'}
                          </p>
                        </div>

                        {/* Sección Explicativa de la Labor de la Abogada */}
                        <div className={`p-4 rounded-xl border ${done ? 'bg-white/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                          <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Labor de la Abogada
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold leading-snug">
                            Supervisa la sesión técnica, resuelve dudas operativas del cliente y valida la correcta asimilación del material entregado.
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="h-8">
                            {done && s?.fecha_completado && (
                              <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                ✓ {new Date(s.fecha_completado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleToggleHito(h.id.toString(), !done)}
                            disabled={isUpdating}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              done 
                                ? 'bg-indigo-100 text-indigo-700 hover:bg-red-50 hover:text-red-600' 
                                : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg'
                            } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {isUpdating ? '...' : done ? 'Entregado' : 'Marcar Entrega'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hitosCapacitacion.length === 0 && (
                <div className="text-center py-32 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <p className="text-slate-300 font-black uppercase text-xl tracking-[0.5em]">Sin hitos de capacitación</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bitacora' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 p-12">
              <div className="bg-slate-50 p-12 rounded-[3rem] border-4 border-white shadow-2xl">
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 mb-10 flex items-center gap-4">
                  <span className="w-5 h-5 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></span>
                  Nuevo Registro
                </h3>
                <form action={async f => { const r = await agregarNotaBitacora(f); if(r.success) (document.getElementById('form-bitacora') as HTMLFormElement)?.reset(); else alert(r.error); }} id="form-bitacora" className="space-y-6">
                  <input type="hidden" name="expediente_id" value={selectedExpediente.id} />
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Resumen de Actividad</label>
                    <textarea name="nota" required rows={5} className="w-full p-6 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-base font-bold text-slate-800 transition-all" placeholder="Describe los avances logrados hoy..."></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Próximo Contacto</label>
                      <input type="date" name="fecha_proximo_seguimiento" required className="w-full p-5 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-base font-black text-slate-900" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Hora</label>
                      <input type="time" name="hora" className="w-full p-5 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none text-base font-black text-slate-900" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2"><SubmitButton label="GUARDAR EN BITÁCORA" className="w-full py-6 rounded-2xl font-black tracking-widest shadow-lg text-sm" /></div>
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
                                {n.hora && <span className="text-slate-400 ml-2">• {n.hora.substring(0, 5)} hrs</span>}
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
