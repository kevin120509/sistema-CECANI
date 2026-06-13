"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  marcarHitoCompletado,
  guardarDatosConcentrado,
  agregarIntegrante,
  eliminarIntegranteAction,
} from "@/actions/abogada";
import { logoutAbogada } from "@/actions/auth-abogada";
import { subirArchivoR2Action } from "@/actions/r2-actions";
import {
  registrarDocumento,
  eliminarDocumentoAction,
  solicitarBorradoAction,
} from "@/actions/documentos";
import {
  crearRecordatorio,
  actualizarEstatusRecordatorio,
  eliminarRecordatorioAction,
} from "@/actions/recordatorios";
import NotificationStatusIndicator from "@/components/NotificationStatusIndicator";
import type {
  CatalogoHito,
  TipoDocumento,
  Recordatorio,
  ExpedienteIntegrante,
} from "@/types/database";
import type { ExpedienteAbogada } from "@/app/abogada/page";
import {
  Search,
  Building2,
  User,
  FileText,
  ClipboardList,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Clock,
  FileUp,
  FileSignature,
  AlertCircle,
  Users,
  Loader2,
  Bell,
  MessageCircle,
  AlertTriangle,
  Info,
  Mail,
  MapPin,
  UserPlus,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  ListTodo,
  Activity,
  Trash2,
  Calendar,
  CheckSquare,
  ChevronRight,
  Menu,
  X,
  Scale,
} from "lucide-react";
import { PLANES_PAGO_LABELS } from "@/lib/constants";

interface ExpedienteManagerProps {
  expedientes: ExpedienteAbogada[];
  hitos: CatalogoHito[];
  alertasHoy: ExpedienteAbogada[];
}

const CECANI_EMAIL = "cecani.sc@gmail.com";

// --- UTILIDADES ---
const getUrgencyColor = (fecha: string) => {
  const hoy = new Date().toISOString().split("T")[0];
  if (fecha < hoy) return "bg-red-900/30 text-red-400 border-red-900/50";
  if (fecha === hoy) return "bg-sky-900/30 text-sky-400 border-sky-800";
  return "bg-sky-900/30 text-sky-400 border-sky-800";
};

const getHitoTemplates = (
  hitoNombre: string,
  empresa: string,
  abogada: string,
  fecha: string,
  hora?: string,
) => {
  const [year, month, day] = fecha.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const fechaFmt = localDate.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const horaFmt = hora ? ` a las *${hora} HRS*` : "";
  const abogadaLimpio =
    abogada === "de CECANI" || !abogada ? "de CECANI" : abogada;
  const base = `Hola, le saluda la abogada *${abogadaLimpio}* respecto al proceso de *${empresa}*.\n\nLe recordamos nuestro compromiso para el día *${fechaFmt.toUpperCase()}*${horaFmt}.\n\n`;
  const requestDocsStr = `Para continuar con el proceso y aprovechar nuestra cita, es indispensable que nos envíe o tenga listos los siguientes documentos:\n\n`;

  const templates: Record<
    string,
    { tipo: string; titulo: string; mensaje: string; sugerencias: string[] }
  > = {
    "Videollamada de bienvenida": {
      tipo: "meet_cliente",
      titulo: "Videollamada de Bienvenida",
      mensaje: `${base}El objetivo es conocer sus necesidades y explicarle el paso a paso legal. ¿Confirmamos la asistencia?`,
      sugerencias: [],
    },
    "Solicitar nombres": {
      tipo: "seguimiento",
      titulo: "Trámite de Denominación (Economía)",
      mensaje: `${base}Requerimos las opciones de nombres para ingresar la solicitud ante la Secretaría de Economía.`,
      sugerencias: ["3 OPCIONES DE NOMBRE EN ORDEN DE PRIORIDAD"],
    },
    "Requerir documentos": {
      tipo: "entrega_docs",
      titulo: "Requerimiento de Documentación Oficial",
      mensaje: `${base}Para integrar su expediente conforme al Manual Legal, solicitamos la siguiente documentación de CADA ASOCIADO en formato PDF legible (no fotos) al correo *${CECANI_EMAIL}*:\n\n`,
      sugerencias: [
        "INE AMBOS LADOS",
        "CURP ACTUALIZADA",
        "CONSTANCIA SITUACIÓN FISCAL",
        "COMPROBANTE DOMICILIO",
        "E.FIRMA VIGENTE",
      ],
    },
    "Definir objeto social": {
      tipo: "seguimiento",
      titulo: "Definición de Objeto Social",
      mensaje: `${base}Necesitamos platicar sobre las actividades de su asociación para redactar los estatutos. Favor de tener a la mano:`,
      sugerencias: [
        "ACTIVIDADES SOCIALES DESEADAS",
        "IDENTIFICACIONES DE SOCIOS",
        "COMPROBANTE DE DOMICILIO",
      ],
    },
    "Cita en Notaría": {
      tipo: "cita_notaria",
      titulo: "Firma de Acta en Notaría",
      mensaje: `${base}Es indispensable que el Representante Legal acuda con su identificación original. Documentos a presentar:`,
      sugerencias: [
        "INE ORIGINAL",
        "CURP IMPRESA",
        "COPIA DEL PROYECTO DE ACTA",
      ],
    },
    "Inscripción SAT": {
      tipo: "cita_sat",
      titulo: "Cita en el SAT para RFC Moral",
      mensaje: `${base}Su cita para la inscripción de la persona moral ha sido agendada. Es vital que el Representante Legal asista con:`,
      sugerencias: [
        "TESTIMONIO NOTARIAL",
        "IDENTIFICACIÓN VIGENTE",
        "COMPROBANTE DE DOMICILIO DE LA AC",
      ],
    },
  };
  const selected = templates[hitoNombre] || {
    tipo: "seguimiento",
    titulo: `Seguimiento: ${hitoNombre}`,
    mensaje: `${base}${requestDocsStr}`,
    sugerencias: [],
  };
  return selected;
};

const DOCS_MAP: Record<string, string> = {
  "INE FRENTE": "ine_frente",
  "INE REVERSO": "ine_reverso",
  "CURP ACTUALIZADA": "curp",
  "COMPROBANTE DOMICILIO": "comprobante_domicilio",
  "CONSTANCIA SITUACIÓN FISCAL": "csf",
  "E.FIRMA (.CER / .KEY)": "efirma_representante",
  "PAGO INICIAL": "comprobante_pago",
  "PROYECTO DE ACTA": "acta_asamblea",
  "TESTIMONIO NOTARIAL": "testimonio_notarial",
  "COPIA CERTIFICADA": "inscripcion_rpp",
  "ACUSE CITA SAT": "acuse_cita_sat",
  "RFC MORAL": "rfc_moral",
};
const DOCS_PERSONALES = [
  "INE FRENTE",
  "INE REVERSO",
  "CURP ACTUALIZADA",
  "COMPROBANTE DOMICILIO",
  "CONSTANCIA SITUACIÓN FISCAL",
  "E.FIRMA (.CER / .KEY)",
  "PAGO INICIAL",
];
const DOCS_PROCESO = [
  "PROYECTO DE ACTA",
  "TESTIMONIO NOTARIAL",
  "COPIA CERTIFICADA",
  "ACUSE CITA SAT",
  "RFC MORAL",
];
const DOCS_CATALOGO = [...DOCS_PERSONALES, ...DOCS_PROCESO];

// --- COMPONENTES ---

function DocumentItem({
  label,
  url,
  type,
  onUpload,
  isUploading,
  integranteId,
  docId,
  onDelete,
  solicitud_borrado,
  motivo_borrado,
  estatus_borrado,
}: {
  label: string;
  url?: string | null;
  type: string;
  onUpload: (file: File, type: string, integranteId?: string) => void;
  isUploading: boolean;
  integranteId?: string;
  docId?: string;
  onDelete: (id: string, url: string, confirmed?: boolean) => void;
  solicitud_borrado?: boolean;
  motivo_borrado?: string | null;
  estatus_borrado?: string;
}) {
  const isPending = solicitud_borrado && estatus_borrado === "pendiente";
  const isAuthorized = estatus_borrado === "autorizado";
  const isRejected = estatus_borrado === "rechazado";
  return (
    <div
      className={`flex items-center justify-between p-4 bg-slate-900 border rounded-2xl transition-all group shadow-2xl ${isPending ? "border-sky-500/50 bg-sky-900/20" : isAuthorized ? "border-sky-500/50 bg-sky-900/20" : isRejected ? "border-red-500/50 bg-red-900/20" : "border-slate-800 hover:border-sky-600/50"}`}
    >
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
        <div
          className={`shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${url ? (isPending ? "bg-[#0197D2]/20 text-sky-400" : isAuthorized ? "bg-[#0197D2]/20 text-sky-400" : isRejected ? "bg-red-600/20 text-red-400" : "bg-[#0197D2]/20 text-sky-400") : "bg-slate-800 text-slate-500"}`}
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : url ? (
            isPending ? (
              <Clock size={22} />
            ) : isAuthorized ? (
              <CheckCircle2 size={22} />
            ) : isRejected ? (
              <AlertCircle size={22} />
            ) : (
              <CheckCircle2 size={22} />
            )
          ) : (
            <FileText size={20} />
          )}
        </div>
        <div className="min-w-0">
          <span className="text-xs md:text-sm font-black uppercase text-slate-200 tracking-tight block truncate">
            {label}
          </span>
          <span
            className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${isPending ? "text-sky-400" : isAuthorized ? "text-sky-400" : isRejected ? "text-red-400" : "text-slate-500"}`}
          >
            {isPending
              ? "Baja en Revisión"
              : isAuthorized
                ? "Baja Autorizada"
                : isRejected
                  ? "Baja Rechazada"
                  : url
                    ? "Recibido"
                    : "Pendiente"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {url ? (
          <div className="flex gap-1.5 md:gap-2">
            <a
              href={`/api/r2/download?url=${encodeURIComponent(url)}`}
              target="_blank"
              className="p-2 md:p-2.5 bg-slate-800 text-sky-400 hover:bg-[#0197D2] hover:text-white rounded-xl transition-all shadow-lg border border-slate-700"
            >
              <ExternalLink size={16} />
            </a>
            {isAuthorized && (
              <button
                onClick={() => onDelete(docId!, url, true)}
                className="p-2 md:p-2.5 bg-red-600 text-white hover:bg-slate-950 rounded-xl transition-all shadow-md animate-pulse"
                title="Eliminar ahora (Autorizado)"
              >
                <Trash2 size={16} />
              </button>
            )}
            {!solicitud_borrado && !isAuthorized && !isRejected && (
              <button
                onClick={() => onDelete(docId!, url)}
                className="p-2 md:p-2.5 bg-slate-800 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg border border-slate-700"
                title="Solicitar eliminación"
              >
                <Trash2 size={16} />
              </button>
            )}
            {isRejected && (
              <button
                onClick={() => onDelete(docId!, url)}
                className="p-2 md:p-2.5 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg border border-red-900/50"
                title="Solicitar de nuevo"
              >
                <Trash2 size={16} />
              </button>
            )}
            {isPending && (
              <div
                className="p-2 md:p-2.5 bg-sky-900/30 text-sky-400 rounded-xl shadow-lg cursor-help border border-sky-800"
                title={`Motivo enviado: ${motivo_borrado || "No especificado"}`}
              >
                <AlertTriangle size={16} />
              </div>
            )}
          </div>
        ) : (
          <label className="p-2 md:p-2.5 cursor-pointer bg-slate-800 text-slate-500 hover:bg-[#0197D2] hover:text-white rounded-xl transition-all shadow-lg border border-slate-700">
            <FileUp size={16} />
            <input
              type="file"
              className="hidden"
              accept=".pdf"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f, type, integranteId);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function DocumentStage({
  title,
  docs,
  color,
  onUpload,
  uploadingType,
  integranteId,
  onDelete,
}: {
  title: string;
  docs: any[];
  color: string;
  onUpload: (file: File, type: string, integranteId?: string) => void;
  uploadingType: string | null;
  integranteId?: string;
  onDelete: (id: string, url: string, confirmed?: boolean) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 p-5 md:p-6 space-y-4 md:space-y-6 shadow-xl h-full transition-all hover:border-sky-600/50 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h3 className="text-sm md:text-base font-black uppercase tracking-widest flex items-center gap-2.5 text-slate-200">
          <div className="w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
          {title}
        </h3>
        <div className="bg-[#0197D2]/20 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-tighter text-sky-300 border border-sky-600/20">
          {docs.filter((d) => d.url).length} / {docs.length}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:gap-4">
        {docs.map((doc, i) => (
          <DocumentItem
            key={i}
            {...doc}
            onUpload={onUpload}
            isUploading={
              uploadingType ===
              (integranteId ? `${doc.type}_${integranteId}` : doc.type)
            }
            integranteId={integranteId}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default function ExpedienteManager({
  expedientes,
  hitos,
  alertasHoy,
}: ExpedienteManagerProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("lawyer_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expedientes" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seguimiento_tareas" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recordatorios" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpedienteId, setSelectedExpedienteId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<
    "etapa_legal" | "documentacion" | "seguimiento_proceso" | "entregables"
  >("etapa_legal");
  const [updatingHitoId, setUpdatingHitoId] = useState<string | null>(null);
  const [hitosLocales, setHitosLocales] = useState<Record<string, boolean>>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState<string | null>(null);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(
    null,
  );
  const [nuevoIntegrante, setNuevoIntegrante] = useState("");
  const [isAgregandoIntegrante, setIsAgregandoIntegrante] = useState(false);
  const [documentosExtrasDisponibles, setDocumentosExtrasDisponibles] =
    useState<string[]>([]);
  const [concentradoForm, setConcentradoForm] = useState<
    Record<string, string>
  >({});
  const [isSavingConcentrado, setIsSavingConcentrado] = useState(false);
  const [dashTab, setDashTab] = useState<
    "clientes" | "tareas" | "agenda" | "bitacora"
  >("clientes");
  const [agendaView, setAgendaView] = useState<"lista" | "calendario">("lista");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const CAMPOS_CONCENTRADO = [
    "nombre_completo",
    "rfc",
    "curp",
    "estado_civil",
    "ocupacion",
    "domicilio_completo",
    "estado",
    "telefono_cliente",
    "objeto_social_ventas",
    "actividad",
    "numero_control",
    "notaria",
    "estatus_rpp",
    "folio_rpp",
    "libro_rpp",
    "volumen_rpp",
    "total_contrato",
    "periodicidad_pagos",
    "num_pagos_realizados",
    "saldo_cliente",
    "asesora_encargada",
    "cluni",
    "pago_notario",
    "pago_entrega_donataria",
    "cantidad_cobrar_proximo",
    "estatus_detalle",
    "accion_realizar",
    "cantidad_pagada_acumulada",
    "fecha_ultimo_pago",
    "quien_cobra",
    "vendedora",
    "fecha_contrato",
    "link_reunion",
    "fecha_reunion_acuerdos",
  ];

  const filteredExpedientes = useMemo(() => {
    return expedientes.filter((exp) => {
      const search = searchTerm.toLowerCase();
      const nombreEmpresa = exp.nombre_empresa.toLowerCase();
      const nombreCliente =
        (exp as any).cliente?.nombre_completo?.toLowerCase() || "";
      const numControl = (exp as any).numero_control?.toLowerCase() || "";
      return (
        nombreEmpresa.includes(search) ||
        nombreCliente.includes(search) ||
        numControl.includes(search)
      );
    });
  }, [expedientes, searchTerm]);

  const selectedExpediente =
    expedientes.find((e) => e.id === selectedExpedienteId) || null;
  useEffect(() => {
    if (
      selectedExpedienteId &&
      !expedientes.find((e) => e.id === selectedExpedienteId)
    ) {
      setSelectedExpedienteId(null);
    }
  }, [expedientes, selectedExpedienteId]);
  useEffect(() => {
    setHitosLocales({});
  }, [selectedExpedienteId]);

  useEffect(() => {
    if (selectedExpediente) {
      const dbData = selectedExpediente.datos_concentrado?.[0] || {};
      const cliente = (selectedExpediente as any).cliente;
      const contrato = selectedExpediente.contratos?.[0];
      const pagos = selectedExpediente.pagos || [];
      const totalPagado = pagos.reduce(
        (sum, p) => sum + Number(p.monto || 0),
        0,
      );
      const montoContrato = Number(contrato?.monto_total || 0);
      const saldo = montoContrato - totalPagado;
      const totalPagosNum = pagos.length;
      const planPagosLabel = contrato?.plan_pagos
        ? PLANES_PAGO_LABELS[contrato.plan_pagos] || contrato.plan_pagos
        : "";
      const newForm: Record<string, string> = {};
      CAMPOS_CONCENTRADO.forEach((campo) => {
        const dbValue = (dbData as any)[campo] || "";
        const defaults: any = {
          nombre_completo: cliente?.nombre_completo || "",
          rfc: cliente?.rfc || "",
          curp: cliente?.curp || "",
          estado_civil: cliente?.estado_civil || "",
          ocupacion: cliente?.ocupacion || "",
          domicilio_completo: cliente?.domicilio_completo || "",
          estado: cliente?.estado || "",
          telefono_cliente: cliente?.telefono || "",
          total_contrato:
            montoContrato > 0 ? `$${montoContrato.toLocaleString()}` : "",
          saldo_cliente: montoContrato > 0 ? `$${saldo.toLocaleString()}` : "",
          num_pagos_realizados: totalPagosNum > 0 ? String(totalPagosNum) : "",
          periodicidad_pagos: planPagosLabel,
          actividad:
            (selectedExpediente as any).figura?.descripcion ||
            (dbData as any).actividad ||
            "",
          numero_control: (selectedExpediente as any).numero_control || "",
        };
        newForm[campo] = dbValue || defaults[campo] || "";
      });
      setConcentradoForm(newForm);
    }
  }, [selectedExpedienteId, selectedExpediente]);

  const handleConcentradoChange = (campo: string, valor: string) =>
    setConcentradoForm((prev) => ({ ...prev, [campo]: valor }));
  const handleSaveConcentrado = async () => {
    if (!selectedExpediente) return;
    setIsSavingConcentrado(true);
    const res = await guardarDatosConcentrado(
      selectedExpediente.id,
      concentradoForm,
    );
    if (!res.success) alert(res.error || "Error al guardar");
    setIsSavingConcentrado(false);
  };
  const handleUpdateControl = async (val: string) => {
    if (!selectedExpediente) return;
    await guardarDatosConcentrado(selectedExpediente.id, {
      numero_control: val,
    });
  };
  const handleToggleHito = async (hitoId: string, isCompleted: boolean) => {
    if (!selectedExpediente) return;
    setUpdatingHitoId(hitoId);
    setHitosLocales((prev) => ({ ...prev, [hitoId]: isCompleted }));
    const res = await marcarHitoCompletado(
      selectedExpediente.id,
      hitoId,
      isCompleted,
    );
    if (!(res as any)?.success) {
      setHitosLocales((prev) => {
        const n = { ...prev };
        delete n[hitoId];
        return n;
      });
      alert("Error al actualizar el paso: " + ((res as any)?.error || ""));
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
      setNuevoIntegrante("");
      toast.success("Integrante agregado correctamente");
      router.refresh();
    } else {
      toast.error(res.error || "Error al agregar integrante");
    }
    setIsAgregandoIntegrante(false);
  };
  const handleDeleteIntegrante = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar a este integrante?")) return;
    const res = await eliminarIntegranteAction(id);
    if (res.success) {
      toast.success("Integrante eliminado");
      router.refresh();
    } else {
      toast.error(res.error || "Error");
    }
  };
  const handleDeleteReminder = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este recordatorio?")) return;
    const res = await eliminarRecordatorioAction(id);
    if (res.success) {
      toast.success("Recordatorio eliminado");
      router.refresh();
    } else {
      toast.error(res.error || "Error");
    }
  };
  const handleLogout = async () => {
    if (confirm("¿Estás segura de que deseas cerrar sesión?")) {
      setIsLoggingOut(true);
      await logoutAbogada();
      window.location.reload();
    }
  };

  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const handleFileUpload = async (
    file: File,
    tipo: string,
    integranteId?: string,
  ) => {
    if (!selectedExpediente) return;
    const typeKey = integranteId ? `${tipo}_${integranteId}` : tipo;
    setUploadingType(typeKey);
    try {
      const carpetaEmpresa = selectedExpediente.nombre_empresa
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_");
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await subirArchivoR2Action(
        formData,
        `expedientes/${carpetaEmpresa}/documentacion`,
      );
      if (!uploadRes.success || !uploadRes.data)
        throw new Error(uploadRes.error);
      const regRes = await registrarDocumento(
        selectedExpediente.id,
        tipo as TipoDocumento,
        uploadRes.data.url,
        integranteId,
      );
      if (!regRes.success) throw new Error(regRes.error);
      router.refresh();
    } catch (err: any) {
      alert(`Error al subir: ${err.message}`);
    } finally {
      setUploadingType(null);
    }
  };
  const handleDeleteDocument = async (
    docId: string,
    url: string,
    isFinalDeletion?: boolean,
  ) => {
    if (isFinalDeletion) {
      if (
        !confirm(
          "¿Confirmas la eliminación definitiva? El archivo se borrará de R2 y no se podrá recuperar.",
        )
      )
        return;
      const res = await eliminarDocumentoAction(docId, url);
      if (res.success) {
        toast.success("Documento eliminado correctamente");
        router.refresh();
      } else {
        alert("Error al eliminar: " + res.error);
      }
      return;
    }
    const motivo = prompt(
      "Indica el motivo de la baja (para autorización de la directora):",
    );
    if (!motivo) return;
    const res = await solicitarBorradoAction(docId, motivo);
    if (res.success) {
      toast.info("Solicitud de baja enviada a la directora");
      router.refresh();
    } else {
      alert("Error: " + res.error);
    }
  };

  const closeDetail = () => {
    setSelectedExpedienteId(null);
    setActiveTab("etapa_legal");
    setShowReminderForm(null);
    setSelectedReminderId(null);
  };
  const hitosLegales = hitos.filter((h) => h.orden < 100);
  const hitosCapacitacion = hitos.filter((h) => h.orden >= 101);

  const todosRecordatorios = useMemo(() => {
    const list: Array<
      Recordatorio & { empresa: string; clienteNombre: string; expId: string }
    > = [];
    expedientes.forEach((exp) => {
      ((exp as any).recordatorios || []).forEach((r: Recordatorio) => {
        list.push({
          ...r,
          empresa: exp.nombre_empresa,
          clienteNombre: (exp as any).cliente?.nombre_completo || "",
          expId: exp.id,
        });
      });
    });
    return list.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  }, [expedientes]);

  const hoy = new Date().toISOString().split("T")[0];
  const recordatoriosPendientes = todosRecordatorios.filter(
    (r) => r.estatus === "pendiente",
  );
  const recordatoriosHoy = recordatoriosPendientes.filter(
    (r) => r.fecha === hoy,
  );
  const recordatoriosVencidos = recordatoriosPendientes.filter(
    (r) => r.fecha && r.fecha < hoy,
  );
  const recordatoriosFuturos = recordatoriosPendientes.filter(
    (r) => r.fecha && r.fecha > hoy,
  );

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{
      date: string;
      day: number;
      recs: typeof todosRecordatorios;
    }> = [];
    for (let i = 0; i < daysInMonth; i++) {
      const d = i + 1;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        date,
        day: d,
        recs: recordatoriosPendientes.filter((r) => r.fecha === date),
      });
    }
    return { firstDay, days, month, year };
  }, [recordatoriosPendientes]);

  const tareasPendientes = useMemo(() => {
    return expedientes
      .map((exp) => {
        let currentStep = 0;
        const hitoActual = hitosLegales.find((h, index) => {
          const st = exp.seguimiento_tareas?.find((s) => s.hito_id === h.id);
          if (!st || st.estatus !== "completado") {
            currentStep = index + 1;
            return true;
          }
          return false;
        });
        return {
          exp,
          hitoActual,
          currentStep,
          totalSteps: hitosLegales.length,
        };
      })
      .filter((t) => t.hitoActual);
  }, [expedientes, hitosLegales]);

  const bitacoraGlobal = useMemo(() => {
    const notas: any[] = [];
    expedientes.forEach((exp) => {
      (exp.bitacora || []).forEach((b: any) => {
        notas.push({
          ...b,
          empresa: exp.nombre_empresa,
          clienteNombre: (exp as any).cliente?.nombre_completo || "",
          expId: exp.id,
        });
      });
    });
    return notas.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [expedientes]);

  if (!selectedExpediente) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans overflow-x-hidden">
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 transform lg:translate-x-0 lg:sticky lg:top-0 border-r border-slate-800 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="p-6 border-b border-slate-800 flex items-center justify-end lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
              Panel Legal
            </p>
            <nav className="space-y-1">
              <SidebarLink
                icon={<Users size={18} />}
                label="Mis Clientes"
                badge={expedientes.length}
                active={dashTab === "clientes"}
                onClick={() => {
                  setDashTab("clientes");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarLink
                icon={<ListTodo size={18} />}
                label="Mis Tareas"
                badge={tareasPendientes.length || undefined}
                active={dashTab === "tareas"}
                onClick={() => {
                  setDashTab("tareas");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarLink
                icon={<Activity size={18} />}
                label="Actividad Reciente"
                active={dashTab === "bitacora"}
                onClick={() => {
                  setDashTab("bitacora");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarLink
                icon={<Calendar size={18} />}
                label="Agenda"
                badge={
                  recordatoriosHoy.length + recordatoriosVencidos.length ||
                  undefined
                }
                active={dashTab === "agenda"}
                onClick={() => {
                  setDashTab("agenda");
                  setIsSidebarOpen(false);
                }}
              />
            </nav>
          </div>
          <div className="p-6 border-t border-slate-800 space-y-4">
            <NotificationStatusIndicator />
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#0197D2] text-white font-bold text-sm shadow-lg shadow-sky-600/25 hover:bg-sky-500 transition-all"
            >
              <LogOut size={18} /> Salir
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-8 w-full max-w-[1600px] mx-auto">
          <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2.5 bg-slate-900 text-slate-300 rounded-lg lg:hidden hover:text-white"
              >
                <Menu size={20} />
              </button>
              <div className="relative w-full md:w-96">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-sm font-medium text-slate-200 outline-none focus:border-sky-500 w-full placeholder-slate-500 transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 hidden md:flex">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-bold">
                  A
                </div>
                <span>Abogada</span>
              </div>
            </div>
          </header>

          {dashTab === "clientes" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 rounded bg-[#0197D2]/20 text-sky-400 text-xs font-bold flex items-center gap-1">
                    ↑ Activos
                  </span>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  Total Clientes
                </p>
                <div className="flex items-end justify-between mt-1">
                  <h3 className="text-3xl font-bold text-white">
                    {expedientes.length}
                  </h3>
                  <Users size={32} className="text-sky-600/80" />
                </div>
              </div>
              <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 rounded bg-red-600/20 text-red-400 text-xs font-bold flex items-center gap-1">
                    ⚠ Hoy
                  </span>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  Alertas del Día
                </p>
                <div className="flex items-end justify-between mt-1">
                  <h3 className="text-3xl font-bold text-white">
                    {alertasHoy.length}
                  </h3>
                  <AlertTriangle size={32} className="text-red-600/80" />
                </div>
              </div>
              <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-sm border border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 rounded bg-red-600/20 text-red-400 text-xs font-bold flex items-center gap-1">
                    ↓ Vencidos
                  </span>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  Recordatorios Pendientes
                </p>
                <div className="flex items-end justify-between mt-1">
                  <h3 className="text-3xl font-bold text-white">
                    {recordatoriosPendientes.length}
                  </h3>
                  <Calendar size={32} className="text-red-600/80" />
                </div>
              </div>
            </div>
          )}

          {dashTab === "clientes" && (
            <div className="space-y-4">
              {filteredExpedientes.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-sm">
                  <Users size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium text-sm">
                    Sin clientes asignados
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredExpedientes.map((exp) => {
                    const nombreCliente =
                      (exp as any).cliente?.nombre_completo || "Sin nombre";
                    const completadosExp = hitosLegales.filter(
                      (h) =>
                        exp.seguimiento_tareas?.find(
                          (st) => st.hito_id === h.id,
                        )?.estatus === "completado",
                    ).length;
                    const totalExp = hitosLegales.length;
                    const hasAlert = alertasHoy.some((a) => a.id === exp.id);
                    return (
                      <div
                        key={exp.id}
                        className={`bg-slate-900 rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors shadow-sm ${hasAlert ? "border-red-500/50 hover:border-red-500" : "border-slate-800 hover:border-slate-700"}`}
                      >
                        <div className="flex items-start gap-4 min-w-[250px] min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase shrink-0 border border-slate-700 mt-1">
                            {exp.nombre_empresa.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <h4 className="text-slate-200 font-medium text-lg break-words leading-tight">
                                {exp.nombre_empresa}
                              </h4>
                              {hasAlert && (
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mt-1 shrink-0" />
                              )}
                            </div>
                            <p className="text-slate-400 text-xs mt-1 break-words">
                              {nombreCliente}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                                Nº {(exp as any).numero_control || "S/C"}
                              </span>
                              <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1 whitespace-nowrap">
                                <MapPin size={10} />{" "}
                                {(exp as any).cliente?.estado || "S/U"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 px-4 max-w-xs w-full">
                          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-2">
                            <span>
                              Fase {completadosExp}/{totalExp}
                            </span>
                            <span>
                              {Math.round((completadosExp / totalExp) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all bg-sky-500`}
                              style={{
                                width: `${(completadosExp / totalExp) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] font-bold ${exp.documentos?.length ? "bg-[#0197D2]/20 text-sky-400 border border-sky-600/20" : "bg-slate-800 text-slate-500 border border-slate-700"}`}
                          >
                            {exp.documentos?.length || 0} Docs
                          </span>
                          <button
                            onClick={() => setSelectedExpedienteId(exp.id)}
                            className="bg-[#0197D2]/10 text-sky-400 border border-sky-600/20 px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#0197D2] hover:text-white transition-all shadow-lg"
                          >
                            Gestionar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {dashTab === "tareas" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <ListTodo size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    Mis Tareas Pendientes
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Siguiente paso a realizar en cada expediente
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {tareasPendientes.length === 0 ? (
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-16 text-center shadow-sm">
                    <CheckCircle2
                      size={48}
                      className="mx-auto text-emerald-500 mb-4"
                    />
                    <p className="text-slate-300 font-black uppercase text-sm">
                      ¡Al día!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tareasPendientes.map((t) => (
                      <div
                        key={t.exp.id}
                        className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-indigo-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-6 flex-1">
                          <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center font-black text-xl text-slate-400 border border-slate-800 group-hover:text-indigo-400 transition-colors">
                            {t.exp.nombre_empresa.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-lg font-black text-white uppercase truncate">
                              {t.exp.nombre_empresa}
                            </h4>
                            <p className="text-xs font-bold text-slate-500 uppercase">
                              {t.exp.cliente?.nombre_completo}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                              Paso {t.currentStep} de {t.totalSteps}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                              {Math.round((t.currentStep / t.totalSteps) * 100)}
                              % Avance
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-200 uppercase leading-snug">
                            {t.hitoActual?.nombre}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedExpedienteId(t.exp.id)}
                          className="px-8 py-3 bg-slate-950 text-white border border-slate-800 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 transition-all shrink-0"
                        >
                          Atender
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {dashTab === "bitacora" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Activity size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    Actividad Reciente
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Seguimiento cronológico de expedientes
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {bitacoraGlobal.length === 0 ? (
                  <div className="text-center py-16">
                    <Activity
                      size={48}
                      className="mx-auto text-slate-700 mb-4"
                    />
                    <p className="text-slate-400 font-bold uppercase text-xs">
                      Sin actividad registrada
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bitacoraGlobal.map((nota) => (
                      <div
                        key={nota.id}
                        className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-start gap-6 hover:border-emerald-500/30 transition-all group cursor-pointer"
                        onClick={() => setSelectedExpedienteId(nota.expId)}
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center text-emerald-500 border border-slate-800 shrink-0">
                          <MessageCircle size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-black text-white uppercase truncate">
                              {nota.empresa}
                            </h4>
                            <span className="text-[10px] font-bold text-slate-500">
                              {new Date(nota.created_at).toLocaleDateString()}{" "}
                              {new Date(nota.created_at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mb-3">
                            "{nota.nota}"
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                              <User size={12} />{" "}
                              {nota.autor?.nombre_completo || "Abogada"}
                            </p>
                            {nota.fecha_proximo_seguimiento && (
                              <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded">
                                Próx:{" "}
                                {new Date(
                                  nota.fecha_proximo_seguimiento + "T12:00:00",
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {dashTab === "agenda" && (
            <div className="space-y-6">
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm max-w-sm">
                <button
                  onClick={() => setAgendaView("lista")}
                  className={`flex-1 px-4 py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${agendaView === "lista" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"}`}
                >
                  <ClipboardList size={14} /> Lista
                </button>
                <button
                  onClick={() => setAgendaView("calendario")}
                  className={`flex-1 px-4 py-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${agendaView === "calendario" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"}`}
                >
                  <Calendar size={14} /> Calendario
                </button>
              </div>
              {agendaView === "lista" && (
                <div className="space-y-6">
                  {recordatoriosVencidos.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
                        <AlertTriangle size={14} /> Vencidos
                      </p>
                      {groupRecordatoriosByExpId(recordatoriosVencidos).map(
                        (g) => (
                          <GroupedRecordatorioCard
                            key={g.expId}
                            group={g}
                            color="red"
                            onClick={() => setSelectedExpedienteId(g.expId)}
                          />
                        ),
                      )}
                    </div>
                  )}
                  {recordatoriosHoy.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-sky-400 uppercase flex items-center gap-2">
                        <Clock size={14} /> Para Hoy
                      </p>
                      {groupRecordatoriosByExpId(recordatoriosHoy).map((g) => (
                        <GroupedRecordatorioCard
                          key={g.expId}
                          group={g}
                          color="sky"
                          onClick={() => setSelectedExpedienteId(g.expId)}
                        />
                      ))}
                    </div>
                  )}
                  {recordatoriosFuturos.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-sky-400 uppercase flex items-center gap-2">
                        <Calendar size={14} /> Próximos
                      </p>
                      {groupRecordatoriosByExpId(recordatoriosFuturos).map(
                        (g) => (
                          <GroupedRecordatorioCard
                            key={g.expId}
                            group={g}
                            color="sky"
                            onClick={() => setSelectedExpedienteId(g.expId)}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
              {agendaView === "calendario" && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase">
                      {new Date(
                        calendarDays.year,
                        calendarDays.month,
                      ).toLocaleDateString("es-MX", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <span className="bg-[#0197D2]/20 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                      {recordatoriosPendientes.length} pendientes
                    </span>
                  </div>
                  <div className="grid grid-cols-7 bg-slate-950/50 border-b border-slate-800">
                    {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                      (d) => (
                        <div
                          key={d}
                          className="py-2 text-center text-[10px] font-bold text-slate-500 uppercase"
                        >
                          {d}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: calendarDays.firstDay }).map(
                      (_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="h-24 border-b border-r border-slate-800/30"
                        />
                      ),
                    )}
                    {calendarDays.days.map(({ date, day, recs }) => {
                      const isHoy = date === hoy;
                      const hasRecs = recs.length > 0;
                      return (
                        <div
                          key={date}
                          className={`h-24 border-b border-r border-slate-800/30 p-2 relative transition-colors ${hasRecs ? "bg-[#0197D2]/5 hover:bg-[#0197D2]/10 cursor-pointer" : "hover:bg-slate-800/30"} ${isHoy ? "bg-[#0197D2]/10" : ""}`}
                        >
                          <span
                            className={`text-xs font-bold ${isHoy ? "text-sky-400 bg-[#0197D2]/20 rounded w-6 h-6 flex items-center justify-center" : "text-slate-500"}`}
                          >
                            {day}
                          </span>
                          {hasRecs && (
                            <div className="mt-1.5 space-y-1">
                              {groupRecordatoriosByExpId(recs)
                                .slice(0, 2)
                                .map((g) => (
                                  <div
                                    key={g.expId}
                                    onClick={() =>
                                      setSelectedExpedienteId(g.expId)
                                    }
                                    className="text-[9px] font-bold text-sky-300 bg-[#0197D2]/20 rounded px-1.5 py-0.5 truncate cursor-pointer hover:bg-[#0197D2]/30 transition-colors"
                                  >
                                    {g.empresa}{" "}
                                    {g.recordatorios.length > 1
                                      ? `(${g.recordatorios.length})`
                                      : ""}
                                  </div>
                                ))}
                              {groupRecordatoriosByExpId(recs).length > 2 && (
                                <div className="text-[9px] font-bold text-slate-500 px-1">
                                  +{groupRecordatoriosByExpId(recs).length - 2}{" "}
                                  más
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  const contrato =
    (selectedExpediente as any).contratos?.[0] ||
    (selectedExpediente as any).contrato;
  const isPdf = (url: string | undefined | null) =>
    url?.toLowerCase().endsWith(".pdf");
  const urlContratoDoble = isPdf(contrato?.url_pdf_doble_firma)
    ? contrato?.url_pdf_doble_firma
    : null;
  const urlContratoGenerado = isPdf(contrato?.url_pdf_generado)
    ? contrato?.url_pdf_generado
    : null;
  const urlContratoCliente = isPdf(contrato?.url_pdf_firmado_cliente)
    ? contrato?.url_pdf_firmado_cliente
    : null;
  const recordatorios =
    (selectedExpediente as any).recordatorios || ([] as Recordatorio[]);
  const integrantes =
    (selectedExpediente as any).integrantes || ([] as ExpedienteIntegrante[]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans overflow-x-hidden p-6 md:p-8">
      <div className="max-w-[1600px] w-full mx-auto space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <button
            onClick={closeDetail}
            className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-sm transition-all bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-800"
          >
            ← Volver al Listado
          </button>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <NotificationStatusIndicator />
            <div className="hidden md:block h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-3 flex-1 md:flex-initial justify-end">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Nº Control:
              </span>
              <input
                type="text"
                defaultValue={(selectedExpediente as any).numero_control || ""}
                onBlur={(e) => handleUpdateControl(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-sky-600 w-full md:w-48 shadow-sm transition-all"
              />
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col lg:flex-row justify-between gap-8 items-center shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="space-y-3 relative z-10 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">
              {selectedExpediente.nombre_empresa}
            </h1>
            <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-4 justify-center lg:justify-start">
              <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border border-slate-700">
                {(selectedExpediente as any).figura?.descripcion ||
                  "Sin figura legal"}
              </span>
              <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                <User size={16} />{" "}
                {(selectedExpediente as any).cliente?.nombre_completo ||
                  "Sin cliente titular"}
              </p>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-center lg:justify-end gap-4">
            {urlContratoDoble || urlContratoGenerado || urlContratoCliente ? (
              <a
                href={`/api/r2/download?url=${encodeURIComponent(urlContratoDoble || urlContratoGenerado || urlContratoCliente || "")}`}
                target="_blank"
                className="flex items-center gap-3 px-6 py-3 bg-[#0197D2]/10 text-sky-400 border border-sky-600/20 rounded-xl font-bold hover:bg-[#0197D2] hover:text-white transition-all shadow-lg"
              >
                <FileSignature size={20} />{" "}
                {urlContratoDoble
                  ? "Contrato Final"
                  : urlContratoGenerado
                    ? "Contrato Generado"
                    : "Contrato Cliente"}
              </a>
            ) : (
              <span className="flex items-center gap-3 px-6 py-3 bg-red-600/10 text-red-400 border border-red-500/30 rounded-xl font-bold opacity-50 cursor-not-allowed">
                <AlertCircle size={20} /> Sin contrato PDF
              </span>
            )}
            <div className="hidden md:block h-8 w-px bg-slate-800 mx-2" />
            <a
              href={`https://wa.me/52${(selectedExpediente as any).cliente?.telefono?.replace(/\D/g, "")}`}
              target="_blank"
              className="flex items-center gap-3 px-6 py-3 bg-[#0197D2] text-white rounded-xl font-bold hover:bg-sky-500 transition-all shadow-lg shadow-sky-600/20"
              title="Enviar WhatsApp al Cliente"
            >
              <MessageCircle size={20} /> Contacto
            </a>
          </div>
        </div>
        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-2 md:p-3 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {[
              {
                id: "etapa_legal",
                label: "1. Etapa Legal",
                icon: <ClipboardList size={16} />,
              },
              {
                id: "documentacion",
                label: "2. CheckList Docs",
                icon: <BookOpen size={16} />,
              },
              {
                id: "seguimiento_proceso",
                label: "3. Proceso General",
                icon: <CheckCircle2 size={16} />,
              },
              {
                id: "entregables",
                label: "4. Entregables",
                icon: <CheckSquare size={16} />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id ? "bg-[#0197D2] text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 min-h-[600px] overflow-hidden">
          {activeTab === "etapa_legal" && (
            <div className="p-8 space-y-8 bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-200 flex items-center gap-3">
                  <FileText size={24} className="text-red-400" /> Concentrado de
                  Datos
                </h3>
                <button
                  onClick={handleSaveConcentrado}
                  disabled={isSavingConcentrado}
                  className="px-6 py-2 bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-500 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingConcentrado ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Guardar Cambios"
                  )}
                </button>
              </div>
              <div className="space-y-8 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {[
                  {
                    titulo: "1. Datos del Cliente Titular",
                    campos: [
                      "nombre_completo",
                      "telefono_cliente",
                      "rfc",
                      "curp",
                      "estado_civil",
                      "ocupacion",
                      "domicilio_completo",
                      "estado",
                    ],
                  },
                  {
                    titulo: "2. Datos de la Asociación y Legal",
                    campos: [
                      "actividad",
                      "cluni",
                      "estatus_rpp",
                      "folio_rpp",
                      "libro_rpp",
                      "volumen_rpp",
                      "notaria",
                      "pago_notario",
                      "objeto_social_ventas",
                    ],
                  },
                  {
                    titulo: "3. Datos de Pagos y Contrato",
                    campos: [
                      "asesora_encargada",
                      "vendedora",
                      "quien_cobra",
                      "total_contrato",
                      "periodicidad_pagos",
                      "pago_entrega_donataria",
                      "cantidad_cobrar_proximo",
                      "num_pagos_realizados",
                      "cantidad_pagada_acumulada",
                      "saldo_cliente",
                      "fecha_ultimo_pago",
                      "fecha_contrato",
                    ],
                  },
                  {
                    titulo: "4. Seguimiento y Estatus",
                    campos: [
                      "estatus_detalle",
                      "accion_realizar",
                      "link_reunion",
                      "fecha_reunion_acuerdos",
                    ],
                  },
                ].map((seccion) => (
                  <div
                    key={seccion.titulo}
                    className="bg-slate-950/30 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm"
                  >
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">
                      {seccion.titulo}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {seccion.campos.map((campo) => (
                        <div key={campo} className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {campo.replace(/_/g, " ")}
                          </label>
                          {campo === "objeto_social_ventas" ? (
                            <textarea
                              value={concentradoForm[campo] || ""}
                              onChange={(e) =>
                                handleConcentradoChange(campo, e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 min-h-[120px] outline-none focus:border-sky-600"
                            />
                          ) : (
                            <input
                              type="text"
                              value={concentradoForm[campo] || ""}
                              onChange={(e) =>
                                handleConcentradoChange(campo, e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-sky-600"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "documentacion" && (
            <div className="p-6 md:p-8 space-y-8 bg-slate-950 min-h-full">
              <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-200 flex items-center gap-3">
                    <Users size={24} className="text-sky-400" /> Integrantes de
                    Firma
                  </h3>
                  <button
                    onClick={() => {
                      const nombre = prompt(
                        "Ingresa el nombre del documento que deseas subir:",
                      );
                      if (nombre && nombre.trim()) {
                        setDocumentosExtrasDisponibles((prev) => [
                          ...prev,
                          nombre.trim(),
                        ]);
                      }
                    }}
                    className="bg-[#0197D2] text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-sky-500 transition-all"
                  >
                    <FileUp size={16} /> Subir Documento Extra
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {integrantes.map((int: any) => (
                    <div
                      key={int.id}
                      className="group bg-slate-950/50 p-5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-sm transition-all hover:border-sky-600/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                          <User size={20} />
                        </div>
                        <p className="font-bold text-sm text-slate-300 uppercase">
                          {int.nombre_completo}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteIntegrante(int.id)}
                        className="p-2 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar Integrante"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 max-w-xl">
                  <input
                    type="text"
                    value={nuevoIntegrante}
                    onChange={(e) => setNuevoIntegrante(e.target.value)}
                    placeholder="Nombre del socio o integrante..."
                    className="flex-1 px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-sm outline-none focus:border-sky-600 text-slate-200 placeholder-slate-500"
                  />
                  <button
                    onClick={handleAddIntegrante}
                    disabled={!nuevoIntegrante.trim() || isAgregandoIntegrante}
                    className="px-5 py-2.5 bg-[#0197D2] text-white font-bold text-sm rounded-xl hover:bg-sky-500 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAgregandoIntegrante ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserPlus size={16} />
                    )}{" "}
                    Agregar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(() => {
                  const docsGenerales =
                    selectedExpediente.documentos?.filter(
                      (d) => !d.integrante_id,
                    ) || [];
                  const modelPersonal = DOCS_PERSONALES.map((t) => {
                    const dbType = DOCS_MAP[t] || t;
                    const found = docsGenerales.find((d) => d.tipo === dbType);
                    return {
                      type: t,
                      label: t,
                      url: found?.url_archivo,
                      docId: found?.id,
                      validado: found?.validado,
                      motivo_rechazo: found?.motivo_rechazo,
                      solicitud_borrado: found?.solicitud_borrado,
                      motivo_borrado: found?.motivo_borrado,
                      estatus_borrado: found?.estatus_borrado,
                    };
                  });
                  return (
                    <DocumentStage
                      title="Datos Personales del Cliente"
                      color="sky"
                      docs={modelPersonal}
                      onUpload={handleFileUpload}
                      uploadingType={uploadingType}
                      onDelete={handleDeleteDocument}
                    />
                  );
                })()}
                {(() => {
                  const docsGenerales =
                    selectedExpediente.documentos?.filter(
                      (d) => !d.integrante_id,
                    ) || [];
                  const modelProceso = DOCS_PROCESO.map((t) => {
                    const dbType = DOCS_MAP[t] || t;
                    const found = docsGenerales.find((d) => d.tipo === dbType);
                    return {
                      type: t,
                      label: t,
                      url: found?.url_archivo,
                      docId: found?.id,
                      validado: found?.validado,
                      motivo_rechazo: found?.motivo_rechazo,
                      solicitud_borrado: found?.solicitud_borrado,
                      motivo_borrado: found?.motivo_borrado,
                      estatus_borrado: found?.estatus_borrado,
                    };
                  });
                  return (
                    <DocumentStage
                      title="Documentación del Proceso"
                      color="sky"
                      docs={modelProceso}
                      onUpload={handleFileUpload}
                      uploadingType={uploadingType}
                      onDelete={handleDeleteDocument}
                    />
                  );
                })()}
                {integrantes.map((int: any) => {
                  const susDocs =
                    selectedExpediente.documentos?.filter(
                      (d) => d.integrante_id === int.id,
                    ) || [];
                  const model = DOCS_CATALOGO.filter(
                    (t) => !["PAGO INICIAL"].includes(t),
                  ).map((t) => {
                    const dbType = DOCS_MAP[t] || t;
                    const found = susDocs.find((d) => d.tipo === dbType);
                    return {
                      type: t,
                      label: t,
                      url: found?.url_archivo,
                      docId: found?.id,
                      validado: found?.validado,
                      motivo_rechazo: found?.motivo_rechazo,
                      solicitud_borrado: found?.solicitud_borrado,
                      motivo_borrado: found?.motivo_borrado,
                      estatus_borrado: found?.estatus_borrado,
                    };
                  });
                  return (
                    <DocumentStage
                      key={int.id}
                      title={`Expediente de ${int.nombre_completo}`}
                      color="sky"
                      docs={model}
                      onUpload={handleFileUpload}
                      uploadingType={uploadingType}
                      integranteId={int.id}
                      onDelete={handleDeleteDocument}
                    />
                  );
                })}
                {documentosExtrasDisponibles.length > 0 &&
                  (() => {
                    const docsGenerales =
                      selectedExpediente.documentos?.filter(
                        (d) => !d.integrante_id,
                      ) || [];
                    const modelExtras = documentosExtrasDisponibles.map((t) => {
                      const dbType = t;
                      const found = docsGenerales.find(
                        (d) => d.tipo === dbType,
                      );
                      return {
                        type: t,
                        label: t,
                        url: found?.url_archivo,
                        docId: found?.id,
                        validado: found?.validado,
                        motivo_rechazo: found?.motivo_rechazo,
                        solicitud_borrado: found?.solicitud_borrado,
                        motivo_borrado: found?.motivo_borrado,
                        estatus_borrado: found?.estatus_borrado,
                      };
                    });
                    return (
                      <DocumentStage
                        title="Documentos Extras"
                        color="sky"
                        docs={modelExtras}
                        onUpload={handleFileUpload}
                        uploadingType={uploadingType}
                        onDelete={handleDeleteDocument}
                      />
                    );
                  })()}
              </div>
            </div>
          )}
          {activeTab === "seguimiento_proceso" && (
            <div className="p-6 md:p-8 bg-slate-950 min-h-full grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-4">
                  <ClipboardList size={20} className="text-sky-400" /> Flujo de
                  Hitos Legales
                </h3>
                <div className="space-y-3">
                  {hitosLegales.map((hito, idx) => {
                    const isCompletedDb =
                      selectedExpediente.seguimiento_tareas?.find(
                        (st) => st.hito_id === hito.id,
                      )?.estatus === "completado";
                    const isCompleted =
                      hitosLocales[hito.id] !== undefined
                        ? hitosLocales[hito.id]
                        : isCompletedDb;
                    const isProcessing = updatingHitoId === hito.id.toString();
                    const hasReminder = recordatorios.some(
                      (r: any) =>
                        r.titulo === hito.nombre && r.estatus === "pendiente",
                    );
                    const isOverdue = recordatorios.some(
                      (r: any) =>
                        r.titulo === hito.nombre &&
                        r.estatus === "pendiente" &&
                        r.fecha &&
                        r.fecha < hoy,
                    );
                    let cardBg = isCompleted
                      ? "bg-green-600/10 border-green-600/30"
                      : isOverdue
                        ? "bg-red-900/20 border-red-500/50"
                        : hasReminder
                          ? "bg-yellow-900/20 border-yellow-500/50"
                          : "bg-slate-900 border-slate-800 hover:bg-slate-800";
                    let iconColor = isCompleted
                      ? "text-green-500"
                      : isOverdue
                        ? "text-red-400 hover:text-green-400"
                        : hasReminder
                          ? "text-yellow-400 hover:text-green-400"
                          : "text-slate-500 hover:text-green-400";
                    let textColor = isCompleted
                      ? "text-green-400"
                      : isOverdue
                        ? "text-red-400"
                        : hasReminder
                          ? "text-yellow-400"
                          : "text-slate-300";
                    return (
                      <div
                        key={hito.id}
                        className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border transition-all ${cardBg}`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="relative shrink-0">
                            {isProcessing ? (
                              <Loader2
                                size={24}
                                className="animate-spin text-slate-400"
                              />
                            ) : (
                              <CheckCircle2 size={24} className={iconColor} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${textColor}`}>
                              Paso {idx + 1} de {hitosLegales.length}: {hito.nombre}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 md:ml-auto z-20">
                          {!isCompleted ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleHito(
                                  hito.id.toString(),
                                  true,
                                );
                              }}
                              className="text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all border border-emerald-600/20 whitespace-nowrap"
                            >
                              Marcar Completado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleHito(
                                  hito.id.toString(),
                                  false,
                                );
                              }}
                              className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all border border-slate-700 whitespace-nowrap"
                            >
                              Desmarcar
                            </button>
                          )}
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowReminderForm(hito.nombre);
                              }}
                              className="text-[10px] font-bold text-sky-400 hover:text-white bg-[#0197D2]/10 hover:bg-[#0197D2] px-3 py-1.5 rounded-lg transition-all border border-sky-600/20 whitespace-nowrap"
                            >
                              Programar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-4">
                  <Calendar size={20} className="text-red-400" /> Recordatorios
                  Activos
                </h3>
                <div className="space-y-3">
                  {recordatorios.length === 0 ? (
                    <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800">
                      <p className="text-slate-500 text-sm font-bold">
                        No hay recordatorios pendientes.
                      </p>
                    </div>
                  ) : (
                    recordatorios.map((r: any) => (
                      <div
                        key={r.id}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between gap-4 shadow-sm relative overflow-hidden group"
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${r.estatus === "completado" ? "bg-green-600" : r.fecha < hoy ? "bg-red-600" : "bg-yellow-500"}`}
                        ></div>
                        <div className="pl-2">
                          <p className="text-sm font-bold text-slate-200">
                            {r.titulo}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {r.fecha} {r.hora && `a las ${r.hora}`}
                          </p>
                          {r.notas && (
                            <p className="text-xs text-slate-500 italic mt-2 bg-slate-950 p-2 rounded">
                              "{r.notas}"
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-1">
                            {r.estatus === "pendiente" && (
                              <button
                                onClick={() => {
                                  setSelectedReminderId(r.id);
                                  setShowReminderForm(r.titulo);
                                }}
                                className="px-3 py-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 rounded hover:bg-slate-700 transition-colors border border-slate-700"
                              >
                                Completar
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteReminder(r.id)}
                              className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                              title="Eliminar Recordatorio"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${r.estatus === "completado" ? "bg-green-600/20 text-green-400" : r.fecha < hoy ? "bg-red-600/20 text-red-400" : "bg-yellow-500/20 text-yellow-500"}`}
                          >
                            {r.estatus}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === "entregables" && (
            <div className="space-y-8">
              <div className="relative overflow-hidden bg-[#0197D2] rounded-[3rem] p-12 text-white shadow-2xl">
                <div className="relative z-10 flex flex-col items-end">
                  <div className="text-8xl font-black flex items-baseline">
                    {
                      hitosCapacitacion.filter((h) =>
                        h.id.toString() in hitosLocales
                          ? hitosLocales[h.id.toString()]
                          : selectedExpediente.seguimiento_tareas?.find(
                              (st) => st.hito_id === h.id,
                            )?.estatus === "completado",
                      ).length
                    }
                    <span className="text-3xl opacity-30 ml-2">
                      {" "}
                      / {hitosCapacitacion.length}
                    </span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-sky-400/10 rounded-full blur-[100px] -mr-48 -mt-48" />
              </div>
              <div className="grid grid-cols-1 gap-6">
                {hitosCapacitacion.map((h, i) => {
                  const done =
                    h.id.toString() in hitosLocales
                      ? hitosLocales[h.id.toString()]
                      : selectedExpediente.seguimiento_tareas?.find(
                          (st) => st.hito_id === h.id,
                        )?.estatus === "completado";
                  const isUpdating = updatingHitoId === h.id.toString();
                  return (
                    <div
                      key={h.id}
                      className={`flex items-center gap-10 px-12 py-10 rounded-[3rem] border transition-all ${done ? "bg-[#0197D2]/10 border-sky-600/30" : "bg-slate-900 border-slate-800 hover:border-sky-600/50 shadow-lg shadow-black/20"}`}
                    >
                      <div
                        className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl font-black shrink-0 ${done ? "bg-[#0197D2] text-white" : "bg-slate-800 text-slate-400"}`}
                      >
                        {done ? <CheckCircle2 size={32} /> : i + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p
                          className={`text-2xl font-black uppercase tracking-tight ${done ? "text-sky-400 line-through opacity-50" : "text-slate-200"}`}
                        >
                          {h.nombre}
                        </p>
                        {h.descripcion && (
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {h.descripcion}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleHito(h.id.toString(), !done)}
                        disabled={isUpdating}
                        className={`px-12 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl transition-all ${done ? "bg-[#0197D2]/20 text-sky-400 border border-sky-600/30" : "bg-[#0197D2] text-white hover:bg-sky-500 hover:-translate-y-1"}`}
                      >
                        {isUpdating ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : done ? (
                          "Entregado"
                        ) : (
                          "Marcar"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showReminderForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReminderForm(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 rounded-[3rem] shadow-2xl max-w-6xl w-full p-8 md:p-12 border-4 border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setShowReminderForm(null)}
                className="absolute top-8 right-8 text-slate-400 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
              {(() => {
                const hitoEncontrado = hitos.find(
                  (h) => h.nombre === showReminderForm,
                );
                if (!hitoEncontrado) return null;
                return (
                  <ReminderForm
                    hito={hitoEncontrado}
                    expediente={selectedExpediente}
                    onSuccess={() => setShowReminderForm(null)}
                  />
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReminderForm({
  hito,
  expediente,
  onSuccess,
}: {
  hito: CatalogoHito;
  expediente: ExpedienteAbogada;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const abogadaNombre =
    (expediente as any).asesora?.nombre_completo || "de CECANI";
  const template = useMemo(
    () =>
      getHitoTemplates(
        hito.nombre,
        expediente.nombre_empresa,
        abogadaNombre,
        fecha || new Date().toISOString().split("T")[0],
        hora,
      ),
    [hito.nombre, expediente.nombre_empresa, abogadaNombre, fecha, hora],
  );
  const generatedMessage = useMemo(() => {
    let msg = template.mensaje;
    if (selectedDocs.length > 0)
      msg += `Para continuar con el proceso y aprovechar nuestra cita, es indispensable que nos envíe o tenga listos los siguientes documentos:\n\n- ${selectedDocs.join("\n- ").toUpperCase()}`;
    return msg;
  }, [template.mensaje, selectedDocs]);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fecha) return alert("Selecciona una fecha");
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
      notificar_cliente_whatsapp: false,
    });
    if (res.success) {
      const tel = (expediente as any).cliente?.telefono?.replace(/\D/g, "");
      const waLink = `https://wa.me/52${tel}?text=${encodeURIComponent(generatedMessage)}`;
      window.open(waLink, "_blank");
      onSuccess();
    } else alert(res.error);
    setIsSubmitting(false);
  };
  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 lg:grid-cols-2 gap-16"
    >
      <div className="space-y-10">
        <div className="flex items-center gap-6 text-sky-400">
          <Info size={40} />
          <h3 className="text-3xl font-black uppercase tracking-tighter">
            Programar {template.titulo}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">
              Fecha del Compromiso
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full bg-slate-950/50 border-4 border-slate-800 rounded-3xl p-6 text-base font-bold uppercase outline-none focus:border-sky-500 transition-all text-slate-200"
            />
          </div>
          <div className="space-y-4">
            <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">
              Hora Pactada
            </label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full bg-slate-950/50 border-4 border-slate-800 rounded-3xl p-6 text-base font-bold outline-none focus:border-sky-500 transition-all text-slate-200"
            />
          </div>
        </div>
        <div className="space-y-6">
          <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">
            Documentación Requerida (Sugerencias del Paso)
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(template.sugerencias.length > 0
              ? template.sugerencias
              : DOCS_CATALOGO
            ).map((doc) => (
              <button
                key={doc}
                type="button"
                onClick={() =>
                  setSelectedDocs((p) =>
                    p.includes(doc) ? p.filter((d) => d !== doc) : [...p, doc],
                  )
                }
                className={`text-left px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-4 transition-all shadow-lg ${selectedDocs.includes(doc) ? "bg-[#0197D2] border-sky-400 text-white scale-105 shadow-sky-900/20" : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700"}`}
              >
                {doc}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-slate-950 rounded-[4rem] p-12 border-4 border-sky-900/20 flex flex-col justify-between shadow-inner">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-500">
              Vista Previa WhatsApp (Manual CECANI)
            </p>
            <MessageCircle size={24} className="text-sky-600" />
          </div>
          <div className="bg-slate-800 border-l-8 border-sky-600 p-10 rounded-[2.5rem] text-sm font-bold leading-relaxed uppercase whitespace-pre-wrap shadow-2xl h-[350px] overflow-y-auto custom-scrollbar">
            {generatedMessage}
          </div>
          <div className="bg-red-900/30 border-2 border-red-600/30 p-6 rounded-3xl flex gap-4 items-center">
            <AlertCircle className="text-red-600 shrink-0" size={24} />
            <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">
              Al habilitar, el mensaje se enviará de inmediato por WhatsApp con
              los datos seleccionados.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-8 bg-[#0197D2] hover:bg-sky-500 rounded-[2.5rem] text-sm font-black uppercase tracking-[0.35em] shadow-3xl transition-all disabled:opacity-50 hover:-translate-y-1 active:scale-95"
        >
          {isSubmitting
            ? "Procesando..."
            : "Habilitar Compromiso y Abrir WhatsApp"}
        </button>
      </div>
    </form>
  );
}

function ConcentradoCard({ title, children, color, className = "" }: any) {
  const colors: any = {
    slate: "border-slate-800 bg-slate-950/50 text-slate-200",
    sky: "border-sky-900/50 bg-sky-950/30 text-sky-400",
  };
  return (
    <div
      className={`p-6 md:p-8 rounded-3xl border-2 shadow-lg space-y-6 transition-all hover:shadow-xl ${colors[color] || colors.slate} ${className}`}
    >
      <h3 className="text-xs md:text-sm font-black uppercase tracking-widest border-b-2 border-current/10 pb-4 text-center">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function ConcentradoField({ l, c, value, onChange }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] md:text-[11px] font-bold uppercase opacity-70 tracking-widest ml-2">
        {l}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(c, e.target.value)}
        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-xs md:text-sm font-semibold uppercase outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-500 transition-all shadow-sm text-slate-200"
      />
    </div>
  );
}
function SidebarLink({
  icon,
  label,
  badge,
  badgeColor = "sky",
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: "sky" | "red";
  active: boolean;
  onClick: () => void;
}) {
  const badgeStyles = {
    sky: "bg-[#0197D2] text-white",
    red: "bg-red-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all text-left ${active ? "bg-[#0197D2] text-white shadow-xl shadow-sky-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span
          className={`text-[9px] font-black px-2 py-0.5 rounded-full ${badgeStyles[badgeColor]}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
function groupRecordatoriosByExpId(recs: any[]) {
  const groups: Record<
    string,
    {
      expId: string;
      empresa: string;
      clienteNombre: string;
      recordatorios: any[];
    }
  > = {};
  recs.forEach((r) => {
    if (!groups[r.expId]) {
      groups[r.expId] = {
        expId: r.expId,
        empresa: r.empresa,
        clienteNombre: r.clienteNombre,
        recordatorios: [],
      };
    }
    groups[r.expId].recordatorios.push(r);
  });
  return Object.values(groups);
}
function GroupedRecordatorioCard({
  group,
  color,
  onClick,
}: {
  group: any;
  color: "red" | "sky";
  onClick: (expId: string) => void;
}) {
  const colors = {
    red: {
      bg: "bg-rose-950/20",
      border: "border-rose-900/50",
      text: "text-rose-400",
      headerBg: "bg-rose-900/10",
    },
    sky: {
      bg: "bg-sky-950/20",
      border: "border-sky-900/50",
      text: "text-sky-400",
      headerBg: "bg-sky-900/10",
    },
  };
  const c = colors[color] || colors.sky;
  return (
    <div
      className={`${c.bg} border ${c.border} rounded-2xl overflow-hidden shadow-sm`}
    >
      <div
        className={`${c.headerBg} border-b ${c.border} px-5 py-3 flex items-center justify-between`}
      >
        <div className="min-w-0 pr-4">
          <h4 className="text-sm font-black text-slate-200 uppercase tracking-wide truncate">
            {group.empresa}
          </h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase truncate">
            {group.clienteNombre}
          </p>
        </div>
        <button
          onClick={() => onClick(group.expId)}
          className={`shrink-0 text-[10px] font-bold ${c.text} bg-slate-900 border ${c.border} px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all`}
        >
          Ver Expediente
        </button>
      </div>
      <div className="p-3 space-y-2">
        {group.recordatorios.map((r: any) => (
          <div
            key={r.id}
            className="flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-1.5 h-8 rounded-full shrink-0 ${color === "red" ? "bg-rose-500" : "bg-sky-500"}`}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-300 uppercase leading-tight truncate">
                  {r.titulo}
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 truncate">
                  {r.tipo || "General"}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 pl-2">
              {r.fecha && color === "sky" && (
                <p
                  className={`text-[9px] font-black uppercase ${c.text} mb-0.5`}
                >
                  {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
              {r.fecha && color === "red" && (
                <p
                  className={`text-[9px] font-black uppercase ${c.text} mb-0.5`}
                >
                  Venció:{" "}
                  {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
              <p className="text-[10px] font-black text-slate-400 uppercase">
                {r.hora || "Todo el día"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
