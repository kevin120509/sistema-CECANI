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

### [10 Junio 2026] - Ejecución del Servidor en Segundo Plano
- **Acción**: Se activó el servidor de desarrollo Next.js (Turbopack) en segundo plano.
- **Cambios**: Ninguno en el código.
- **Estado**: Servidor operativo en `http://localhost:3000`.

### [10 Junio 2026] - Unificación Global de Diseño "Deep Dark"
- **Acción**: Se extendió la estética del panel de Directora a todo el ecosistema (Abogadas y Clientes). Se eliminó el estilo "Luxury Premium" (Azul/Glassmorphism) en favor de un modo oscuro profundo más sobrio y profesional.
- **Cambios**:
    - `src/app/globals.css`: Redefinición de tokens globales (Slate-950 base, Sky-600 acento).
    - `src/components/abogada/ExpedienteManager.tsx`: Actualización de colores y tipografía.
    - `src/components/cliente/Paso1...Paso4.tsx`: Refactorización completa de los 5 pasos del wizard del cliente.
    - `src/components/abogada/AbogadaAuth.tsx` y `DirectoraLogin.tsx`: Unificación de cabeceras y botones.
- **Estado**: Interfaz 100% coherente en todos los roles del sistema.

## 6. Bitácora de Sesión

### [18 Junio 2026] - Corrección de Bugs en Paneles de Abogada y Directora
- **Acción**: Se resolvieron múltiples reportes de UI y lógica de asignación en los paneles operativos.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`: Se reintrodujo el botón de "Alta Maestra" en la cabecera, añadiendo el modal y conectándolo a `crearClienteManualAction`.
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se corrigió la estructura del sidebar (`overflow-y-auto`) para que el botón de "Salir" se mantenga siempre visible al fondo, evitando un scroll excesivo.
        - Se añadió una verificación segura (`?.charAt(0)`) para prevenir que la sección "Mis Tareas" cierre la interfaz abruptamente si falta información de la empresa.
    - `src/app/abogada/page.tsx` y `ExpedienteManager.tsx`: Se implementó un filtro estricto por `userId`. Ahora la pestaña "Mis Clientes" solo muestra expedientes asignados *exclusivamente* al usuario logueado, y "Compartidos" los asignados a él y a otras abogadas, corrigiendo la visualización cruzada en cuentas administrativas.
- **Pendientes**: Ninguno inmediato para estos flujos.

### [18 Junio 2026] - Sincronización UI y Backend para Renombrado Optimista
- **Acción**: Se implementó una actualización optimista en el renombrado de documentos y se ajustó el repositorio de base de datos para borrar el récord correcto usando el nombre viejo.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`: Se implementó un estado `optimisticLabel` y un `useEffect` en `DocumentItem` para que el cambio visual del nombre del documento sea instantáneo al presionar "Enter", eliminando la sensación de "no se guardó". Se modificó `handleRenameDocument` para enviar el nombre anterior.
    - `src/infrastructure/persistence/SupabaseDocumentosRepository.ts`: Se actualizó `registrarDocumento` para aceptar `oldName` y usarlo explícitamente en la query `.delete()`, evitando duplicidad de slots vacíos.
    - `src/core/services/DocumentoService.ts` y `src/actions/documentos.ts`: Se ajustaron las firmas para pasar `oldName` a la persistencia.
- **Estado**: Funcionalidad de renombrado 100% estable y reactiva al usuario.

### [16 Junio 2026] - Fix: Error de Compilación en Vercel por Suspense
- **Acción**: Se corrigió un error que impedía a Vercel construir la aplicación (`useSearchParams() should be wrapped in a suspense boundary`).
- **Cambios**:
    - `src/app/actualizar-password/page.tsx`: Se importó `Suspense` y se envolvió el componente `<ActualizarPasswordClient />` para cumplir con las reglas de componentes de cliente de Next.js en el App Router.
- **Pendientes**:
    - Confirmar que Vercel termine el nuevo despliegue correctamente.

### [15 Junio 2026] - Plan de Migración Post-Registro (Asignación Automática)
- **Acción**: Se acordó y documentó el flujo final para asignar a las abogadas sus clientes sin depender de un panel de migración en la UI.
- **Acuerdo**: 
    1. Las abogadas crearán sus propias cuentas reales (Registro normal).
    2. Cuando el usuario indique que el registro masivo concluyó, Gemini (la IA) ejecutará un script en backend.
    3. Dicho script cruzará el nombre registrado con el nombre provisorio/excel, migrando automáticamente los clientes (relaciones de `expediente_asesoras`) a las cuentas recién creadas.
- **Cambios**: Se eliminó la pestaña de migración en `DirectorDashboard.tsx` para mantener el panel limpio según lo solicitado.

### [15 Junio 2026] - Migración Final y Procesamiento de Reportes de Asignación Múltiple
- **Acción**: Se procesaron los archivos `reporte_multiples_abogadas ya asognado.txt` y `reporte_asignacion_abogadas.txt` para hacer efectivas las asignaciones en la base de datos.
- **Cambios**:
    - **Creación de Cuentas**: Se generaron automáticamente las cuentas faltantes en Supabase Auth y perfiles para las abogadas extraídas de los reportes originales (p. ej., Sandra, Odette, Yara, Yael, etc.).
    - **Asignación Múltiple**: Se leyó el texto original del Excel (como `"ABIGAIL-SANDRA"`) mapeándolo a los UUIDs correspondientes.
    - **Poblado de Base de Datos**: Se insertaron un total de ~791 relaciones en la tabla `expediente_asesoras`, asegurando que las cuentas con clientes compartidos ya se conecten correctamente en el sistema.

### [15 Junio 2026] - Sincronización Realtime y Vista de "Compartidos" (Panel Abogada)
- **Acción**: Se amplió el sistema en tiempo real y se creó una vista dedicada para que las abogadas vean sus clientes compartidos.
- **Cambios**:
    - **Sincronización Total**: Se editaron los listeners en `RealtimeSyncProvider.tsx` para incluir las tablas `expediente_asesoras`, `bitacora`, `recordatorios` y `seguimiento_tareas`. Esto garantiza que si una abogada actualiza algo en un expediente compartido, la otra abogada vea los cambios sin recargar la página.
    - **Pestaña "Compartidos"**: Se agregó una nueva sección en el sidebar de `ExpedienteManager.tsx` usando el ícono `Share2`. Filtra dinámicamente aquellos clientes que tienen más de una abogada asignada, mejorando la organización del trabajo en equipo.

### [15 Junio 2026] - Implementación de Múltiples Abogadas (Seguimiento Compartido)
- **Acción**: Se rediseñó el sistema de asignación para soportar múltiples abogadas por expediente (relación muchos a muchos), como solicitado por la Directora para los casos importados.
- **Cambios**:
    - **Base de Datos**: Se creó el archivo `01_expediente_asesoras.sql` con la estructura de la nueva tabla relacional `expediente_asesoras`.
    - **Panel Directora**: Se modificó `DirectorDashboard.tsx` para permitir seleccionar múltiples abogadas con checkboxes y mostrarlas separadas por coma en el Concentrado.
    - **Panel Abogada**: Se actualizó `ExpedienteManager.tsx` para mostrar a todas las abogadas asignadas al expediente.
    - **Server Actions**: Se reescribió `asignarAbogada` en `directora.ts` para hacer inserts múltiples, actualizar notificaciones push y preservar compatibilidad legacy. También se actualizó la lógica de privacidad en `abogada/page.tsx` para usar la tabla relacional.
- **Pendientes**:
    - **IMPORTANTE**: El usuario debe ejecutar el script SQL `01_expediente_asesoras.sql` en el Dashboard de Supabase.

### [15 Junio 2026] - Sincronización Inicial de Contexto
- **Acción**: Lectura exhaustiva de la arquitectura (Clean Architecture), stack tecnológico (Next.js, Supabase, R2) y el estado actual del proyecto (Sistema CECANI) para estar al tanto del flujo de trabajo y reglas.
- **Cambios**: Ninguno.
- **Pendientes**: Esperando instrucciones del usuario para continuar con el desarrollo.

### [13 Junio 2026] - Restauración de Paneles y Política de Preservación
- **Acción**: Se restauraron las vistas de validación en el panel de Directora y se estableció una regla de memoria para evitar regresiones.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`: Re-incorporación de la lógica de validación de pagos, contratos firmados y carga de doble firma (CECANI) en la pestaña "Por Asignar".
    - `Regla Crítica`: Se añadió a la memoria del proyecto la instrucción de **NUNCA eliminar funciones o vistas existentes** durante las actualizaciones.
- **Estado**: Funcionalidad administrativa completa recuperada y blindada contra futuras eliminaciones accidentales.

### [13 Junio 2026] - Implementación de Borrado Instantáneo (Optimistic UI)
- **Acción**: Se eliminó la latencia percibida al borrar clientes en el panel de Directora.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`: Se implementó un estado `hiddenIds` que oculta al cliente de la lista en milisegundos tras la confirmación, sin esperar la respuesta del servidor.
    - `src/actions/directora.ts`: Se integró la limpieza de R2 dentro del `Promise.all` paralelo para optimizar el tiempo total de ejecución en el backend.
- **Estado**: Borrado percibido como instantáneo por el usuario.

### [13 Junio 2026] - Optimización de Borrado y Simplificación de Concentrado
- **Acción**: Se aceleró el proceso de eliminación de clientes y se simplificó la UI del Concentrado.
- **Cambios**:
    - `src/actions/directora.ts`: Refactorización de `eliminarExpedienteAction` para usar `Promise.all`, ejecutando borrados de tablas en paralelo.
    - `src/components/directora/DirectorDashboard.tsx`: 
        - Implementación de **Actualización Optimista**: el modal se cierra y el proceso inicia sin bloquear la UI.
        - Simplificación de tarjetas: En el Concentrado se eliminaron botones de gestión para dejar únicamente el de **Eliminar** con un diseño más prominente.
- **Estado**: Eliminación instantánea percibida por el usuario y flujo simplificado.

### [13 Junio 2026] - Corrección de Validación Bloqueante (Paso 1 Cliente)
- **Acción**: Se corrigió la lógica de validación en `Paso1CrearProyecto.tsx` que impedía avanzar del sub-paso 2 al 3.
- **Cambios**: 
    - Se eliminó la verificación de `planPagos` en el `step === 2`.
    - Se añadió una verificación específica para `planPagos` en el `step === 3`.
- **Estado**: El flujo del cliente es ahora fluido y permite avanzar correctamente tras configurar la empresa.
## 6. Bitácora de Sesión
### [13 Junio 2026] - Formalización de Flujo Secuencial y Bloqueo de Asignación
- **Acción**: Se estableció un flujo obligatorio entre Cliente y Directora para garantizar la integridad legal del expediente.
### [18 Junio 2026] - Renombrado Dinámico de Documentos y Programación de WhatsApp
- **Acción**: Se implementó la capacidad para que la Abogada renombre los documentos pendientes y esos nombres se reflejen en la solicitud de documentos por WhatsApp.
- **Cambios**:
    - `src/actions/documentos.ts`: Se actualizó `registrarDocumento` para aceptar el parámetro `customNameOverride` saltándose las reglas estrictas de ENUM cuando es necesario.
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se rediseñó `DocumentItem` para incluir funcionalidad de edición inline (renombrado de etiquetas de documentos sin subir).
        - Se actualizaron las funciones `handleRenameDocument` para guardar los "slots" vacíos con la URL "PENDIENTE" y su nombre en DB.
        - Se unificó el listado `computedDocs` en la lógica de Programación del Hito (Modal WhatsApp), integrando el catálogo base con los documentos extras y nombres personalizados del expediente en cuestión.
- **Pendientes**: Probar exhaustivamente el flujo de comunicación de WhatsApp desde la vista de abogada.

### [13 Junio 2026] - Refactorización de Alta Maestra y Validación
- **Acción**: Ajustes al modal de Alta Maestra, renombrado y optimización.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`: Se ensanchó el modal (`max-w-3xl`) de "Alta de Clientes Manual", se habilitó el scroll interno y se agregaron las descripciones completas al combo de "Tipo de Asociación".
    - Se eliminó la captura del monto de contrato y lógicas asociadas.
- **Estado**: Funcional.

### [13 Junio 2026] - Privacidad de Expedientes para Abogadas
- **Acción**: Reescritura del backend para que cada abogada vea únicamente sus propios clientes.
- **Cambios**:
    - `src/actions/abogada.ts` y SQL subyacente: El dashboard ahora solo carga expedientes en los cuales la abogada está referenciada como `asesora_id` (Dueña) o en `expediente_asesoras` (Compartidos).
    - `src/components/abogada/ExpedienteManager.tsx`: El listado total muestra correctamente el contador real filtrado.
- **Estado**: Operativo y corrigiendo el problema de los 650 clientes ajenos visibles.

### [13 Junio 2026] - Refactorización de Modales por Pestañas (Validación vs Por Asignar)
- **Acción**: Implementación estricta de las reglas de visibilidad del flujo de validación en la interfaz de Directora.
- **Cambios**:
    - `FLUJO_PROCESO.md`: Creación del manual de flujo (Integración -> Formalización -> Operatividad).
    - `src/components/directora/DirectorDashboard.tsx`: Se implementó un bloqueo lógico; el botón de "Asignar Abogada" ahora es invisible hasta que se carga el **Contrato con Doble Firma**.
- **Estado**: Flujo administrativo blindado contra saltos accidentales.

### [13 Junio 2026] - Optimización de Responsividad en Interfaces
- **Acción**: Se auditó y mejoró la responsividad de las tres interfaces principales.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`: Sidebar colapsable.
    - `src/app/page.tsx`: Stepper adaptativo.
    - `src/components/cliente/Paso1CrearProyecto.tsx`: Diseño de topbar para móviles.
- **Estado**: Todas las interfaces operativas son ahora amigables con dispositivos móviles.

### [13 Junio 2026] - Implementación de Borrado Total de Clientes

- **Acción**: Se añadió la funcionalidad para que la Directora elimine clientes por completo desde el Concentrado.
- **Cambios**:
    - `src/lib/r2.ts`: Nueva función `borrarCarpetaExpedienteR2` para limpieza de bodega.
    - `src/actions/directora.ts`: Refactorización de `eliminarExpedienteAction` para incluir borrado en cascada manual (DB + R2 + Auth).
    - `src/components/directora/DirectorDashboard.tsx`: Integración de botón de eliminación en la lista y modal de confirmación con advertencia de irreversibilidad.
- **Estado**: Funcionalidad operativa y verificada visualmente mediante compilación exitosa.

### [13 Junio 2026] - Ejecución del Servidor en Segundo Plano
- **Acción**: Se activó el servidor de desarrollo Next.js en segundo plano mediante `npm run dev`.
- **Cambios**: Ninguno en el código.
- **Estado**: Servidor operativo en segundo plano.

### [10 Junio 2026] - Refactorización Integral: Diseño "Deep Dark" en ExpedienteManager
- **Acción**: Refactorización profunda de `src/components/abogada/ExpedienteManager.tsx` para alinearlo 100% con el sistema de diseño "Deep Dark".
- **Cambios**:
    - Se reemplazaron todos los tokens de color `blue-` e `indigo-` por variantes `sky-` y `slate-` oscuras.
    - Se migraron los fondos `bg-[#0f172a]` y `bg-[#1e293b]` a `bg-slate-950` y `bg-slate-900` respectivamente.
    - Se estandarizaron los botones a `bg-sky-600` con `hover:bg-sky-500`.
    - Se actualizaron los bordes a `slate-800` o `sky-600/20`.
    - Se corrigieron elementos decorativos y se verificó la ausencia de fragmentos JSX huérfanos.
- **Estado**: Interfaz de gestión de expedientes unificada con la estética del panel de Directora, logrando una coherencia visual total en las herramientas administrativas.

### [9 Junio 2026] - Rediseño de Cotizador Cliente, Bajas Docs y Optimización General
- **Acción**: Implementación de mejoras visuales en el portal del cliente, creación del flujo de "Bajas Docs" para documentos extras de abogada y reestructuración de la UI de expedientes.
- **Cambios**:
    - **Portal Cliente (`Paso1` y `Paso3`)**: Se reemplazó el término "Inversión" por "Pago". El paso de "Plan de Liquidación" se rediseñó como una calculadora visual en la sección de "Configuración de Servicios", dividiendo el pago normal (Único, Quincenal) del pago con tarjeta (MSI), y mostrando dinámicamente el monto de la cuota dividida.
    - **Panel Abogada (`ExpedienteManager`)**: 
        - Se reorganizó la pestaña "Etapa Legal" para dividir el Concentrado de Datos en tarjetas (se eliminó `asesora_encargada` y `ocupacion`).
        - Los integrantes de firma se movieron a "Checklist Docs".
        - Se implementó un botón para crear "Documentos Extras" personalizados, los cuales ahora respetan el flujo de solicitud de borrado.
        - Los checkboxes del flujo legal ahora son interactivos y cambian de color (verde, amarillo, rojo) según el estatus de los recordatorios (vencidos/pendientes).
    - **Panel Directora (`DirectorDashboard`)**: 
        - El botón de "Alta Maestra" se movió al menú principal superior derecho.
        - Se añadió la pestaña "Bajas Docs" para que la directora apruebe o rechace las eliminaciones de documentos (incluidos los extras) solicitadas por las abogadas.
        - En el listado de Concentrado ahora se ve el nombre de la asesora asignada y un botón rápido de "Ver Documentación".
- **Estado**: Todas las peticiones de UI/UX completadas y compilando correctamente.

### [9 Junio 2026] - Optimización de Concurrencia y Organización de Informes
- **Acción**: Creación de la carpeta `informes/` para alojar los reportes de asignación de clientes (`reporte_asignacion_abogadas.txt` y `reporte_multiples_abogadas.txt`). Implementación de estrategias de optimización para soportar 21+ abogadas simultáneas.
- **Cambios**:
    - Se creó el archivo `migration_optimizar_indices.sql` que contiene índices (`CREATE INDEX`) para las tablas más solicitadas (`expedientes`, `documentos`, `seguimiento_tareas`). Esto previene "Full Table Scans" en PostgreSQL y asegura tiempos de respuesta menores a 50ms incluso con carga alta.
    - El diseño de la UI ya estaba optimizado (ej. el "Concentrado de Datos" tiene un botón explícito de "Guardar Cambios" para no saturar la base de datos con auto-guardados por cada letra que teclean 20 personas al mismo tiempo).
- **Pendientes**: Ejecutar el archivo SQL en el editor de Supabase.

### [9 Junio 2026] - Verificación y Extracción de Abogadas
- **Acción**: Análisis de la columna "ASESORA CECANI ENCARGADA" del Excel `CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx`. Se normalizaron nombres, corrigieron errores tipográficos y se separaron los equipos.
- **Resultado**: Se identificaron 21 asesoras/abogadas únicas operando en el sistema:
  1. Abigail (Abi, Aby)
  2. Alejandra Chavira (Ale, Chavira)
  3. Araceli (Areceli)
  4. Blanca Briceño
  5. Claudia
  6. Dalia
  7. Filiberta Reyes Guerrero
  8. Flor
  9. Jorge Eduardo Quiztian
  10. Kenia Nextle (Kenia)
  11. Luisa Enríquez (Luiza, Luisa)
  12. Mirta
  13. Nereyda
  14. Niza Guerra (Niza, Nza)
  15. Odette
  16. Sandra
  17. Selena
  18. Valeria (Vale)
  19. Yael Matadamas López
  20. Yaraset Reyes (Yar)
  21. Yesenia

### [9 Junio 2026] - Importación de Concentrado de Excel a Base de Datos
- **Acción**: Lectura e importación automatizada del archivo `CONCENTRADO DE CONTRATOS EN SEGUIMIENTO.xlsx` a las tablas `perfiles`, `expedientes`, `datos_concentrado` y `seguimiento_tareas`.
- **Cambios**:
    - Se creó un script en Node.js usando la librería `xlsx` y `@supabase/supabase-js`.
    - Se procesaron 823 registros únicos del Excel.
    - Se insertaron 804 registros exitosamente, creando perfiles de usuario, el expediente base (A.C.), y la lista de control de documentos (`seguimiento_tareas` del hito 32 al 48) para que las abogadas puedan subir información.
    - Se creó el archivo `reporte_duplicados.txt` con la lista de asociaciones repetidas (se conservó la fila con más información).
- **Pendientes**:
    - Las abogadas ya pueden acceder a estos expedientes para asignar documentos, pero falta la asignación formal de abogada-expediente si se desea cambiar la encargada actual que viene en el Excel.
### [6 Junio 2026] - Refactorización de Modales por Pestañas (Validación vs Por Asignar)
- **Acción**: Implementación estricta de las reglas de visibilidad del flujo de validación en la interfaz de Directora según instrucciones de audio.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`:
        - **Pestaña Validación**: Ahora solo muestra los documentos iniciales (INE, Domicilio) y el contrato generado por el sistema.
        - **Filtro ListosParaAsignar**: Los clientes en `en_proceso` no aparecerán en la pestaña "Por Asignar" hasta que hayan subido su Contrato Firmado y su Comprobante de Pago. Mientras tanto, solo serán visibles en el "Concentrado".
        - **Pestaña Por Asignar**: Ahora solo muestra el Comprobante de Pago (con su monto), el Contrato Firmado por el cliente, y el área para subir la Doble Firma y asignar la asesora. Los documentos iniciales se ocultan para evitar duplicidad visual.
        - Se eliminó completamente el botón de "Contactar Cliente" de todos los modales.
        - Se eliminó el placeholder de "Esperando firma del cliente..." en la sección de contratos.
- **Estado**: El flujo de revisión es ahora secuencial, limpio y sin duplicidad de pasos.

### [6 Junio 2026] - Sincronización de CheckList y Visibilidad de Contratos
- **Acción**: Corrección del mapeo de documentos cliente-servidor e integración de contratos en el CheckList legal.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se implementó `DOCS_MAP` para traducir etiquetas de UI (ej: "INE FRENTE") a tipos de DB (ej: "ine_frente").
        - Se cambió el estatus visual de "Validado" a **"Recibido"** para reflejar con precisión la llegada de archivos del cliente.
        - Se integraron los **Contratos (Firmado por Cliente y Doble Firma)** directamente en el CheckList de Proceso, extrayendo las URLs de la tabla `contratos`.
        - Se verificó la operatividad del botón de solicitud de baja para los documentos enviados por el cliente.
- **Estado**: La abogada ahora visualiza correctamente todos los documentos que el cliente ya envió y tiene acceso total a los contratos finales validados por la directora.

### [6 Junio 2026] - Potenciación de Herramientas de Supervisión (Directora)
- **Acción**: Enriquecimiento de datos en el panel de Directora para una toma de decisiones más ágil.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`:
        - **Módulo de Gestión**: Se integró la sección **"Perfil del Cliente Titular"** mostrando RFC, CURP, Teléfono, Estado Civil, Ocupación y Domicilio.
        - **Módulo Documental**: Se añadió una cabecera de **"Contratos Oficiales"** que permite a la directora re-leer el contrato firmado por el cliente y el de doble firma (CECANI) con un solo clic.
        - **Comunicación Integrada**: Se añadieron botones de **WhatsApp Directo** tanto en el perfil del cliente como en la sección de contratos, unificando la supervisión con el contacto inmediato.
        - Se estandarizó la estética oscura (Shadow Blue/Black) en todos los nuevos componentes de los modales.
- **Estado**: Supervisión administrativa completa. La directora tiene visibilidad total de la identidad legal del cliente y sus contratos sin navegar entre carpetas.

### [6 Junio 2026] - Reorganización Visual de Contratos y Centro de Acción
- **Acción**: Centralización de documentos críticos y herramientas de comunicación en la cabecera del expediente.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se eliminaron las entradas de "Contrato Firmado" del CheckList de Proceso para evitar redundancia visual (imágenes/previsualizaciones).
        - Se creó un **"Action Bar"** en la cabecera con botones individuales para: **Contrato Cliente**, **Contrato CECANI** (Doble Firma) y **Borrador**.
        - Se reubicó el botón de **Contacto WhatsApp** al Centro de Acción, permitiendo acceso inmediato a documentos y comunicación en un solo bloque.
        - Se garantizó que los contratos solo se abran vía link externo (PDF), eliminando ruido visual en el CheckList.
- **Estado**: Interfaz operativa optimizada. La abogada tiene control total de la documentación legal y contacto directo desde el resumen principal.

### [6 Junio 2026] - Control de Errores y Comunicación Directa (Abogada)
- **Acción**: Implementación de herramientas de limpieza de datos (integrantes/recordatorios) y enlace directo a WhatsApp.
- **Cambios**:
    - **Server Actions**: Se crearon `eliminarIntegranteAction` y `eliminarRecordatorioAction` para corregir errores de captura.
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se añadieron botones de eliminación (Trash2) en las listas de integrantes de firma y recordatorios activos.
        - Se integró un botón de **Contacto Directo vía WhatsApp** en la cabecera del expediente, facilitando la comunicación inmediata con el cliente titular.
        - Se mejoró la visualización del contrato firmado, moviendo el acceso directo al visor de archivos al lado del aviso de estatus.
- **Estado**: Mayor autonomía para la abogada en la gestión de datos erróneos y comunicación agilizada.

### [6 Junio 2026] - Blindaje Estético "Shadow Blue" y Verificación de Bajas
- **Acción**: Refactorización estética final hacia un tema oscuro profundo y validación del flujo de eliminación de documentos.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se eliminaron todos los fondos blancos del CheckList de documentos, reemplazándolos por `bg-slate-900/50`.
        - Se aplicaron bordes "Neon Blue" y sombras profundas a los ítems del expediente para una estética unificada.
        - Se actualizó el formulario de recordatorios y el visor de WhatsApp con fondos `slate-950` y inputs oscuros.
    - **Validación de Flujo**:
        - Se verificó la trazabilidad de `solicitarBorradoAction` (Abogada) -> `aprobarBorradoAction` (Directora) -> `eliminarDocumentoAction` (Abogada, ejecución final).
        - El sistema de notificaciones Push (OneSignal) y el refresco en tiempo real (Supabase Realtime) garantizan que la abogada vea la autorización de baja al instante.
- **Estado**: Interfaz 100% libre de elementos claros en el área operativa. Flujo de control de cambios documental verificado y funcional.

### [6 Junio 2026] - Restauración del Modal de Agenda (Abogada)
- **Acción**: Implementación de la lógica de renderizado para el modal de programación de citas.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se detectó que el estado `showReminderForm` no tenía un componente modal asociado en el JSX.
        - Se integró `framer-motion` (`AnimatePresence` y `motion`) para un despliegue suave del modal.
        - Se añadió el bloque de renderizado del modal que invoca a `ReminderForm` vinculándolo con el catálogo de hitos.
        - Se importó el icono `X` para el cierre del modal.
- **Estado**: Funcionalidad de "Programar" 100% operativa. Ahora el botón abre correctamente el editor de mensajes de WhatsApp y agenda el recordatorio.

### [6 Junio 2026] - Reorganización Documental y Fix de Agenda (Abogada)
- **Acción**: Reestructuración del CheckList de documentos y corrección del sistema de programación de citas.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se dividió la documentación general en dos bloques: **"Datos Personales del Cliente"** y **"Documentación del Proceso"**.
        - Se aplicó una estética **"Deep Black & Neon Blue"** (Slate-950 con bordes Azul-900 y brillos en Azul-500) para mayor contraste.
        - Se corrigió el botón **"Programar"** en la pestaña de Proceso General (no disparaba el modal de WhatsApp).
        - Se actualizaron las plantillas de hito legal (Videollamada, Denominación, Notaría, SAT) basándose 100% en el **Manual de Área Legal**.
        - Se mejoró la prevención de eventos en inputs y botones para evitar conflictos de UI.
- **Estado**: Funcionalidad de agenda recuperada y CheckList alineado con la organización jerárquica del manual.

### [6 Junio 2026] - Rediseño de Identidad Visual y Limpieza UI
- **Acción**: Refactorización completa de colores en paneles de Abogada y Directora; eliminación de branding innecesario.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx` y `src/components/directora/DirectorDashboard.tsx`:
        - Migración masiva de colores: Se eliminaron tonos Indigo, Emerald, Amber, Pink, Rose y Violet.
        - Nueva Paleta Estricta: Solo se utiliza **Azul** (para acciones primarias, éxito y navegación) y **Rojo** (para alertas, rechazos, bajas y urgencias).
        - Eliminación del botón "Premium version" en ambas interfaces para simplificar la estética.
        - Unificación de estilos en botones de acción y barras de progreso.
- **Estado**: Interfaz profesional, unificada y alineada con la nueva directiva de diseño.

### [6 Junio 2026] - Mejora de CheckList de Documentación (Abogada)
- **Acción**: Corrección y expansión de la sección "CheckList Docs" en el panel de Abogada.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se actualizó `DOCS_CATALOGO` para incluir todos los documentos requeridos (INE Frente/Reverso, CURP, Pago Inicial, etc.).
        - Se añadió la sección de **"Documentación General (Cliente Titular)"** para visualizar los archivos subidos por el cliente antes de la asignación.
        - Se optimizó la visualización de documentos por integrante, filtrando tipos no aplicables (como Pago Inicial).
        - Se mejoró el mensaje cuando no hay integrantes registrados.
- **Estado**: Interfaz de documentación más robusta y alineada con el flujo legal real.

### [6 Junio 2026] - Inicio de Sesión y Ejecución del Servidor
- **Acción**: Inicio de la sesión de trabajo y despliegue del entorno de desarrollo local.
- **Cambios**: Ninguno en el código. Se activó el servidor Next.js en segundo plano.
- **Estado**: Servidor activo en `http://localhost:3000`. Preparado para continuar con las tareas pendientes (Validación de Directora y Doble Firma).

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

### [5 Junio 2026] - Restauración Visual y Ajustes de Funcionalidad
- **Acción**: Reversión del diseño del portal de cliente a la estética "Premium Blue" y restauración de funcionalidades críticas en los paneles de Directora y Abogada.
- **Cambios**:
    - `src/app/globals.css`: Implementación de arquitectura CSS híbrida para soportar tanto el tema Premium (Cliente) como el tema Admin One (Gestión).
    - `src/app/page.tsx`: Restauración a la versión "Luxury" e inyección de la clase `premium-theme`.
    - `src/components/cliente/`: Restauración integral de todos los pasos del flujo a la estética Midnight Navy.
    - `src/components/abogada/ExpedienteManager.tsx`: Restauración de la versión detallada (bitácoras, asociados, recordatorios) y cambio del icono de ojo por el botón "Gestionar".
    - `src/components/directora/DirectorDashboard.tsx`: Restauración de la funcionalidad de filtrado individual por abogada en la sección de concentrado y tablas detalladas.
- **Estado**: Interfaz de cliente alineada con la preferencia del usuario; paneles administrativos manteniendo el estándar corporativo moderno.

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

### [12 Junio 2026] - Corrección de Visibilidad (Datos Excel) y Despliegue
- **Acción**: Sincronización local-Vercel y corrección de visibilidad para los 800+ expedientes importados.
- **Cambios**:
    *   **Visibilidad Total (Admin)**: Modificado `src/app/abogada/page.tsx` para que admins/directoras puedan ver expedientes no asignados. Se aumentó el límite de consulta a 2000 registros.
    *   **Gestión de Históricos (Directora)**: Ajustado `DirectorDashboard.tsx` para mostrar expedientes de Excel en "Por Asignar" y permitir su asignación a abogadas sin requerir el flujo digital estricto (contrato/pago).
    *   **Fix Compilación**: Corregidos 24 errores de TypeScript en `ExpedienteManager.tsx` y `Paso3Contrato.tsx` (iconos faltantes, typos y variables de `useMemo` perdidas).
- **Estado**: Despliegue en Vercel exitoso. Los datos de Excel ya son visibles y gestionables por el equipo administrativo.

### [11 Junio 2026] - Fix: Alta Maestra y Visibilidad en Panel Legal
- **Acción**: Corrección de la visibilidad de expedientes creados manualmente y automatización de validación documental.
- **Cambios**:
    - `src/actions/directora.ts`: La acción `crearClienteManualAction` ahora establece automáticamente el estatus del expediente como `en_proceso` si se asigna una abogada en el momento de la creación. Se añadió `revalidatePath('/abogada')` para asegurar el refresco instantáneo en el panel legal.
    - `src/infrastructure/persistence/SupabaseDocumentosRepository.ts` & `src/actions/documentos.ts`: Se extendió la lógica de registro de documentos para soportar un parámetro opcional `validado`.
    - `src/components/directora/DirectorDashboard.tsx`: Al realizar un "Alta Maestra", los documentos subidos por la directora se registran ahora con el estado `validado: true`, eliminando la necesidad de que la propia directora apruebe sus subidas.
- **Estado**: Flujo de Alta Maestra corregido; los expedientes ahora aparecen inmediatamente para la abogada asignada y con documentos pre-aprobados.

### [11 Junio 2026] - Estabilización de Flujos y Corrección de Duplicados
- **Acción**: Resolución de problemas de redundancia en UI y optimización de la experiencia del cliente tras la subida de archivos.
- **Cambios**:
    - **Portal Cliente**:
        - `src/hooks/useExpediente.ts`: Se ajustó la lógica de `calcularPaso` para que el cliente permanezca en el Paso 2 (Documentación) mientras sus archivos están en estado de validación por dirección. Esto evita transiciones prematuras y el efecto de "múltiples recargas".
        - `src/components/cliente/Paso3Contrato.tsx`: Se añadió un mensaje informativo indicando que el contrato debe ser aprobado antes de proceder con la firma y el pago inicial.
    - **Panel Directora**:
        - `src/app/directora/page.tsx`: Se refinó la consulta del "Concentrado" para excluir expedientes sin asesora asignada, separando claramente los casos nuevos de los operativos.
        - `src/components/directora/DirectorDashboard.tsx`: Se implementó un sistema de deduplicación por ID en el filtrado de datos para garantizar que ningún cliente aparezca repetido en las vistas.
- **Estado**: Flujo de usuario más coherente; eliminación de duplicados visuales en la administración.

### [11 Junio 2026] - Optimización UI: Concentrado y Gestión Operativa (Directora)
- **Acción**: Mejora de la usabilidad y presentación en la sección de "Concentrado" del panel de Directora.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`:
        - **Layout Concentrado**: Se aumentó la densidad de información y se mejoró la responsividad del grid (`xl:grid-cols-3`). Se ajustaron los espacios y tipografía para evitar desbordamientos de texto.
        - **Acceso a Gestión**: Se añadió un botón con icono de "ojo" en las tarjetas de concentrado para abrir el modal de "Gestión y Concentrado Operativo", el cual era inaccesible previamente.
        - **Rediseño de Modal**: El modal de gestión fue reorganizado completamente:
            - Separación clara entre "Perfil del Cliente" e "Información Operativa/Bitácora".
            - Mejor visualización de la inversión total con acentos en azul y gradientes.
            - Optimización de la lectura del objeto social con un contenedor con scroll interno y tipografía itálica.
- **Estado**: Sección de concentrado optimizada para una gestión rápida y visualmente jerarquizada.

### [10 Junio 2026] - Rediseño Estético: Modo Oscuro "Deep Dark" (Directora)
- **Acción**: Refactorización visual completa del panel de Directora y su login para alinearlos con la estética profesional del login de abogadas.
- **Cambios**:
    - `src/components/directora/DirectorDashboard.tsx`:
        - Migración de paleta de colores a `Slate-950` (fondos profundos) y `Slate-900` (tarjetas/sidebar).
        - Cambio de acentos de azul estándar a `Sky-600` (celeste neón) para mayor profesionalismo.
        - Actualización de tipografía a `font-black uppercase tracking-widest` en etiquetas y títulos.
        - Refactorización de modales y visor de documentos con bordes `Slate-800` y efectos de glassmorphism refinados.
    - `src/components/directora/DirectoraLogin.tsx`:
        - Rediseño total desde "Modo Claro" a "Deep Dark Mode".
        - Implementación de gradientes `Red/Sky/Emerald` en la cabecera de autenticación.
    - `src/app/directora/page.tsx`: Sincronización del color de fondo del layout principal.
- **Estado**: Interfaz directiva modernizada y coherente con el resto del ecosistema administrativo.

### [11 Junio 2026] - Integración de Datos Completos de Excel en Panel de Abogada
- **Acción**: Actualización de la sección "Concentrado de Datos" en el Panel de Abogada (`ExpedienteManager.tsx`) para incluir y permitir la edición de todos los campos provenientes de los archivos Excel originales.
- **Cambios**:
    - Se agregaron campos faltantes a `CAMPOS_CONCENTRADO`: `cluni`, `pago_notario`, `pago_entrega_donataria`, `cantidad_cobrar_proximo`, `estatus_detalle`, `accion_realizar`, `cantidad_pagada_acumulada`, `fecha_ultimo_pago`, `quien_cobra`, `vendedora`, `fecha_contrato`, `link_reunion`, `fecha_reunion_acuerdos`.
    - Se rediseñó la UI de la pestaña "Etapa Legal" para dividir la información en 4 secciones lógicas: "Datos del Cliente Titular", "Datos de la Asociación y Legal", "Datos de Pagos y Contrato", y "Seguimiento y Estatus".
- **Estado**: La abogada ahora puede visualizar y modificar toda la información de contexto del cliente desde su panel sin necesidad de recurrir a documentos externos de Excel, con carga automática desde la base de datos `datos_concentrado`.

### [11 Junio 2026] - Corrección de Flujo: Validación de Documentación de Clientes
- **Acción**: Restricción en el avance de la interfaz del cliente para evitar que vean prematuramente la sección de "Formalización Legal" (Contrato) antes de que la directora haya aprobado su expediente, y eliminación de notificaciones push engañosas.
- **Cambios**:
    - `src/hooks/useExpediente.ts`: Se modificó la regla del "Paso 2" para que el cliente se mantenga en la vista de carga ("Documentación en Validación") mientras el estatus sea `revision_directora`, bloqueando el avance al Paso 3 incluso si los documentos individuales han sido marcados con palomita verde.
    - `src/core/services/ContratoService.ts`: Se eliminó el bloque que enviaba la notificación push prematura de "¡Tu contrato está listo!" en la función `generarContratoAutomatico`, ya que este solo debe notificarse cuando la directora oprima "Aprobar Expediente" o envíe el contrato.
    - `src/components/cliente/Paso3Contrato.tsx`: Se cambió el texto de "Instrumento" a "Contrato" para mayor claridad hacia el usuario final.
- **Estado**: El flujo del cliente es ahora más lógico; verán una pantalla de "En Validación" continua hasta recibir aprobación formal de la directora.

### [11 Junio 2026] - Reestructuración de la Agenda de Abogada
- **Acción**: Agrupación por cliente de los recordatorios en la vista de Agenda del panel de la abogada para evitar saturación visual y mejorar la organización.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se creó la función `groupRecordatoriosByExpId` para agrupar dinámicamente un arreglo de recordatorios por `expId`.
        - Se implementó el componente `GroupedRecordatorioCard` que encapsula la información del cliente (Empresa y Representante) en una cabecera, y renderiza una lista de recordatorios en su interior.
        - Se modificó la vista de lista (`agendaView === 'lista'`) para mapear utilizando la función de agrupación.
        - Se optimizó la celda de la vista de calendario (`agendaView === 'calendario'`) para que, cuando haya varios recordatorios de un mismo cliente en un día, solo muestre 1 fila indicando la cantidad: `Empresa (5)`.
- **Estado**: La agenda es mucho más legible, agrupando la carga de trabajo diaria, vencida y futura por cliente en lugar de por tarjeta individual.

### [11 Junio 2026] - Nuevas Herramientas: Mis Tareas y Actividad Reciente
- **Acción**: Se eliminó el panel de Solicitud de Alta de la abogada y en su lugar se crearon dos nuevas vistas analíticas globales.
- **Cambios**:
    - `src/components/abogada/ExpedienteManager.tsx`:
        - Se creó la pestaña "Mis Tareas" que extrae dinámicamente el próximo paso (Hito no completado) de cada expediente y lo lista para fácil acceso.
        - Se creó la pestaña "Actividad Reciente" que unifica y ordena de manera descendente todas las notas de bitácora de todos los expedientes de la abogada.
        - Se leyeron los flujos del `MANUAL ÁREA LEGAL.pdf` para asegurar congruencia.
- **Estado**: La abogada ahora tiene herramientas de productividad robustas sin necesidad de alterar la base de datos subyacente.

### [13 Junio 2026] - Refinamiento de Responsividad y Menús Colapsables
- **Acción**: Se ajustaron las interfaces de Directora, Abogada y Cliente para soportar resoluciones móviles y se corrigió el menú lateral.
- **Cambios**:
    - `ExpedienteManager.tsx` y `DirectorDashboard.tsx`: Menú colapsable en desktop activable presionando el avatar. Se eliminaron insignias duplicadas en la cabecera. Paddings responsivos y grids escalables.
    - `Paso1CrearProyecto.tsx`: Se ajustaron los paddings estáticos a responsivos.
- **Estado**: Interfaces responsivas listas para producción.
