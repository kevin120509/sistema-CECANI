/**
 * Convierte números a letras en español (formato para contratos y cheques).
 * Ejemplo: 1500.50 -> MIL QUINIENTOS PESOS 50/100 M.N.
 */
export function numeroALetras(num: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const dieces = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintes = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertirSeccion(n: number): string {
    let res = '';
    if (n >= 100) {
      if (n === 100) return 'CIEN';
      res += centenas[Math.floor(n / 100)] + ' ';
      n %= 100;
    }
    if (n >= 20) {
      if (n >= 21 && n <= 29) {
        res += 'VEINTI' + unidades[n % 10];
      } else {
        res += decenas[Math.floor(n / 10)];
        if (n % 10 > 0) res += ' Y ' + unidades[n % 10];
      }
    } else if (n >= 10) {
      res += dieces[n - 10];
    } else if (n > 0) {
      res += unidades[n];
    }
    return res.trim();
  }

  const partes = num.toString().split('.');
  let entero = parseInt(partes[0]);
  const decimal = partes[1] ? partes[1].padEnd(2, '0').substring(0, 2) : '00';

  if (entero === 0) return `CERO PESOS ${decimal}/100 M.N.`;

  let resultado = '';
  if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000);
    resultado += (millones === 1 ? 'UN MILLON' : convertirSeccion(millones) + ' MILLONES') + ' ';
    entero %= 1000000;
  }
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    resultado += (miles === 1 ? 'MIL' : convertirSeccion(miles) + ' MIL') + ' ';
    entero %= 1000;
  }
  resultado += convertirSeccion(entero);

  return `${resultado.trim()} PESOS ${decimal}/100 M.N.`;
}
