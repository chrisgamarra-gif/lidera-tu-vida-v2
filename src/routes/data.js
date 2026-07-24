'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { allSemaforos, stepsCompleted } = require('../growth');
const { buildGrowthPlanPdf } = require('../pdf');
const { checkSemaforoTransitions } = require('../semaforoWatcher');

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

/* -------- compromiso (pasos 1 y 2) -------- */
router.put('/compromiso', (req, res) => {
  const { declaracion, fecha, publicoCon, publicoMensaje } = req.body || {};
  const compromiso = {
    declaracion: String(declaracion || '').slice(0, 2000),
    fecha: String(fecha || '').slice(0, 30),
    publicoCon: String(publicoCon || '').slice(0, 200),
    publicoMensaje: String(publicoMensaje || '').slice(0, 2000)
  };
  db.setCompromiso(currentUserId(req), compromiso);
  res.json({ ok: true, compromiso });
});

/* -------- FODA (paso 3) -------- */
const FODA_KEYS = ['fortalezas', 'debilidades', 'oportunidades', 'amenazas'];
router.put('/foda', (req, res) => {
  const body = req.body || {};
  const foda = {};
  for (const k of FODA_KEYS) {
    foda[k] = Array.isArray(body[k]) ? body[k].map(String).slice(0, 50) : [];
  }
  db.setFoda(currentUserId(req), foda);
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
