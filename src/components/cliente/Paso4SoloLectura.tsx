'use client';

import type { Contrato, Documento, Expediente } from '@/types/database';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Download, 
  Building2, 
  Calendar,
  ExternalLink,
  ShieldCheck,
  UserPlus
} from 'lucide-react';

interface Paso4Props {
  expediente: Expediente;
  contrato: Contrato | null;
  documentos: Documento[];
}

const TIPO_LABELS: Record<string, string> = {
  ine_frente: 'INE (Frente)',
  ine_reverso: 'INE (Reverso)',
  comprobante_domicilio: 'Comprobante de Domicilio',
  contrato_firmado: 'Contrato Firmado',
  comprobante_pago: 'Comprobante de Pago',
  otro: 'Otro',
};

const ESTATUS_CONFIG: Record<string, { label: string, color: string, icon: any, desc: string }> = {
  revision_directora: {
    label: 'Validación de Perfil',
    color: 'text-sky-400 bg-sky-950/40 border-sky-900',
    icon: <ShieldCheck />,
    desc: 'Tu expediente ha sido enviado con éxito. Muy pronto se te asignará una asesora, quien te contactará personalmente para dar seguimiento.'
  },
  en_proceso: {
    label: 'Trámite en Curso',
    color: 'text-amber-400 bg-amber-950/40 border-amber-900',
    icon: <Clock />,
    desc: 'Tu trámite está en proceso. Tu asesora asignada te mantendrá informado sobre cada avance en la estructura legal.'
  },
  completado: {
    label: 'Proceso Finalizado',
    color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900',
    icon: <CheckCircle2 />,
    desc: '¡Tu trámite ha sido completado exitosamente! La documentación oficial ha sido integrada a tu archivo permanente.'
  },
  rechazado: {
    label: 'Requiere Atención',
    color: 'text-rose-400 bg-rose-950/40 border-rose-900',
    icon: <AlertCircle />,
    desc: 'Se han detectado inconsistencias en la información proporcionada. Por favor, contacta a soporte técnico.'
  },
};

/**
 * Componente: Paso4SoloLectura
 * Habilidades Aplicadas:
 * - frontend-design (Premium Dashboard Summary)
 * - tailwind-css-patterns (Status indicators & Cards)
 */
export default function Paso4SoloLectura({
  expediente,
  contrato,
  documentos,
}: Paso4Props) {
  const config = ESTATUS_CONFIG[expediente.estatus] || ESTATUS_CONFIG.revision_directora;
  const pendienteAsignar = !expediente.asesora_id && contrato?.url_pdf_firmado_cliente;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Status Banner Premium */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-[2.5rem] border-2 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] ${config.color} overflow-hidden relative`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <div className="w-20 h-20 rounded-3xl bg-slate-900/80 backdrop-blur-md flex items-center justify-center shadow-sm shrink-0">
            {config.icon}
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">¡Gracias por tu confianza!</h2>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Estatus Actual:</span>
              <span className="text-xs font-black uppercase tracking-widest">{config.label}</span>
            </div>
            <p className="text-sm font-medium leading-relaxed max-w-xl opacity-80">
              {config.desc}
            </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
      </motion.div>

      {/* Alerta de Asignación Pendiente */}
      {pendienteAsignar && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-900 rounded-[2rem] p-6 text-white flex items-center gap-6 shadow-2xl border border-white/5"
        >
          <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0 animate-pulse">
            <UserPlus size={24} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-sky-400">Asignación en Trámite</h4>
            <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-tight">
              Tu contrato ha sido recibido. Estamos vinculando tu expediente con una asesora legal senior.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Información General */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 rounded-[2.5rem] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-800">
            <header className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-slate-950 text-white rounded-lg flex items-center justify-center shadow-md"><Building2 size={16} /></div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Expediente</h3>
            </header>
            
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest leading-none">Razón Social</p>
                <p className="text-lg font-black text-white tracking-tight leading-tight">{expediente.nombre_empresa}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Fecha de Apertura</p>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-tight">
                  <Calendar size={12} className="opacity-40" />
                  {new Date(expediente.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                </div>
              </div>
            </div>
          </section>

          {/* Descargas Rápidas */}
          {contrato?.url_pdf_generado && (
            <section className="bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <header className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-8 h-8 bg-sky-500 text-white rounded-lg flex items-center justify-center shadow-lg"><Download size={16} /></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">Documentos Oficiales</h3>
              </header>
              
              <div className="space-y-3 relative z-10">
                <QuickLink label="Contrato Digital" href={contrato.url_pdf_generado} />
                {contrato.url_pdf_firmado_cliente && (
                  <QuickLink label="Copia Firmada" href={contrato.url_pdf_firmado_cliente} isSuccess />
                )}
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all duration-1000" />
            </section>
          )}
        </div>

        {/* Historial de Documentos */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-12 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] border border-slate-800">
            <header className="flex items-center gap-4 border-b border-slate-800 pb-8 mb-8">
              <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-inner"><FileText size={20} /></div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Archivo Digital</h4>
                <p className="text-xs font-black uppercase tracking-tight text-white">Documentación integrada al sistema</p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-4">
              {documentos.length === 0 ? (
                <div className="text-center py-20 bg-slate-950/50 rounded-[2.5rem] border-2 border-dashed border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Archivo vacío</p>
                </div>
              ) : (
                documentos.map((doc, idx) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-6 rounded-[2rem] bg-slate-900 border border-slate-800 hover:border-sky-800 hover:shadow-xl hover:shadow-sky-900/10 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all group-hover:scale-110 ${doc.validado ? 'bg-emerald-950/40 text-emerald-400' : 'bg-slate-800/50 text-slate-500'}`}>
                        {doc.validado ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-white">{TIPO_LABELS[doc.tipo] || doc.tipo}</h4>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Subido el {new Date(doc.created_at).toLocaleDateString('es-MX')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {doc.validado ? (
                        <span className="hidden sm:flex items-center gap-1.5 text-emerald-400 text-[8px] font-black uppercase bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-900 tracking-widest">
                          Validado
                        </span>
                      ) : (
                        <span className="hidden sm:flex text-slate-500 text-[8px] font-black uppercase bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700 tracking-widest">
                          En revisión
                        </span>
                      )}
                      
                      <a
                        href={doc.url_archivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center hover:bg-sky-600 hover:text-white hover:border-sky-600 shadow-sm transition-all duration-300 active:scale-90"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ label, href, isSuccess = false }: { label: string, href: string, isSuccess?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group/link
        ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isSuccess ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white'}`}>
          <FileText size={14} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest opacity-90">{label}</span>
      </div>
      <ExternalLink size={14} className="opacity-30 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all" />
    </a>
  );
}
