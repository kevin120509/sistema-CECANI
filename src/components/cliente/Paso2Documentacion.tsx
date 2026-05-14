'use client';

import { useState } from 'react';
import { subirArchivoR2Action } from '@/actions/r2-actions';
import { registrarDocumento } from '@/actions/documentos';
import { actualizarEstatusExpediente } from '@/actions/expediente';
import { generarContratoAutomatico } from '@/actions/contrato';
import type { Expediente, TipoDocumento, Contrato } from '@/types/database';

interface Paso2Props {
  expediente: Expediente;
  onComplete: () => Promise<void>;
}

interface ArchivoSeleccionado {
  file: File | null;
  preview: string | null;
}

// ============================================
// Componente FileInput extraído fuera del render
// ============================================
function FileInput({
  id,
  label,
  accept,
  archivo,
  disabled,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  accept: string;
  archivo: ArchivoSeleccionado;
  disabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          key={archivo.file ? archivo.file.name : 'empty'}
          id={id}
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={disabled}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        {archivo.file && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
            title="Quitar archivo"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {archivo.file && (
        <p className="mt-1 text-xs text-green-600">
          ✓ {archivo.file.name} ({(archivo.file.size / 1024).toFixed(0)} KB)
        </p>
      )}
      {archivo.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={archivo.preview}
          alt="Vista previa"
          className="mt-2 max-h-24 rounded border border-gray-200"
        />
      )}
    </div>
  );
}

export default function Paso2Documentacion({
  expediente,
  onComplete,
}: Paso2Props) {
  const [ineFrente, setIneFrente] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [ineReverso, setIneReverso] = useState<ArchivoSeleccionado>({ file: null, preview: null });
  const [comprobanteDomicilio, setComprobanteDomicilio] = useState<ArchivoSeleccionado>({ file: null, preview: null });

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: ArchivoSeleccionado) => void) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setter({ file, preview });
    }
  };

  const subirYRegistrar = async (file: File, tipo: TipoDocumento, descripcion: string, nombreClave: string): Promise<string> => {
    setProgress(`Subiendo ${descripcion} a Cloudflare R2...`);
    
    // Crear un nombre de carpeta amigable basado en la empresa
    const carpetaEmpresa = expediente.nombre_empresa
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Generar un nuevo archivo con el nombre deseado para mantener orden en R2
    const extension = file.name.split('.').pop() || 'bin';
    const nuevoNombre = `${nombreClave}_${carpetaEmpresa}.${extension}`;
    const fileRenombrado = new File([file], nuevoNombre, { type: file.type });
    
    // USAR SERVER ACTION PARA R2
    const formData = new FormData();
    formData.append('file', fileRenombrado);
    
    const uploadResult = await subirArchivoR2Action(formData, `expedientes/${carpetaEmpresa}/documentacion`);
    
    if (!uploadResult.success || !uploadResult.data) {
      throw new Error(`Error al subir ${descripcion}: ${uploadResult.error}`);
    }

    const urlPublicaR2 = uploadResult.data.url;

    setProgress(`Registrando ${descripcion} en Base de Datos...`);
    const registerResult = await registrarDocumento(expediente.id, tipo, urlPublicaR2);
    if (!registerResult.success) {
      throw new Error(`Error al registrar ${descripcion} en BD: ${registerResult.error}`);
    }
    return urlPublicaR2;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ineFrente.file) { setError('Debes subir la INE (frente).'); return; }
    if (!ineReverso.file) { setError('Debes subir la INE (reverso).'); return; }
    if (!comprobanteDomicilio.file) { setError('Debes subir el comprobante de domicilio.'); return; }

    setIsUploading(true);

    try {
      await subirYRegistrar(ineFrente.file, 'ine_frente', 'INE (frente)', 'INE_Frente');
      await subirYRegistrar(ineReverso.file, 'ine_reverso', 'INE (reverso)', 'INE_Reverso');
      await subirYRegistrar(comprobanteDomicilio.file, 'comprobante_domicilio', 'Comprobante de Domicilio', 'Comprobante_Domicilio');

      await actualizarEstatusExpediente(expediente.id, 'revision_directora');

      setProgress('Generando contrato inteligente...');
      const contratoId = expediente.contratos?.[0]?.id;
      if (contratoId) {
        await generarContratoAutomatico(expediente.cliente_id, expediente.id, contratoId);
      } else {
        console.warn('No se encontró ID de contrato para generar PDF.');
      }

      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado durante la subida.');
    } finally {
      setIsUploading(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Documentación Necesaria</h2>
          <p className="text-sm text-gray-500 mt-1">
            Por favor, sube los siguientes documentos de identificación para continuar con la generación de tu contrato.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm">
            ❌ {error}
          </div>
        )}

        {isUploading && progress && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-sm flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {progress}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="border rounded-md p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Identificación Oficial (INE)</legend>
            <div className="space-y-4 mt-2">
              <FileInput
                id="ine_frente"
                label="INE Frente (Elige imagen o PDF) *"
                accept="image/*,.pdf"
                archivo={ineFrente}
                disabled={isUploading}
                onChange={(e) => handleFileChange(e, setIneFrente)}
                onClear={() => setIneFrente({ file: null, preview: null })}
              />
              <FileInput
                id="ine_reverso"
                label="INE Reverso (Elige imagen o PDF) *"
                accept="image/*,.pdf"
                archivo={ineReverso}
                disabled={isUploading}
                onChange={(e) => handleFileChange(e, setIneReverso)}
                onClear={() => setIneReverso({ file: null, preview: null })}
              />
            </div>
          </fieldset>

          <fieldset className="border rounded-md p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">Comprobante de Domicilio</legend>
            <div className="space-y-4 mt-2">
              <FileInput
                id="comprobante_domicilio"
                label="Comprobante (Agua, Luz, Teléfono) *"
                accept="image/*,.pdf"
                archivo={comprobanteDomicilio}
                disabled={isUploading}
                onChange={(e) => handleFileChange(e, setComprobanteDomicilio)}
                onClear={() => setComprobanteDomicilio({ file: null, preview: null })}
              />
            </div>
          </fieldset>

          <div className="pt-4 gap-4 flex justify-end">
            <button
              type="submit"
              disabled={isUploading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isUploading ? 'Subiendo...' : 'Guardar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
