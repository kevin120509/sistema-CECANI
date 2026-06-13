'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { marcarHitoCompletado, guardarDatosConcentrado, agregarIntegrante, eliminarIntegranteAction } from '@/actions/abogada';
import { logoutAbogada } from '@/actions/auth-abogada';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento, eliminarDocumentoAction, solicitarBorradoAction } from '@/actions/documentos';
import { crearRecordatorio, actualizarEstatusRecordatorio, eliminarRecordatorioAction } from '@/actions/recordatorios';
import NotificationStatusIndicator from '@/components/NotificationStatusIndicator';
import type { CatalogoHito, TipoDocumento, Recordatorio, ExpedienteIntegrante } from '@/types/database';
import type { ExpedienteAbogada } from '@/app/abogada/page';
import { 
  Search, Building2, User, FileText, ClipboardList, BookOpen, 
  ExternalLink, CheckCircle2, Clock, FileUp, FileSignature,
  AlertCircle, Users, Loader2, Bell, MessageCircle, 
  AlertTriangle, Info, Mail, MapPin, UserPlus, HelpCircle, LayoutDashboard, LogOut,
  ListTodo, Activity, Trash2, Calendar, CheckSquare, ChevronRight, X
} from 'lucide-react';
import { PLANES_PAGO_LABELS } from '@/lib/constants';

interface ExpedienteManagerProps {
  expedientes: ExpedienteAbogada[];
  hitos: CatalogoHito[];
  alertasHoy: ExpedienteAbogada[];
}

const CECANI_EMAIL = 'cecani.sc@gmail.com';

const getUrgencyColor = (fecha: string) => {
  const hoy = new Date().toISOString().split('T')[0];
  if (fecha < hoy) return 'bg-red-900/30 text-red-400 border-red-900/50';
  if (fecha === hoy) return 'bg-sky-900/30 text-sky-400 border-sky-800';
  return 'bg-sky-900/30 text-sky-400 border-sky-800';
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
    'Videollamada de bienvenida': { tipo: 'meet_cliente', titulo: 'Videollamada de Bienvenida', mensaje: `${base}El objetivo es conocer sus necesidades y explicarle el paso a paso legal. ¿Confirmamos la asistencia?`, sugerencias: [] },
    'Solicitar nombres': { tipo: 'seguimiento', titulo: 'Trámite de Denominación (Economía)', mensaje: `${base}Requerimos las opciones de nombres para ingresar la solicitud ante la Secretaría de Economía.`, sugerencias: ['3 OPCIONES DE NOMBRE EN ORDEN DE PRIORIDAD'] },
    'Requerir documentos': { tipo: 'entrega_docs', titulo: 'Requerimiento de Documentación Oficial', mensaje: `${base}Para integrar su expediente conforme al Manual Legal, solicitamos la siguiente documentación de CADA ASOCIADO en formato PDF legible (no fotos) al correo *${CECANI_EMAIL}*:\n\n`, sugerencias: ['INE AMBOS LADOS', 'CURP ACTUALIZADA', 'CONSTANCIA SITUACIÓN FISCAL', 'COMPROBANTE DOMICILIO', 'E.FIRMA VIGENTE'] },
    'Definir objeto social': { tipo: 'seguimiento', titulo: 'Definición de Objeto Social', mensaje: `${base}Necesitamos platicar sobre las actividades de su asociación para redactar los estatutos. Favor de tener a la mano:`, sugerencias: ['ACTIVIDADES SOCIALES DESEADAS', 'IDENTIFICACIONES DE SOCIOS', 'COMPROBANTE DE DOMICILIO'] },
    'Cita en Notaría': { tipo: 'cita_notaria', titulo: 'Firma de Acta en Notaría', mensaje: `${base}Es indispensable que el Representante Legal acuda con su identificación original. Documentos a presentar:`, sugerencias: ['INE ORIGINAL', 'CURP IMPRESA', 'COPIA DEL PROYECTO DE ACTA'] },
    'Inscripción SAT': { tipo: 'cita_sat', titulo: 'Cita en el SAT para RFC Moral', mensaje: `${base}Su cita para la inscripción de la persona moral ha sido agendada. Es vital que el Representante Legal asista con:`, sugerencias: ['TESTIMONIO NOTARIAL', 'IDENTIFICACIÓN VIGENTE', 'COMPROBANTE DE DOMICILIO DE LA AC'] }
  };
  const selected = templates[hitoNombre] || { tipo: 'seguimiento', titulo: `Seguimiento: ${hitoNombre}`, mensaje: `${base}${requestDocsStr}`, sugerencias: [] };
  return selected;
};

const DOCS_MAP: Record<string, string> = {
  'INE FRENTE': 'ine_frente', 'INE REVERSO': 'ine_reverso', 'CURP ACTUALIZADA': 'curp', 'COMPROBANTE DOMICILIO': 'comprobante_domicilio', 'CONSTANCIA SITUACIÓN FISCAL': 'csf', 'E.FIRMA (.CER / .KEY)': 'efirma_representante', 'PAGO INICIAL': 'comprobante_pago', 'PROYECTO DE ACTA': 'acta_asamblea', 'TESTIMONIO NOTARIAL': 'testimonio_notarial', 'COPIA CERTIFICADA': 'inscripcion_rpp', 'ACUSE CITA SAT': 'acuse_cita_sat', 'RFC MORAL': 'rfc_moral'
};
const DOCS_PERSONALES = ['INE FRENTE', 'INE REVERSO', 'CURP ACTUALIZADA', 'COMPROBANTE DOMICILIO', 'CONSTANCIA SITUACIÓN FISCAL', 'E.FIRMA (.CER / .KEY)', 'PAGO INICIAL'];
const DOCS_PROCESO = ['PROYECTO DE ACTA', 'TESTIMONIO NOTARIAL', 'COPIA CERTIFICADA', 'ACUSE CITA SAT', 'RFC MORAL'];
const DOCS_CATALOGO = [...DOCS_PERSONALES, ...DOCS_PROCESO];

const CAMPOS_CONCENTRADO = [
  'nombre_completo', 'rfc', 'curp', 'estado_civil', 'ocupacion', 'domicilio_completo', 'estado', 'telefono_cliente',
  'cluni', 'pago_notario', 'pago_entrega_donataria', 'cantidad_cobrar_proximo', 'estatus_detalle', 'accion_realizar',
  'cantidad_pagada_acumulada', 'fecha_ultimo_pago', 'quien_cobra', 'vendedora', 'fecha_contrato', 'link_reunion', 'fecha_reunion_acuerdos',
  'total_contrato', 'saldo_cliente', 'num_pagos_realizados', 'periodicidad_pagos', 'actividad', 'notaria', 'folio_rpp', 'libro_rpp', 'volumen_rpp', 'estatus_rpp'
];

function DocumentItem({ label, url, type, onUpload, isUploading, integranteId, docId, onDelete, solicitud_borrado, motivo_borrado, estatus_borrado }: { label: string, url?: string | null, type: string, onUpload: (file: File, type: string, integranteId?: string) => void, isUploading: boolean, integranteId?: string, docId?: string, onDelete: (id: string, url: string, confirmed?: boolean) => void, solicitud_borrado?: boolean, motivo_borrado?: string | null, estatus_borrado?: string }) {
  const isPending = solicitud_borrado && estatus_borrado === 'pendiente';
  const isAuthorized = estatus_borrado === 'autorizado';
  const isRejected = estatus_borrado === 'rechazado';
  return (
    <div className={`flex items-center justify-between p-4 bg-slate-900 border rounded-2xl transition-all group shadow-2xl ${isPending ? 'border-sky-500/50 bg-sky-900/20' : isAuthorized ? 'border-sky-500/50 bg-sky-900/20' : isRejected ? 'border-red-500/50 bg-red-900/20' : 'border-slate-800 hover:border-sky-600/50'}`}>
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${url ? (isPending ? 'bg-[#0197D2]/20 text-sky-400' : isAuthorized ? 'bg-[#0197D2]/20 text-sky-400' : isRejected ? 'bg-red-600/20 text-red-400' : 'bg-[#0197D2]/20 text-sky-400') : 'bg-slate-800 text-slate-500'}`}>
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : url ? (isPending ? <Clock size={22} /> : isAuthorized ? <CheckCircle2 size={22} /> : isRejected ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />) : <FileText size={20} />}
        </div>
        <div className="min-w-0">
          <span className="text-xs md:text-sm font-black uppercase text-slate-200 tracking-tight block truncate">{label}</span>
          <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${isPending ? 'text-sky-400' : isAuthorized ? 'text-sky-400' : isRejected ? 'text-red-400' : 'text-slate-500'}`}>
            {isPending ? 'Baja en Revisión' : isAuthorized ? 'Baja Autorizada' : isRejected ? 'Baja Rechazada' : url ? 'Recibido' : 'Pendiente'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {url ? (
          <>
            <button onClick={() => window.open(`/api/r2/download?url=${encodeURIComponent(url)}`, '_blank')} className="p-2 text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all" title="Ver archivo"><ExternalLink size={18} /></button>
            <button onClick={() => onDelete(docId!, url, isAuthorized)} className={`p-2 rounded-lg transition-all ${isPending ? 'text-sky-500 cursor-not-allowed opacity-50' : isAuthorized ? 'text-red-400 hover:bg-red-400/10' : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'}`} disabled={isPending} title={isAuthorized ? 'Eliminar permanentemente' : 'Solicitar baja'}>
              {isAuthorized ? <Trash2 size={18} /> : <X size={18} />}
            </button>
          </>
        ) : (
          <label className="p-2 text-sky-500 hover:bg-[#0197D2]/10 rounded-lg cursor-pointer transition-all shadow-inner active:scale-90" title="Subir archivo">
            <FileUp size={18} />
            <input type="file" className="hidden" accept=".pdf" disabled={isUploading} onChange={(e) => { const f = e.target.files?.[0]; if(f) onUpload(f, type, integranteId); }} />
          </label>
        )}
      </div>
    </div>
  );
}

function DocumentStage({ title, docs, onUpload, uploadingType, integranteId, color, onDelete }: any) {
  const colors: any = { sky: 'border-sky-600/30 bg-sky-950/20 text-sky-400', red: 'border-red-900/50 bg-red-950/20 text-red-400' };
  const c = colors[color] || colors.sky;
  return (
    <div className={`p-6 md:p-10 rounded-[2.5rem] border-2 shadow-2xl space-y-8 transition-all hover:shadow-sky-900/10 ${c}`}>
      <div className="flex items-center justify-between border-b border-current/10 pb-6"><h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em]">{title}</h3><div className="px-4 py-1 rounded-full bg-current/10 text-[10px] font-black">{docs.filter((d: any) => d.url).length} / {docs.length}</div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-6">{docs.map((doc: any, i: number) => (<DocumentItem key={i} label={doc.label} url={doc.url} type={doc.type} docId={doc.docId} onUpload={onUpload} isUploading={uploadingType === (integranteId ? `${doc.type}_${integranteId}` : doc.type)} integranteId={integranteId} onDelete={onDelete} solicitud_borrado={doc.solicitud_borrado} motivo_borrado={doc.motivo_borrado} estatus_borrado={doc.estatus_borrado} />))}</div>
    </div>
  );
}

export default function ExpedienteManager({ expedientes, hitos, alertasHoy }: ExpedienteManagerProps) {
  const router = useRouter();
  const [selectedExpedienteId, setSelectedExpedienteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etapa_legal' | 'checklist' | 'seguimiento_proceso' | 'entregables' | 'agenda' | 'tareas' | 'actividad'>('etapa_legal');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSavingConcentrado, setIsSavingConcentrado] = useState(false);
  const [concentradoForm, setConcentradoForm] = useState<Record<string, string>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [hitosLocales, setHitosLocales] = useState<Record<string, boolean>>({});
  const [updatingHitoId, setUpdatingHitoId] = useState<string | null>(null);
  const [nuevoIntegrante, setNuevoIntegrante] = useState('');
  const [isAgregandoIntegrante, setIsAgregandoIntegrante] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState<string | null>(null);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [agendaView, setAgendaView] = useState<'lista' | 'calendario'>('lista');

  const hoy = new Date().toISOString().split('T')[0];
  const hitosLegales = hitos.filter(h => h.id < 100);
  const hitosCapacitacion = hitos.filter(h => h.id >= 100);

  const filteredExpedientes = useMemo(() => {
    return expedientes.filter(exp => {
      const search = searchTerm.toLowerCase();
      const nombreEmpresa = exp.nombre_empresa?.toLowerCase() || '';
      const nombreCliente = (exp as any).cliente?.nombre_completo?.toLowerCase() || '';
      const numControl = (exp as any).numero_control?.toLowerCase() || '';
      return nombreEmpresa.includes(search) || nombreCliente.includes(search) || numControl.includes(search);
    });
  }, [expedientes, searchTerm]);

  const selectedExpediente = expedientes.find(e => e.id === selectedExpedienteId) || null;

  useEffect(() => { if (selectedExpedienteId && !expedientes.find(e => e.id === selectedExpedienteId)) setSelectedExpedienteId(null); }, [expedientes, selectedExpedienteId]);
  useEffect(() => { setHitosLocales({}); }, [selectedExpedienteId]);

  useEffect(() => {
    if (selectedExpediente) {
      const dbData = selectedExpediente.datos_concentrado?.[0] || {};
      const cliente = (selectedExpediente as any).cliente;
      const contrato = selectedExpediente.contratos?.[0];
      const pagos = selectedExpediente.pagos || [];
      const totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
      const montoContrato = Number(contrato?.monto_total || 0);
      const saldo = montoContrato - totalPagado;
      const totalPagosNum = pagos.length;
      const planPagosLabel = contrato?.plan_pagos ? (PLANES_PAGO_LABELS[contrato.plan_pagos] || contrato.plan_pagos) : '';
      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach(campo => {
        const dbValue = (dbData as any)[campo] || '';
        const defaults: any = {
          nombre_completo: cliente?.nombre_completo || '', rfc: cliente?.rfc || '', curp: cliente?.curp || '', estado_civil: cliente?.estado_civil || '', ocupacion: cliente?.ocupacion || '', domicilio_completo: cliente?.domicilio_completo || '', estado: cliente?.estado || '', telefono_cliente: cliente?.telefono || '', total_contrato: montoContrato > 0 ? `$${montoContrato.toLocaleString()}` : '', saldo_cliente: montoContrato > 0 ? `$${saldo.toLocaleString()}` : '', num_pagos_realizados: totalPagosNum > 0 ? String(totalPagosNum) : '', periodicidad_pagos: planPagosLabel, actividad: (selectedExpediente as any).figura?.descripcion || (dbData as any).actividad || '', numero_control: (selectedExpediente as any).numero_control || '',
        };
        newForm[campo] = dbValue || defaults[campo] || '';
      });
      setConcentradoForm(newForm);
    }
  }, [selectedExpedienteId, selectedExpediente]);

  const handleConcentradoChange = (campo: string, valor: string) => setConcentradoForm(prev => ({ ...prev, [campo]: valor }));
  const handleSaveConcentrado = async () => { if (!selectedExpediente) return; setIsSavingConcentrado(true); const res = await guardarDatosConcentrado(selectedExpediente.id, concentradoForm); if (!res.success) alert(res.error || 'Error al guardar'); setIsSavingConcentrado(false); };
  const handleUpdateControl = async (val: string) => { if (!selectedExpediente) return; await guardarDatosConcentrado(selectedExpediente.id, { numero_control: val }); };
  const handleToggleHito = async (hitoId: string, isCompleted: boolean) => { if (!selectedExpediente) return; setUpdatingHitoId(hitoId); setHitosLocales(prev => ({ ...prev, [hitoId]: isCompleted })); const res = await marcarHitoCompletado(selectedExpediente.id, hitoId, isCompleted); if (!(res as any)?.success) { setHitosLocales(prev => { const n = { ...prev }; delete n[hitoId]; return n; }); alert('Error al actualizar el paso: ' + ((res as any)?.error || '')); } else { router.refresh(); } setUpdatingHitoId(null); };
  const handleAddIntegrante = async () => { if (!selectedExpediente || !nuevoIntegrante) return; setIsAgregandoIntegrante(true); const res = await agregarIntegrante(selectedExpediente.id, nuevoIntegrante); if (res.success) { setNuevoIntegrante(''); toast.success('Integrante agregado correctamente'); router.refresh(); } else { toast.error(res.error || 'Error al agregar integrante'); } setIsAgregandoIntegrante(false); };
  const handleDeleteIntegrante = async (id: string) => { if (!confirm('¿Seguro que deseas eliminar este integrante?')) return; const res = await eliminarIntegranteAction(id); if (res.success) { toast.success('Integrante eliminado'); router.refresh(); } else { toast.error(res.error || 'Error al eliminar'); } };

  const handleFileUpload = async (file: File, type: string, integranteId?: string) => {
    if (!selectedExpediente) return;
    const typeId = integranteId ? `${type}_${integranteId}` : type;
    setUploadingType(typeId);
    try {
      const empresaKey = selectedExpediente.nombre_empresa.replace(/[^a-zA-Z0-9]/g, '_');
      const folder = `expedientes/${empresaKey}/documentacion`;
      const fd = new FormData(); fd.append('file', file);
      const uploadRes = await subirArchivoR2Action(fd, folder);
      if (!uploadRes.success || !uploadRes.data) throw new Error(uploadRes.error);
      const dbType = DOCS_MAP[type] || type;
      const regRes = await registrarDocumento(selectedExpediente.id, dbType as any, uploadRes.data.url, integranteId || null, true);
      if (!regRes.success) throw new Error(regRes.error);
      toast.success('Documento subido correctamente');
      router.refresh();
    } catch (err: any) { toast.error('Error al subir: ' + err.message); } finally { setUploadingType(null); }
  };

  const handleDeleteDocument = async (docId: string, url: string, confirmed: boolean = false) => {
    if (confirmed) {
      if (!confirm('Esta acción eliminará el archivo permanentemente de la nube. ¿Deseas continuar?')) return;
      const res = await eliminarDocumentoAction(docId, url);
      if (res.success) { toast.success('Documento eliminado'); router.refresh(); } else toast.error(res.error);
    } else {
      const motivo = prompt('Por favor, indica el motivo de la baja (será revisado por dirección):');
      if (!motivo) return;
      const res = await solicitarBorradoAction(docId, motivo);
      if (res.success) { toast.success('Solicitud de baja enviada a dirección'); router.refresh(); } else toast.error(res.error);
    }
  };

  const handleDeleteReminder = async (id: string) => { if (!confirm('¿Seguro que deseas eliminar este recordatorio?')) return; const res = await eliminarRecordatorioAction(id); if (res.success) { toast.success('Recordatorio eliminado'); router.refresh(); } else toast.error(res.error || 'Error al eliminar'); };

  const handleLogout = async () => { setIsLoggingOut(true); await logoutAbogada(); router.push('/abogada'); };

  const recordatorios = useMemo(() => { if (!selectedExpediente) return []; return [...(selectedExpediente.recordatorios || [])].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()); }, [selectedExpediente]);
  const integrantes = selectedExpediente?.integrantes || [];
  const recordatoriosPendientes = useMemo(() => {
    const list: any[] = [];
    expedientes.forEach(exp => {
      (exp.recordatorios || []).forEach((r: any) => {
        if (r.estatus === 'pendiente') {
          list.push({ ...r, empresa: exp.nombre_empresa, clienteNombre: (exp as any).cliente?.nombre_completo || '', expId: exp.id });
        }
      });
    });
    return list;
  }, [expedientes]);

  const recordatoriosVencidos = useMemo(() => recordatoriosPendientes.filter(r => r.fecha < hoy).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [recordatoriosPendientes, hoy]);
  const recordatoriosHoy = useMemo(() => recordatoriosPendientes.filter(r => r.fecha === hoy).sort((a, b) => (a.hora || '00:00') > (b.hora || '00:00') ? 1 : -1), [recordatoriosPendientes, hoy]);
  const recordatoriosFuturos = useMemo(() => recordatoriosPendientes.filter(r => r.fecha > hoy).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), [recordatoriosPendientes, hoy]);

  const documentosExtrasDisponibles = useMemo(() => {
    if (!selectedExpediente) return [];
    const extras: string[] = [];
    selectedExpediente.documentos?.forEach(d => {
      const dbTypes = Object.values(DOCS_MAP);
      if (!dbTypes.includes(d.tipo)) extras.push(d.tipo);
    });
    return extras;
  }, [selectedExpediente]);

  const tareasPendientes = useMemo(() => {
    return expedientes.map(exp => {
      const hitoActual = hitos.find(h => {
        const st = exp.seguimiento_tareas?.find(s => s.hito_id === h.id);
        return !st || st.estatus !== 'completado';
      });
      return { exp, hitoActual };
    }).filter(t => t.hitoActual);
  }, [expedientes, hitos]);

  const bitacoraGlobal = useMemo(() => {
    const notas: any[] = [];
    expedientes.forEach(exp => {
      (exp.bitacora || []).forEach((b: any) => {
        notas.push({ ...b, empresa: exp.nombre_empresa, clienteNombre: (exp as any).cliente?.nombre_completo || '', expId: exp.id });
      });
    });
    return notas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [expedientes]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans overflow-hidden">
      <aside className="w-20 md:w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/20"><Building2 size={24} className="text-white" /></div>
          <div className="hidden md:block">
            <h1 className="text-sm font-black text-white uppercase tracking-widest">CECANI</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase">Panel Legal</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="hidden md:block text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 mt-6 mb-4">Operación</p>
          <SidebarLink icon={<ListTodo size={20} />} label="Mis Tareas" badge={tareasPendientes.length} active={activeTab === 'tareas'} onClick={() => setActiveTab('tareas')} />
          <SidebarLink icon={<Calendar size={20} />} label="Agenda" badge={recordatoriosPendientes.length} active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} />
          <SidebarLink icon={<Activity size={20} />} label="Actividad" active={activeTab === 'actividad'} onClick={() => setActiveTab('actividad')} />
          
          <p className="hidden md:block text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 mt-10 mb-4">Gestión</p>
          <SidebarLink icon={<Users size={20} />} label="Expedientes" active={activeTab !== 'tareas' && activeTab !== 'agenda' && activeTab !== 'actividad'} onClick={() => { setActiveTab('etapa_legal'); }} />
        </div>
        <div className="p-6 border-t border-slate-800">
          <button onClick={handleLogout} disabled={isLoggingOut} className="w-full flex items-center justify-center md:justify-start gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:text-white hover:bg-rose-900/20 hover:border-rose-900/50 border border-transparent transition-all">
            {isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
            <span className="hidden md:block text-[11px] font-black uppercase tracking-widest">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col h-full bg-slate-950">
          <header className="h-24 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-10 shrink-0">
             <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-400">A</div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bienvenida</p><h2 className="text-sm font-black text-white uppercase tracking-widest">Abogada CECANI</h2></div>
             </div>
             <div className="flex items-center gap-4">
                <NotificationStatusIndicator />
             </div>
          </header>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-3 border-r border-slate-800 flex flex-col h-full overflow-hidden">
              <div className="p-6 md:p-8 space-y-6 shrink-0">
                 <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Clientes</h2>
                    <div className="flex gap-2"><div className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full text-[9px] font-black text-sky-400 uppercase tracking-widest">{filteredExpedientes.length} Total</div></div>
                 </div>
                 <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors" size={20} />
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white outline-none focus:border-sky-600/50 transition-all placeholder:text-slate-700 shadow-2xl" />
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                {filteredExpedientes.map((exp) => (
                  <div key={exp.id} onClick={() => setSelectedExpedienteId(exp.id)} className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group flex items-center justify-between ${selectedExpedienteId === exp.id ? 'bg-sky-600/10 border-sky-500 shadow-xl shadow-sky-600/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md'}`}>
                    <div className="flex items-center gap-4 min-w-0">
                       <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg transition-all ${selectedExpedienteId === exp.id ? 'bg-[#0197D2] text-white' : 'bg-slate-950 text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-900'}`}>{exp.nombre_empresa.charAt(0)}</div>
                       <div className="min-w-0 pr-2"><h3 className={`text-sm font-black uppercase tracking-tight truncate transition-colors ${selectedExpedienteId === exp.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{exp.nombre_empresa}</h3><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1 truncate">{exp.cliente?.nombre_completo}</p></div>
                    </div>
                    <ChevronRight size={18} className={`shrink-0 transition-all ${selectedExpedienteId === exp.id ? 'text-sky-500 translate-x-1' : 'text-slate-700'}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-9 h-full overflow-y-auto custom-scrollbar bg-[#020617]">
              {selectedExpediente ? (
                <>
                  <div className="p-8 md:p-12 border-b border-slate-800 bg-slate-900/20">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="flex items-center gap-8">
                           <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-sky-600 to-sky-400 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-sky-600/20">{selectedExpediente.nombre_empresa.charAt(0)}</div>
                           <div>
                              <div className="flex items-center gap-3 mb-2"><span className="px-3 py-1 bg-sky-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">A.C. EN TRÁMITE</span><span className="text-slate-700 text-xs">•</span><span className="text-sky-500 text-xs font-black uppercase tracking-[0.2em]">{(selectedExpediente as any).figura?.descripcion || 'ASOCIACIÓN CIVIL'}</span></div>
                              <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-3">{selectedExpediente.nombre_empresa}</h1>
                              <p className="text-slate-500 text-xs font-black uppercase tracking-widest flex items-center gap-2"><User size={14} className="text-sky-600" /> {selectedExpediente.cliente?.nombre_completo}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <button onClick={() => { const tel = selectedExpediente.cliente?.telefono?.replace(/\D/g, ''); if(tel) window.open(`https://wa.me/52${tel}`, '_blank'); }} className="flex items-center gap-3 px-6 py-4 bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-600/10"><MessageCircle size={18} /> WhatsApp</button>
                           <div className="flex items-center gap-2">
                             {selectedExpediente.contratos?.[0]?.url_pdf_generado && (<button onClick={() => window.open(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_generado!)}`, '_blank')} className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl hover:text-white transition-all shadow-lg" title="Ver Borrador"><FileText size={20}/></button>)}
                             {selectedExpediente.contratos?.[0]?.url_pdf_firmado_cliente && (<button onClick={() => window.open(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_firmado_cliente!)}`, '_blank')} className="p-4 bg-sky-600/10 border border-sky-500/20 text-sky-400 rounded-2xl hover:bg-sky-600 hover:text-white transition-all shadow-lg" title="Ver Contrato Cliente"><FileSignature size={20}/></button>)}
                             {selectedExpediente.contratos?.[0]?.url_pdf_doble_firma && (<button onClick={() => window.open(`/api/r2/download?url=${encodeURIComponent(selectedExpediente.contratos![0].url_pdf_doble_firma!)}`, '_blank')} className="p-4 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-lg" title="Ver Doble Firma"><Shield size={20}/></button>)}
                           </div>
                        </div>
                     </div>
                  </div>
                  <nav className="flex bg-slate-900/50 border-b border-slate-800 p-2 gap-2 overflow-x-auto custom-scrollbar shrink-0">
                    {[ { id: 'etapa_legal', label: 'Etapa Legal', icon: <Scale size={16}/> }, { id: 'checklist', label: 'CheckList Docs', icon: <ClipboardList size={16}/> }, { id: 'seguimiento_proceso', label: 'Proceso General', icon: <Clock size={16}/> }, { id: 'entregables', label: 'Entregables', icon: <BookOpen size={16}/> } ].map((tab) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-3 px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#0197D2] text-white shadow-xl shadow-sky-600/20' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}>{tab.icon} {tab.label}</button>
                    ))}
                  </nav>

                  <div className="p-8 md:p-12">
                    {activeTab === 'etapa_legal' && (
                      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                          <ConcentradoCard title="Datos del Cliente Titular" color="sky" className="xl:col-span-1">
                            <ConcentradoField l="Nombre Completo" c="nombre_completo" value={concentradoForm.nombre_completo} onChange={handleConcentradoChange} />
                            <div className="grid grid-cols-2 gap-4"><ConcentradoField l="RFC" c="rfc" value={concentradoForm.rfc} onChange={handleConcentradoChange} /><ConcentradoField l="CURP" c="curp" value={concentradoForm.curp} onChange={handleConcentradoChange} /></div>
                            <ConcentradoField l="Domicilio Completo" c="domicilio_completo" value={concentradoForm.domicilio_completo} onChange={handleConcentradoChange} />
                            <ConcentradoField l="Estado" c="estado" value={concentradoForm.estado} onChange={handleConcentradoChange} />
                            <ConcentradoField l="Teléfono Cliente" c="telefono_cliente" value={concentradoForm.telefono_cliente} onChange={handleConcentradoChange} />
                          </ConcentradoCard>
                          <ConcentradoCard title="Datos de la Asociación y Legal" color="slate" className="xl:col-span-1">
                            <ConcentradoField l="Objeto Social / Actividad" c="actividad" value={concentradoForm.actividad} onChange={handleConcentradoChange} />
                            <ConcentradoField l="CLUNI" c="cluni" value={concentradoForm.cluni} onChange={handleConcentradoChange} />
                            <div className="grid grid-cols-2 gap-4"><ConcentradoField l="Notaría" c="notaria" value={concentradoForm.notaria} onChange={handleConcentradoChange} /><ConcentradoField l="Pago Notario" c="pago_notario" value={concentradoForm.pago_notario} onChange={handleConcentradoChange} /></div>
                            <div className="grid grid-cols-2 gap-4"><ConcentradoField l="Folio RPP" c="folio_rpp" value={concentradoForm.folio_rpp} onChange={handleConcentradoChange} /><ConcentradoField l="Libro" c="libro_rpp" value={concentradoForm.libro_rpp} onChange={handleConcentradoChange} /></div>
                            <ConcentradoField l="Estatus RPP" c="estatus_rpp" value={concentradoForm.estatus_rpp} onChange={handleConcentradoChange} />
                          </ConcentradoCard>
                          <div className="flex flex-col gap-8">
                            <ConcentradoCard title="Datos de Pagos y Contrato" color="sky">
                              <div className="grid grid-cols-2 gap-4"><ConcentradoField l="Inversión Total" c="total_contrato" value={concentradoForm.total_contrato} onChange={handleConcentradoChange} /><ConcentradoField l="Saldo Pendiente" c="saldo_cliente" value={concentradoForm.saldo_cliente} onChange={handleConcentradoChange} /></div>
                              <div className="grid grid-cols-2 gap-4"><ConcentradoField l="Pagos Realizados" c="num_pagos_realizados" value={concentradoForm.num_pagos_realizados} onChange={handleConcentradoChange} /><ConcentradoField l="Periodo Pagos" c="periodicidad_pagos" value={concentradoForm.periodicidad_pagos} onChange={handleConcentradoChange} /></div>
                              <ConcentradoField l="Fecha Contrato" c="fecha_contrato" value={concentradoForm.fecha_contrato} onChange={handleConcentradoChange} />
                              <ConcentradoField l="Vendedora" c="vendedora" value={concentradoForm.vendedora} onChange={handleConcentradoChange} />
                            </ConcentradoCard>
                            <ConcentradoCard title="Seguimiento y Estatus" color="slate">
                              <ConcentradoField l="Acción a Realizar" c="accion_realizar" value={concentradoForm.accion_realizar} onChange={handleConcentradoChange} />
                              <ConcentradoField l="Estatus Detalle" c="estatus_detalle" value={concentradoForm.estatus_detalle} onChange={handleConcentradoChange} />
                              <button onClick={handleSaveConcentrado} disabled={isSavingConcentrado} className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-sky-600/20 transition-all disabled:opacity-50">{isSavingConcentrado ? 'Guardando...' : 'Guardar Información Global'}</button>
                            </ConcentradoCard>
                          </div>
                        </div>
                        <div className="bg-slate-900/50 p-10 rounded-[3rem] border-2 border-slate-800 shadow-3xl">
                           <div className="flex justify-between items-center mb-10"><div className="flex items-center gap-4 text-sky-400"><Users size={28}/><h3 className="text-xl font-black uppercase tracking-widest">Integrantes de Firma</h3></div><div className="flex gap-4"><input type="text" value={nuevoIntegrante} onChange={e => setNuevoIntegrante(e.target.value)} placeholder="Nombre del integrante" className="bg-slate-950 border border-slate-800 rounded-xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-sky-500 w-64" /><button onClick={handleAddIntegrante} disabled={isAgregandoIntegrante} className="px-6 py-3 bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 disabled:opacity-50 transition-all shadow-xl shadow-sky-600/10">Agregar</button></div></div>
                           <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">{integrantes.map((int: any) => (<div key={int.id} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center justify-between group"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-slate-500 uppercase">{int.nombre_completo.charAt(0)}</div><span className="text-xs font-black text-slate-300 uppercase truncate max-w-[150px]">{int.nombre_completo}</span></div><button onClick={() => handleDeleteIntegrante(int.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></div>))}</div>
                           {integrantes.length === 0 && <div className="text-center py-10 bg-slate-950/30 rounded-3xl border-2 border-dashed border-slate-800"><p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No hay integrantes adicionales registrados</p></div>}
                        </div>
                      </div>
                    )}
                    {activeTab === 'checklist' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex items-center justify-between mb-8 shadow-2xl">
                            <div className="flex items-center gap-4 text-sky-500"><FileSignature size={28}/><h2 className="text-xl font-black uppercase tracking-widest">Control Documental Integrado</h2></div>
                            <button onClick={() => { const name = prompt('Nombre del documento personalizado:'); if(name) handleFileUpload(new File([], ""), name); }} className="px-6 py-3 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all shadow-xl hover:bg-slate-800 flex items-center gap-2"><UserPlus size={14}/> Crear Doc Extra</button>
                         </div>
                         {(() => {
                           const docsGenerales = selectedExpediente.documentos?.filter(d => !d.integrante_id) || [];
                           const modelPersonal = DOCS_PERSONALES.map(t => { const dbType = DOCS_MAP[t] || t; const found = docsGenerales.find(d => d.tipo === dbType); return { type: t, label: t, url: found?.url_archivo, docId: found?.id, validado: found?.validado, motivo_rechazo: found?.motivo_rechazo, solicitud_borrado: found?.solicitud_borrado, motivo_borrado: found?.motivo_borrado, estatus_borrado: found?.estatus_borrado }; });
                           return (<DocumentStage title="Datos Personales del Cliente" color="sky" docs={modelPersonal} onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument} />);
                         })()}
                         {(() => {
                           const docsGenerales = selectedExpediente.documentos?.filter(d => !d.integrante_id) || [];
                           const modelProceso = DOCS_PROCESO.map(t => { const dbType = DOCS_MAP[t] || t; const found = docsGenerales.find(d => d.tipo === dbType); return { type: t, label: t, url: found?.url_archivo, docId: found?.id, validado: found?.validado, motivo_rechazo: found?.motivo_rechazo, solicitud_borrado: found?.solicitud_borrado, motivo_borrado: found?.motivo_borrado, estatus_borrado: found?.estatus_borrado }; });
                           return (<DocumentStage title="Documentación del Proceso" color="sky" docs={modelProceso} onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument} />);
                         })()}
                         {integrantes.map((int: any) => {
                           const susDocs = selectedExpediente.documentos?.filter(d => d.integrante_id === int.id) || [];
                           const model = DOCS_CATALOGO.filter(t => !['PAGO INICIAL'].includes(t)).map(t => { const dbType = DOCS_MAP[t] || t; const found = susDocs.find(d => d.tipo === dbType); return { type: t, label: t, url: found?.url_archivo, docId: found?.id, validado: found?.validado, motivo_rechazo: found?.motivo_rechazo, solicitud_borrado: found?.solicitud_borrado, motivo_borrado: found?.motivo_borrado, estatus_borrado: found?.estatus_borrado }; });
                           return (<DocumentStage key={int.id} title={`Expediente de ${int.nombre_completo}`} color="sky" docs={model} onUpload={handleFileUpload} uploadingType={uploadingType} integranteId={int.id} onDelete={handleDeleteDocument} />);
                         })}
                         {documentosExtrasDisponibles.length > 0 && (() => {
                           const docsGenerales = selectedExpediente.documentos?.filter(d => !d.integrante_id) || [];
                           const modelExtras = documentosExtrasDisponibles.map(t => { const dbType = t; const found = docsGenerales.find(d => d.tipo === dbType); return { type: t, label: t, url: found?.url_archivo, docId: found?.id, validado: found?.validado, motivo_rechazo: found?.motivo_rechazo, solicitud_borrado: found?.solicitud_borrado, motivo_borrado: found?.motivo_borrado, estatus_borrado: found?.estatus_borrado }; });
                           return (<DocumentStage title="Documentos Extras" color="sky" docs={modelExtras} onUpload={handleFileUpload} uploadingType={uploadingType} onDelete={handleDeleteDocument} />);
                         })()}
                      </div>
                    )}
                    {activeTab === 'seguimiento_proceso' && (
                       <div className="p-6 md:p-8 bg-slate-950 min-h-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="space-y-6">
                           <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-4"><ClipboardList size={20} className="text-sky-400"/> Flujo de Hitos Legales</h3>
                           <div className="space-y-3">
                             {hitosLegales.map((hito, idx) => {
                               const isCompletedDb = selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === hito.id)?.estatus === 'completado';
                               const isCompleted = hitosLocales[hito.id] !== undefined ? hitosLocales[hito.id] : isCompletedDb;
                               const isProcessing = updatingHitoId === hito.id.toString();
                               const hasReminder = recordatorios.some((r: any) => r.titulo === hito.nombre && r.estatus === 'pendiente');
                               const isOverdue = recordatorios.some((r: any) => r.titulo === hito.nombre && r.estatus === 'pendiente' && r.fecha && r.fecha < hoy);
                               let cardBg = isCompleted ? 'bg-green-600/10 border-green-600/30' : isOverdue ? 'bg-red-900/20 border-red-500/50' : hasReminder ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-slate-900 border-slate-800 hover:bg-slate-800';
                               let iconColor = isCompleted ? 'text-green-500' : isOverdue ? 'text-red-400 hover:text-green-400' : hasReminder ? 'text-yellow-400 hover:text-green-400' : 'text-slate-500 hover:text-green-400';
                               let textColor = isCompleted ? 'text-green-400' : isOverdue ? 'text-red-400' : hasReminder ? 'text-yellow-400' : 'text-slate-300';
                               return (
                                 <div key={hito.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${cardBg}`}>
                                   <div className="relative">{isProcessing ? <Loader2 size={24} className="animate-spin text-slate-400" /> : <button onClick={(e) => { e.stopPropagation(); handleToggleHito(hito.id.toString(), !isCompleted); }} className="focus:outline-none transition-transform hover:scale-110"><CheckCircle2 size={24} className={iconColor} /></button>}</div>
                                   <div className="flex-1"><p className={`text-sm font-bold ${textColor}`}>{idx + 1}. {hito.nombre}</p></div>
                                   {!isCompleted && (<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReminderForm(hito.nombre); }} className="text-xs font-bold text-sky-400 hover:text-white bg-[#0197D2]/10 hover:bg-[#0197D2] px-3 py-1.5 rounded-lg transition-all border border-sky-600/20 z-20">Programar</button>)}
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                         <div className="space-y-6">
                           <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-4"><Calendar size={20} className="text-red-400"/> Recordatorios Activos</h3>
                           <div className="space-y-3">
                             {recordatorios.length === 0 ? (
                               <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800"><p className="text-slate-500 text-sm font-bold">No hay recordatorios pendientes.</p></div>
                             ) : (
                               recordatorios.map((r: any) => (
                                 <div key={r.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between gap-4 shadow-sm relative overflow-hidden group">
                                   <div className={`absolute left-0 top-0 bottom-0 w-1 ${r.estatus === 'completado' ? 'bg-green-600' : r.fecha < hoy ? 'bg-red-600' : 'bg-yellow-500'}`}></div>
                                   <div className="pl-2"><p className="text-sm font-bold text-slate-200">{r.titulo}</p><p className="text-xs text-slate-400 mt-1">{r.fecha} {r.hora && `a las ${r.hora}`}</p>{r.notas && <p className="text-xs text-slate-500 italic mt-2 bg-slate-950 p-2 rounded">"{r.notas}"</p>}</div>
                                   <div className="flex flex-col items-end gap-2"><div className="flex gap-1">{r.estatus === 'pendiente' && (<button onClick={() => { setSelectedReminderId(r.id); setShowReminderForm(r.titulo); }} className="px-3 py-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 rounded hover:bg-slate-700 transition-colors border border-slate-700">Completar</button>)}<button onClick={() => handleDeleteReminder(r.id)} className="p-1.5 text-slate-500 hover:text-red-500 transition-colors" title="Eliminar Recordatorio"><Trash2 size={14}/></button></div><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${r.estatus === 'completado' ? 'bg-green-600/20 text-green-400' : r.fecha < hoy ? 'bg-red-600/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'}`}>{r.estatus}</span></div>
                                 </div>
                               ))
                             )}
                           </div>
                         </div>
                       </div>
                    )}
                    {activeTab === 'entregables' && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative overflow-hidden bg-[#0197D2] rounded-[3rem] p-12 text-white shadow-2xl"><div className="relative z-10 flex flex-col items-end"><div className="text-8xl font-black flex items-baseline">{hitosCapacitacion.filter(h => (h.id.toString() in hitosLocales ? hitosLocales[h.id.toString()] : (selectedExpediente as any)?.seguimiento_tareas?.find((st: any) => st.hito_id === h.id)?.estatus === 'completado')).length}<span className="text-3xl opacity-30 ml-2"> / {hitosCapacitacion.length}</span></div></div><div className="absolute top-0 right-0 w-96 h-96 bg-sky-400/10 rounded-full blur-[100px] -mr-48 -mt-48" /></div>
                        <div className="grid grid-cols-1 gap-6">{hitosCapacitacion.map((h, i) => { const done = h.id.toString() in hitosLocales ? hitosLocales[h.id.toString()] : selectedExpediente.seguimiento_tareas?.find(st => st.hito_id === h.id)?.estatus === 'completado'; const isUpdating = updatingHitoId === h.id.toString(); return ( <div key={h.id} className={`flex items-center gap-10 px-12 py-10 rounded-[3rem] border transition-all ${done ? 'bg-[#0197D2]/10 border-sky-600/30' : 'bg-slate-900 border-slate-800 hover:border-sky-600/50 shadow-lg shadow-black/20'}`}> <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl font-black shrink-0 ${done ? 'bg-[#0197D2] text-white' : 'bg-slate-800 text-slate-400'}`}>{done ? <CheckCircle2 size={32} /> : i + 1}</div> <div className="flex-1 space-y-2"><p className={`text-2xl font-black uppercase tracking-tight ${done ? 'text-sky-400 line-through opacity-50' : 'text-slate-200'}`}>{h.nombre}</p>{h.descripcion && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{h.descripcion}</p>}</div> <button onClick={() => handleToggleHito(h.id.toString(), !done)} disabled={isUpdating} className={`px-12 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl transition-all ${done ? 'bg-[#0197D2]/20 text-sky-400 border border-sky-600/30' : 'bg-[#0197D2] text-white hover:bg-sky-500 hover:-translate-y-1'}`}>{isUpdating ? <Loader2 size={20} className="animate-spin" /> : done ? 'Entregado' : 'Marcar'}</button> </div> ); })}</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col p-10 space-y-10">
                   {activeTab === 'tareas' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><h2 className="text-2xl font-black text-white uppercase tracking-widest mb-10 border-b-4 border-sky-600 inline-block">Mis Tareas Pendientes</h2><div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">{tareasPendientes.map((t: any) => (<div key={t.exp.id} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 flex flex-col justify-between hover:border-sky-600/50 transition-all shadow-2xl"><div><div className="flex items-center gap-4 mb-6 text-sky-500"><div className="w-12 h-12 rounded-2xl bg-slate-950 flex items-center justify-center font-black text-lg">{t.exp.nombre_empresa.charAt(0)}</div><p className="text-xs font-black uppercase tracking-widest truncate">{t.exp.nombre_empresa}</p></div><h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Próximo Hito:</h4><p className="text-lg font-black text-white uppercase leading-tight mb-8 line-clamp-2">{t.hitoActual.nombre}</p></div><button onClick={() => { setSelectedExpedienteId(t.exp.id); setActiveTab('seguimiento_proceso'); }} className="w-full py-4 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 font-black uppercase tracking-widest text-[10px] hover:bg-[#0197D2] hover:text-white transition-all shadow-xl">Gestionar Tarea</button></div>))}</div>{tareasPendientes.length === 0 && <div className="text-center py-20 bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-800"><p className="text-slate-600 font-black uppercase tracking-widest">No hay tareas pendientes en tus expedientes</p></div>}</div>
                   )}
                   {activeTab === 'agenda' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black text-white uppercase tracking-widest border-b-4 border-red-600 inline-block">Agenda y Compromisos</h2><div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800"><button onClick={() => setAgendaView('lista')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${agendaView === 'lista' ? 'bg-[#0197D2] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Lista</button><button onClick={() => setAgendaView('calendario')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${agendaView === 'calendario' ? 'bg-[#0197D2] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Calendario</button></div></div>{agendaView === 'lista' ? (<div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8"><div><h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-6 px-4 flex items-center gap-2"><AlertCircle size={14}/> Vencidos</h3><div className="space-y-4">{groupRecordatoriosByExpId(recordatoriosVencidos).map(g => (<GroupedRecordatorioCard key={g.expId} group={g} color="red" onClick={(id) => { setSelectedExpedienteId(id); setActiveTab('seguimiento_proceso'); }} />))}</div></div><div><h3 className="text-xs font-black text-sky-400 uppercase tracking-widest mb-6 px-4 flex items-center gap-2"><Bell size={14}/> Hoy</h3><div className="space-y-4">{groupRecordatoriosByExpId(recordatoriosHoy).map(g => (<GroupedRecordatorioCard key={g.expId} group={g} color="sky" onClick={(id) => { setSelectedExpedienteId(id); setActiveTab('seguimiento_proceso'); }} />))}</div></div><div><h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 px-4 flex items-center gap-2"><Calendar size={14}/> Próximos</h3><div className="space-y-4">{groupRecordatoriosByExpId(recordatoriosFuturos).map(g => (<GroupedRecordatorioCard key={g.expId} group={g} color="sky" onClick={(id) => { setSelectedExpedienteId(id); setActiveTab('seguimiento_proceso'); }} />))}</div></div></div>) : (<div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-3xl overflow-hidden overflow-x-auto"><div className="min-w-[800px]"><div className="grid grid-cols-7 border-b border-slate-800 pb-6 mb-6">{['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => (<div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">{d}</div>))}</div><div className="grid grid-cols-7 gap-4">{Array.from({length: 35}).map((_, i) => { const date = new Date(new Date().getFullYear(), new Date().getMonth(), i - new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() + 2); const dStr = date.toISOString().split('T')[0]; const isToday = dStr === hoy; const isOtherMonth = date.getMonth() !== new Date().getMonth(); const dailyRecs = recordatoriosPendientes.filter(r => r.fecha === dStr); const groups = groupRecordatoriosByExpId(dailyRecs); return (<div key={i} className={`min-h-[140px] p-4 rounded-2xl border transition-all ${isToday ? 'bg-sky-600/10 border-sky-600 shadow-xl' : 'bg-slate-950/50 border-slate-800'} ${isOtherMonth ? 'opacity-20 grayscale' : ''}`}><p className={`text-[10px] font-black mb-3 ${isToday ? 'text-sky-400' : 'text-slate-500'}`}>{date.getDate()}</p><div className="space-y-1.5">{groups.map(g => (<div key={g.expId} onClick={() => { setSelectedExpedienteId(g.expId); setActiveTab('seguimiento_proceso'); }} className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[8px] font-black text-slate-200 uppercase truncate cursor-pointer hover:border-sky-500 transition-all">{g.empresa} {g.recordatorios.length > 1 && `(${g.recordatorios.length})`}</div>))}</div></div>); })}</div></div></div>)}</div>
                   )}
                   {activeTab === 'actividad' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><h2 className="text-2xl font-black text-white uppercase tracking-widest mb-10 border-b-4 border-emerald-600 inline-block">Historial de Bitácoras Global</h2><div className="space-y-6 max-w-4xl">{bitacoraGlobal.map((nota: any) => (<div key={nota.id} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 hover:border-sky-600/30 transition-all shadow-2xl relative overflow-hidden group"><div className="absolute right-0 top-0 p-8 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { setSelectedExpedienteId(nota.expId); setActiveTab('etapa_legal'); }} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 hover:bg-[#0197D2] hover:text-white transition-all shadow-xl" title="Ver Expediente"><ChevronRight size={20}/></button></div><div className="flex items-center gap-4 mb-6"><div className="w-10 h-10 rounded-xl bg-sky-600/10 text-sky-500 flex items-center justify-center font-black text-xs">{nota.empresa.charAt(0)}</div><div><h4 className="text-[10px] font-black text-white uppercase tracking-widest">{nota.empresa}</h4><p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{nota.clienteNombre}</p></div><span className="text-[8px] text-slate-800 mx-2">•</span><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{new Date(nota.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div><div className="bg-slate-950 border-l-4 border-sky-600 p-6 rounded-2xl text-sm text-slate-300 italic font-medium leading-relaxed">"{nota.nota}"</div><div className="mt-6 flex items-center gap-3"><div className="px-3 py-1 bg-red-600/10 border border-red-500/20 rounded-lg text-[9px] font-black text-red-400 uppercase tracking-widest">Prox. Seguimiento: {new Date(nota.fecha_proximo_seguimiento + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</div>{nota.autor?.nombre_completo && <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest ml-auto">Atendió: {nota.autor.nombre_completo}</span>}</div></div>))}</div>{bitacoraGlobal.length === 0 && <div className="text-center py-20 bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-800"><p className="text-slate-600 font-black uppercase tracking-widest">No se han registrado notas de bitácora todavía</p></div>}</div>
                   )}
                   {activeTab !== 'tareas' && activeTab !== 'agenda' && activeTab !== 'actividad' && (
                     <div className="flex-1 flex flex-col items-center justify-center space-y-10 animate-in zoom-in duration-500">
                        <div className="relative"><div className="absolute inset-0 bg-sky-600/20 blur-[100px] rounded-full animate-pulse" /><div className="relative w-40 h-40 bg-slate-900 rounded-[3rem] border-4 border-slate-800 flex items-center justify-center text-slate-700 shadow-2xl"><Users size={80} /></div></div>
                        <div className="text-center space-y-4"><h3 className="text-3xl font-black text-white uppercase tracking-tighter">Selecciona un Expediente</h3><p className="text-slate-500 text-sm font-black uppercase tracking-widest">Utiliza el buscador o la lista de la izquierda para comenzar</p></div>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showReminderForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReminderForm(null)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 rounded-[3rem] shadow-2xl max-w-6xl w-full p-8 md:p-12 border-4 border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
               <button onClick={() => setShowReminderForm(null)} className="absolute top-8 right-8 text-slate-400 hover:text-white transition-colors"><X size={32}/></button>
               {(() => { const hitoEncontrado = hitos.find(h => h.nombre === showReminderForm); if (!hitoEncontrado) return null; return (<ReminderForm hito={hitoEncontrado} expediente={selectedExpediente!} onSuccess={() => setShowReminderForm(null)} />); })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReminderForm({ hito, expediente, onSuccess }: { hito: CatalogoHito, expediente: ExpedienteAbogada, onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const abogadaNombre = (expediente as any).asesora?.nombre_completo || 'de CECANI';
  const template = useMemo(() => getHitoTemplates(hito.nombre, expediente.nombre_empresa, abogadaNombre, fecha || new Date().toISOString().split('T')[0], hora), [hito.nombre, expediente.nombre_empresa, abogadaNombre, fecha, hora]);
  const generatedMessage = useMemo(() => { let msg = template.mensaje; if (selectedDocs.length > 0) msg += `Para continuar con el proceso y aprovechar nuestra cita, es indispensable que nos envíe o tenga listos los siguientes documentos:\n\n- ${selectedDocs.join('\n- ').toUpperCase()}`; return msg; }, [template.mensaje, selectedDocs]);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if(!fecha) return alert('Selecciona una fecha'); setIsSubmitting(true); const res = await crearRecordatorio({ expediente_id: expediente.id, tipo: template.tipo as any, titulo: template.titulo, descripcion: generatedMessage, fecha: fecha, hora: hora || undefined, docs_requeridos: selectedDocs, notificar_abogada: true, notificar_cliente_whatsapp: false }); if (res.success) { const tel = (expediente as any).cliente?.telefono?.replace(/\D/g, ''); const waLink = `https://wa.me/52${tel}?text=${encodeURIComponent(generatedMessage)}`; window.open(waLink, '_blank'); onSuccess(); } else alert(res.error); setIsSubmitting(false); };
  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div className="space-y-10">
        <div className="flex items-center gap-6 text-sky-400"><Info size={40} /><h3 className="text-3xl font-black uppercase tracking-tighter">Programar {template.titulo}</h3></div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4"><label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Fecha del Compromiso</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full bg-slate-950/50 border-4 border-slate-800 rounded-3xl p-6 text-base font-bold uppercase outline-none focus:border-sky-500 transition-all text-slate-200" /></div>
          <div className="space-y-4"><label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Hora Pactada</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-slate-950/50 border-4 border-slate-800 rounded-3xl p-6 text-base font-bold outline-none focus:border-sky-500 transition-all text-slate-200" /></div>
        </div>
        <div className="space-y-6"><label className="text-[12px] font-black uppercase tracking-widest text-slate-500">Documentación Requerida (Sugerencias del Paso)</label><div className="grid grid-cols-2 gap-3">{(template.sugerencias.length > 0 ? template.sugerencias : DOCS_CATALOGO).map((doc) => (<button key={doc} type="button" onClick={() => setSelectedDocs(p => p.includes(doc) ? p.filter(d => d !== doc) : [...p, doc])} className={`text-left px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-4 transition-all shadow-lg ${selectedDocs.includes(doc) ? 'bg-[#0197D2] border-sky-400 text-white scale-105 shadow-sky-900/20' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{doc}</button>))}</div></div>
      </div>
      <div className="bg-slate-950 rounded-[4rem] p-12 border-4 border-sky-900/20 flex flex-col justify-between shadow-inner">
        <div className="space-y-8"><div className="flex items-center justify-between"><p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-500">Vista Previa WhatsApp (Manual CECANI)</p><MessageCircle size={24} className="text-sky-600" /></div><div className="bg-slate-800 border-l-8 border-sky-600 p-10 rounded-[2.5rem] text-sm font-bold leading-relaxed uppercase whitespace-pre-wrap shadow-2xl h-[350px] overflow-y-auto custom-scrollbar">{generatedMessage}</div><div className="bg-red-900/30 border-2 border-red-600/30 p-6 rounded-3xl flex gap-4 items-center"><AlertCircle className="text-red-600 shrink-0" size={24} /><p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">Al habilitar, el mensaje se enviará de inmediato por WhatsApp con los datos seleccionados.</p></div></div>
        <button type="submit" disabled={isSubmitting} className="w-full py-8 bg-[#0197D2] hover:bg-sky-500 rounded-[2.5rem] text-sm font-black uppercase tracking-[0.35em] shadow-3xl transition-all disabled:opacity-50 hover:-translate-y-1 active:scale-95">{isSubmitting ? 'Procesando...' : 'Habilitar Compromiso y Abrir WhatsApp'}</button>
      </div>
    </form>
  );
}

function ConcentradoCard({ title, children, color, className = "" }: any) {
  const colors: any = { slate: 'border-slate-800 bg-slate-950/50 text-slate-200', sky: 'border-sky-900/50 bg-sky-950/30 text-sky-400' };
  return (<div className={`p-6 md:p-8 rounded-3xl border-2 shadow-lg space-y-6 transition-all hover:shadow-xl ${colors[color] || colors.slate} ${className}`}><h3 className="text-xs md:text-sm font-black uppercase tracking-widest border-b-2 border-current/10 pb-4 text-center">{title}</h3><div className="space-y-4">{children}</div></div>);
}
function ConcentradoField({ l, c, value, onChange }: any) { return (<div className="space-y-1.5"><label className="text-[10px] md:text-[11px] font-bold uppercase opacity-70 tracking-widest ml-2">{l}</label><input type="text" value={value || ''} onChange={e => onChange(c, e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-xs md:text-sm font-semibold uppercase outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-500 transition-all shadow-sm text-slate-200" /></div>); }
function SidebarLink({ icon, label, badge, badgeColor = 'sky', active, onClick }: { icon: React.ReactNode; label: string; badge?: number; badgeColor?: 'sky' | 'red'; active: boolean; onClick: () => void; }) { const badgeStyles = { sky: 'bg-[#0197D2] text-white', red: 'bg-red-600 text-white' }; return (<button onClick={onClick} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all text-left ${active ? 'bg-[#0197D2] text-white shadow-xl shadow-sky-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}><div className="flex items-center gap-3"><span className={active ? 'text-white' : 'text-slate-500'}>{icon}</span><span className="text-[11px] font-black uppercase tracking-widest">{label}</span></div>{badge !== undefined && badge > 0 && (<span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${badgeStyles[badgeColor]}`}>{badge}</span>)}</button>); }
function groupRecordatoriosByExpId(recs: any[]) { const groups: Record<string, { expId: string; empresa: string; clienteNombre: string; recordatorios: any[] }> = {}; recs.forEach(r => { if (!groups[r.expId]) { groups[r.expId] = { expId: r.expId, empresa: r.empresa, clienteNombre: r.clienteNombre, recordatorios: [] }; } groups[r.expId].recordatorios.push(r); }); return Object.values(groups); }
function GroupedRecordatorioCard({ group, color, onClick }: { group: any; color: 'red' | 'sky'; onClick: (expId: string) => void; }) { const colors = { red: { bg: 'bg-rose-950/20', border: 'border-rose-900/50', text: 'text-rose-400', headerBg: 'bg-rose-900/10' }, sky: { bg: 'bg-sky-950/20', border: 'border-sky-900/50', text: 'text-sky-400', headerBg: 'bg-sky-900/10' } }; const c = colors[color] || colors.sky; return ( <div className={`${c.bg} border ${c.border} rounded-2xl overflow-hidden shadow-sm`}><div className={`${c.headerBg} border-b ${c.border} px-5 py-3 flex items-center justify-between`}><div className="min-w-0 pr-4"><h4 className="text-sm font-black text-slate-200 uppercase tracking-wide truncate">{group.empresa}</h4><p className="text-[10px] font-bold text-slate-500 uppercase truncate">{group.clienteNombre}</p></div><button onClick={() => onClick(group.expId)} className={`shrink-0 text-[10px] font-bold ${c.text} bg-slate-900 border ${c.border} px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all`}>Ver Expediente</button></div><div className="p-3 space-y-2">{group.recordatorios.map((r: any) => (<div key={r.id} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors"><div className="flex items-center gap-3 min-w-0"><div className={`w-1.5 h-8 rounded-full shrink-0 ${color === 'red' ? 'bg-rose-500' : 'bg-sky-500'}`} /><div className="min-w-0"><p className="text-[11px] font-bold text-slate-300 uppercase leading-tight truncate">{r.titulo}</p><p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 truncate">{r.tipo || 'General'}</p></div></div><div className="text-right shrink-0 pl-2">{r.fecha && color === 'sky' && (<p className={`text-[9px] font-black uppercase ${c.text} mb-0.5`}>{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>)}{r.fecha && color === 'red' && (<p className={`text-[9px] font-black uppercase ${c.text} mb-0.5`}>Venció: {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>)}<p className="text-[10px] font-black text-slate-400 uppercase">{r.hora || 'Todo el día'}</p></div></div>))}</div></div> ); }
