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
  folioIne?: string | null;
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
  const lineSpacing = 4; // Extra space between lines
  const paragraphSpacing = 12; // Extra space between paragraphs

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

  // Improved text drawer with markdown-like bold support (e.g. "**Bold Text**")
  // Bold text will be slightly larger automatically to stand out.
  const drawParagraph = (
    text: string, 
    baseSize: number = 11, // Increased from 10 to 11
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
      
      if (wordText.startsWith('**')) {
        startsWithBold = true;
        wordText = wordText.substring(2);
      }
      
      if (wordText.includes('**')) {
        endsWithBold = true;
        wordText = wordText.replace('**', '');
      }

      if (startsWithBold) isCurrentlyBold = true;
      
      wordsWithBold.push({ text: wordText, isBold: isCurrentlyBold });
      
      if (endsWithBold) isCurrentlyBold = false;
    }
    
    const lines: { words: {text: string, isBold: boolean}[], isLast: boolean }[] = [];
    let currentLineWords: {text: string, isBold: boolean}[] = [];
    let currentLineWidth = 0;

    const getWordMetrics = (word: string, isBold: boolean) => {
      const font = isBold ? fontBold : fontNormal;
      const size = isBold ? baseSize + 1 : baseSize; // Bold text is 1pt larger
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
    if (currentLineWords.length > 0) {
      lines.push({ words: currentLineWords, isLast: true });
    }

    // Extra spacing logic if bold text is taller
    const maxLineHeight = baseSize + 2 + lineSpacing;

    // Draw lines
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

  const drawBullet = (text: string) => {
     drawParagraph(text, 11, 'left', 15);
  };

  // --- CÓDIGO DE IDENTIFICACIÓN ---
  const contractCode = `${Math.floor(Math.random() * 900 + 100)}/2026_${datos.servicioBaseId.toUpperCase().substring(0, 4)}`;
  page.drawText(contractCode, { x: width - margin - 110, y: height - 40, size: 10, font: fontNormal });

  // --- INTRODUCCIÓN ---
  addSpacing(20);
  drawParagraph(
    `Contrato de Prestación de Servicios para Consultoría que celebran por una parte **“CECANI”**, SOCIEDAD CIVIL, representada en este acto por la **C. MIRTA DENIS CRUZ MORALES** a quien en lo sucesivo se le denominará **“LA EMPRESA”** y, por la otra, la **C. ${datos.nombreRepresentante.toUpperCase()}**, quien se denominará **“EL CLIENTE”**, ambas partes están de acuerdo con celebrar el presente contrato al tenor de las siguientes:`,
    11, 'justify'
  );

  drawParagraph('**DECLARACIONES**', 13, 'center');
  
  drawParagraph('**I. “LA EMPRESA”, a través de su representante legal manifiesta:**', 12, 'left');
  drawParagraph(
    'a) Que tiene capacidad jurídica y técnica para prestar sus servicios, a través de la C. Mirta Denis Cruz Morales, de acuerdo al acta de asamblea número 4542, Volumen 82, levantada ante la fe de la Lic. Gabriela Benítez Castillejos, Titular de la Notaría Pública número 92, del Estado de Oaxaca. Que el carácter con que se ostenta no le ha sido revocado ni restringido de manera alguna y que su representada tiene plena existencia y capacidad legal.',
    11, 'justify', 15
  );
  drawParagraph(
    'b) Que, de acuerdo con su objeto social, puede dedicarse, entre otras cosas, a la prestación de servicios técnicos, consultivos y de asesoría en diversas áreas, contando actualmente con el personal capacitado e instalaciones necesarias para realizar dicho objetivo.',
    11, 'justify', 15
  );
  drawParagraph(
    'c) Que se encuentra inscrita en el Registro Federal de Contribuyentes con clave **CEC181024K45** y que señala como domicilio para todos los efectos legales del presente CONTRATO el ubicado en: **calle Fresnitos, número 206 local 2, ex-hacienda Candiani, Santa Cruz Xoxocotlán, Estado de Oaxaca, C.P. 71230**.',
    11, 'justify', 15
  );

  drawParagraph('**II. “EL CLIENTE” manifiesta bajo protesta de decir verdad:**', 12, 'left');
  drawParagraph(
    `a) Que es una persona física, mayor de edad, con RFC **${datos.rfc || '_______'}** y CURP **${datos.curp || '_______'}**, de ocupación **${datos.ocupacion || '_______'}** y estado civil **${datos.estadoCivil || '_______'}**, quien se identifica con credencial para votar vigente.`, 
    11, 'justify', 15
  );
  drawParagraph(
    `b) Que señala como domicilio para efectos de este contrato el ubicado en: **${datos.domicilioCompleto || '_______'}**.`, 
    11, 'justify', 15
  );
  drawParagraph(
    `c) Que representa legalmente a la organización denominada **${datos.nombreEmpresa.toUpperCase()}**, constituida bajo la figura de **${datos.figuraLegal.toUpperCase()}**.`, 
    11, 'justify', 15
  );

  drawParagraph('Atentas a las declaraciones anteriores, ambas partes están de acuerdo con sujetar el presente contrato al tenor de las siguientes:', 11, 'justify');
  
  // Prevent CLÁUSULAS from being left alone at the bottom of the page
  checkPageBreak(120);
  drawParagraph('**CLÁUSULAS**', 13, 'center');

  // --- PRIMERA ---
  drawParagraph(
    `**Primera.** “LA EMPRESA” se compromete a prestar sus servicios a “EL CLIENTE” en las áreas siguientes:`,
    11, 'justify'
  );

  let areasServicio = [];
  if (datos.servicioBaseId === 'constitucion') {
    areasServicio = [
      'Constitución de la Asociación Civil.',
      'Proceso de Autorización para Donataria Nacional.'
    ];
  } else if (datos.servicioBaseId === 'acta_extra') {
    areasServicio = [
      'Elaboración y protocolización de Acta Extraordinaria.',
      'Actualización de estatutos sociales y trámite de Donataria.'
    ];
  } else {
    areasServicio = [
      'Recuperación o Renovación del estatus de Donataria Autorizada.'
    ];
  }

  // Inyectar extras dinámicamente
  if (datos.modulosExtraIds.includes('web')) {
    areasServicio.push('Diseño y desarrollo de Página Web Profesional.');
  }
  if (datos.modulosExtraIds.includes('cluni')) {
    areasServicio.push('Trámite de CLUNI ante el Registro Federal de OSC.');
  }
  if (datos.modulosExtraIds.includes('informe_anual')) {
    areasServicio.push('Elaboración de Informe Anual CLUNI.');
  }
  if (datos.modulosExtraIds.includes('cambio_rep')) {
    areasServicio.push('Actualización de Representante Legal en CLUNI.');
  }
  // La regularización contable NO se agrega aquí, ya que se cotiza por separado 
  // y está especificada en la cláusula Cuarta inciso e.

  // Dibujar lista numerada
  areasServicio.forEach((servicio, index) => {
    drawParagraph(`${index + 1}. ${servicio}`, 11, 'left', 15);
  });

  drawParagraph(
    `Así como otros que requiera y pueda pagar “EL CLIENTE”; y “LA EMPRESA” esté en posibilidad de prestar por disponer de recursos humanos y técnicos para ello.`,
    11, 'justify'
  );

  // --- SEGUNDA ---
  const montoLetras = numeroALetras(datos.montoTotal);
  drawParagraph(
    `**Segunda.** Las partes convienen en que los honorarios por los servicios que “LA EMPRESA” prestará a “EL CLIENTE” corresponden a un monto total de **$${datos.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${montoLetras.toUpperCase()} M.N.) incluye IVA.**`,
    11, 'justify'
  );

  // Desglose de pagos si no es de contado
  if (datos.planPagos !== 'unico') {
    const numCuotas = datos.planPagos === '2_meses' ? 2 : 4;
    const montoCuota = datos.montoTotal / numCuotas;
    drawParagraph(
      `Dicho monto se cubrirá en **${numCuotas} pagos mensuales** de **$${montoCuota.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN** cada uno, debiendo liquidarse de manera consecutiva para dar continuidad al trámite.`,
      11, 'justify'
    );
  } else {
    drawParagraph(
      'Dicho monto ha sido pactado bajo la modalidad de **Pago Único de Contado**, otorgando un beneficio preferencial en el costo total del servicio.',
      11, 'justify'
    );
  }
  
  checkPageBreak(150); // Keep "Nuestro servicio incluye" and the list together
  drawParagraph('**Nuestro servicio incluye:**', 12, 'left');

  let inclusiones: string[] = [];

  switch (datos.servicioBaseId) {
    case 'constitucion':
      inclusiones = [
        '• Acompañamiento legal durante el proceso de constitución.',
        '• Elaboración del acta constitutiva y asesoramiento general en derecho corporativo.',
        '• Solicitud de denominación social ante la Secretaría de Economía.',
        '• Asesoría para realizar la inscripción en el Registro Público de la Propiedad.',
        '• Trámite de cita en línea para inscripción de persona moral en el SAT y obtención de RFC y E.Firma.',
        '• Ingreso del trámite de Donataria ante el SAT con los requerimientos de la Ley del ISR vigente para 2026.',
        '• Seguimiento al trámite ante el SAT hasta la aprobación de la Donataria Nacional.',
        '• Asesoría para la obtención de la Constancia de Acreditación de Actividades.',
        '• Correcciones de errores en caso de que existan, sin costo para el cliente (siempre y cuando hayan sido errores de LA EMPRESA).',
        '• Membresía Cecani 2026: Acceso a 11 cursos, 10 diplomados y 10 webinars de capacitación especializada.'
      ];
      break;
    case 'acta_extra':
      inclusiones = [
        '• Acompañamiento legal y asesoramiento general en derecho corporativo.',
        '• Elaboración de proyecto de Acta de Asamblea Extraordinaria.',
        '• Actualización y adecuación de estatutos sociales alineados a los requerimientos del SAT.',
        '• Ingreso del trámite de Donataria ante el SAT con los requerimientos de la Ley del ISR vigente para 2026.',
        '• Seguimiento al trámite ante el SAT hasta la aprobación de la Donataria Nacional.',
        '• Asesoría para la obtención de la Constancia de Acreditación de Actividades.',
        '• Correcciones de errores en caso de que existan, sin costo para el cliente.',
        '• Membresía Cecani 2026: Acceso a 11 cursos, 10 diplomados y 10 webinars de capacitación especializada.'
      ];
      break;
    case 'recuperacion':
    case 'renovacion':
      inclusiones = [
        '• Análisis exhaustivo del expediente y causales de pérdida o revocación.',
        '• Elaboración de estrategia legal y documental para la recuperación/renovación del estatus.',
        '• Ingreso del trámite de Donataria ante el SAT con los requerimientos de la Ley del ISR vigente para 2026.',
        '• Seguimiento al trámite ante el SAT hasta la aprobación de la Donataria Nacional.',
        '• Correcciones de errores en caso de que existan, sin costo para el cliente.',
        '• Membresía Cecani 2026: Acceso a 11 cursos, 10 diplomados y 10 webinars de capacitación especializada.'
      ];
      break;
    default:
      inclusiones = [
        '• Acompañamiento legal y asesoramiento general corporativo.',
        '• Seguimiento de trámites acordados.',
        '• Membresía Cecani 2026: Acceso a 11 cursos, 10 diplomados y 10 webinars de capacitación especializada.'
      ];
  }

  if (datos.modulosExtraIds.includes('web')) {
    inclusiones.push('• Diseño de Página Web Profesional: Adaptado a dispositivos, certificado SSL, SEO básico, Dominio propio y correo institucional.');
  }
  if (datos.modulosExtraIds.includes('cluni')) {
    inclusiones.push('• Trámite de CLUNI ante el Registro Federal de OSC.');
  }

  for (const item of inclusiones) {
    drawBullet(item);
  }

  drawParagraph('El servicio **NO** incluye pagos de derechos Notariales ni pagos de derechos de inscripción en el Registro Público de la Propiedad.', 11, 'left');

  // --- TERCERA ---
  drawParagraph(
    '**Tercera.** “LA EMPRESA” garantiza que el tiempo máximo de la aprobación del proceso de Donataria es de **noventa días hábiles o el equivalente a tres meses**, para dar respuesta a las solicitudes ingresadas, asumiendo la responsabilidad de reingresar la solicitud en caso de que esta resulte rechazada, esto sin perjuicio para “EL CLIENTE”, obligándose a erogar los gastos extraordinarios que resulten. (Consultar el anexo 1 de este contrato "Cronograma de proceso").',
    11, 'justify'
  );

  // --- CUARTA ---
  drawParagraph(
    '**Cuarta.** “EL CLIENTE” está obligado a proporcionar a “LA EMPRESA” los siguientes requisitos para la Elaboración del proyecto de Acta Constitutiva en tiempo y forma para dar inicio al trámite: a) 3 propuestas de nombres para la AC. b) Datos Generales de cada integrante. c) Documentos en formato PDF (INE, CURP, Constancia de situación fiscal, Comprobante de domicilio).',
    11, 'justify'
  );
  drawParagraph(
    'd) “EL CLIENTE” deberá enviar los documentos al correo indicado **cecani.sc@gmail.com** y en formato **PDF legible**; **NO deberán ser enviados vía WhatsApp o en fotografías**; en caso de ser enviados así, NO serán tomados en cuenta.',
    11, 'justify', 15
  );
  drawParagraph(
    'e) Las Asociaciones Civiles están obligadas a llevar su contabilidad y declaraciones ante el SAT, aun así no tengan ingresos, **están obligadas a declarar en ceros**. En caso de requerir este servicio contable extra, podrá ser prestado por el área contable de "LA EMPRESA" con honorarios correspondientes.',
    11, 'justify', 15
  );

  // --- QUINTA ---
  drawParagraph(
    '**Quinta.** “LA EMPRESA” se obliga a proporcionar el personal y las instalaciones necesarias para prestar asesoría y servicios, de conformidad con este contrato a “EL CLIENTE”; dicho personal e instalaciones serán propios de “LA EMPRESA” y continuarán bajo su dirección, supervisión y dependencia económica.',
    11, 'justify'
  );

  // --- SEXTA ---
  drawParagraph(
    '**Sexta.** Queda expresamente convenido que “LA EMPRESA” será responsable de la eficiencia razonable de los servicios que se obliga a prestar a “EL CLIENTE”, en los términos del presente contrato, razón por la que “LA EMPRESA” a su sola discreción y bajo su exclusiva responsabilidad designará, seleccionará y dirigirá al personal que utilice para la prestación de dichos servicios. **“EL CLIENTE” no tendrá ninguna relación de carácter laboral con el personal de “LA EMPRESA”.**',
    11, 'justify'
  );

  // --- SEPTIMA ---
  drawParagraph(
    '**Séptima.** “LA EMPRESA” no asume responsabilidad alguna frente a servicios ofrecidos y prestados de terceros contratados directamente por “EL CLIENTE”, por lo tanto, éste se obliga a relevar a “LA EMPRESA” de cualquier responsabilidad que se le hiciere efectiva.',
    11, 'justify'
  );

  // --- OCTAVA ---
  drawParagraph(
    '**Octava.** “LA EMPRESA” se obliga a: a) Conservar en forma confidencial cualquier información sobre “EL CLIENTE”. b) Poner a disposición de “EL CLIENTE” en cualquier momento los documentos elaborados para éste. c) No transferir los derechos derivados del presente instrumento, sin la previa autorización de “EL CLIENTE”.',
    11, 'justify'
  );

  // --- NOVENA ---
  drawParagraph(
    '**Novena.** El presente contrato se pacta por tiempo indefinido y se terminará en el momento en que los servicios sean prestados en su totalidad y los documentos producto de éstos entregados al CLIENTE, debiendo comunicar a la otra parte con 30 días de anticipación cualquier voluntad de término temprano.',
    11, 'justify'
  );

  // --- DÉCIMA ---
  drawParagraph(
    '**Décima.** Una vez concluido el objeto del presente contrato, “EL CLIENTE” se obliga a entregar a “LA EMPRESA” una carta donde manifieste su conformidad con el servicio obtenido, así como un video de testimonio del trámite concluido.',
    11, 'justify'
  );

  // --- DECIMA PRIMERA ---
  drawParagraph(
    '**Décima primera.** CONTINUIDAD DEL SERVICIO EN CASO DE BAJA DEL PERSONAL ASIGNADO. En caso de que la asesora jurídica designada por “LA EMPRESA” cause baja por cualquier motivo, “CECANI” se obliga a realizar la reasignación inmediata de una nueva asesora jurídica en un plazo no mayor a siete días hábiles, sin costo adicional para el CLIENTE.',
    11, 'justify'
  );

  // --- DECIMA SEGUNDA ---
  drawParagraph(
    '**Décima segunda.** CAMBIO DE ASESORA JURÍDICA A SOLICITUD DEL CLIENTE. “El CLIENTE” podrá solicitar el cambio de la asesora jurídica asignada únicamente cuando presente pruebas contundentes que demuestren un inadecuado seguimiento del caso o falta de cumplimiento. En caso de proceder, la reasignación se hará en un plazo no mayor a cinco días hábiles.',
    11, 'justify'
  );

  // --- DECIMA TERCERA ---
  drawParagraph(
    '**Décima tercera.** Las partes reconocen que si “LA EMPRESA” no cumple con las obligaciones en el plazo pactado, “EL CLIENTE” dará una prórroga no mayor a 2 meses. Esta cláusula no surtirá efectos si el retraso es por parte de “EL CLIENTE”, notario público o autoridad (SAT).',
    11, 'justify'
  );

  // --- DECIMA CUARTA ---
  drawParagraph(
    '**Décima cuarta.** Para la resolución de cualquier conflicto derivado de la interpretación o cumplimiento de las anteriores cláusulas, ambas partes se someterán a la jurisdicción territorial de las autoridades judiciales competentes en García, Nuevo León, renunciando a cualquier fuero por domicilio presente o futuro.',
    11, 'justify'
  );

  // --- TÉRMINOS Y CONDICIONES ---
  addSpacing(10);
  drawParagraph('**Términos y Condiciones de Compra**', 13, 'center');
  drawParagraph(
    'Estos Términos constituyen un contrato vinculante. **NO HAY REEMBOLSOS TOTALES NI PARCIALES Y NO HAY CANCELACIONES YA EFECTUADO EL PAGO.** El Cliente no puede transferir ni ceder su interés en el Contrato a terceros. Para dudas, visite nuestra página web https://www.cecani.org o envíe correo a cecani.sc@gmail.com.',
    11, 'justify'
  );

  // --- FIRMAS ---
  checkPageBreak(150); // Ensure signatures have enough vertical space
  addSpacing(50);
  const signatureY = y;
  page.drawLine({ start: { x: margin, y: signatureY }, end: { x: margin + 180, y: signatureY }, thickness: 1 });
  page.drawLine({ start: { x: width - margin - 180, y: signatureY }, end: { x: width - margin, y: signatureY }, thickness: 1 });
  
  addSpacing(15);
  page.drawText('C. MIRTA DENIS CRUZ MORALES', { x: margin + 10, y, size: 10, font: fontBold });
  
  const clientNameLength = fontBold.widthOfTextAtSize(`C. ${datos.nombreRepresentante.toUpperCase()}`, 10);
  const clientNameX = (width - margin - 180) + ((180 - clientNameLength) / 2);
  page.drawText(`C. ${datos.nombreRepresentante.toUpperCase()}`, { x: clientNameX, y, size: 10, font: fontBold });
  
  addSpacing(15);
  page.drawText('REPRESENTANTE LEGAL CECANI S.C.', { x: margin + 10, y, size: 9, font: fontNormal });
  
  const clientSubtitleLength = fontNormal.widthOfTextAtSize('REPRESENTANTE LEGAL CLIENTE', 9);
  const clientSubtitleX = (width - margin - 180) + ((180 - clientSubtitleLength) / 2);
  page.drawText('REPRESENTANTE LEGAL CLIENTE', { x: clientSubtitleX, y, size: 9, font: fontNormal });

  // --- ANEXO 1 (TABLA DE TIEMPOS) ---
  page = pdfDoc.addPage([600, 800]);
  y = height - 60;
  drawParagraph('**Anexo 1: Cronograma del trámite y tiempos estimados**', 14, 'center');
  addSpacing(20);

  const tableHeader = ['TRÁMITE', 'TIEMPO ESTIMADO', 'PLAZO GENERAL'];
  const tableData = [
    ['Solicitud y envío de documentos por parte del cliente', '20 DÍAS HÁBILES', '11 A 14 MESES'],
    ['Solicitud de aprobación del nombre ante la SE', '15 A 30 DÍAS HÁBILES', ''],
    ['Elaboración del acta de asamblea constitutiva', '20 A 30 DÍAS HÁBILES', ''],
    ['Protocolización ante Notario Público', '20 DÍAS HÁBILES', ''],
    ['Cita ante el SAT para RFC y E.Firma', '30 DÍAS HÁBILES', ''],
    ['Ingreso al Registro Público de la Propiedad', '60 DÍAS HÁBILES', ''],
    ['Asesoría para integración de expedientes', '90 DÍAS HÁBILES', ''],
    ['Ingreso de trámite de Donataria', '5 DÍAS HÁBILES', ''],
    ['Autorización de Donataria con SAT', '90 DÍAS HÁBILES', '']
  ];

  const colWidths = [220, 140, 120];
  let currentX = margin;
  for (let i = 0; i < tableHeader.length; i++) {
    page.drawRectangle({ x: currentX, y: y - 18, width: colWidths[i], height: 25, color: rgb(0.1, 0.1, 0.4) });
    page.drawText(tableHeader[i], { x: currentX + 5, y: y - 10, size: 10, font: fontBold, color: rgb(1, 1, 1) });
    currentX += colWidths[i];
  }
  y -= 18;

  for (const row of tableData) {
    currentX = margin;
    for (let i = 0; i < row.length; i++) {
      page.drawRectangle({ x: currentX, y: y - 18, width: colWidths[i], height: 25, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });
      page.drawText(row[i], { x: currentX + 5, y: y - 10, size: 9, font: fontNormal });
      currentX += colWidths[i];
    }
    y -= 25;
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
