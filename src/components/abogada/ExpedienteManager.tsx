'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { marcarHitoCompletado, guardarDatosConcentrado, agregarIntegrante } from '@/actions/abogada';
import { logoutAbogada } from '@/actions/auth-abogada';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento, eliminarDocumentoAction } from '@/actions/documentos';
import { crearRecordatorio, actualizarEstatusRecordatorio } from '@/actions/recordatorios';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';
import type { CatalogoHito, TipoDocumento, Recordatorio, ExpedienteIntegrante } from '@/types/database';
import type { ExpedienteAbogada } from '@/app/abogada/page';
import { 
  Search, Building2, User, FileText, ClipboardList, BookOpen, 
  ExternalLink, CheckCircle2, Clock, FileUp, 
  AlertCircle, Users, Loader2, Bell, MessageCircle, 
  Calendar, Trash2, CheckSquare, ChevronRight,
  AlertTriangle, Info, Mail, MapPin, UserPlus
} from 'lucide-react';
import { PLANES_PAGO_LABELS } from '@/lib/constants';

interface ExpedienteManagerProps {
  expedientes: ExpedienteAbogada[];
  hitos: CatalogoHito[];
  alertasHoy: ExpedienteAbogada[];
}

const CECANI_EMAIL = 'cecani.sc@gmail.com';

// --- UTILIDADES ---
const getUrgencyColor = (fecha: string) => {
  const hoy = new Date().toISOString().split('T')[0];
  if (fecha < hoy) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (fecha === hoy) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
};

const getHitoTemplates = (hitoNombre: string, empresa: string, abogada: string, fecha: string, hora?: string) => {
  const [year, month, day] = fecha.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  
  const fechaFmt = localDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const horaFmt = hora ? ` a las *${hora} HRS*` : '';
  
  const abogadaLimpio = abogada === 'de CECANI' || !abogada ? 'de CECANI' : abogada;
  
  const base = `Hola, le saluda la abogada *${abogadaLimpio}* respecto al proceso de *${empresa}*.\n\nLe recordamos nuestro compromiso para el día *${fechaFmt.toUpperCase()}*${horaFmt}.\n\n`;

  const requestDocsStr = `Para continuar con el proceso y aprovechar nuestra cita, es indispensable que nos envíe o tenga listos los siguientes documentos:\n\n`;

  const templates: Record<string, { tipo: string, titulo: string, mensaje: string, sugerencias: string[] }> = {
    'Videollamada de bienvenida': {
      tipo: 'meet_cliente',
      titulo: 'Videollamada de Bienvenida',
      mensaje: `${base}El objetivo es conocer sus necesidades y explicarle el paso a paso legal. ¿Confirmamos la asistencia?`,
      sugerencias: []
    },
    'Definir objeto social': {
      tipo: 'seguimiento',
      titulo: 'Definición de Objeto Social',
      mensaje: `${base}Necesitamos platicar sobre las actividades de su asociación para redactar los estatutos. Favor de tener a la mano:`,
      sugerencias: ['Actividades sociales deseadas', 'Identificaciones de socios', 'Comprobante de domicilio']
    },
    'Solicitar nombres': {
      tipo: 'seguimiento',
      titulo: 'Trámite de Denominación (Economía)',
      mensaje: `${base}Requerimos las opciones de nombres para ingresar la solicitud ante la Secretaría de Economía.`,
      sugerencias: ['3 opciones de nombre en orden de prioridad']
    },
    'Requerir documentos': {
      tipo: 'entrega_docs',
      titulo: 'Requerimiento de Documentación Oficial',
      mensaje: `${base}Para integrar su expediente conforme al Manual Legal, solicitamos la siguiente documentación de CADA ASOCIADO en formato PDF legible (no fotos) al correo *${CECANI_EMAIL}*:\n\n`,
      sugerencias: ['INE AMBOS LADOS', 'CURP ACTUALIZADA', 'CONSTANCIA SITUACIÓN FISCAL', 'COMPROBANTE DOMICILIO', 'E.FIRMA VIGENTE']
    },
    'Cita en Notaría': {
      tipo: 'cita_notaria',
      titulo: 'Firma de Acta en Notaría',
      mensaje: `${base}Es indispensable que el Representante Legal acuda con su identificación original. Documentos a presentar:`,
      sugerencias: ['INE ORIGINAL', 'CURP IMPRESA', 'COPIA DEL PROYECTO DE ACTA']
    }
  };

  const selected = templates[hitoNombre] || {
    tipo: 'seguimiento',
    titulo: `Seguimiento: ${hitoNombre}`,
    mensaje: `${base}${requestDocsStr}`,
    sugerencias: []
  };

  return selected;
};

const DOCS_CATALOGO = [
  'INE ASOCIADO', 'CURP ASOCIADO', 'CONSTANCIA SITUACIÓN FISCAL', 
  'COMPROBANTE DOMICILIO', 'E.FIRMA (.CER / .KEY)', 'PROYECTO DE ACTA',
  'TESTIMONIO NOTARIAL', 'COPIA CERTIFICADA', 'ACUSE CITA SAT', 'RFC MORAL'
];

// --- COMPONENTES ---

function DocumentItem({ label, url, type, onUpload, isUploading, integranteId, docId, onDelete }: { label: string, url?: string | null, type: string, onUpload: (file: File, type: string, integranteId?: string) => void, isUploading: boolean, integranteId?: string, docId?: string, onDelete: (id: string, url: string) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-400 transition-all group shadow-sm">
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${url ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : url ? <CheckCircle2 size={22} /> : <FileText size={20} />}
        </div>
        <div className="min-w-0">
          <span className="text-xs md:text-sm font-bold uppercase text-slate-900 tracking-tight block truncate">{label}</span>
          <span className="text-[9px] md:text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{url ? 'Validado' : 'Pendiente'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {url ? (
          <div className="flex gap-1.5 md:gap-2">
            <a href={`/api/r2/download?url=${encodeURIComponent(url)}`} target="_blank" className="p-2 md:p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm">
              <ExternalLink size={16} />
            </a>
            <button 
              onClick={() => onDelete(docId!, url)}
              className="p-2 md:p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm"
              title="Eliminar por equivocación"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <label className="p-2 md:p-2.5 cursor-pointer bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm border border-slate-200">
            <FileUp size={16} />
            <input type="file" className="hidden" accept=".pdf" disabled={isUploading} onChange={(e) => { const f = e.target.files?.[0]; if(f) onUpload(f, type, integranteId); }} />
          </label>
        )}
      </div>
    </div>
  );
}

function DocumentStage({ title, docs, color, onUpload, uploadingType, integranteId, onDelete }: { title: string, docs: any[], color: string, onUpload: (file: File, type: string, integranteId?: string) => void, uploadingType: string | null, integranteId?: string, onDelete: (id: string, url: string) => void }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-300 bg-blue-50/50 text-blue-900',
    violet: 'border-violet-300 bg-violet-50/50 text-violet-900',
    emerald: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
    indigo: 'border-indigo-300 bg-indigo-50/50 text-indigo-900',
  };

  return (
    <div className={`rounded-3xl border-2 p-5 md:p-6 space-y-4 md:space-y-6 shadow-lg h-full transition-all hover:scale-[1.01] ${colors[color] || colors.blue}`}>
      <div className="flex items-center justify-between border-b-2 border-current/10 pb-4">
        <h3 className="text-sm md:text-base font-bold uppercase tracking-wider flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-current shadow-sm"></div>
          {title}
        </h3>
        <div className="bg-white/70 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold uppercase shadow-sm">
          {docs.filter(d => d.url).length} / {docs.length}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {docs.map((doc, i) => (
          <DocumentItem 
            key={i} 
            {...doc} 
            onUpload={onUpload} 
            isUploading={uploadingType === (integranteId ? `${doc.type}_${integranteId}` : doc.type)} 
            integranteId={integranteId}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default function ExpedienteManager({ expedientes, hitos, alertasHoy }: ExpedienteManagerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpedienteId, setSelectedExpedienteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etapa_legal' | 'documentacion' | 'seguimiento_proceso' | 'entregables'>('etapa_legal');
  const [updatingHitoId, setUpdatingHitoId] = useState<string | null>(null);
  const [hitosLocales, setHitosLocales] = useState<Record<string, boolean>>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Estados para Recordatorios
  const [showReminderForm, setShowReminderForm] = useState<string | null>(null);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [reminderView, setReminderView] = useState<'flow' | 'list'>('flow');

  // Estados para Integrantes
  const [nuevoIntegrante, setNuevoIntegrante] = useState('');
  const [isAgregandoIntegrante, setIsAgregandoIntegrante] = useState(false);

  const CAMPOS_CONCENTRADO = [
    'asesora_encargada', 'estado', 'telefono_cliente', 'objeto_social_ventas',
    'actividad', 'cluni', 'notaria', 'pago_notario', 'estatus_rpp',
    'total_contrato', 'periodicidad_pagos', 'pago_entrega_donataria', 'cantidad_cobrar_proximo',
    'num_pagos_realizados', 'cantidad_pagada_acumulada', 'saldo_cliente', 'fecha_ultimo_pago', 'quien_cobra',
    'fecha_contrato', 'numero_control', 'folio_rpp', 'volumen_rpp', 'libro_rpp'
  ];

  const [concentradoForm, setConcentradoForm] = useState<Record<string, string>>({});
  const [isSavingConcentrado, setIsSavingConcentrado] = useState(false);

  const filteredExpedientes = useMemo(() => {
    return expedientes.filter(exp => {
      const search = searchTerm.toLowerCase();
      const nombreEmpresa = exp.nombre_empresa.toLowerCase();
      const nombreCliente = (exp as any).cliente?.nombre_completo?.toLowerCase() || '';
      const numControl = (exp as any).numero_control?.toLowerCase() || '';
      return nombreEmpresa.includes(search) || nombreCliente.includes(search) || numControl.includes(search);
    });
  }, [expedientes, searchTerm]);

  const selectedExpediente = expedientes.find(e => e.id === selectedExpedienteId) || null;

  useEffect(() => { setHitosLocales({}); }, [selectedExpedienteId]);

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
      const totalPagosNum = pagos.length;
      const fechaUltimoPago = pagos.length > 0
        ? pagos.sort((a, b) => new Date(b.fecha_pago || b.created_at).getTime() - new Date(a.fecha_pago || a.created_at).getTime())[0]?.fecha_pago || pagos[0]?.created_at?.split('T')[0] || ''
        : '';
      const planPagosLabel = contrato?.plan_pagos ? (PLANES_PAGO_LABELS[contrato.plan_pagos] || contrato.plan_pagos) : '';
      const fechaContrato = contrato?.created_at ? contrato.created_at.split('T')[0] : '';

      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach(campo => {
        const dbValue = (dbData as any)[campo] || '';
        const defaults: any = {
          estado: cliente?.estado || '',
          telefono_cliente: cliente?.telefono || '',
          total_contrato: montoContrato > 0 ? `$${montoContrato.toLocaleString()}` : '',
          saldo_cliente: montoContrato > 0 ? `$${saldo.toLocaleString()}` : '',
          cantidad_pagada_acumulada: totalPagado > 0 ? `$${totalPagado.toLocaleString()}` : '',
          num_pagos_realizados: totalPagosNum > 0 ? String(totalPagosNum) : '',
          fecha_ultimo_pago: fechaUltimoPago,
          periodicidad_pagos: planPagosLabel,
          fecha_contrato: fechaContrato,
          asesora_encargada: asesora?.nombre_completo || (dbData as any).asesora_encargada || '',
          actividad: (selectedExpediente as any).figura?.descripcion || (dbData as any).actividad || '',
        };
        newForm[campo] = dbValue || defaults[campo] || '';
      });
      setConcentradoForm(newForm);
    }
  }, [selectedExpedienteId, selectedExpediente]);

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

  const handleUpdateControl = async (val: string) => {
    if (!selectedExpediente) return;
    await guardarDatosConcentrado(selectedExpediente.id, { numero_control: val });
  };

  const handleToggleHito = async (hitoId: string, isCompleted: boolean) => {
    if (!selectedExpediente) return;
    setUpdatingHitoId(hitoId);
    setHitosLocales(prev => ({ ...prev, [hitoId]: isCompleted }));
    const res = await marcarHitoCompletado(selectedExpediente.id, hitoId, isCompleted);
    if (!(res as any)?.success) {
      setHitosLocales(prev => { const n = { ...prev }; delete n[hitoId]; return n; });
      alert('Error al actualizar el paso');
    } else {
      router.refresh();
    }
    setUpdatingHitoId(null);
  };

  const handleAddIntegrante = async () => {
    if (!selectedExpediente || !nuevoIntegrante) return;
    setIsAgregandoIntegrante(true);
    const res = await agregarIntegrante(selectedExpediente.id, nuevoIntegrante);
    if (res.success) {
      setNuevoIntegrante('');
      router.refresh();
    } else {
      alert(res.error);
    }
    setIsAgregandoIntegrante(false);
  };

  const handleLogout = async () => {
    if (confirm('¿Estás segura de que deseas cerrar sesión?')) {
      setIsLoggingOut(true);
      await logoutAbogada();
      window.location.reload();
    }
  };

  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const handleFileUpload = async (file: File, tipo: string, integranteId?: string) => {
    if (!selectedExpediente) return;
    const typeKey = integranteId ? `${tipo}_${integranteId}` : tipo;
    setUploadingType(typeKey);
    
    try {
      const carpetaEmpresa = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await subirArchivoR2Action(formData, `expedientes/${carpetaEmpresa}/documentacion`);
      if (!uploadRes.success || !uploadRes.data) throw new Error(uploadRes.error);

      // Usamos 'otro' como fallback si el enum falla, o mapeamos nombres antiguos
      const regRes = await registrarDocumento(selectedExpediente.id, tipo as TipoDocumento, uploadRes.data.url, integranteId);
      if (!regRes.success) throw new Error(regRes.error);
      router.refresh();
    } catch (err: any) {
      alert(`Error al subir: ${err.message}`);
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteDocument = async (docId: string, url: string) => {
    if(!confirm('¿Estás segura de eliminar este documento? Esta acción no se puede deshacer.')) return;
    const res = await eliminarDocumentoAction(docId, url);
    if (res.success) {
      router.refresh();
    } else {
      alert('Error al eliminar: ' + res.error);
    }
  };

  const closeDetail = () => { setSelectedExpedienteId(null); setActiveTab('etapa_legal'); setShowReminderForm(null); setSelectedReminderId(null); };
  const hitosLegales = hitos.filter(h => h.orden < 100);
  const hitosCapacitacion = hitos.filter(h => h.orden >= 101);

  // --- RENDER DASHBOARD ---
  if (!selectedExpediente) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-900 rounded-[2.2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-200">
              <span className="font-black text-4xl">C</span>
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Panel Operativo Legal</h1>
              <p className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Gestión Centralizada CECANI</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <NotificationStatusIndicator />
            <button onClick={handleLogout} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors">Cerrar Sesión</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-12 text-white space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex justify-between items-start">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-4">
                  <Calendar size={32} className="text-blue-400" /> Agenda Estratégica
                </h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Compromisos prioritarios para hoy</p>
              </div>
              <div className="bg-blue-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">
                {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {alertasHoy.length > 0 ? alertasHoy.slice(0, 4).map(a => (
                <div key={a.id} className="bg-white/5 border-2 border-white/10 rounded-3xl p-6 flex items-center justify-between group/item hover:bg-white/10 transition-all cursor-pointer" onClick={() => setSelectedExpedienteId(a.id)}>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase text-blue-400 tracking-widest">{a.nombre_empresa}</p>
                    <p className="text-sm font-bold uppercase truncate">{(a as any).cliente?.nombre_completo}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover/item:bg-blue-600 transition-all">
                    <ChevronRight size={20} />
                  </div>
                </div>
              )) : (
                <div className="col-span-2 py-12 text-center space-y-4 opacity-20 border-2 border-dashed border-white/20 rounded-[2.5rem]">
                  <CheckSquare size={56} className="mx-auto" />
                  <p className="text-sm font-black uppercase tracking-[0.3em]">Sin pendientes críticos registrados</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-rose-50 border-8 border-white rounded-3xl p-12 space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 text-rose-100"><AlertTriangle size={120} /></div>
             <h2 className="text-2xl font-bold uppercase tracking-widest text-rose-900 flex items-center gap-4 relative z-10">
               Urgencias
             </h2>
             <div className="space-y-6 relative z-10">
               <p className="text-xs font-bold text-rose-600 uppercase leading-relaxed tracking-wide">Atienda de inmediato los expedientes con retraso documental para evitar multas o rechazos de Notaría/SAT.</p>
               <div className="w-full h-3 bg-rose-200 rounded-full overflow-hidden shadow-inner">
                 <div className="h-full bg-rose-600 shadow-lg" style={{ width: '65%' }}></div>
               </div>
             </div>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={32} />
          <input 
            type="text" 
            placeholder="Buscar por Empresa, Cliente o Nº Control..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border-4 border-slate-50 rounded-full py-8 pl-20 pr-12 text-lg font-bold text-slate-800 outline-none focus:border-blue-500 shadow-xl shadow-slate-200/50 transition-all"
          />
        </div>

        <div className="bg-white border-8 border-slate-50 rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr] bg-slate-900 px-12 py-8 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            <span>Expediente / Control</span>
            <span>Titular / Cliente</span>
            <span className="text-center">Progreso de Gestión</span>
            <span className="text-center">Docs</span>
            <span className="text-center">Acción</span>
          </div>
          <div className="divide-y-4 divide-slate-50">
            {filteredExpedientes.map(exp => {
              const nombreCliente = (exp as any).cliente?.nombre_completo || 'Sin nombre';
              const completadosExp = hitosLegales.filter(h => exp.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado').length;
              const totalExp = hitosLegales.length;
              const hasAlert = alertasHoy.some(a => a.id === exp.id);

              return (
                <div key={exp.id} className={`grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr] items-center px-12 py-10 hover:bg-slate-50/80 transition-all group ${hasAlert ? 'bg-rose-50/20' : ''}`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="font-black text-slate-900 uppercase tracking-tighter text-2xl group-hover:text-blue-600 transition-colors">{exp.nombre_empresa}</span>
                      {hasAlert && <span className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-200 animate-pulse"></span>}
                    </div>
                    <span className="text-[11px] text-slate-400 font-black uppercase tracking-[0.35em] block">{(exp as any).numero_control || 'SIN CONTROL'}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-800 font-bold text-base uppercase truncate">{nombreCliente}</p>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><MapPin size={12}/> {(exp as any).cliente?.estado || 'S/U'}</p>
                  </div>
                  <div className="flex flex-col items-center gap-4 px-10">
                    <div className="flex justify-between w-full text-[11px] font-black uppercase tracking-widest text-slate-600">
                      <span>FASE {completadosExp} DE {totalExp}</span>
                      <span className="bg-slate-100 px-3 py-1 rounded-lg">{Math.round((completadosExp / totalExp) * 100)}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-50 shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${completadosExp === totalExp ? 'bg-emerald-500' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`} style={{ width: `${(completadosExp / totalExp) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-center">
                     <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exp.documentos?.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                       {exp.documentos?.length || 0} ARCH
                     </span>
                  </div>
                  <div className="text-center">
                    <button onClick={() => setSelectedExpedienteId(exp.id)} className="bg-slate-900 text-white px-10 py-5 rounded-[1.5rem] text-[11px] font-black hover:bg-blue-600 transition-all uppercase tracking-widest shadow-2xl hover:-translate-y-1 active:scale-95">Gestionar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER DETALLE ---
  const contrato = selectedExpediente.contratos?.[0];
  const urlContrato = contrato?.url_pdf_doble_firma || contrato?.url_pdf_firmado_cliente || contrato?.url_pdf_generado;
  const recordatorios = (selectedExpediente as any).recordatorios || [] as Recordatorio[];
  const integrantes = (selectedExpediente as any).integrantes || [] as ExpedienteIntegrante[];

  return (
    <div className="max-w-[1800px] mx-auto px-4 md:px-8 py-8 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <button onClick={closeDetail} className="flex items-center gap-3 text-slate-500 hover:text-slate-900 font-bold text-xs md:text-sm uppercase tracking-widest group transition-all">
          <span className="p-2 md:p-2.5 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors">← Volver al Listado</span>
        </button>
        <div className="flex items-center gap-4 w-full md:w-auto">
           <NotificationStatusIndicator />
           <div className="hidden md:block h-8 w-px bg-slate-200" />
           <div className="flex items-center gap-3 flex-1 md:flex-initial justify-end">
             <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Nº Control:</span>
             <input type="text" defaultValue={(selectedExpediente as any).numero_control || ''} onBlur={e => handleUpdateControl(e.target.value)} className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs md:text-sm font-bold uppercase outline-none focus:border-blue-600 w-full md:w-48 shadow-sm transition-all" />
           </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 lg:p-10 text-white flex flex-col lg:flex-row justify-between gap-8 items-center shadow-xl relative overflow-hidden">
        <div className="space-y-4 relative z-10 text-center lg:text-left">
          <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tight leading-tight">{selectedExpediente.nombre_empresa}</h1>
          <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 text-xs font-medium text-slate-300 uppercase">
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl"><User size={16} className="text-blue-400" /> {(selectedExpediente as any).cliente?.nombre_completo}</span>
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl"><Building2 size={16} className="text-blue-400" /> {selectedExpediente.figura?.siglas}</span>
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl"><Mail size={16} className="text-blue-400" /> {CECANI_EMAIL}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full lg:w-auto">
          {urlContrato && <a href={urlContrato} target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5 text-center flex-1 lg:flex-initial">Ver Contrato</a>}
          <a href={`https://wa.me/52${(selectedExpediente as any).cliente?.telefono?.replace(/\D/g, '')}`} target="_blank" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-900/40 transition-all hover:-translate-y-0.5 text-center flex items-center justify-center gap-2 flex-1 lg:flex-initial"><MessageCircle size={16}/> Chat Directo</a>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] -ml-16 -mb-16 pointer-events-none" />
      </div>

      <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden min-h-[600px]">
        <nav className="flex overflow-x-auto bg-slate-50/50 border-b border-slate-100 p-3 gap-3 custom-scrollbar">
          {[
            { id: 'etapa_legal', label: 'Concentración de Datos', icon: <ClipboardList size={18} /> },
            { id: 'documentacion', label: 'Checklist Documental', icon: <FileText size={18} /> },
            { id: 'seguimiento_proceso', label: 'Gestión Legal y Agenda', icon: <Clock size={18} /> },
            { id: 'entregables', label: 'Capacitación CECANI', icon: <BookOpen size={18} /> },
          ].map((tab: any) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 md:gap-3 py-3 px-5 md:px-8 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-6 md:p-10">
          {activeTab === 'etapa_legal' && (
            <div className="space-y-16 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                <ConcentradoCard title="I. Identidad del Cliente" color="slate">
                  {[
                    { l: 'Asesora Asignada', c: 'asesora_encargada' },
                    { l: 'Estado / Entidad', c: 'estado' },
                    { l: 'Teléfono Contacto', c: 'telefono_cliente' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                </ConcentradoCard>

                <ConcentradoCard title="II. Detalles del Proceso" color="blue">
                  {[
                    { l: 'Figura Legal', c: 'actividad' },
                    { l: 'Número de Control', c: 'numero_control' },
                    { l: 'Notaría Designada', c: 'notaria' },
                    { l: 'Estatus Registro Propiedad', c: 'estatus_rpp' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                  <div className="grid grid-cols-3 gap-3">
                    <ConcentradoField l="Folio RPP" c="folio_rpp" value={concentradoForm.folio_rpp} onChange={handleConcentradoChange} />
                    <ConcentradoField l="Libro" c="libro_rpp" value={concentradoForm.libro_rpp} onChange={handleConcentradoChange} />
                    <ConcentradoField l="Vol." c="volumen_rpp" value={concentradoForm.volumen_rpp} onChange={handleConcentradoChange} />
                  </div>
                </ConcentradoCard>

                <ConcentradoCard title="III. Situación Financiera" color="emerald">
                  {[
                    { l: 'Inversión Total', c: 'total_contrato' },
                    { l: 'Esquema de Pagos', c: 'periodicidad_pagos' },
                    { l: 'Pagos Realizados', c: 'num_pagos_realizados' },
                    { l: 'Saldo Pendiente', c: 'saldo_cliente' },
                  ].map(f => <ConcentradoField key={f.c} {...f} value={concentradoForm[f.c]} onChange={handleConcentradoChange} />)}
                </ConcentradoCard>

                <ConcentradoCard title="IV. Redacción de Objeto Social (Acta)" color="violet" className="lg:col-span-3">
                  <div className="space-y-4">
                    <label className="text-[12px] font-black uppercase text-violet-600 tracking-[0.3em] ml-3">Descripción de Actividades para Cláusulas Legales</label>
                    <textarea value={concentradoForm.objeto_social_ventas || ''} onChange={e => handleConcentradoChange('objeto_social_ventas', e.target.value)} className="w-full bg-violet-50/30 border-4 border-violet-100 rounded-[2.5rem] p-10 text-base font-bold uppercase outline-none focus:border-violet-500 min-h-[250px] shadow-inner leading-relaxed" placeholder="Transcriba aquí los acuerdos sobre el objeto social..." />
                  </div>
                </ConcentradoCard>
              </div>

              <div className="flex justify-center pt-8">
                <button onClick={handleSaveConcentrado} disabled={isSavingConcentrado} className="flex items-center justify-center gap-4 bg-slate-900 text-white px-12 py-5 rounded-2xl text-xs md:text-sm font-bold uppercase tracking-widest shadow-xl hover:bg-blue-600 disabled:opacity-50 transition-all hover:-translate-y-0.5 active:scale-95 w-full md:w-auto">
                  {isSavingConcentrado ? <><Loader2 size={24} className="animate-spin" /> Guardando...</> : <><CheckSquare size={24} /> Sincronizar Datos</>}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'documentacion' && (
            <div className="space-y-12 md:space-y-16 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl gap-6">
                 <div className="space-y-1.5">
                   <h2 className="text-xl md:text-2xl font-bold uppercase tracking-wide flex items-center gap-3">
                     <Users size={24} className="text-blue-400"/> Gestión de Asociados
                   </h2>
                   <p className="text-[11px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">Cargue documentos para cada integrante de la A.C.</p>
                 </div>
                 <div className="flex w-full md:w-auto items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
                   <input 
                     type="text" 
                     placeholder="Nombre Completo del Asociado" 
                     value={nuevoIntegrante}
                     onChange={e => setNuevoIntegrante(e.target.value)}
                     className="bg-transparent text-xs md:text-sm font-bold uppercase outline-none px-4 w-full md:w-64"
                   />
                   <button 
                     onClick={handleAddIntegrante}
                     disabled={isAgregandoIntegrante || !nuevoIntegrante}
                     className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all shadow-md disabled:opacity-50 whitespace-nowrap"
                   >
                     {isAgregandoIntegrante ? 'Añadiendo...' : 'Agregar Asociado'}
                   </button>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-12">
                {integrantes.map((integ: any) => (
                  <div key={integ.id} className="space-y-6">
                    <div className="flex items-center gap-4 border-l-4 border-blue-600 pl-4">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md"><User size={20}/></div>
                      <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-slate-900">{integ.nombre_completo}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                      <DocumentItem label="INE Asociado" type="ine_frente" integranteId={integ.id} docId={selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente' && d.integrante_id === integ.id)?.id} url={selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente' && d.integrante_id === integ.id)?.url_archivo} onUpload={handleFileUpload} isUploading={uploadingType === `ine_frente_${integ.id}`} onDelete={handleDeleteDocument} />
                      <DocumentItem label="CURP Asociado" type="curp" integranteId={integ.id} docId={selectedExpediente.documentos?.find(d => d.tipo === 'curp' && d.integrante_id === integ.id)?.id} url={selectedExpediente.documentos?.find(d => d.tipo === 'curp' && d.integrante_id === integ.id)?.url_archivo} onUpload={handleFileUpload} isUploading={uploadingType === `curp_${integ.id}`} onDelete={handleDeleteDocument} />
                      <DocumentItem label="Constancia Fiscal" type="csf" integranteId={integ.id} docId={selectedExpediente.documentos?.find(d => d.tipo === 'csf' && d.integrante_id === integ.id)?.id} url={selectedExpediente.documentos?.find(d => d.tipo === 'csf' && d.integrante_id === integ.id)?.url_archivo} onUpload={handleFileUpload} isUploading={uploadingType === `csf_${integ.id}`} onDelete={handleDeleteDocument} />
                      <DocumentItem label="e.firma Rep." type="efirma_representante" integranteId={integ.id} docId={selectedExpediente.documentos?.find(d => d.tipo === 'efirma_representante' && d.integrante_id === integ.id)?.id} url={selectedExpediente.documentos?.find(d => d.tipo === 'efirma_representante' && d.integrante_id === integ.id)?.url_archivo} onUpload={handleFileUpload} isUploading={uploadingType === `efirma_representante_${integ.id}`} onDelete={handleDeleteDocument} />
                    </div>
                  </div>
                ))}

                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-l-4 border-emerald-500 pl-4">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md"><Building2 size={20}/></div>
                    <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-slate-900">Documentos de la Organización y Cliente</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <DocumentStage title="Identidad Titular" color="blue" onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument}
                      docs={[
                        { label: 'INE (Frente)', type: 'ine_frente', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente' && (!d.integrante_id || d.integrante_id === ''))?.id), url: (selectedExpediente.documentos?.find(d => d.tipo === 'ine_frente' && (!d.integrante_id || d.integrante_id === ''))?.url_archivo) },
                        { label: 'INE (Vuelta)', type: 'ine_reverso', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'ine_reverso' && (!d.integrante_id || d.integrante_id === ''))?.id), url: (selectedExpediente.documentos?.find(d => d.tipo === 'ine_reverso' && (!d.integrante_id || d.integrante_id === ''))?.url_archivo) },
                        { label: 'CURP Titular', type: 'curp', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'curp' && (!d.integrante_id || d.integrante_id === ''))?.id), url: (selectedExpediente.documentos?.find(d => d.tipo === 'curp' && (!d.integrante_id || d.integrante_id === ''))?.url_archivo) },
                        { label: 'Dom. Titular', type: 'comprobante_domicilio', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_domicilio' && (!d.integrante_id || d.integrante_id === ''))?.id), url: (selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_domicilio' && (!d.integrante_id || d.integrante_id === ''))?.url_archivo) },
                      ]}
                    />
                    <DocumentStage title="Venta y Registro" color="emerald" onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument}
                      docs={[
                        { label: 'Contrato Firmado', type: 'contrato_firmado', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'contrato_firmado' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'contrato_firmado' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                        { label: 'Boucher Pago', type: 'comprobante_pago', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_pago' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'comprobante_pago' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                      ]}
                    />
                    <DocumentStage title="Gestión Jurídica" color="violet" onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument}
                      docs={[
                        { label: 'Autorización Nombre', type: 'otro', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'otro' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'otro' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                        { label: 'Propuestas Nombre', type: 'otro', docId: (selectedExpediente.documentos?.filter(d => d.tipo === 'otro' && (!d.integrante_id || d.integrante_id === ''))?.[1])?.id, url: (selectedExpediente.documentos?.filter(d => d.tipo === 'otro' && (!d.integrante_id || d.integrante_id === ''))?.[1])?.url_archivo },
                        { label: 'Proyecto Acta', type: 'proyecto_word', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'proyecto_word' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'proyecto_word' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                      ]}
                    />
                    <DocumentStage title="Protocolización y RFC" color="indigo" onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument}
                      docs={[
                        { label: 'Testimonio Notarial', type: 'testimonio_notarial', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'testimonio_notarial' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'testimonio_notarial' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                        { label: 'Copia Certificada', type: 'acta_asamblea', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'acta_asamblea' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'acta_asamblea' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                        { label: 'Acuse Cita SAT', type: 'acuse_cita_sat', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'acuse_cita_sat' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'acuse_cita_sat' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                        { label: 'RFC Moral', type: 'rfc_moral', docId: (selectedExpediente.documentos?.find(d => d.tipo === 'rfc_moral' && (!d.integrante_id || d.integrante_id === '')))?.id, url: (selectedExpediente.documentos?.find(d => d.tipo === 'rfc_moral' && (!d.integrante_id || d.integrante_id === '')))?.url_archivo },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seguimiento_proceso' && (
            <div className="max-w-7xl mx-auto space-y-16 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row items-center justify-between gap-10 border-b-8 border-slate-50 pb-12">
                <div className="space-y-3 text-center md:text-left">
                  <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900">Gestión de Seguimiento</h2>
                  <p className="text-base font-bold text-slate-400 uppercase tracking-[0.4em]">Hitos legales y agenda de compromisos</p>
                </div>
                <div className="flex p-3 bg-slate-100 rounded-[2.5rem] gap-3 shadow-inner">
                  <button onClick={() => setReminderView('flow')} className={`px-12 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all ${reminderView === 'flow' ? 'bg-white shadow-2xl text-blue-600' : 'text-slate-500'}`}>Ruta Legal</button>
                  <button onClick={() => setReminderView('list')} className={`px-12 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all ${reminderView === 'list' ? 'bg-white shadow-2xl text-blue-600' : 'text-slate-500'}`}>Agenda ({recordatorios.length})</button>
                </div>
              </div>

              {reminderView === 'flow' ? (
                <div className="space-y-8">
                  {hitosLegales.map((h, i) => {
                    const done = h.id.toString() in hitosLocales ? hitosLocales[h.id.toString()] : selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado';
                    const isUpdating = updatingHitoId === h.id.toString();
                    const isFormOpen = showReminderForm === h.id.toString();

                    return (
                      <div key={h.id} className="group">
                        <div className={`flex flex-col md:flex-row items-center gap-10 p-12 rounded-[4rem] border-[6px] transition-all ${done ? 'bg-emerald-50/20 border-emerald-50 opacity-50' : 'bg-white border-slate-50 shadow-2xl shadow-slate-200/40 hover:border-blue-100'}`}>
                          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl font-black shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30'}`}>
                            {done ? <CheckCircle2 size={40} /> : i + 1}
                          </div>
                          <div className="flex-1 text-center md:text-left space-y-2">
                            <p className={`text-2xl font-black uppercase tracking-tight ${done ? 'text-emerald-700' : 'text-slate-900'}`}>{h.nombre}</p>
                            {h.descripcion && <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">{h.descripcion}</p>}
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-6">
                            {!done && (
                              <button onClick={() => setShowReminderForm(isFormOpen ? null : h.id.toString())} className={`flex items-center gap-4 px-10 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-lg ${isFormOpen ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-amber-500 hover:text-white'}`}>
                                <Bell size={22} /> {isFormOpen ? 'Cancelar' : 'Recordatorio'}
                              </button>
                            )}
                            <button onClick={() => handleToggleHito(h.id.toString(), !done)} disabled={isUpdating} className={`flex items-center gap-4 px-12 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all ${done ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}>
                              {isUpdating ? <Loader2 size={22} className="animate-spin" /> : done ? 'Completado' : 'Marcar Paso'}
                            </button>
                          </div>
                        </div>

                        {isFormOpen && (
                          <div className="mt-6 mx-8 p-12 bg-slate-900 rounded-[4rem] border-8 border-blue-500/20 text-white animate-in slide-in-from-top-8 duration-500 shadow-[0_50px_100px_rgba(37,99,235,0.15)]">
                             <ReminderForm hito={h} expediente={selectedExpediente} onSuccess={() => { setShowReminderForm(null); router.refresh(); }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                  {recordatorios.length > 0 ? recordatorios.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha)).map((r: any) => {
                    const isSelected = selectedReminderId === r.id;
                    const isDone = r.estatus === 'completado';
                    const tel = (selectedExpediente as any).cliente?.telefono?.replace(/\D/g, '');
                    const waLink = `https://wa.me/52${tel}?text=${encodeURIComponent(r.descripcion || '')}`;

                    return (
                      <div key={r.id} className="space-y-6">
                        <div onClick={() => setSelectedReminderId(isSelected ? null : r.id)} className={`flex items-center gap-10 p-10 rounded-[3.5rem] border-[6px] bg-white shadow-2xl cursor-pointer transition-all ${isSelected ? 'border-blue-500 ring-8 ring-blue-50' : getUrgencyColor(r.fecha)} ${isDone ? 'opacity-40 grayscale-50' : ''}`}>
                           <div className="w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center shrink-0 shadow-lg">
                             {isDone ? <CheckCircle2 size={40} className="text-emerald-500" /> : <Calendar size={40} />}
                           </div>
                           <div className="flex-1 space-y-2">
                             <div className="flex items-center gap-5">
                               <span className="text-[11px] font-black uppercase tracking-[0.25em] px-5 py-2 bg-white/60 rounded-xl shadow-sm">{r.tipo.replace('_', ' ')}</span>
                               <span className="text-xs font-black uppercase tracking-widest opacity-60">{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })} — {r.hora?.substring(0, 5) || 'HORA S/P'}</span>
                             </div>
                             <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900">{r.titulo}</h4>
                           </div>
                           <div className={`p-4 rounded-2xl bg-slate-50 transition-transform ${isSelected ? 'rotate-90 bg-blue-50 text-blue-600' : ''}`}><ChevronRight size={24} /></div>
                        </div>

                        {isSelected && (
                          <div className="mx-12 p-12 bg-slate-50 rounded-[4rem] border-4 border-slate-100 space-y-12 animate-in zoom-in-95 duration-300 shadow-2xl">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                               <div className="space-y-6">
                                 <h5 className="text-[12px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3"><MessageCircle size={16}/> Mensaje para WhatsApp</h5>
                                 <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 text-sm font-bold text-slate-800 leading-relaxed uppercase whitespace-pre-wrap shadow-inner">
                                   {r.descripcion}
                                 </div>
                               </div>
                               <div className="space-y-6">
                                 <h5 className="text-[12px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3"><FileText size={16}/> Documentos Solicitados</h5>
                                 {r.docs_requeridos?.length > 0 ? (
                                   <div className="grid grid-cols-1 gap-3">
                                     {r.docs_requeridos.map((d: string, i: number) => (
                                       <div key={i} className="px-6 py-4 bg-blue-100/50 text-blue-800 rounded-2xl text-[11px] font-black uppercase border-2 border-blue-100 flex items-center gap-3">
                                         <div className="w-2 h-2 rounded-full bg-blue-600"></div> {d}
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center text-[10px] font-black uppercase text-slate-300">No se requiere documentación adicional</div>
                                 )}
                               </div>
                             </div>
                             
                             <div className="flex flex-col sm:flex-row gap-6 pt-6">
                               <a href={waLink} target="_blank" className="flex-1 flex items-center justify-center gap-4 py-8 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all shadow-3xl shadow-emerald-200 hover:-translate-y-1">
                                 <MessageCircle size={24} /> Abrir WhatsApp con Plantilla
                               </a>
                               {!isDone && (
                                 <button onClick={async () => { await actualizarEstatusRecordatorio(r.id, selectedExpediente.id, 'completado'); router.refresh(); }} className="flex-1 flex items-center justify-center gap-4 py-8 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-3xl shadow-slate-200 hover:-translate-y-1">
                                   <CheckSquare size={24} /> Marcar como Realizado
                                 </button>
                               )}
                               <button onClick={async () => { if(confirm('¿Eliminar definitivamente este recordatorio?')) { await actualizarEstatusRecordatorio(r.id, selectedExpediente.id, 'cancelado'); router.refresh(); } }} className="p-8 bg-rose-100 text-rose-600 rounded-[2rem] hover:bg-rose-600 hover:text-white transition-all shadow-lg border-2 border-rose-200">
                                 <Trash2 size={24} />
                               </button>
                             </div>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="py-24 text-center space-y-8 opacity-20 border-4 border-dashed border-slate-100 rounded-[4rem]">
                      <Clock size={100} className="mx-auto" />
                      <p className="text-2xl font-black uppercase tracking-[0.4em]">Sin recordatorios activos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'entregables' && (
            <div className="max-w-5xl mx-auto space-y-12 animate-in slide-in-from-top-8 duration-500">
              <div className="bg-indigo-900 rounded-[4rem] p-16 text-white flex justify-between items-center shadow-3xl relative overflow-hidden border-[10px] border-indigo-800">
                <div className="relative z-10 space-y-4">
                  <h2 className="text-4xl font-black uppercase tracking-tighter">Capacitación y Entrega Final</h2>
                  <p className="text-indigo-300 text-sm font-black uppercase tracking-[0.35em]">{selectedExpediente.nombre_empresa}</p>
                </div>
                <div className="relative z-10 flex flex-col items-end">
                  <div className="text-8xl font-black flex items-baseline">
                    {hitosCapacitacion.filter(h => (h.id.toString() in hitosLocales ? hitosLocales[h.id.toString()] : selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado')).length}
                    <span className="text-3xl opacity-30 ml-2"> / {hitosCapacitacion.length}</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px] -mr-48 -mt-48" />
              </div>
              <div className="grid grid-cols-1 gap-6">
                {hitosCapacitacion.map((h, i) => {
                  const done = h.id.toString() in hitosLocales ? hitosLocales[h.id.toString()] : selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado';
                  const isUpdating = updatingHitoId === h.id.toString();
                  return (
                    <div key={h.id} className={`flex items-center gap-10 px-12 py-10 rounded-[3rem] border-[6px] transition-all ${done ? 'bg-indigo-50/30 border-indigo-50' : 'bg-white border-slate-50 hover:border-indigo-100 shadow-xl'}`}>
                      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl font-black shrink-0 ${done ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {done ? <CheckCircle2 size={32} /> : i + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className={`text-2xl font-black uppercase tracking-tight ${done ? 'text-indigo-700 line-through opacity-50' : 'text-slate-900'}`}>{h.nombre}</p>
                        {h.descripcion && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{h.descripcion}</p>}
                      </div>
                      <button onClick={() => handleToggleHito(h.id.toString(), !done)} disabled={isUpdating} className={`px-12 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl transition-all ${done ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1'}`}>
                        {isUpdating ? <Loader2 size={20} className="animate-spin" /> : done ? 'Entregado' : 'Marcar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function ReminderForm({ hito, expediente, onSuccess }: { hito: CatalogoHito, expediente: ExpedienteAbogada, onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const abogadaNombre = (expediente as any).asesora?.nombre_completo || 'de CECANI';
  
  const template = useMemo(() => getHitoTemplates(hito.nombre, expediente.nombre_empresa, abogadaNombre, fecha || new Date().toISOString().split('T')[0], hora), [hito.nombre, expediente.nombre_empresa, abogadaNombre, fecha, hora]);

  const generatedMessage = useMemo(() => {
    let msg = template.mensaje;
    if (selectedDocs.length > 0) {
      msg += `Para continuar con el proceso y aprovechar nuestra cita, es indispensable que nos envíe o tenga listos los siguientes documentos:\n\n- ${selectedDocs.join('\n- ').toUpperCase()}`;
    }
    return msg;
  }, [template.mensaje, selectedDocs]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!fecha) return alert('Selecciona una fecha');
    setIsSubmitting(true);
    const res = await crearRecordatorio({
      expediente_id: expediente.id,
      tipo: template.tipo as any,
      titulo: template.titulo,
      descripcion: generatedMessage,
      fecha: fecha,
      hora: hora || undefined,
      docs_requeridos: selectedDocs,
      notificar_abogada: true,
      notificar_cliente_whatsapp: false
    });
    
    if (res.success) {
      const tel = (expediente as any).cliente?.telefono?.replace(/\D/g, '');
      const waLink = `https://wa.me/52${tel}?text=${encodeURIComponent(generatedMessage)}`;
      window.open(waLink, '_blank');
      onSuccess();
    } else {
      alert(res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div className="space-y-10">
        <div className="flex items-center gap-6 text-blue-400">
          <Info size={40} />
          <h3 className="text-3xl font-black uppercase tracking-tighter">Programar {template.titulo}</h3>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Fecha del Compromiso</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full bg-white/5 border-4 border-white/10 rounded-3xl p-6 text-base font-bold uppercase outline-none focus:border-blue-500 transition-all" />
          </div>
          <div className="space-y-4">
            <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Hora Pactada</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-white/5 border-4 border-white/10 rounded-3xl p-6 text-base font-bold outline-none focus:border-blue-500 transition-all" />
          </div>
        </div>
        <div className="space-y-6">
          <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Documentación Requerida (Sugerencias del Paso)</label>
          <div className="grid grid-cols-2 gap-3">
            {(template.sugerencias.length > 0 ? template.sugerencias : DOCS_CATALOGO).map((doc) => (
              <button key={doc} type="button" onClick={() => setSelectedDocs(p => p.includes(doc) ? p.filter(d => d !== doc) : [...p, doc])} className={`text-left px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-4 transition-all shadow-lg ${selectedDocs.includes(doc) ? 'bg-blue-600 border-blue-400 text-white scale-105 shadow-blue-900/20' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}>
                {doc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded-[4rem] p-12 border-4 border-white/5 flex flex-col justify-between shadow-inner">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-500">Vista Previa WhatsApp (Manual CECANI)</p>
            <MessageCircle size={24} className="text-emerald-500" />
          </div>
          <div className="bg-slate-800 border-l-8 border-emerald-500 p-10 rounded-[2.5rem] text-sm font-bold leading-relaxed uppercase whitespace-pre-wrap shadow-2xl h-[350px] overflow-y-auto custom-scrollbar">
            {generatedMessage}
          </div>
          <div className="bg-amber-900/30 border-2 border-amber-500/30 p-6 rounded-3xl flex gap-4 items-center">
            <AlertCircle className="text-amber-500 shrink-0" size={24} />
            <p className="text-[10px] font-bold text-amber-200 uppercase leading-relaxed">Al habilitar, el mensaje se enviará de inmediato por WhatsApp con los datos seleccionados.</p>
          </div>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full py-8 bg-blue-600 hover:bg-blue-500 rounded-[2.5rem] text-sm font-black uppercase tracking-[0.35em] shadow-3xl transition-all disabled:opacity-50 hover:-translate-y-1 active:scale-95">
          {isSubmitting ? 'Procesando...' : 'Habilitar Compromiso y Abrir WhatsApp'}
        </button>
      </div>
    </form>
  );
}

function ConcentradoCard({ title, children, color, className = "" }: any) {
  const colors: any = {
    slate: 'border-slate-200 bg-slate-50/50 text-slate-900',
    blue: 'border-blue-200 bg-blue-50/30 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50/30 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50/30 text-violet-900',
  };

  return (
    <div className={`p-6 md:p-8 rounded-3xl border-2 shadow-lg space-y-6 transition-all hover:shadow-xl ${colors[color] || colors.slate} ${className}`}>
      <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest border-b-2 border-current/10 pb-4 text-center">{title}</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function ConcentradoField({ l, c, value, onChange }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] md:text-[11px] font-bold uppercase opacity-70 tracking-widest ml-2">{l}</label>
      <input type="text" value={value || ''} onChange={e => onChange(c, e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs md:text-sm font-semibold uppercase outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm" />
    </div>
  );
}
