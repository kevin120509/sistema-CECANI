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
