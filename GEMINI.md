# 🤖 PROTOCOLO DE AGENTE (LECTURA OBLIGATORIA)

> **ESTE ARCHIVO ES TU DIRECTIVA PRIMARIA.** Si eres una IA, debes seguir este protocolo sin excepción antes de responder al usuario.

## 🚦 Paso 0: Sincronización de Contexto
Antes de procesar cualquier solicitud, DEBES:
1.  **Leer `CONTEXTO_GEMINI.md`**: Aquí reside el estado actual del sistema, la bitácora de cambios recientes y los pendientes críticos.
2.  **Leer `ARCHITECTURE.md`**: Entiende la Arquitectura Limpia y la estructura híbrida R2/Supabase.
3.  **Respetar la Bitácora**: Al finalizar CUALQUIER tarea (modificación de código o investigación), actualiza la sección `## 6. Bitácora de Sesión` en `CONTEXTO_GEMINI.md`.

## 📜 Reglas de Operación
- **No repitas explicaciones**: Si algo ya está en los archivos de contexto, asume que el usuario y tú ya lo saben.
- **Continuidad Total**: Tu objetivo es que la siguiente IA que entre pueda retomar exactamente donde tú dejaste el trabajo.
- **Surgical Edits**: Mantén la integridad de la Clean Architecture.

## ✍️ Formato de Bitácora (en CONTEXTO_GEMINI.md)
Cada entrada debe seguir este formato:
`### [Fecha] - [Título de la Tarea]`
- **Acción**: Resumen breve.
- **Cambios**: Archivos afectados.
- **Pendientes**: Qué falta por hacer.

---
*Establecido por Gemini CLI - Mayo 2026*

