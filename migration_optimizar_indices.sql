-- Optimización de índices para alta concurrencia (20+ Abogadas en tiempo real)
-- Estos índices evitan que la base de datos haga escaneos completos (Full Table Scans)
-- cuando múltiples abogadas y directoras filtran, buscan y modifican datos simultáneamente.

-- 1. Índices para la tabla principal (Expedientes)
CREATE INDEX IF NOT EXISTS idx_expedientes_asesora_id ON public.expedientes(asesora_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_cliente_id ON public.expedientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_estatus ON public.expedientes(estatus);

-- 2. Índices para Documentos (Muy consultado al cargar el checklist)
CREATE INDEX IF NOT EXISTS idx_documentos_expediente_id ON public.documentos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON public.documentos(tipo);

-- 3. Índices para Tareas / Checklist (Evita bloqueos al marcar checkboxes)
CREATE INDEX IF NOT EXISTS idx_seguimiento_tareas_expediente ON public.seguimiento_tareas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_tareas_estatus ON public.seguimiento_tareas(estatus);

-- 4. Índices para Datos del Concentrado
CREATE INDEX IF NOT EXISTS idx_datos_concentrado_expediente ON public.datos_concentrado(expediente_id);

-- 5. Índices para Relaciones de Asesoras (Casos compartidos)
CREATE INDEX IF NOT EXISTS idx_expediente_asesoras_expediente ON public.expediente_asesoras(expediente_id);
CREATE INDEX IF NOT EXISTS idx_expediente_asesoras_asesora ON public.expediente_asesoras(asesora_id);

-- 6. Índices para Perfiles (Búsquedas de nombres rápidas)
CREATE INDEX IF NOT EXISTS idx_perfiles_rol ON public.perfiles(rol);