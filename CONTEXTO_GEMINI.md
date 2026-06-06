# Contexto del Sistema CECANI (Para Gemini CLI / Asistentes IA)

Este archivo contiene el contexto técnico y de negocio actualizado del proyecto "sistema-CECANI". **Debe ser leído por cualquier agente de IA (como Gemini CLI) antes de proponer cambios arquitectónicos o de lógica de negocio.**

## 1. Arquitectura General y Roles
El sistema es una plataforma web (Next.js + Supabase) para digitalizar la gestión legal y contable de Asociaciones Civiles (A.C.). Existen 3 roles principales:

*   **Cliente (Portal Público):** No usa contraseña. La sesión se mantiene vía `localStorage` (`cecani_cliente_id`). El cliente llena sus datos legales completos, selecciona los servicios que desea contratar, sube sus documentos (INE, Comprobante) y firma el contrato.
*   **Directora (Panel Administrativo):** Valida los expedientes nuevos, revisa/genera el contrato en PDF oficial, lo envía al cliente y, una vez firmado, **asigna una Asesora** al caso.
*   **Asesora / Abogada (Panel Operativo):** Gestiona los casos asignados (Concentración, Capacitación, Bitácora).

## 2. Arquitectura de Almacenamiento Híbrida (NUEVO)
Para optimizar costos y rendimiento, el sistema utiliza una arquitectura híbrida:
*   **Supabase (PostgreSQL):** Almacena metadatos, información del cliente, registros de expedientes y **URLs públicas** de los documentos.
*   **Cloudflare R2 (Bodega de Archivos):** Almacena los archivos físicos (PDFs, imágenes) mediante el SDK de AWS S3. 

### Estructura de Carpetas en R2:
```text
expedientes/
  └── [Nombre_de_la_Empresa]/
      ├── documentacion/       <-- INE Frente, Reverso, Comprobante Domicilio, Pagos.
      └── contratos/           <-- Contrato generado (borrador) y Contrato firmado por el cliente.
```

## 3. Lógica de Contratos y Cumplimiento Legal
El sistema genera contratos de "Grado Legal" idénticos a los oficiales de CECANI.

### A. Datos Legales Obligatorios (Recolectados en Paso 1)
Para que las "Declaraciones" del contrato sean válidas, se capturan: RFC (con homoclave), CURP, Ocupación, Estado Civil, Domicilio Completo y Folio de INE. Estos datos residen en la tabla `perfiles`.

### B. Generación de PDF (`src/lib/pdf-generator.ts`)
*   Usa `pdf-lib` con un motor de **justificación de texto** personalizado.
*   Incluye cláusulas dinámicas según el servicio (Constitución, CLUNI, Web, etc.).
*   Convierte montos numéricos a letras (Formato bancario).
*   Incluye **Anexo 1: Cronograma de Procesos** (11 a 14 meses).

## 4. Estado Actual de la Implementación

✅ **Arquitectura Híbrida R2 + Supabase:** Implementada en todos los pasos de subida.
✅ **Formulario Legal Completo:** El Paso 1 ahora captura toda la información para el contrato.
✅ **Generador de PDF Profesional:** Refactorizado para coincidir 100% con los templates de la carpeta `informacion/`.
✅ **Estructura Organizada en R2:** Los archivos se guardan en subcarpetas por cliente y tipo de documento.

## 5. Tareas Pendientes / Siguientes Pasos
1.  **Validación de Directora:** Adaptar el panel de la directora para que pueda visualizar estos nuevos campos legales y los archivos desde R2.
2.  **Doble Firma:** Implementar la subida del contrato con la firma de CECANI (Doble firma) hacia la carpeta `contratos/` en R2.
3.  **Seguridad:** Asegurar que las URLs de R2 tengan políticas de acceso adecuadas (actualmente usan el subdominio público `.r2.dev`).

## 6. Bitácora de Sesión
### [3 Junio 2026] - Sincronización Global "Zero-Refresh" y Blindaje Legal (FINAL)
- **Acción**: Implementación de un sistema de interactividad total en tiempo real y blindaje de privacidad para el equipo legal, optimizando el despliegue en Vercel.
- **Cambios**:
    - **Realtime Global:** Creación de `RealtimeSyncProvider.tsx` en la raíz. El sistema ahora es "Cero F5"; cambios en expedientes, pagos y documentos se reflejan instantáneamente en todos los paneles.
    - **Privacidad Legal:** Blindaje en `src/app/abogada/page.tsx`. Las abogadas ahora solo ven clientes validados y específicamente asignados a su ID (bloqueo por servidor).
    - **Validación de Directora:** Implementación de aprobación dual (Pago + Contrato) en `DirectorDashboard.tsx`. Inclusión de **Visor Inteligente (Quick-View)** para imágenes y PDFs y notificaciones **Toast** proactivas.
    - **Transición Automática:** El portal del cliente ahora salta al Paso 4 (Éxito) automáticamente cuando la directora valida contrato y pago.
    - **Corrección de Errores Críticos:** Solución de `ReferenceErrors` (variables mal nombradas e iconos faltantes), sincronización de tablas de base de datos desajustadas y restauración de llaves de entorno (.env.local) contaminadas.
    - **Vercel Build:** Optimización de compilación en la nube mediante `.vercelignore` y ajustes en `tsconfig.json` para excluir archivos temporales.
- **Estado Final**: Repositorio GitHub y Vercel Production totalmente sincronizados con la versión `0.1.2`.

### [3 Junio 2026] - Sincronización y Persistencia de Versión
- **Acción**: Verificación de la permanencia de actualizaciones en el sistema. Se realizó un bump de versión a 0.1.1 en `package.json` para formalizar los cambios acumulados y se sincronizó el estado del repositorio.
- **Cambios**:
    - `package.json`: Versión actualizada a 0.1.1.
    - Sincronización total de cambios pendientes en Git para garantizar la persistencia entre sesiones de Gemini CLI.
- **Pendientes**:
    - Resolver 365 errores de lint detectados (principalmente tipos `any` y accesos a refs en render).
    - Continuar con la validación de la Directora y la Doble Firma según el plan original.

### [2 Junio 2026] - Rediseño Premium de Paneles y Revisión Funcional
- **Acción**: Implementación de una interfaz "Luxury Premium Aesthetic" en los paneles de Cliente, Directora y Abogada para presentar una estética altamente profesional (eliminando redondeos exagerados de `rounded-[4rem]` por `rounded-3xl` e implementando tipografías más ligeras y legibles junto a Glassmorphism avanzado `backdrop-blur`).
- **Cambios**:
    - `src/components/cliente/Paso1CrearProyecto.tsx`, `Paso2Documentacion.tsx`, `Paso3Contrato.tsx`: Estética mejorada para botones, tarjetas y campos, mejorando la confianza visual del usuario final.
    - `src/components/directora/DirectorDashboard.tsx`: Suavización de modales utilizando blur en vez de opacidad total oscura, y mejoras en la tabla para facilitar lectura.
    - `src/components/abogada/ExpedienteManager.tsx`: Estandarización de `border-radius` y colores de sombra en el panel. Revisión del tipado de TypeScript.
- **Pendientes**:
    - Generar y revisar screenshots desde los navegadores locales para confirmar el render final si hay futuras modificaciones.

### [1 Junio 2026] - Sincronización Avanzada: Flujo Legal e Información Oficial
- **Acción**: Rediseño integral del panel de abogada para alinearlo 100% con los manuales de la carpeta `flujo` y contratos de `informacion`. Se implementó la gestión dinámica de asociados y el sistema de recordatorios con plantillas inteligentes. Se corrigió el flujo de validación Cliente-Directora.
- **Cambios**:
    - `ExpedienteManager.tsx`: Implementación de "Gestión de Asociados". Nuevo formulario de recordatorios que redacta automáticamente fecha/hora y lista de documentos en base al hito legal. Ajuste de zona horaria (UTC a Local) para los recordatorios de WhatsApp.
    - `DirectorDashboard.tsx`: Se bloqueó la asignación de abogada hasta que el contrato esté firmado (doble firma) y el pago del cliente validado.
    - `Paso2Documentacion.tsx` / `Paso3Contrato.tsx` / `useExpediente.ts`: Se implementó el campo `motivo_rechazo`. Si la directora rechaza la información, el cliente ve claramente el motivo y puede resubir los documentos sin que el sistema se trabe. Al resubir, el motivo se limpia y el estatus vuelve a revisión.
    - `database.ts`: Sincronización de enums de documentos.
    - `directora.ts` / `expediente.ts`: Modificación en Server Actions para manejar el flujo de rechazo con notificación y persistencia de DB en `datos_concentrado`.
- **Pendientes**:
    - Probar la subida masiva de asociados para expedientes con más de 10 integrantes.
    - Configurar las alertas visuales de "Urgencia" para que se basen en la fecha de los recordatorios vencidos.

### [28 Mayo 2026] - Sincronización Local-Vercel
- **Acción**: Se realiza un commit de sincronización para asegurar que los cambios locales se reflejen en Vercel. Se incluyen archivos de utilidad en la carpeta scratch.
- **Cambios**: `CONTEXTO_GEMINI.md`, `scratch/*.js`.
- **Pendientes**: Verificar despliegue exitoso en Vercel.

### [2026-05-27] - Optimización del Modal de Gestión y Fix de Subida (Directora)
- **Acción**: Se rediseñó el modal de Gestión para agrupar todas las validaciones antes de asignar abogada. Se arregló un bug al subir la Doble Firma.
- **Cambios**: `src/components/directora/DirectorDashboard.tsx`, `task.md`.
- **Pendientes**: Ninguno crítico. El flujo de subida a R2 y actualización a Supabase de la "Doble Firma" ya funciona correctamente y la interfaz es fluida.

### [2026-05-27] - Generación de Contratos Completadatos PDF
- **Acción**: Se actualizaron las cláusulas del generador de contratos en PDF para incluir los 14 puntos completos del template legal de CECANI de manera generalizada y personalizada.
- **Cambios**: `src/lib/pdf-generator.ts`
- **Pendientes**: Ninguno asociado a esta tarea.

### [5 Junio 2026] - Rediseño Corporativo: Migración Estándar "Admin One"
- **Acción**: Transformación visual total de todas las interfaces (Cliente, Directora, Abogada) hacia una estética de dashboard administrativo limpio y eficiente.
- **Cambios**:
    - `src/components/layout/DashboardLayout.tsx`: Nuevo componente de layout unificado con Sidebar y Header.
    - `src/app/globals.css`: Actualización de tema a paleta clara (Slate-50), tarjetas blancas (`card-base`) e inputs corporativos.
    - `src/app/page.tsx`: Integración del nuevo layout en el portal de cliente.
    - `src/components/cliente/`: Refactorización de todos los pasos (1-4) para eliminar estilos 'Luxury' y usar el nuevo estándar de tarjetas.
    - `src/components/directora/DirectorDashboard.tsx`: Rediseño completo para un flujo operativo más limpio y tabular.
    - `src/components/abogada/ExpedienteManager.tsx`: Migración a vista de dashboard con gestión de expedientes simplificada.
    - **Correcciones**: Resolución de errores de sintaxis JSX y desajustes de tipos en `CatalogoHito`.
- **Pendientes**:
    - Finalizar la vista de calendario en el panel de abogada bajo el nuevo estándar visual.
    - Optimizar el visor de documentos para dispositivos móviles.

### [5 Junio 2026] - Rediseño Premium: Interfaz de Cliente "Midnight Navy & Blue"
- **Acción**: Transformación visual completa del portal de cliente hacia una estética profesional de alta gama.
- **Cambios**:
    - `src/app/globals.css`: Nuevo sistema de temas, gradientes profundos y glassmorphism refinado.
    - `src/components/cliente/`: Rediseño total de `Paso1` a `Paso4` y `PasoCorreccionDocs`.
        - Implementación de `premium-border` y acentos en azul eléctrico.
        - Mejora en la jerarquía visual, tipografía y estados de validación.
        - Corrección de errores de sintaxis y dependencias (lucide-react).
- **Pendientes**:
    - Extender la estética premium a los paneles de Abogada y Directora para coherencia total.
    - Verificar la responsividad en dispositivos móviles extremos.

### [5 Junio 2026] - Resolución de Bugs de Compilación y Sincronización Global
- **Acción**: Corrección de errores críticos de TypeScript y sincronización total del repositorio con GitHub.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`: 
        - Se importó `toast` desde `sonner` para habilitar notificaciones proactivas.
        - Se corrigieron los nombres de propiedades en la lógica de recordatorios (`fecha_recordatorio` -> `fecha`, `hora_recordatorio` -> `hora`) para alinearlos con la interfaz `Recordatorio`.
    - **Sincronización**: Preparación y subida de todos los archivos de migración (`migration_*.sql`), scripts de utilidad en `scratch/` y mejoras en Server Actions.
- **Pendientes**:
    - Ejecutar los nuevos archivos de migración SQL en el dashboard de Supabase si aún no se han aplicado.
    - Continuar con la fase de Doble Firma para Contratos.

### [4 Junio 2026] - Seguridad: Autorización de Borrado y Transparencia Legal
- **Acción**: Implementación de un sistema de control de cambios para la eliminación de documentos y mejora en la visibilidad de datos legales en el panel operativo.
- **Cambios**:
    - **Autorización de Borrado**: Se eliminó la capacidad de borrado directo para las abogadas. Ahora, al intentar borrar, se debe proporcionar un motivo que se envía a la Directora para su aprobación.
    - **Nuevas Server Actions**: Implementación de `solicitarBorradoAction`, `aprobarBorradoAction` y `rechazarBorradoAction` en `src/actions/documentos.ts`.
    - **Panel Abogada**: El `ExpedienteManager.tsx` ahora muestra el estatus "Baja Solicitada" y bloquea el archivo hasta que la directora decida. Muestra el motivo proporcionado.
    - **Panel Directora**: El `DirectorDashboard.tsx` (Sección Validación) ahora detecta solicitudes de baja, permite ver el motivo y ofrece botones para "Autorizar Baja" (borrado real en R2 y DB) o "Ignorar".
    - **Visibilidad Legal**: Se corrigió la consulta en `src/app/abogada/page.tsx` para traer la descripción completa de la **Figura Jurídica** elegida por el cliente, mostrándola prominentemente en el encabezado del expediente.
    - **Esquema DB**: Creado `migration_borrado_autorizado.sql` para agregar las columnas `solicitud_borrado` y `motivo_borrado` a la tabla `documentos`.
- **Pendientes**:
    - **IMPORTANTE**: Ejecutar `migration_borrado_autorizado.sql` en el editor SQL de Supabase para habilitar las nuevas columnas.
    - Continuar con la revisión de seguridad de URLs firmadas en R2.
