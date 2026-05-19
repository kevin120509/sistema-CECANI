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

  drawParagraph(`**Primera.** “LA EMPRESA” se compromete a prestar sus servicios de **${tipoServicioTitulo}** a “EL CLIENTE” en las áreas siguientes:`, 11, 'justify');
  let areasServicio = isContabilidad ? ['Asesoría Contable Especializada para Donatarias.', 'Cumplimiento de obligaciones fiscales ante el SAT.'] : 
    (datos.servicioBaseId === 'constitucion' ? ['Constitución de A.C.', 'Autorización para Donataria.'] : ['Actualización de estatutos y Donataria.']);
  areasServicio.forEach((s, i) => drawParagraph(`${i + 1}. ${s}`, 11, 'left', 15));

  const montoLetras = numeroALetras(datos.montoTotal);
  drawParagraph(`**Segunda.** Los honorarios corresponden a un monto total de **$${datos.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${montoLetras.toUpperCase()} M.N.) incluye IVA.**`, 11, 'justify');

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

  checkPageBreak(150);
  drawParagraph('**Nuestro servicio incluye:**', 12, 'left');
  let inclusiones = isContabilidad ? ['• Declaraciones mensuales y anuales.', '• Asesoría fiscal continua.'] : ['• Acompañamiento legal.', '• Gestión ante el SAT y Notaría.'];
  inclusiones.forEach(item => drawBullet(item));

  drawParagraph('**Tercera.** Tiempo estimado: **90 días hábiles** para la resolución de trámites ante autoridades.', 11, 'justify');
  drawParagraph('**Cuarta.** El cliente enviará documentos (INE, CURP, CSF, Comprobante) en **formato PDF**. No se aceptan fotos ni WhatsApp.', 11, 'justify');
  
  // Firmas y Anexo...
  addSpacing(50);
  const sigY = y;
  page.drawLine({ start: { x: margin, y: sigY }, end: { x: margin + 180, y: sigY }, thickness: 1 });
  page.drawLine({ start: { x: width - margin - 180, y: sigY }, end: { x: width - margin, y: sigY }, thickness: 1 });
  addSpacing(15);
  page.drawText('C. MIRTA DENIS CRUZ MORALES', { x: margin + 10, y, size: 10, font: fontBold });
  page.drawText(`C. ${datos.nombreRepresentante.toUpperCase()}`, { x: width - margin - 170, y, size: 10, font: fontBold });

  return await pdfDoc.save();
}
