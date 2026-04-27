'use client';

import type { Contrato, Documento, Expediente } from '@/types/database';

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
  otro: 'Otro',
};

const ESTATUS_LABELS: Record<string, string> = {
  revision_directora: 'En revisión por Dirección',
  en_proceso: 'En proceso',
  completado: 'Completado',
  rechazado: 'Rechazado',
};

export default function Paso4SoloLectura({
  expediente,
  contrato,
  documentos,
}: Paso4Props) {
  const estatusLabel =
    ESTATUS_LABELS[expediente.estatus] || expediente.estatus;

  const estatusColor =
    expediente.estatus === 'completado'
      ? 'bg-green-100 text-green-800 border-green-200'
      : expediente.estatus === 'rechazado'
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-yellow-100 text-yellow-800 border-yellow-200';

  // Determinar si falta asignar secretaria/asesora
  const pendienteAsignar = !expediente.asesora_id && contrato?.url_pdf_firmado_cliente;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner de agradecimiento y estatus */}
      <div className={`rounded-lg border p-6 text-center shadow-sm ${estatusColor}`}>
        <h2 className="text-xl font-bold mb-2 text-gray-800">¡Gracias por elegir CECANI!</h2>
        <p className="text-base font-medium">{estatusLabel}</p>
        <p className="text-sm mt-3 opacity-90 leading-relaxed">
          {expediente.estatus === 'revision_directora'
            ? 'Tu expediente ha sido enviado con éxito. Muy pronto se te asignará una asesora, quien te contactará personalmente a través de WhatsApp para dar seguimiento a tu trámite.'
            : expediente.estatus === 'en_proceso'
              ? 'Tu trámite está en proceso. Tu asesora asignada te mantendrá informado por WhatsApp.'
              : expediente.estatus === 'completado'
                ? '¡Tu trámite ha sido completado exitosamente! Gracias por confiar en nosotros.'
                : 'Estamos revisando tu información. Pronto nos pondremos en contacto contigo.'}
        </p>
      </div>

      {/* SECCIÓN NUEVA: Pendientes por Asignar */}
      {pendienteAsignar && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-5 flex items-start gap-4">
          <div className="bg-orange-100 p-2 rounded-full text-orange-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="text-orange-800 font-semibold">Pendiente por Asignar</h4>
            <p className="text-orange-700 text-sm mt-1">
              Tu contrato firmado ha sido recibido. Estamos en proceso de asignarte una secretaria para el seguimiento personalizado de tu trámite.
            </p>
          </div>
        </div>
      )}

      {/* Información del expediente */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Información del Expediente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">Empresa</span>
            <p className="text-gray-900 font-medium text-base">{expediente.nombre_empresa}</p>
          </div>
          <div className="space-y-1">
            <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">Fecha de Inicio</span>
            <p className="text-gray-900 font-medium text-base">
              {new Date(expediente.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Documentos Mejorada */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Documentación
        </h3>

        {documentos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-lg">
            <p className="text-sm text-gray-400">No hay documentos registrados aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-md ${doc.validado ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{TIPO_LABELS[doc.tipo] || doc.tipo}</h4>
                    <p className="text-[11px] text-gray-500">Subido el {new Date(doc.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {doc.validado ? (
                    <span className="flex items-center gap-1 text-green-700 text-[10px] font-bold uppercase bg-green-100 px-2 py-1 rounded">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Validado
                    </span>
                  ) : (
                    <span className="text-gray-500 text-[10px] font-bold uppercase bg-gray-100 px-2 py-1 rounded">
                      Pendiente por Validar
                    </span>
                  )}
                  
                  <a
                    href={doc.url_archivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-full shadow-sm transition-all border border-transparent hover:border-blue-100"
                    title="Ver documento"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contratos */}
      {contrato?.url_pdf_generado && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Contratos y Descargas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={contrato.url_pdf_generado}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded shadow-sm text-blue-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Contrato Generado</span>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>

            {contrato.url_pdf_firmado_cliente && (
              <a
                href={contrato.url_pdf_firmado_cliente}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-green-50/50 border border-green-100 hover:bg-green-50 hover:border-green-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded shadow-sm text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Contrato Firmado</span>
                </div>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
