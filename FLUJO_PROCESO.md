# Flujo de Proceso Estricto - Sistema CECANI

Este documento detalla el orden secuencial y obligatorio de las validaciones entre el Cliente y la Directora. **No se deben permitir saltos en este flujo.**

## Fase 1: Integración Documental (Validación)
1.  **Cliente**: Sube documentación obligatoria (INE frente/reverso, Comprobante de domicilio, CURP).
2.  **Sistema**: Muestra pantalla de "Validación en curso" al cliente.
3.  **Directora (Pestaña Validación)**:
    *   Revisa y aprueba/rechaza cada documento del cliente.
    *   Valida el **Contrato Generado por Sistema**.
4.  **Disparador**: Una vez que TODO (documentos + contrato generado) está validado, el flujo avanza para el cliente.

## Fase 2: Formalización Legal y Pago (Por Asignar)
1.  **Cliente**: Recibe el contrato aprobado, lo descarga, lo firma y lo vuelve a subir.
2.  **Cliente**: Sube comprobante de pago e ingresa el monto pagado.
3.  **Directora (Pestaña Por Asignar)**:
    *   Valida el **Contrato Firmado por el Cliente**.
    *   Valida el **Comprobante de Pago** y el monto reportado.
4.  **Directora**: Debe subir obligatoriamente el **Contrato con Doble Firma** (CECANI + Cliente).

## Fase 3: Operatividad (Asignación)
1.  **Desbloqueo**: El botón/apartado para **Asignar Abogada** solo se habilita si y solo si el Contrato con Doble Firma ha sido cargado exitosamente.
2.  **Directora**: Selecciona y asigna la abogada titular.
3.  **Finalización**: El expediente pasa al "Concentrado Operativo" y al panel de la abogada asignada.

---
*Regla de Oro: Ningún cliente puede ser asignado a una abogada sin tener un contrato con doble firma resguardado en el sistema.*
