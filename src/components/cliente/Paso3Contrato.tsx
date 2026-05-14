'use client';

import { useState } from 'react';
import { guardarContratoFirmado } from '@/actions/contrato';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento, registrarPago } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import type { Contrato, Expediente } from '@/types/database';

interface Paso3Props {
  expediente: Expediente;
  contrato: Contrato;
  onComplete: () => Promise<void>;
}

interface ArchivoSeleccionado {
  file: File | null;
  preview: string | null;
}

function FileInput({
  id,
  label,
  accept,
  archivo,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  archivo: ArchivoSeleccionado;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />
      {archivo.file && (
        <p className="mt-1 text-xs text-green-600">
          ✓ {archivo.file.name} ({(archivo.file.size / 1024).toFixed(0)} KB)
        </p>
      )}
    </div>
  );
}

export default function Paso3Contrato({
  expediente,
  contrato,
  onComplete,
}: Paso3Props) {

  // Sección de subida
  const [contratoFirmado, setContratoFirmado] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [comprobantePago, setComprobantePago] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [montoPago, setMontoPago] = useState<string>('');

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isWaitingForDirector = !contrato.url_pdf_generado;

  const handleDescargar = () => {
    if (isWaitingForDirector) return;
    window.open(contrato.url_pdf_generado!, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: ArchivoSeleccionado) => void) => {
    const file = e.target.files?.[0] || null;
    setter({ file, preview: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contratoFirmado.file) { setError('Debes subir el contrato firmado.'); return; }
    if (!comprobantePago.file) { setError('Debes subir el comprobante de pago.'); return; }
    if (!montoPago || isNaN(Number(montoPago)) || Number(montoPago) <= 0) {
      setError('Debes ingresar un monto de pago válido.'); return;
    }

    setIsUploading(true);

    try {
      // Crear un nombre de carpeta amigable basado en la empresa
      const carpetaEmpresa = expediente.nombre_empresa
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Subir Contrato Firmado a Cloudflare R2
      setProgress('Subiendo contrato firmado a R2...');
      
      const extContrato = contratoFirmado.file.name.split('.').pop() || 'pdf';
      const fileRenombradoContrato = new File(
        [contratoFirmado.file], 
        `Contrato_FIRMADO_POR_CLIENTE_${carpetaEmpresa}.${extContrato}`, 
        { type: contratoFirmado.file.type }
      );

      const fdContrato = new FormData();
      fdContrato.append('file', fileRenombradoContrato);
      
      const resContrato = await subirArchivoR2Action(fdContrato, `expedientes/${carpetaEmpresa}/contratos`);
      
      if (!resContrato.success || !resContrato.data) throw new Error(resContrato.error || 'Error al subir contrato');
      await registrarDocumento(expediente.id, 'contrato_firmado', resContrato.data.url);
      await guardarContratoFirmado(contrato.id, resContrato.data.url);

      // Subir Comprobante de Pago a Cloudflare R2
      setProgress('Subiendo comprobante de pago a R2...');

      const extPago = comprobantePago.file.name.split('.').pop() || 'bin';
      const fileRenombradoPago = new File(
        [comprobantePago.file], 
        `Comprobante_Pago_${carpetaEmpresa}.${extPago}`, 
        { type: comprobantePago.file.type }
      );

      const fdPago = new FormData();
      fdPago.append('file', fileRenombradoPago);
      
      const resPago = await subirArchivoR2Action(fdPago, `expedientes/${carpetaEmpresa}/documentacion`);
      
      if (!resPago.success || !resPago.data) throw new Error(resPago.error || 'Error al subir comprobante');
      
      // Registrar el pago en Supabase
      setProgress('Registrando pago en Base de Datos...');
      await registrarPago(expediente.id, Number(montoPago), resPago.data.url);

      setProgress('Actualizando estatus...');
      await actualizarEstatusExpediente(expediente.id, 'en_proceso');
      
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar el registro.');
    } finally {
      setIsUploading(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Generación y Firma de Contrato</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border text-sm">
            ❌ {error}
          </div>
        )}

        {isWaitingForDirector ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center shadow-inner">
            <svg className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-medium text-amber-900 mb-3">Contrato en Redacción</h3>
            <p className="text-amber-800 text-sm mb-2 max-w-md mx-auto">
              Tus documentos han sido recibidos correctamente y están bajo revisión de la Dirección.
            </p>
            <p className="text-amber-700 text-sm max-w-md mx-auto">
              Actualmente nos encontramos elaborando tu contrato personalizado. Este proceso tardará un momento. <strong>No cierres esta pestaña</strong> para poder descargar tu contrato y proceder con las firmas en breve.
            </p>
          </div>
        ) : (
          <>
            {/* Sección de Descarga */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-8 text-center shadow-sm">
              <svg className="w-12 h-12 text-blue-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tu contrato individualizado está listo</h3>
              <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
                Descarga el contrato, imprímelo, fírmalo en todas sus hojas y vuelve a subirlo escaneado junto con el comprobante de tu pago.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleDescargar}
                  className="inline-flex items-center justify-center px-4 py-2 border-2 text-white bg-blue-600 border-blue-600 rounded-md hover:bg-blue-700 font-medium shadow-sm transition aspect-auto"
                >
                  Descargar Contrato Oficial PDF
                </button>
              </div>
            </div>

            {/* Sección de Subida */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset className="border rounded-md p-4 bg-gray-50">
                <legend className="text-sm font-semibold text-gray-700 px-2">Subir Documentos Finales</legend>
                <div className="space-y-4 mt-2">
                  <FileInput
                    id="contrato"
                    label="Contrato Firmado (PDF o Imagen) *"
                    accept="image/*,.pdf"
                    archivo={contratoFirmado}
                    disabled={isUploading}
                    onChange={(e) => handleFileChange(e, setContratoFirmado)}
                  />
                  <FileInput
                    id="boucher"
                    label="Comprobante de Pago *"
                    accept="image/*,.pdf"
                    archivo={comprobantePago}
                    disabled={isUploading}
                    onChange={(e) => handleFileChange(e, setComprobantePago)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto Pagado ($) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      disabled={isUploading}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Ej. 15000"
                    />
                  </div>
                </div>
              </fieldset>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? progress || 'Enviando...' : 'Finalizar Proceso'}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
