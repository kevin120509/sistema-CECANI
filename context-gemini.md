# Contexto del Proyecto: Sistema Administrativo CECANI

Este documento resume las optimizaciones, cambios estructurales y decisiones técnicas tomadas para centralizar la gestión de contratos y expedientes legales. **Actualizado para continuidad con Antigravity.**

## 1. Evolución Arquitectónica (Clean Architecture)
El sistema utiliza una arquitectura de capas desacoplada para garantizar robustez:

*   **Patrón Result (`src/core/domain/Result.ts`):** Manejo funcional de errores `Success | Failure`. Se debe evitar el uso de `try/catch` en la capa de aplicación, delegando el manejo al tipo `Result`.
*   **Servicios Centralizados:** La lógica de negocio reside en `src/core/services/ExpedienteService.ts`. Los Server Actions son controladores delgados.
*   **Repositorios:** Implementaciones en `src/infrastructure/persistence/` (Supabase) y `src/infrastructure/storage/` (Cloudflare R2).

## 2. Frontend y UX (React 19 + Next.js 16)
*   **Estética Luxury Premium:** Uso intensivo de `backdrop-blur-2xl`, sombras profundas y animaciones escalonadas con `framer-motion`.
*   **Rendimiento:** Implementación de **Lazy Initialization** en componentes pesados como `ExpedienteManager.tsx` para manejar más de 500 registros sin lag.
*   **Next.js 16:** El archivo de middleware se ha renombrado a `src/proxy.ts` siguiendo la nueva convención.

## 3. Gestión de Datos y Bóveda R2
*   **Estructura de Archivos:**
    *   Contratos: `expedientes/{EMPRESA_KEY}/contratos/`
    *   Documentación: `expedientes/{EMPRESA_KEY}/documentacion/`
*   **Alta Maestra:** Flujo administrativo de 3 pasos que permite crear cliente, subir 4 documentos críticos y asignar abogada en una sola operación atómica.
*   **Consolidación de Asesoras:** Se ha realizado una purga y normalización de nombres. Las asesoras oficiales son: SANDRA, ABIGAIL, LUISA ENRIQUEZ, ARACELI, CHAVIRA, ODETTE, YESENIA, FLOR, KENIA, SELENA, VALERIA, NIZA GUERRA.

## 4. Skills de IA Activas
Para mantener la calidad, este proyecto se trabaja con:
*   `next-best-practices`: Next.js 15+, PPR, y Server Actions.
*   `frontend-design`: Estética "Luxury Minimalist".
*   `tailwind-css-patterns`: Composición avanzada de utilidades (Tailwind v4).
*   `typescript-advanced-types`: Tipado estricto y genéricos.

## 5. Pendientes Críticos para Antigravity
1.  **Notificaciones Push:** Integrar OneSignal para alertar a asesoras sobre nuevos registros en bitácora.
2.  **Validación de R2:** Implementar políticas de seguridad para que las URLs de R2 no sean públicas por defecto.
3.  **Cálculos Automáticos:** Refinar el motor de PDF para realizar cálculos de IVA exactos.

---
*Última actualización: 16 de Mayo, 2026 (Migración de Datos y Optimización Masiva)*
