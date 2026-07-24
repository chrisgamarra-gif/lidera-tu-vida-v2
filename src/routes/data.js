'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { allSemaforos, stepsCompleted } = require('../growth');
const { buildGrowthPlanPdf } = require('../pdf');
const { checkSemaforoTransitions } = require('../semaforoWatcher');
const { BRECHAS, PERFIL_PREGUNTAS, interpretarPuntaje, calcularPuntaje } = require('../diagnostico');

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
  res.json({ data, semaforos: allSemaforos(data), pasosCompletados: stepsCompleted(data) });
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

/* -------- catálogo estático del diagnóstico (brechas + preguntas del perfil) -------- */
router.get('/diagnostico/catalogo', (req, res) => {
  res.json({ brechas: BRECHAS, preguntas: PERFIL_PREGUNTAS });
});

/* -------- brechas de crecimiento: cuál te tiene atascado ahora, con reflexión -------- */
router.post('/brecha', (req, res) => {
  const { brecha, reflexion, planAccion } = req.body || {};
  if (!BRECHAS.some(b => b.id === brecha)) return res.status(400).json({ error: 'Brecha no válida.' });
  const entrada = {
    brecha,
    reflexion: String(reflexion || '').slice(0, 2000),
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
  const { declaracion, fecha, publicoCon, publicoMensaje } = req.body || {};
  if (!declaracion || !String(declaracion).trim()) {
    return res.status(400).json({ error: 'Escribe tu declaración de compromiso.' });
  }
  const entrada = {
    declaracion: String(declaracion).slice(0, 2000),
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

/* -------- bitácora de reflexión (paso 5) -------- */
router.post('/bitacora', (req, res) => {
  const { fecha, texto } = req.body || {};
  if (!texto || !String(texto).trim()) return res.status(400).json({ error: 'Escribe tu reflexión.' });
  const item = { fecha: String(fecha || new Date().toISOString().slice(0, 10)), texto: String(texto).slice(0, 3000) };
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
