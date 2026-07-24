'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth, requireMentor } = require('../auth');
const { allSemaforos, stepsCompleted } = require('../growth');
const { buildGrowthPlanPdf, buildConsolidatedPdf } = require('../pdf');

const router = express.Router();
router.use(requireAuth, requireMentor);

router.get('/mentees', (req, res) => {
  const mentees = db.listMentees().map(m => {
    const data = db.getUserData(m.id);
    return {
      username: m.username,
      nombre: m.nombre,
      semaforos: allSemaforos(data),
      pasosCompletados: stepsCompleted(data)
    };
  });
  res.json({ mentees });
});

// OJO: esta ruta debe declararse ANTES que '/mentees/:username' para que
// Express no interprete "export" como si fuera un nombre de usuario.
router.get('/mentees/export/pdf', (req, res) => {
  const mentees = db.listMentees().map(m => ({
    username: m.username,
    nombre: m.nombre,
    data: db.getUserData(m.id)
  }));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-grupo-lidera-tu-vida.pdf"`);

  const doc = buildConsolidatedPdf(mentees, { generadoPor: req.user.username });
  doc.pipe(res);
  doc.end();
});

router.get('/mentees/:username', (req, res) => {
  const user = db.getUserByUsername(req.params.username);
  if (!user || user.rol !== 'mentee') return res.status(404).json({ error: 'Participante no encontrado.' });
  const data = db.getUserData(user.id);
  res.json({
    username: user.username,
    nombre: user.nombre,
    data,
    semaforos: allSemaforos(data),
    pasosCompletados: stepsCompleted(data)
  });
});

router.get('/mentees/:username/export/pdf', (req, res) => {
  const user = db.getUserByUsername(req.params.username);
  if (!user || user.rol !== 'mentee') return res.status(404).json({ error: 'Participante no encontrado.' });
  const data = db.getUserData(user.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="plan-crecimiento-${user.username}.pdf"`);

  const doc = buildGrowthPlanPdf(data, { nombre: user.nombre, username: user.username });
  doc.pipe(res);
  doc.end();
});

module.exports = router;
