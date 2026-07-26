'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { allSemaforos, stepsCompleted, calcularAvanceFacetas } = require('../growth');
const { buildGrowthPlanPdf } = require('../pdf');
const { checkSemaforoTransitions } = require('../semaforoWatcher');
const {
  BRECHAS,
  PERFIL_PREGUNTAS,
  interpretarPuntaje,
  calcularPuntaje,
  CONCIENCIA_PREGUNTAS,
  REFLEXION_PERSONAL_PREGUNTAS,
  LEYES_EXTRA,
  LEY_ORDEN
} = require('../diagnostico');

const router = express.Router();
router.use(requireAuth);

function currentUserId(req) {
  return req.user.sub;
}

function notifyInBackground(userId) {
  // No bloqueamos la respuesta HTTP por el envío de correo; los errores ya se
  // registran dentro de checkSemaforoTransitions/mail.js y nunca deben tumbar
  // la petición que los disparó.
  checkSemaforoTransitions(userId).catch(e => console.error('Error revisando semaforos:', e));
}

/* -------- lectura completa -------- */
router.get('/', (req, res) => {
  const data = db.getUserData(currentUserId(req));
  res.json({
    data,
    semaforos: allSemaforos(data),
    pasosCompletados: stepsCompleted(data),
    avanceFacetas: calcularAvanceFacetas(data)
  });
});

/* -------- exportar el plan como PDF -------- */
router.get('/export/pdf', (req, res) => {
  const data = db.getUserData(currentUserId(req));
  const user = db.getUserById(currentUserId(req));
  const nombreArchivo = `plan-crecimiento-${req.user.username}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

  const doc = buildGrowthPlanPdf(data, { nombre: user.nombre, username: user.username });
  doc.pipe(res);
  doc.end();
});

/* -------- catálogo estático del diagnóstico (brechas + preguntas) -------- */
router.get('/diagnostico/catalogo', (req, res) => {
  res.json({
    brechas: BRECHAS,
    preguntas: PERFIL_PREGUNTAS,
    conciencia: CONCIENCIA_PREGUNTAS,
    reflexionPersonal: REFLEXION_PERSONAL_PREGUNTAS,
    leyesExtra: LEYES_EXTRA,
    leyOrden: LEY_ORDEN
  });
});

/* -------- brechas de crecimiento: cuáles te tienen atascado, con causas y efectos -------- */
router.post('/brecha', (req, res) => {
  const { detalles, planAccion } = req.body || {};
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: 'Elige al menos una brecha.' });
  }
  const idsValidos = new Set(BRECHAS.map(b => b.id));
  const limpiarLista = arr => (Array.isArray(arr) ? arr : [])
    .map(t => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 4);

  const detallesLimpios = [];
  for (const d of detalles || []) {
    if (!d || !idsValidos.has(d.brecha)) {
      return res.status(400).json({ error: 'Una de las brechas elegidas no es válida.' });
    }
    detallesLimpios.push({
      brecha: d.brecha,
      causas: limpiarLista(d.causas),
      efectos: limpiarLista(d.efectos)
    });
  }

  const entrada = {
    detalles: detallesLimpios,
    planAccion: String(planAccion || '').slice(0, 1000),
    fecha: new Date().toISOString().slice(0, 10)
  };
  const brechas = db.pushToList(currentUserId(req), 'brechas', entrada);
  res.status(201).json({ ok: true, brechas });
});
router.delete('/brecha/:index', (req, res) => {
  const brechas = db.removeFromList(currentUserId(req), 'brechas', Number(req.params.index));
  res.json({ ok: true, brechas });
});

/* -------- las 15 leyes: preguntas de reflexión con varias respuestas cada una --------
 * 'intencionalidad' usa la herramienta de brechas de arriba; las otras 14 leyes
 * (incluidas conciencia y reflexion, que además tienen su propia herramienta
 * especial: FODA y el perfil accidental/intencional) usan este mismo banco
 * genérico de preguntas con respuesta libre. */
function obtenerPreguntasDeLey(leyId) {
  if (leyId === 'conciencia') return CONCIENCIA_PREGUNTAS;
  if (leyId === 'reflexion') return REFLEXION_PERSONAL_PREGUNTAS;
  if (LEYES_EXTRA[leyId]) return LEYES_EXTRA[leyId].preguntas;
  return null;
}

router.post('/ley/:leyId/:preguntaId', (req, res) => {
  const { leyId } = req.params;
  const preguntaId = Number(req.params.preguntaId);
  const preguntas = obtenerPreguntasDeLey(leyId);
  if (!preguntas) return res.status(400).json({ error: 'Ley no válida.' });
  if (!preguntas.some(p => p.id === preguntaId)) return res.status(400).json({ error: 'Pregunta no válida.' });
  const { personal, familiar, laboral, espiritual } = req.body || {};
  const limpiar = t => String(t || '').trim().slice(0, 500);
  const facetas = {
    personal: limpiar(personal),
    familiar: limpiar(familiar),
    laboral: limpiar(laboral),
    espiritual: limpiar(espiritual)
  };
  if (!facetas.personal && !facetas.familiar && !facetas.laboral && !facetas.espiritual) {
    return res.status(400).json({ error: 'Escribe al menos una respuesta (Personal, Familiar, Laboral o Espiritual).' });
  }
  const leyes = db.addRespuestaLey(currentUserId(req), leyId, preguntaId, facetas);
  res.status(201).json({ ok: true, leyes });
});
router.delete('/ley/:leyId/:preguntaId/:index', (req, res) => {
  const { leyId } = req.params;
  const preguntaId = Number(req.params.preguntaId);
  const leyes = db.removeRespuestaLey(currentUserId(req), leyId, preguntaId, Number(req.params.index));
  res.json({ ok: true, leyes });
});

/* -------- perfil de crecimiento: accidental <-> intencional -------- */
router.post('/perfil-crecimiento', (req, res) => {
  const { respuestas } = req.body || {};
  if (!Array.isArray(respuestas) || respuestas.length !== PERFIL_PREGUNTAS.length) {
    return res.status(400).json({ error: 'Responde todas las preguntas del perfil.' });
  }
  if (!respuestas.every(r => r === 'a' || r === 'b')) {
    return res.status(400).json({ error: 'Respuestas no válidas.' });
  }
  const puntaje = calcularPuntaje(respuestas);
  const entrada = {
    respuestas,
    puntaje,
    interpretacion: interpretarPuntaje(puntaje),
    fecha: new Date().toISOString().slice(0, 10)
  };
  const perfilCrecimiento = db.pushToList(currentUserId(req), 'perfil_crecimiento', entrada);
  res.status(201).json({ ok: true, perfilCrecimiento });
});
router.delete('/perfil-crecimiento/:index', (req, res) => {
  const perfilCrecimiento = db.removeFromList(currentUserId(req), 'perfil_crecimiento', Number(req.params.index));
  res.json({ ok: true, perfilCrecimiento });
});

/* -------- compromiso (pasos 1 y 2): historial de compromisos a lo largo del tiempo -------- */
router.post('/compromiso', (req, res) => {
  const { personal, familiar, laboral, espiritual, fecha, publicoCon, publicoMensaje } = req.body || {};
  const limpiar = t => String(t || '').trim().slice(0, 1000);
  const facetas = {
    personal: limpiar(personal),
    familiar: limpiar(familiar),
    laboral: limpiar(laboral),
    espiritual: limpiar(espiritual)
  };
  if (!facetas.personal && !facetas.familiar && !facetas.laboral && !facetas.espiritual) {
    return res.status(400).json({ error: 'Escribe al menos un compromiso (Personal, Familiar, Laboral o Espiritual).' });
  }
  const entrada = {
    ...facetas,
    fecha: String(fecha || new Date().toISOString().slice(0, 10)).slice(0, 30),
    publicoCon: String(publicoCon || '').slice(0, 200),
    publicoMensaje: String(publicoMensaje || '').slice(0, 2000),
    creado: new Date().toISOString()
  };
  const compromisos = db.pushToList(currentUserId(req), 'compromisos', entrada);
  res.status(201).json({ ok: true, compromisos });
});
router.delete('/compromiso/:index', (req, res) => {
  const compromisos = db.removeFromList(currentUserId(req), 'compromisos', Number(req.params.index));
  res.json({ ok: true, compromisos });
});

/* -------- FODA (paso 3): cada ítem tiene un estado que evoluciona en el tiempo -------- */
const FODA_KEYS = ['fortalezas', 'debilidades', 'oportunidades', 'amenazas'];
const ESTADOS_VALIDOS = ['activa', 'en_progreso', 'superada'];

router.post('/foda/:categoria', (req, res) => {
  const { categoria } = req.params;
  if (!FODA_KEYS.includes(categoria)) return res.status(400).json({ error: 'Categoría no válida.' });
  const { texto } = req.body || {};
  if (!texto || !String(texto).trim()) return res.status(400).json({ error: 'Escribe el texto.' });
  const foda = db.addFodaItem(currentUserId(req), categoria, String(texto).trim().slice(0, 200));
  res.status(201).json({ ok: true, foda });
});
router.delete('/foda/:categoria/:index', (req, res) => {
  const { categoria } = req.params;
  if (!FODA_KEYS.includes(categoria)) return res.status(400).json({ error: 'Categoría no válida.' });
  const foda = db.removeFodaItem(currentUserId(req), categoria, Number(req.params.index));
  res.json({ ok: true, foda });
});
router.put('/foda/:categoria/:index/estado', (req, res) => {
  const { categoria } = req.params;
  if (!FODA_KEYS.includes(categoria)) return res.status(400).json({ error: 'Categoría no válida.' });
  const { estado } = req.body || {};
  if (!ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado no válido.' });
  const foda = db.setFodaEstado(currentUserId(req), categoria, Number(req.params.index), estado);
  res.json({ ok: true, foda });
});

/* -------- áreas de vida -------- */
const AREA_KEYS = ['laboral', 'personal', 'familiar', 'espiritual'];
router.put('/areas/:area', (req, res) => {
  const { area } = req.params;
  if (!AREA_KEYS.includes(area)) return res.status(400).json({ error: 'Área no válida.' });
  const { meta, notas, metricas } = req.body || {};
  const value = {
    meta: String(meta || '').slice(0, 500),
    notas: String(notas || '').slice(0, 1000),
    metricas: Array.isArray(metricas)
      ? metricas.slice(0, 20).map(m => ({
          nombre: String(m.nombre || '').slice(0, 100),
          actual: String(m.actual ?? ''),
          meta: String(m.meta ?? '')
        }))
      : []
  };
  const areas = db.setArea(currentUserId(req), area, value);
  notifyInBackground(currentUserId(req));
  res.json({ ok: true, areas });
});

/* -------- planificador diario (paso 4) -------- */
router.post('/planificador', (req, res) => {
  const { fecha, area, actividad, minutos } = req.body || {};
  if (!AREA_KEYS.includes(area)) return res.status(400).json({ error: 'Área no válida.' });
  if (!actividad || !String(actividad).trim()) return res.status(400).json({ error: 'Describe la actividad.' });
  const item = {
    fecha: String(fecha || new Date().toISOString().slice(0, 10)),
    area,
    actividad: String(actividad).slice(0, 300),
    minutos: Number(minutos) || 0
  };
  const list = db.pushToList(currentUserId(req), 'planificador', item);
  notifyInBackground(currentUserId(req));
  res.status(201).json({ ok: true, planificador: list });
});
router.delete('/planificador/:index', (req, res) => {
  const list = db.removeFromList(currentUserId(req), 'planificador', Number(req.params.index));
  notifyInBackground(currentUserId(req));
  res.json({ ok: true, planificador: list });
});

/* -------- bitácora de seguimiento mensual (paso 5) -------- */
function semaforoCalificacion(n) {
  if (n >= 8) return 'verde';
  if (n >= 5) return 'amarillo';
  return 'rojo';
}
router.post('/bitacora', (req, res) => {
  const { mesSemana, leyes: leyesTrabajadas, acciones, logros, dificultades, enfoqueProximo, calificacion } = req.body || {};
  if (!mesSemana || !String(mesSemana).trim()) return res.status(400).json({ error: 'Indica el mes o semana.' });
  const calificacionNum = Math.max(1, Math.min(10, Number(calificacion) || 1));
  const leyesLimpias = Array.isArray(leyesTrabajadas)
    ? leyesTrabajadas.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 15)
    : [];
  const item = {
    mesSemana: String(mesSemana).slice(0, 100),
    leyes: leyesLimpias,
    acciones: String(acciones || '').slice(0, 2000),
    logros: String(logros || '').slice(0, 2000),
    dificultades: String(dificultades || '').slice(0, 2000),
    enfoqueProximo: String(enfoqueProximo || '').slice(0, 1000),
    calificacion: calificacionNum,
    semaforo: semaforoCalificacion(calificacionNum),
    fecha: new Date().toISOString().slice(0, 10)
  };
  const list = db.pushToList(currentUserId(req), 'bitacora', item);
  res.status(201).json({ ok: true, bitacora: list });
});
router.delete('/bitacora/:index', (req, res) => {
  const list = db.removeFromList(currentUserId(req), 'bitacora', Number(req.params.index));
  res.json({ ok: true, bitacora: list });
});

/* -------- compartir con alguien (paso 6) -------- */
router.post('/compartir', (req, res) => {
  const { fecha, persona, mensaje } = req.body || {};
  if (!persona || !String(persona).trim()) return res.status(400).json({ error: 'Indica con quién lo compartiste.' });
  if (!mensaje || !String(mensaje).trim()) return res.status(400).json({ error: 'Escribe qué compartiste.' });
  const item = {
    fecha: String(fecha || new Date().toISOString().slice(0, 10)),
    persona: String(persona).slice(0, 150),
    mensaje: String(mensaje).slice(0, 2000)
  };
  const list = db.pushToList(currentUserId(req), 'compartir', item);
  res.status(201).json({ ok: true, compartir: list });
});
router.delete('/compartir/:index', (req, res) => {
  const list = db.removeFromList(currentUserId(req), 'compartir', Number(req.params.index));
  res.json({ ok: true, compartir: list });
});

module.exports = router;
