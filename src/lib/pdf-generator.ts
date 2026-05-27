import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { SERVICIOS_PRINCIPALES, SERVICIOS_EXTRAS } from './constants';
import { numeroALetras } from './utils-pdf';
import type { PlanPagos } from '@/types/database';

interface DatosContrato {
  nombreEmpresa: string;
  nombreRepresentante: string;
  figuraLegal: string;
  servicioBaseId: string;
  modulosExtraIds: string[];
  montoTotal: number;
  planPagos: PlanPagos;
  rfc?: string | null;
  curp?: string | null;
  ocupacion?: string | null;
  estadoCivil?: string | null;
  domicilioCompleto?: string | null;
  tipoContrato?: 'legal' | 'contabilidad';
  observacionesPago?: string | null;
}

export async function generarContratoPDF(datos: DatosContrato): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([600, 800]);
  let { width, height } = page.getSize();
  let y = height - 50;
  const margin = 60;
  const contentWidth = width - (margin * 2);
  const lineSpacing = 4;
  const paragraphSpacing = 12;

  const isContabilidad = datos.tipoContrato === 'contabilidad';
  const tipoServicioTitulo = isContabilidad ? 'Servicios Contables' : 'Consultoría';
  
  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < 60) {
      page = pdfDoc.addPage([600, 800]);
      y = height - 60;
    }
  };

  const addSpacing = (points: number) => {
    checkPageBreak(points);
    y -= points;
  };

  const drawParagraph = (
    text: string, 
    baseSize: number = 11,
    align: 'left' | 'center' | 'justify' = 'justify', 
    indent: number = 0
  ) => {
    let wordsWithBold: { text: string, isBold: boolean }[] = [];
    let isCurrentlyBold = false;
    const rawWords = text.split(' ');
    for (const rw of rawWords) {
      let wordText = rw;
      let startsWithBold = false;
      let endsWithBold = false;
      if (wordText.startsWith('**')) { startsWithBold = true; wordText = wordText.substring(2); }
      if (wordText.includes('**')) { endsWithBold = true; wordText = wordText.replace('**', ''); }
      if (startsWithBold) isCurrentlyBold = true;
      wordsWithBold.push({ text: wordText, isBold: isCurrentlyBold });
      if (endsWithBold) isCurrentlyBold = false;
    }
    const lines: { words: {text: string, isBold: boolean}[], isLast: boolean }[] = [];
    let currentLineWords: {text: string, isBold: boolean}[] = [];
    let currentLineWidth = 0;
    const getWordMetrics = (word: string, isBold: boolean) => {
      const font = isBold ? fontBold : fontNormal;
      const size = isBold ? baseSize + 1 : baseSize;
      return { font, size, width: font.widthOfTextAtSize(word, size) };
    };
    for (let i = 0; i < wordsWithBold.length; i++) {
      let wordObj = wordsWithBold[i];
      let { width: wordWidth } = getWordMetrics(wordObj.text, wordObj.isBold);
      let { width: spaceWidth } = getWordMetrics(' ', wordObj.isBold);
      if (currentLineWidth + wordWidth + (currentLineWords.length > 0 ? spaceWidth : 0) > (contentWidth - indent)) {
        lines.push({ words: currentLineWords, isLast: false });
        currentLineWords = [wordObj];
        currentLineWidth = wordWidth;
      } else {
        currentLineWords.push(wordObj);
        currentLineWidth += wordWidth + (currentLineWords.length > 1 ? spaceWidth : 0);
      }
    }
    if (currentLineWords.length > 0) lines.push({ words: currentLineWords, isLast: true });
    const maxLineHeight = baseSize + 2 + lineSpacing;
    for (const lineObj of lines) {
      checkPageBreak(maxLineHeight);
      let x = margin + indent;
      if (align === 'center') {
         let totalW = 0;
         for(let j=0; j<lineObj.words.length; j++) {
           let w = lineObj.words[j];
           let { width } = getWordMetrics(w.text, w.isBold);
           let { width: sWidth } = getWordMetrics(' ', w.isBold);
           totalW += width + (j < lineObj.words.length - 1 ? sWidth : 0);
         }
         x = (width - totalW) / 2;
         let currentX = x;
         for(let j=0; j<lineObj.words.length; j++) {
           let w = lineObj.words[j];
           let { font, size, width: wWidth } = getWordMetrics(w.text, w.isBold);
           let { width: sWidth } = getWordMetrics(' ', w.isBold);
           page.drawText(w.text, { x: currentX, y, size, font });
           currentX += wWidth + sWidth;
         }
      } else if (align === 'justify' && !lineObj.isLast && lineObj.words.length > 1) {
         let totalWordsWidth = 0;
         for (let j=0; j<lineObj.words.length; j++) {
             let { width } = getWordMetrics(lineObj.words[j].text, lineObj.words[j].isBold);
             totalWordsWidth += width;
         }
         const gapCount = lineObj.words.length - 1;
         const extraSpace = gapCount > 0 ? (contentWidth - indent - totalWordsWidth) / gapCount : 0;
         let currentX = x;
         for (let j=0; j<lineObj.words.length; j++) {
            let w = lineObj.words[j];
            let { font, size, width: wWidth } = getWordMetrics(w.text, w.isBold);
            page.drawText(w.text, { x: currentX, y, size, font });
            currentX += wWidth + extraSpace;
         }
      } else {
         let currentX = x;
         for (let j=0; j<lineObj.words.length; j++) {
            let w = lineObj.words[j];
            let { font, size, width: wWidth } = getWordMetrics(w.text, w.isBold);
            let { width: sWidth } = getWordMetrics(' ', w.isBold);
            page.drawText(w.text, { x: currentX, y, size, font });
            currentX += wWidth + sWidth;
         }
      }
      y -= maxLineHeight;
    }
    y -= paragraphSpacing;
  };

  const drawBullet = (text: string) => { drawParagraph(text, 11, 'left', 15); };

  const contractCode = `${Math.floor(Math.random() * 900 + 100)}/2026_${datos.servicioBaseId.toUpperCase().substring(0, 4)}`;
  page.drawText(contractCode, { x: width - margin - 110, y: height - 40, size: 10, font: fontNormal });

  addSpacing(20);
  drawParagraph(
    `Contrato de Prestación de Servicios para **${tipoServicioTitulo.toUpperCase()}** que celebran por una parte **“CECANI”**, SOCIEDAD CIVIL, representada en este acto por la **C. MIRTA DENIS CRUZ MORALES** a quien en lo sucesivo se le denominará **“LA EMPRESA”** y, por la otra, la **C. ${datos.nombreRepresentante.toUpperCase()}**, quien se denominará **“EL CLIENTE”**, ambas partes están de acuerdo con celebrar el presente contrato al tenor de las siguientes:`,
    11, 'justify'
  );

  drawParagraph('**DECLARACIONES**', 13, 'center');
  drawParagraph('**I. “LA EMPRESA”, a través de su representante legal manifiesta:**', 12, 'left');
  drawParagraph('a) Que tiene capacidad jurídica y técnica para prestar sus servicios...', 11, 'justify', 15);
  drawParagraph('b) Que cuenta con el personal capacitado e instalaciones necesarias para realizar dicho objetivo.', 11, 'justify', 15);
  drawParagraph('c) RFC: **CEC181024K45** Domicilio: calle Fresnitos, número 206 local 2, Santa Cruz Xoxocotlán, Oaxaca.', 11, 'justify', 15);

  drawParagraph('**II. “EL CLIENTE” manifiesta bajo protesta de decir verdad:**', 12, 'left');
  drawParagraph(
    `a) Que es una persona física, con RFC **${datos.rfc || '_______'}** y CURP **${datos.curp || '_______'}**, de ocupación **${datos.ocupacion || '_______'}** y estado civil **${datos.estadoCivil || '_______'}**, quien se identifica con credencial para votar vigente.`, 
    11, 'justify', 15
  );
  drawParagraph(`b) Domicilio: **${datos.domicilioCompleto || '_______'}**.`, 11, 'justify', 15);
  drawParagraph(`c) Representa legalmente a: **${datos.nombreEmpresa.toUpperCase()}**, figura: **${datos.figuraLegal.toUpperCase()}**.`, 11, 'justify', 15);

  checkPageBreak(120);
  drawParagraph('**CLÁUSULAS**', 13, 'center');

  drawParagraph(`**Primera.** “LA EMPRESA” se compromete a prestar sus servicios a “EL CLIENTE” en las áreas siguientes:`, 11, 'justify');
  let areasServicio = isContabilidad ? ['Asesoría Contable Especializada para Donatarias.', 'Cumplimiento de obligaciones fiscales ante el SAT.'] : 
    (datos.servicioBaseId === 'constitucion' ? ['Constitución de A.C.', 'Autorización para Donataria.'] : ['Actualización de estatutos y Donataria.']);
  areasServicio.forEach((s, i) => drawParagraph(`${i + 1}. ${s}`, 11, 'left', 15));

  drawParagraph('**Nuestro servicio incluye:**', 12, 'left');
  let inclusiones = isContabilidad ? ['• Declaraciones mensuales y anuales.', '• Asesoría fiscal continua.'] : ['• Acompañamiento legal.', '• Gestión ante el SAT y Notaría.'];
  inclusiones.forEach(item => drawBullet(item));

  const montoLetras = numeroALetras(datos.montoTotal);
  drawParagraph(`**Segunda.** Las partes convienen en que los honorarios por los servicios que “LA EMPRESA” prestará a “EL CLIENTE” corresponden a un monto de **$${datos.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${montoLetras.toUpperCase()} M.N.) incluye IVA.**`, 11, 'justify');

  // Lógica de Plan de Pagos Matemática
  if (datos.planPagos === 'unico') {
    drawParagraph('Dicho monto ha sido pactado bajo la modalidad de **Pago Único de Contado**.', 11, 'justify');
  } else if (['3_msi', '6_msi', '12_msi', '18_msi'].includes(datos.planPagos)) {
    const meses = parseInt(datos.planPagos.split('_')[0]);
    const pagoMensual = datos.montoTotal / meses;
    drawParagraph(`Dicho monto se cubrirá en **${meses} pagos mensuales fijos** de **$${pagoMensual.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN** a través de financiamiento con tarjeta de crédito (MSI).`, 11, 'justify');
  } else if (datos.planPagos === '2_pagos') {
    drawParagraph('Dicho monto se cubrirá en **2 pagos quincenales** de **$35,500.00 MXN** cada uno.', 11, 'justify');
  } else if (datos.planPagos === '4_pagos') {
    drawParagraph('Dicho monto se cubrirá en **4 pagos quincenales** de **$20,625.00 MXN** cada uno.', 11, 'justify');
  } else {
    const cuotas = datos.planPagos === '2_meses' ? 2 : 4;
    drawParagraph(`Dicho monto se cubrirá en **${cuotas} pagos mensuales** de **$${(datos.montoTotal/cuotas).toLocaleString()} MXN**.`, 11, 'justify');
  }

  if (datos.observacionesPago) {
    drawParagraph(`**Nota Especial de Negociación:** ${datos.observacionesPago}`, 11, 'justify', 15);
  }

  drawParagraph('**Tercera.** “LA EMPRESA” garantiza que el tiempo máximo de la aprobación del proceso es de noventa días hábiles o el equivalente a tres meses, una vez ingresado el trámite, para dar respuesta a las solicitudes ingresadas, asumiendo la responsabilidad de reingresar la solicitud en caso de que esta resulte rechazada, esto sin perjuicio para “EL CLIENTE”, obligándose a erogar los gastos extraordinarios que resulten.', 11, 'justify');

  drawParagraph('**Cuarta.** “EL CLIENTE” está obligado a proporcionar a “LA EMPRESA” los requisitos en tiempo y forma para dar inicio al trámite:', 11, 'justify');
  drawParagraph('a. Documentación requerida (Acta constitutiva, comprobantes, identificaciones, etc.).', 11, 'justify', 15);
  drawParagraph('b. “EL CLIENTE” deberá enviar los documentos al correo indicado cecani.sc@gmail.com en formato PDF legible; NO deberán ser enviados vía WhatsApp o en fotografías; en caso de ser enviados así, NO serán tomados en cuenta.', 11, 'justify', 15);

  drawParagraph('**Quinta.** “LA EMPRESA” se obliga a proporcionar el personal y las instalaciones necesarias para prestar asesoría y servicios, de conformidad con este contrato a “EL CLIENTE”; dicho personal e instalaciones serán propios de “LA EMPRESA” y continuarán bajo su dirección, supervisión y dependencia económica.', 11, 'justify');

  drawParagraph('**Sexta.** Queda expresamente convenido que “LA EMPRESA” será responsable de la eficiencia razonable de los servicios que se obliga a prestar a “EL CLIENTE”, en los términos del presente contrato, razón por la que “LA EMPRESA” a su sola discreción y bajo su exclusiva responsabilidad designará, seleccionará y dirigirá al personal que utilice para la prestación de dichos servicios.', 11, 'justify');

  drawParagraph('**Séptima.** “LA EMPRESA” no asume responsabilidad alguna frente a servicios ofrecidos y prestados de terceros contratados directamente por “EL CLIENTE”, por lo tanto, éste se obliga a relevar a “LA EMPRESA” de cualquier responsabilidad que se le hiciere y pudiera derivarse de los servicios establecidos en el presente contrato.', 11, 'justify');

  drawParagraph('**Octava.** “LA EMPRESA” se obliga a: a) Conservar en forma confidencial cualquier información sobre “EL CLIENTE”. b) Poner a disposición de “EL CLIENTE” en cualquier momento los documentos elaborados para éste. c) No transferir los derechos derivados del presente instrumento, sin la previa autorización de “EL CLIENTE”.', 11, 'justify');

  drawParagraph('**Novena.** El presente contrato se pacta por tiempo indefinido y se terminará en el momento en que los servicios sean prestados en su totalidad y los documentos producto de éstos entregados al CLIENTE, o a voluntad de cualesquiera de las partes, debiendo comunicar a la otra con 30 días de anticipación.', 11, 'justify');

  drawParagraph('**Décima.** Una vez concluido el objeto del presente contrato, “EL CLIENTE” se obliga a entregar a “LA EMPRESA” una carta donde manifieste su conformidad con el servicio obtenido, así como un video de testimonio del trámite concluido y de la manera en que este trámite beneficiará a su organización.', 11, 'justify');

  drawParagraph('**Décima primera. CONTINUIDAD DEL SERVICIO EN CASO DE BAJA DEL PERSONAL ASIGNADO.** En caso de que la asesora jurídica designada por “LA EMPRESA” para la prestación de los servicios objeto del presente contrato cause baja, por cualquier motivo, dentro de la estructura de la empresa, “CECANI” se obliga a realizar la reasignación inmediata de una nueva asesora jurídica con el mismo perfil profesional.', 11, 'justify');

  drawParagraph('**Décima segunda. CAMBIO DE ASESORA JURÍDICA A SOLICITUD DEL CLIENTE.** “El CLIENTE” podrá solicitar el cambio de la asesora jurídica asignada únicamente cuando presente pruebas contundentes que demuestren un inadecuado seguimiento del caso o falta de cumplimiento de las obligaciones contractuales por parte de la asesora. Dicha solicitud será evaluada por “LA EMPRESA”.', 11, 'justify');

  drawParagraph('**Décima tercera.** Las partes reconocen que si “LA EMPRESA” no cumple con las obligaciones asumidas en el presente contrato, en el plazo establecido en la cláusula tercera, “EL CLIENTE” dará una prórroga no mayor a 2 meses, para cumplir con lo pactado, caso contrario, “EL CLIENTE” podrá ejercer todo su derecho de realizar la denuncia correspondiente; esta cláusula no surtirá efectos si el incumplimiento se deriva por cuestiones de retraso por parte de “EL CLIENTE”.', 11, 'justify');

  drawParagraph('**Décima cuarta.** Para la resolución de cualquier conflicto que pudiera surgir con motivo de la interpretación o cumplimiento de las anteriores cláusulas y salvo la opción por mutuo acuerdo de recurrir a la decisión arbitral, ambas partes se someterán a la jurisdicción territorial de las autoridades judiciales competentes, renunciando desde ahora a la competencia de las autoridades que pudieran corresponderles por razón de sus domicilios presentes o futuros.', 11, 'justify');

  addSpacing(40);
  drawParagraph('Para constancia y no causando este documento impuesto alguno, de conformidad con las disposiciones fiscales relativas, las partes enteradas y ratificando su contenido y valor legal lo suscriben el día que se firme de forma electrónica para que surta efectos legales.', 11, 'justify');

  addSpacing(50);
  const sigY = y;
  page.drawLine({ start: { x: margin, y: sigY }, end: { x: margin + 180, y: sigY }, thickness: 1 });
  page.drawLine({ start: { x: width - margin - 180, y: sigY }, end: { x: width - margin, y: sigY }, thickness: 1 });
  addSpacing(15);
  page.drawText('C. MIRTA DENIS CRUZ MORALES', { x: margin + 10, y, size: 10, font: fontBold });
  let nombreClienteRecortado = datos.nombreRepresentante.toUpperCase();
  if (fontBold.widthOfTextAtSize(nombreClienteRecortado, 10) > 170) {
    nombreClienteRecortado = nombreClienteRecortado.substring(0, 20) + '...';
  }
  page.drawText(`C. ${nombreClienteRecortado}`, { x: width - margin - 170, y, size: 10, font: fontBold });

  return await pdfDoc.save();
}
