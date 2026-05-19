/**
 * Utilidades de validación para campos sensibles en México (RFC, CURP, etc.)
 */

/**
 * Expresión regular para validar RFC (Persona Física y Moral)
 * - Persona Física: 4 letras, 6 dígitos (YYMMDD), 3 caracteres de homoclave
 * - Persona Moral: 3 letras, 6 dígitos (YYMMDD), 3 caracteres de homoclave
 */
export const RFC_REGEX = /^([A-ZÑ&]{3,4}) ?(\d{2}(?:0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])) ?([A-Z\d]{2})([A\d])$/;

/**
 * Expresión regular para validar CURP
 * - 4 letras, 6 dígitos (YYMMDD), Sexo (H/M), 2 letras de estado, 3 letras (consonantes), 2 caracteres de verificación
 */
export const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/;

/**
 * Valida un RFC y retorna true si es válido
 */
export function validateRFC(rfc: string): boolean {
  if (!rfc) return false;
  return RFC_REGEX.test(rfc.toUpperCase().trim());
}

/**
 * Valida una CURP y retorna true si es válida
 */
export function validateCURP(curp: string): boolean {
  if (!curp) return false;
  return CURP_REGEX.test(curp.toUpperCase().trim());
}

/**
 * Formatea un RFC a mayúsculas y quita espacios
 */
export function formatRFC(rfc: string): string {
  return rfc.toUpperCase().replace(/\s/g, '');
}

/**
 * Formatea una CURP a mayúsculas y quita espacios
 */
export function formatCURP(curp: string): string {
  return curp.toUpperCase().replace(/\s/g, '');
}
