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
  comprobante_pago: 'Comprobante de Inversión',
};

const ESTATUS_CONFIG: Record<string, { label: string, color: string, icon: any, desc: string }> = {
  revision_directora: {
    label: 'Validación de Perfil',
    color: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: <ShieldCheck size={24} />,
    desc: 'Su expediente ha sido resguardado. Dirección está asignando su abogada titular.'
  },
  en_proceso: {
    label: 'Trámite en Curso',
    color: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: <Clock size={24} />,
    desc: 'Su trámite se encuentra en fase activa de gestión legal.'
  },
  completado: {
    label: 'Proceso Finalizado',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: <CheckCircle2 size={24} />,
    desc: 'Su trámite ha sido completado con éxito. Documentación integrada.'
  },
};

export default function Paso4SoloLectura({ expediente, contrato, documentos }: Paso4Props) {
  const config = ESTATUS_CONFIG[expediente.estatus] || ESTATUS_CONFIG.revision_directora;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className={`card-base p-8 border-l-4 ${config.color.split(' ')[2]}`}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${config.color.split(' ')[0]} ${config.color.split(' ')[1]}`}>
            {config.icon}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Estatus: {config.label}</h2>
            </div>
            <p className="text-slate-500 text-sm font-medium">{config.desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card-base">
            <div className="card-header bg-slate-50/50">Detalles del Proyecto</div>
            <div className="card-content space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Razón Social</label>
                <p className="font-bold text-slate-800 uppercase text-sm">{expediente.nombre_empresa}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Apertura</label>
                <p className="text-slate-600 text-xs font-bold">{new Date(expediente.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {contrato?.url_pdf_generado && (
            <div className="card-base bg-white">
              <div className="card-header bg-slate-50/50">Descargas</div>
              <div className="card-content space-y-2">
                <a href={contrato.url_pdf_generado} target="_blank" className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all group">
                  <span className="text-[10px] font-bold uppercase text-slate-600">Contrato Original</span>
                  <Download size={14} className="text-slate-400 group-hover:text-blue-600" />
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="card-base">
            <div className="card-header bg-slate-50/50 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              Archivo Digital de Resguardo
            </div>
            <div className="card-content p-0">
              <div className="divide-y divide-slate-100">
                {documentos.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No hay archivos resguardados</div>
                ) : (
                  documentos.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.validado ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {doc.validado ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{TIPO_LABELS[doc.tipo] || doc.tipo}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Sincronizado: {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${doc.validado ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                          {doc.validado ? 'Aprobado' : 'Revisión'}
                        </span>
                        <a href={doc.url_archivo} target="_blank" className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all shadow-sm bg-white">
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
