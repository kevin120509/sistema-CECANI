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

### [27 Mayo 2026] - Corrección de Visibilidad en Panel de Abogada
- **Acción:** Se corrigió el problema por el cual los expedientes asignados no aparecían en el panel de la abogada.
- **Cambios:**
    - Modificación en `src/app/abogada/page.tsx` para incluir el rol `'abogada'` en los roles permitidos (evita redirecciones accidentales al login).
    - Actualización de la consulta de expedientes para soportar tanto la columna legacy `asesora_id` como la nueva tabla relacional `expediente_asesoras`.
    - Implementación de manejo de errores en la consulta relacional para mantener compatibilidad si la tabla aún no existe en el esquema.
- **Resultado:** Las abogadas/asesoras ahora pueden ver correctamente los casos que les han sido asignados por la directora.
- **Pendientes:** Asegurar que el usuario ejecute las actualizaciones de base de datos (`database_updates.sql`) para habilitar la tabla relacional de forma definitiva.
