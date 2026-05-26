import { generarContratoPDF } from '../src/lib/pdf-generator';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  const buffer = await generarContratoPDF({
    nombreEmpresa: 'Fundación de Ayuda Social Integral',
    nombreRepresentante: 'Carlos Hernández Villanueva',
    figuraLegal: 'Asociación Civil',
    servicioBaseId: 'constitucion',
    modulosExtraIds: ['web', 'cluni'],
    montoTotal: 75900,
    planPagos: '3_msi',
    rfc: 'HEVC800512XYZ',
    curp: 'HEVC800512HDFRPL09',
    ocupacion: 'Ingeniero',
    estadoCivil: 'Casado',
    domicilioCompleto: 'Av. Paseo de la Reforma 222, Col. Juárez, Cuauhtémoc, CDMX, C.P. 06600',
    tipoContrato: 'legal',
    observaciones_pago: 'Ninguna'
  });

  const outputPath = path.join(process.cwd(), 'scratch', 'test_contrato.pdf');
  fs.writeFileSync(outputPath, buffer);
  console.log('PDF de prueba generado en:', outputPath);
}

test().catch(console.error);
