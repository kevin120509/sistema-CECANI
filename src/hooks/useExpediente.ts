'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { obtenerDashboardData } from '@/actions/expediente';
import { v4 as uuidv4 } from 'uuid';
import type {
  CatalogoFigura,
  Contrato,
  DashboardData,
  Documento,
  Expediente,
  Perfil,
} from '@/types/database';

export type PasoActual = 1 | 2 | 3 | 4;

export interface UseExpedienteReturn {
  currentStep: PasoActual;
  expediente: Expediente | null;
  contrato: Contrato | null;
  documentos: Documento[];
  figuras: CatalogoFigura[];
  perfil: Perfil | null;
  userId: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Obtiene o genera un clienteId único almacenado en localStorage.
 * Sirve como identificador persistente del cliente sin requerir login.
 */
function getOrCreateClienteId(): string {
  const STORAGE_KEY = 'cecani_cliente_id';
  if (typeof window === 'undefined') return uuidv4();

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Hook central del dashboard.
 * No requiere autenticación. Usa un ID de cliente almacenado en localStorage.
 */
export function useExpediente(): UseExpedienteReturn {
  const [data, setData] = useState<DashboardData>({
    perfil: null,
    expediente: null,
    contrato: null,
    documentos: [],
    figuras: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const supabaseRef = useRef(createClient());
  const clienteIdRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    const supabase = supabaseRef.current;

    // Obtener el ID más reciente (podría haber cambiado tras el registro en Paso 1)
    const clienteId = getOrCreateClienteId();
    clienteIdRef.current = clienteId;

    setIsLoading(true);
    setError(null);

    try {
      const result = await obtenerDashboardData(clienteId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error desconocido al cargar datos.');
      }

      const { perfil, expediente: expedienteRaw, figuras, documentos } = result.data;

      // Errores non-critical en perfil/expediente (puede no existir aún)
      // Si RLS bloquea catalogo_figuras o está vacía, usar fallback estático
      const FIGURAS_FALLBACK: CatalogoFigura[] = [
        { id: 1, siglas: 'SA de CV', descripcion: 'Sociedad Anónima de Capital Variable' },
        { id: 2, siglas: 'S de RL de CV', descripcion: 'Sociedad de Responsabilidad Limitada de Capital Variable' },
        { id: 3, siglas: 'SAS', descripcion: 'Sociedad por Acciones Simplificada' },
        { id: 4, siglas: 'SC', descripcion: 'Sociedad Civil' },
        { id: 5, siglas: 'AC', descripcion: 'Asociación Civil' },
        { id: 6, siglas: 'SAPI', descripcion: 'Sociedad Anónima Promotora de Inversión' },
        { id: 7, siglas: 'S en C', descripcion: 'Sociedad en Comandita Simple' },
        { id: 8, siglas: 'SNC', descripcion: 'Sociedad en Nombre Colectivo' },
      ];

      const figurasFinales = (figuras && figuras.length > 0) ? figuras : FIGURAS_FALLBACK;

      let expedienteFinal = null;
      let contratoFinal = null;

      if (expedienteRaw) {
        // @ts-ignore - The action returns this embedded
        const { contratos: contratosArr, ...exp } = expedienteRaw;
        expedienteFinal = { ...exp, contratos: contratosArr } as any;
        contratoFinal = (contratosArr?.[0] as Contrato) || null;
      }

      setData({ 
        perfil: perfil as Perfil | null, 
        expediente: expedienteFinal, 
        contrato: contratoFinal, 
        documentos: documentos as Documento[], 
        figuras: figurasFinales as CatalogoFigura[] 
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los datos.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      clienteIdRef.current = getOrCreateClienteId();
      fetchData();
    }

    // Escuchar cambios en localStorage (cuando Paso 1 guarda el ID real)
    const handleStorageChange = () => {
      const nuevoId = localStorage.getItem('cecani_cliente_id');
      if (nuevoId && nuevoId !== clienteIdRef.current) {
        clienteIdRef.current = nuevoId;
        fetchData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchData]);

  const currentStep = calcularPaso(data.expediente, data.contrato, data.documentos);

  return {
    currentStep,
    expediente: data.expediente,
    contrato: data.contrato,
    documentos: data.documentos,
    figuras: data.figuras,
    perfil: data.perfil,
    userId: clienteIdRef.current || '',
    isLoading,
    error,
    refetch: fetchData,
  };
}

function calcularPaso(
  expediente: Expediente | null,
  contrato: Contrato | null,
  documentos: Documento[]
): PasoActual {
  if (!expediente) return 1;
  
  // Si no ha subido documentación básica, está en Paso 2
  const tieneIneFrente = documentos.some(d => d.tipo === 'ine_frente');
  const tieneIneReverso = documentos.some(d => d.tipo === 'ine_reverso');
  const tieneComprobante = documentos.some(d => d.tipo === 'comprobante_domicilio');
  
  if (!tieneIneFrente || !tieneIneReverso || !tieneComprobante) {
    return 2;
  }
  
  // Si la documentación está, pero el estatus es 'en_registro', 'revision_directora'
  // o 'en_proceso' pero no ha firmado el contrato, está en Paso 3.
  const tieneContratoFirmado = contrato?.url_pdf_firmado_cliente != null;
  
  if (
    ['en_registro', 'revision_directora'].includes(expediente.estatus) ||
    (expediente.estatus === 'en_proceso' && !tieneContratoFirmado)
  ) {
    return 3;
  }

  // Para cualquier otro estatus ('esperando_asignacion', 'en_proceso', 'completado', etc.),
  // mostrar la vista final de solo lectura (Paso 4)
  return 4;
}
