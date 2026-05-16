# Contexto del Proyecto: Sistema Administrativo CECANI

Este documento resume las optimizaciones, cambios estructurales y decisiones técnicas tomadas durante el desarrollo y refinamiento del Sistema Administrativo CECANI para centralizar la gestión de contratos y expedientes legales.

## 1. Resumen de Optimizaciones Principales

### Panel de la Directora (Unificado)
*   **Eliminación de Etapas Redundantes:** Se eliminó la pestaña de "Validación" intermedia. El flujo ahora es directo: el cliente firma el contrato generado -> el expediente aparece en "Por Asignar" -> la Directora finaliza el proceso.
*   **Enriquecimiento de Tablas:** Se añadieron columnas de *Figura Legal* y *Servicios Seleccionados* (incluyendo avisos de cotización contable) directamente en la vista principal para evitar aperturas de modales innecesarias.
*   **Gestión de Documentos Inteligente:** Se implementó un filtro en el modal de la Directora para eliminar fotos duplicadas (INE, Comprobantes) que se acumulaban por re-subidas del cliente.

### Flujo de Contratos y Firmas
*   **Proceso de Doble Firma:** El sistema ahora permite a la Directora descargar el PDF firmado por el cliente, compararlo con el original, subir la versión final con ambas firmas y asignar a la abogada en un solo paso.
*   **Asignación de Abogadas:** Se robusteció la consulta de personal para incluir múltiples roles (`asesora`, `abogada`, `admin`), garantizando que la lista de selección nunca aparezca vacía si hay personal registrado.

## 2. Cambios Técnicos Clave

### Base de Datos y Backend
*   **Supabase Admin:** Uso de `createAdminClient` para operaciones críticas de dirección, permitiendo bypass de RLS (Row Level Security) y asegurando que la Directora tenga visibilidad total de los expedientes.
*   **Limpieza de Datos:** Eliminación del campo `folio_ine` en todos los formularios y motores de generación de PDF para simplificar el registro del cliente.
*   **Acciones de Servidor:** Creación de `aprobarContratoGeneradoCliente` y optimización de `asignarAbogada` para manejar notificaciones automáticas.

### Frontend y UI/UX
*   **Diseño Premium:** Implementación de una paleta de colores azul pastel, layouts *full-width* (horizontal) y adaptabilidad responsiva total.
*   **Micro-interacciones:** Avisos visuales para servicios que requieren "Cotización Contable" (Regularización) y estados de carga en botones.

## 3. Arquitectura del Sistema (Clean Architecture)

Se ha implementado una **Arquitectura Limpia (Clean Architecture)** para garantizar que el proyecto sea escalable, fácil de mantener e independiente de proveedores externos.

### Estructura de Capas:
*   **🧠 Dominio (`src/core/domain`):** El corazón del negocio. Contiene las interfaces (contratos) y tipos de datos que definen qué hace el sistema.
*   **⚙️ Aplicación (`src/core/services`):** Casos de uso y lógica de orquestación. Aquí reside el "cerebro" que decide el flujo de los expedientes y contratos.
*   **🔌 Infraestructura (`src/infrastructure`):** Detalles técnicos. Implementaciones reales de Supabase (persistencia), Cloudflare R2 (almacenamiento) y OneSignal (notificaciones).
*   **🖼️ Presentación (`src/app`, `src/actions`):** Interfaz de usuario y controladores (Server Actions) delgados que delegan la lógica a los servicios.

### Beneficios:
*   **Desacoplamiento:** Las herramientas externas (como OneSignal o Supabase) pueden ser reemplazadas sin afectar la lógica de negocio central.
*   **Mantenibilidad:** Cada función tiene un lugar único y predecible.
*   **Robustez:** Se eliminó la lógica compleja de los *Server Actions*, convirtiéndolos en puentes simples hacia los servicios.

## 4. Estado Actual y Siguientes Pasos

### Estado: Operativo
*   El sistema permite el registro, generación de contrato, firma digital del cliente, validación de la directora y asignación de abogada.
*   Los archivos se almacenan de forma segura en Cloudflare R2.

### Pendientes / Ideas de Mejora
*   **Cálculo de IVA:** Automatizar el cálculo matemático exacto (`Total * 1.16`) en el motor de PDF en lugar de solo mencionar "(MÁS IVA)".
*   **Triggers de Notificación:** Configurar alertas automáticas vía email para el área contable cuando se detecte un servicio de "Regularización".
*   **Refactorización:** Ejecutar limpieza de lints menores (`prefer-const`, `unused-vars`) en el motor de PDF para mantener la salud del código.

---
*Última actualización: 14 de Mayo, 2026*
