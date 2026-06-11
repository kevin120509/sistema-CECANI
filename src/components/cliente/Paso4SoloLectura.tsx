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
  UserPlus,
  Sparkles
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
  otro: 'Otro Documento',
};

const ESTATUS_CONFIG: Record<string, { label: string, color: string, icon: any, desc: string, glow: string }> = {
  revision_directora: {
    label: 'Validación de Perfil',
    color: 'border-sky-500/20 bg-slate-900/80 text-sky-400',
    glow: 'shadow-[0_0_50px_rgba(14,165,233,0.1)]',
    icon: <ShieldCheck size={32} />,
    desc: 'Su expediente ha sido resguardado con éxito. Muy pronto se le asignará una asesora legal senior, quien coordinará el inicio de su estructura corporativa.'
  },
  en_proceso: {
    label: 'Trámite en Curso',
    color: 'border-amber-500/20 bg-slate-900/80 text-amber-400',
    glow: 'shadow-[0_0_50px_rgba(245,158,11,0.1)]',
    icon: <Clock size={32} />,
    desc: 'Su trámite se encuentra en fase activa de gestión. Su asesora asignada le mantendrá informado sobre cada hito alcanzado en su proceso legal.'
  },
  completado: {
    label: 'Proceso Finalizado',
    color: 'border-emerald-500/20 bg-slate-900/80 text-emerald-400',
    glow: 'shadow-[0_0_50px_rgba(16,185,129,0.1)]',
    icon: <CheckCircle2 size={32} />,
    desc: '¡Misión Cumplida! Su trámite ha sido completado con éxito. Toda su documentación oficial ha sido integrada a su archivo permanente digital.'
  },
  rechazado: {
    label: 'Atención Requerida',
    color: 'border-rose-500/20 bg-slate-900/80 text-rose-400',
    glow: 'shadow-[0_0_50px_rgba(244,63,94,0.1)]',
    icon: <AlertCircle size={32} />,
    desc: 'Se han detectado observaciones críticas en la información proporcionada. Por favor, póngase en contacto con nuestro equipo de soporte legal.'
  },
};

export default function Paso4SoloLectura({
  expediente,
  contrato,
  documentos,
}: Paso4Props) {
  const config = ESTATUS_CONFIG[expediente.estatus] || ESTATUS_CONFIG.revision_directora;
  const pendienteAsignar = !expediente.asesora_id && (contrato?.url_pdf_firmado_cliente || documentos.some(d => d.tipo === 'contrato_firmado'));

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24 py-4">
      {/* Status Banner Premium */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl border-2 p-10 md:p-14 shadow-2xl relative overflow-hidden ${config.color} ${config.glow}`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
          <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-2xl shrink-0 group">
             <div className="transition-transform duration-500 group-hover:scale-110">
               {config.icon}
             </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Estatus de Expediente</h2>
              <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border ${config.color}`}>
                {config.label}
              </span>
            </div>
            <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-2xl">
              {config.desc}
            </p>
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#0197D2]/5 rounded-full blur-[100px]" />
      </motion.div>

      {/* Alerta de Asignación Pendiente */}
      {pendienteAsignar && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0197D2]/10 rounded-3xl p-8 text-white flex items-center gap-8 shadow-2xl border border-sky-600/20 overflow-hidden relative"
        >
          <div className="w-16 h-16 bg-[#0197D2] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.4)] shrink-0 animate-pulse relative z-10">
            <UserPlus size={28} className="text-white" />
          </div>
          <div className="relative z-10">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] text-sky-400 mb-1">Vinculación en Trámite</h4>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-relaxed max-w-xl">
              Su instrumentación ha sido recibida correctamente. Nuestro departamento de operaciones está asignando su expediente a una especialista senior.
            </p>
          </div>
          <Sparkles className="absolute right-10 top-1/2 -translate-y-1/2 text-sky-600/20" size={64} />
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Información General */}
        <div className="lg:col-span-4 space-y-10">
          <section className="bg-slate-900 rounded-3xl p-10 shadow-2xl border border-slate-800">
            <header className="flex items-center gap-4 mb-10 border-b border-slate-800 pb-8">
              <div className="w-10 h-10 bg-slate-950 text-sky-400 rounded-xl flex items-center justify-center border border-slate-800 shadow-lg"><Building2 size={20} /></div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Expediente</h3>
            </header>
            
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.4em] mb-3">Razón Social</p>
                <p className="text-2xl font-black text-white tracking-tighter leading-tight uppercase">{expediente.nombre_empresa}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3">Fecha de Apertura</p>
                <div className="flex items-center gap-3 text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                  <Calendar size={14} className="text-sky-500/40" />
                  {new Date(expediente.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                </div>
              </div>
            </div>
          </section>

          {/* Descargas Rápidas */}
          {contrato?.url_pdf_generado && (
            <section className="bg-slate-950 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden group border border-slate-800">
              <header className="flex items-center gap-4 mb-10 relative z-10">
                <div className="w-10 h-10 bg-[#0197D2] text-white rounded-xl flex items-center justify-center shadow-lg"><Download size={20} /></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400">Downloads</h3>
              </header>
              
              <div className="space-y-4 relative z-10">
                <QuickLink label="Contrato Oficial" href={contrato.url_pdf_generado} />
                {(contrato.url_pdf_firmado_cliente || documentos.find(d => d.tipo === 'contrato_firmado')?.url_archivo) && (
                  <QuickLink label="Copia Firmada" href={contrato.url_pdf_firmado_cliente || documentos.find(d => d.tipo === 'contrato_firmado')!.url_archivo!} isSuccess />
                )}
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#0197D2]/10 rounded-full blur-[100px] group-hover:bg-[#0197D2]/20 transition-all duration-1000" />
            </section>
          )}
        </div>

        {/* Historial de Documentos */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 shadow-2xl border border-slate-800">
            <header className="flex items-center gap-6 border-b border-slate-800 pb-10 mb-10">
              <div className="w-14 h-14 bg-slate-950 text-sky-500 rounded-2xl flex items-center justify-center shadow-inner border border-slate-800"><FileText size={28} /></div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-sky-500 mb-2">Archivo Digital</h4>
                <p className="text-sm font-black uppercase tracking-widest text-white/80">Documentación de Resguardo Legal</p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-6">
              {documentos.length === 0 ? (
                <div className="text-center py-24 bg-slate-950/50 rounded-3xl border-2 border-dashed border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-700">Repositorio Vacío</p>
                </div>
              ) : (
                documentos.map((doc, idx) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-8 rounded-3xl bg-slate-950/40 border border-slate-800 hover:border-sky-500/30 hover:shadow-2xl transition-all duration-500 group"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-lg border ${doc.validado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#0197D2]/10 text-sky-400 border-sky-600/20'}`}>
                        {doc.validado ? <CheckCircle2 size={32} /> : <FileText size={32} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white mb-1">{TIPO_LABELS[doc.tipo] || doc.tipo}</h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sincronizado: {new Date(doc.created_at).toLocaleDateString('es-MX')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className={`hidden sm:flex items-center gap-2 px-5 py-2 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-lg ${doc.validado ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-sky-400 bg-[#0197D2]/10 border-sky-600/20'}`}>
                        {doc.validado ? 'Validado' : 'Revisión'}
                      </div>
                      
                      <a
                        href={doc.url_archivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center hover:bg-[#0197D2] hover:text-white hover:border-sky-500 shadow-2xl transition-all duration-500 active:scale-90 group-hover:shadow-sky-600/20"
                      >
                        <ExternalLink size={20} />
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
        flex items-center justify-between p-6 rounded-2xl border transition-all duration-500 group/link
        ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border transition-all duration-500 group-hover/link:scale-110 ${isSuccess ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-950 text-white border-slate-800'}`}>
          <FileText size={18} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80 group-hover/link:opacity-100 transition-opacity">{label}</span>
      </div>
      <ExternalLink size={16} className="opacity-30 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all text-sky-400" />
    </a>
  );
}
