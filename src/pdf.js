'use strict';
/**
 * Genera el PDF del plan de crecimiento personal de un usuario.
 * Usa pdfkit (JS puro, sin dependencias nativas).
 */
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { allSemaforos, stepsCompleted } = require('./growth');

const LOGO_PATH = path.join(__dirname, 'assets', 'logo-claro.png');

const AREA_LABELS = { laboral: 'Laboral', personal: 'Personal', familiar: 'Familiar', espiritual: 'Espiritual' };
const SEMA_LABELS = { verde: 'Avance solido', amarillo: 'Progreso parcial', rojo: 'Estancado' };
const SEMA_COLORS = { verde: '#2E7D5B', amarillo: '#E0AF3B', rojo: '#B23B32' };

const NAVY = '#0F2750';
const NAVY_DEEP = '#070D18';
const INK = '#101B2C';
const INK_SOFT = '#4C5A70';
const GOLD = '#B98A24';
const LINE = '#D9E0EA';

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function drawHeader(doc, nombre) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;

  try {
    doc.image(LOGO_PATH, margin, 36, { width: 190 });
  } catch (e) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text('GAMARRA LEADERSHIP', margin, 40);
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(INK_SOFT)
    .text('PLAN DE CRECIMIENTO PERSONAL', margin, 92, { width: pageWidth - margin * 2, align: 'right' })
    .font('Helvetica')
    .fontSize(9)
    .text(nombre, margin, 104, { width: pageWidth - margin * 2, align: 'right' })
    .text(new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }), margin, 116, {
      width: pageWidth - margin * 2,
      align: 'right'
    });

  doc
    .moveTo(margin, 145)
    .lineTo(pageWidth - margin, 145)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();

  doc.x = margin;
  doc.y = 162;
}

function sectionTitle(doc, text) {
  doc.x = doc.page.margins.left;
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text(text);
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.margins.left + 40, doc.y + 4)
    .strokeColor(GOLD)
    .lineWidth(2)
    .stroke();
  doc.moveDown(0.8);
}

function paragraph(doc, text, opts = {}) {
  doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size || 10.5)
    .fillColor(opts.color || INK)
    .text(text || '-', { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, ...opts });
}

function labelValue(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT).text(label.toUpperCase());
  doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(value || '-');
  doc.moveDown(0.5);
}

/**
 * @param {object} data     objeto de datos del usuario (compromiso, foda, areas, planificador, bitacora, compartir)
 * @param {object} usuario  { nombre, username }
 * @returns {PDFDocument}   stream que se puede hacer pipe() a una respuesta HTTP o a un archivo
 */
function buildGrowthPlanPdf(data, usuario) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

  drawHeader(doc, usuario.nombre);

  // ---- Resumen de progreso ----
  sectionTitle(doc, 'Resumen de tu progreso');
  const pasos = stepsCompleted(data);
  const semaforos = allSemaforos(data);

  paragraph(doc, `Pasos completados de la guia de crecimiento: ${pasos} de 6.`);
  doc.moveDown(0.4);

  const areaKeys = Object.keys(AREA_LABELS);
  const startY = doc.y;
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 4;
  areaKeys.forEach((k, i) => {
    const x = doc.page.margins.left + i * colWidth;
    doc.circle(x + 6, startY + 6, 5).fill(SEMA_COLORS[semaforos[k]]);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text(AREA_LABELS[k], x + 16, startY, { width: colWidth - 20 });
    doc
      .fillColor(INK_SOFT)
      .font('Helvetica')
      .fontSize(8.5)
      .text(SEMA_LABELS[semaforos[k]], x + 16, startY + 12, { width: colWidth - 20 });
  });
  doc.y = startY + 34;

  // ---- Compromiso (historial) ----
  sectionTitle(doc, 'Compromiso de crecimiento');
  if (!data.compromisos.length) {
    paragraph(doc, 'Sin compromiso declarado todavia.', { color: INK_SOFT });
  } else {
    const ultimo = data.compromisos[data.compromisos.length - 1];
    paragraph(doc, 'Compromiso mas reciente:', { bold: true, size: 9.5, color: INK_SOFT });
    labelValue(doc, 'Declaracion', ultimo.declaracion);
    labelValue(doc, 'Compartido con', ultimo.publicoCon);
    labelValue(doc, 'Mensaje', ultimo.publicoMensaje);
    if (data.compromisos.length > 1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT).text(`Historial (${data.compromisos.length - 1} anteriores):`);
      data.compromisos
        .slice(0, -1)
        .reverse()
        .forEach(c => {
          doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT).text(`${fmtDate(c.fecha)} - ${c.declaracion}`);
        });
    }
  }

  // ---- Brechas de crecimiento y perfil de intencionalidad ----
  sectionTitle(doc, 'Diagnostico de intencionalidad');
  const BRECHA_LABELS = {
    suposicion: 'Suposicion', conocimiento: 'Conocimiento', tiempo: 'Tiempo', error: 'Error',
    perfeccion: 'Perfeccion', inspiracion: 'Inspiracion', comparacion: 'Comparacion', expectativas: 'Expectativas'
  };
  if (data.brechas.length) {
    const ultimaBrecha = data.brechas[data.brechas.length - 1];
    paragraph(doc, `Brecha identificada: ${BRECHA_LABELS[ultimaBrecha.brecha] || ultimaBrecha.brecha}`, { bold: true });
    if (ultimaBrecha.reflexion) paragraph(doc, ultimaBrecha.reflexion, { size: 9.5, color: INK_SOFT });
    if (ultimaBrecha.planAccion) paragraph(doc, `Plan de accion: ${ultimaBrecha.planAccion}`, { size: 9.5, color: INK_SOFT });
  } else {
    paragraph(doc, 'Sin diagnostico de brechas todavia.', { color: INK_SOFT });
  }
  doc.moveDown(0.3);
  if (data.perfilCrecimiento.length) {
    const ultimoPerfil = data.perfilCrecimiento[data.perfilCrecimiento.length - 1];
    paragraph(doc, `Perfil de intencionalidad: ${ultimoPerfil.puntaje}/10 - ${ultimoPerfil.interpretacion}`, {
      size: 9.5,
      color: INK_SOFT
    });
  }

  // ---- FODA ----
  sectionTitle(doc, 'Diagnostico FODA');
  const ESTADO_LABEL = { activa: 'activa', en_progreso: 'en progreso', superada: 'superada' };
  const fodaPairs = [
    ['Fortalezas', data.foda.fortalezas],
    ['Debilidades', data.foda.debilidades],
    ['Oportunidades', data.foda.oportunidades],
    ['Amenazas', data.foda.amenazas]
  ];
  fodaPairs.forEach(([label, items]) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(label);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(INK)
      .text(
        items.length
          ? items.map(i => `- ${i.texto} (${ESTADO_LABEL[i.estado] || i.estado})`).join('\n')
          : '(sin registrar)'
      );
    doc.moveDown(0.5);
  });

  // ---- Áreas de vida ----
  sectionTitle(doc, 'Areas de vida: metas y metricas');
  areaKeys.forEach(k => {
    const area = data.areas[k];
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(AREA_LABELS[k]);
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(`Meta: ${area.meta || '(sin definir)'}`);
    if (area.notas) doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(INK_SOFT).text(`Notas: ${area.notas}`);
    if (area.metricas && area.metricas.length) {
      area.metricas.forEach(m => {
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(INK_SOFT)
          .text(`  - ${m.nombre}: ${m.actual || 0} / ${m.meta || 0}`);
      });
    }
    doc.moveDown(0.6);
  });

  // ---- Planificador ----
  sectionTitle(doc, 'Planificador diario (historial)');
  if (!data.planificador.length) {
    paragraph(doc, 'Sin actividades registradas todavia.', { color: INK_SOFT });
  } else {
    data.planificador
      .slice()
      .reverse()
      .forEach(p => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 30) doc.addPage();
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(INK)
          .text(`${fmtDate(p.fecha)}  ·  ${AREA_LABELS[p.area] || p.area}  ·  ${p.actividad}  (${p.minutos || 0} min)`);
      });
  }

  // ---- Bitácora ----
  sectionTitle(doc, 'Bitacora de reflexion');
  if (!data.bitacora.length) {
    paragraph(doc, 'Sin entradas registradas todavia.', { color: INK_SOFT });
  } else {
    data.bitacora
      .slice()
      .reverse()
      .forEach(b => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 50) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT).text(fmtDate(b.fecha));
        doc.font('Helvetica').fontSize(10).fillColor(INK).text(b.texto);
        doc.moveDown(0.4);
      });
  }

  // ---- Compartir ----
  sectionTitle(doc, 'Acompanamiento compartido');
  if (!data.compartir.length) {
    paragraph(doc, 'Sin registros de acompanamiento todavia.', { color: INK_SOFT });
  } else {
    data.compartir
      .slice()
      .reverse()
      .forEach(s => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 50) doc.addPage();
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(INK)
          .text(`${s.persona}  ·  ${fmtDate(s.fecha)}`);
        doc.font('Helvetica').fontSize(10).fillColor(INK).text(s.mensaje);
        doc.moveDown(0.4);
      });
  }

  // ---- Pie de pagina con numeracion ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK_SOFT)
      .text(
        `Lidera tu Vida - Escuela de Liderazgo Gamarra Leadership  ·  Pagina ${i + 1} de ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 65,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' }
      );
  }

  return doc;
}

/**
 * Genera un PDF consolidado con el avance de TODO el grupo: una tabla
 * resumen (con semaforo por area) y luego una seccion breve por participante.
 * @param {Array<{username:string, nombre:string, data:object}>} mentees
 * @param {{generadoPor?: string}} opts
 */
function buildConsolidatedPdf(mentees, opts = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const margin = doc.page.margins.left;

  drawHeader(doc, `Reporte de grupo${opts.generadoPor ? ' - generado por ' + opts.generadoPor : ''}`);

  sectionTitle(doc, 'Resumen del grupo');
  paragraph(doc, `Total de participantes: ${mentees.length}.`);
  doc.moveDown(0.3);

  if (!mentees.length) {
    paragraph(doc, 'Todavia no hay participantes registrados en el programa.', { color: INK_SOFT });
  } else {
    // ---- tabla resumen ----
    const areaKeys = Object.keys(AREA_LABELS);
    const colNombre = 150;
    const colArea = (doc.page.width - margin * 2 - colNombre - 50) / areaKeys.length;
    const colPasos = 50;

    const drawTableHeader = () => {
      doc.x = margin;
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT);
      doc.text('Participante', margin, y, { width: colNombre });
      areaKeys.forEach((k, i) => {
        doc.text(AREA_LABELS[k], margin + colNombre + i * colArea, y, { width: colArea, align: 'center' });
      });
      doc.text('Pasos', margin + colNombre + areaKeys.length * colArea, y, { width: colPasos, align: 'center' });
      doc.moveTo(margin, y + 14).lineTo(doc.page.width - margin, y + 14).strokeColor(LINE).lineWidth(1).stroke();
      doc.y = y + 20;
    };

    drawTableHeader();

    mentees.forEach(m => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        drawTableHeader();
      }
      const semaforos = allSemaforos(m.data);
      const pasos = stepsCompleted(m.data);
      const y = doc.y;
      doc.font('Helvetica').fontSize(9.5).fillColor(INK);
      doc.text(m.nombre, margin, y, { width: colNombre });
      areaKeys.forEach((k, i) => {
        const cx = margin + colNombre + i * colArea + colArea / 2;
        doc.circle(cx, y + 5, 4.5).fill(SEMA_COLORS[semaforos[k]]);
      });
      doc.fillColor(INK).text(String(pasos) + '/6', margin + colNombre + areaKeys.length * colArea, y, {
        width: colPasos,
        align: 'center'
      });
      doc.y = y + 18;
    });

    // ---- seccion por participante ----
    mentees.forEach(m => {
      const semaforos = allSemaforos(m.data);
      const pasos = stepsCompleted(m.data);
      sectionTitle(doc, m.nombre);
      paragraph(doc, `Usuario: ${m.username}  ·  Pasos completados: ${pasos}/6`, { color: INK_SOFT, size: 9.5 });
      doc.moveDown(0.2);

      areaKeys.forEach(k => {
        const area = m.data.areas[k];
        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(INK)
          .text(`${AREA_LABELS[k]} (${SEMA_LABELS[semaforos[k]]}): `, { continued: true })
          .font('Helvetica')
          .fillColor(INK_SOFT)
          .text(area.meta || '(sin meta definida)');
      });

      if (m.data.compromisos.length) {
        const ultimo = m.data.compromisos[m.data.compromisos.length - 1];
        doc.moveDown(0.2);
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(INK_SOFT).text(`"${ultimo.declaracion}"`);
      }

      const ultimaActividad = m.data.planificador[m.data.planificador.length - 1];
      if (ultimaActividad) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(INK_SOFT)
          .text(`Ultima actividad: ${fmtDate(ultimaActividad.fecha)} - ${ultimaActividad.actividad}`);
      }
      doc.moveDown(0.6);
    });
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK_SOFT)
      .text(
        `Lidera tu Vida - Reporte de grupo  ·  Pagina ${i + 1} de ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 65,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' }
      );
  }

  return doc;
}

module.exports = { buildGrowthPlanPdf, buildConsolidatedPdf };
