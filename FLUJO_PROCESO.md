# Flujo del Sistema CECANI - Portal Cliente (Actualizado)

Este documento detalla el proceso desde que un cliente inicia su trámite hasta el seguimiento por parte de la abogada, integrando la nueva Arquitectura Híbrida.

## 1. Registro Legal y Cotización (Cliente - Paso 1)
- **Datos Personales y Legales**: El cliente ingresa su nombre, RFC, CURP, Ocupación, Estado Civil y Domicilio Completo. Estos datos son vitales para las declaraciones del contrato.
- **Configuración de Empresa**: Define el nombre de la organización y la figura legal deseada.
- **Calculadora Modular**: Selecciona el servicio base y módulos extra (Web, CLUNI, etc.). El sistema calcula el total con descuentos por pago de contado si aplica.
- **Persistencia**: Se crea el **Expediente** y el registro en la tabla `perfiles` de Supabase.

## 2. Carga de Documentos Iniciales (Cliente - Paso 2)
- **Identificación**: El cliente sube INE (frente/vuelta) y Comprobante de Domicilio.
- **Almacenamiento Híbrido**: Los archivos se suben a **Cloudflare R2** (`/documentacion/`) y las URLs se guardan en la tabla `documentos` de Supabase.
- **Generación de Contrato**: Al finalizar este paso, el sistema genera automáticamente el **Contrato PDF Profesional** con los datos del Paso 1 y lo sube a R2 (`/contratos/`).
- **NOTIFICACIÓN**: Se avisa a la **Directora** del nuevo expediente.

## 3. Descarga, Firma y Pago (Cliente - Paso 3)
- **Descarga**: El cliente descarga su contrato personalizado desde el sistema.
- **Firma**: Sube el contrato ya firmado (escaneado/foto). Se guarda en R2 como `Contrato_FIRMADO_POR_CLIENTE_...`.
- **Pago**: Sube el comprobante de su pago inicial y registra el monto pagado.
- **Estatus**: El expediente pasa a `en_proceso`.

## 4. Validación, Doble Firma y Asignación (Directora)
- **Revisión**: La Directora comprueba los datos legales, el contrato firmado y el pago.
- **Doble Firma**: Sube el contrato final con la firma de CECANI.
- **Asignación**: Designa a una **Asesora** para iniciar el trámite legal.

## 5. Seguimiento Operativo (Asesora)
- **Gestión en Panel**: Seguimiento de hitos (CLUNI, Notaría, RPP) mediante la tabla de Concentración.
- **Bitácora**: Registro de avances y comunicación.
- **Capacitación**: Liberación de cursos y diplomados según el avance del cliente.

---
*Documento actualizado por Gemini CLI - Mayo 2026*
*Arquitectura: Next.js + Supabase + Cloudflare R2*
