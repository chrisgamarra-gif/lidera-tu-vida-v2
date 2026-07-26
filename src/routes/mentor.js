'use strict';
const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireMentor } = require('../auth');
const { allSemaforos, stepsCompleted, fodaResumen, calcularAvanceFacetas } = require('../growth');
const { buildGrowthPlanPdf, buildConsolidatedPdf } = require('../pdf');

const router = express.Router();
router.use(requireAuth, requireMentor);

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Genera una clave temporal fácil de dictar/copiar (evita caracteres ambiguos como 0/O, 1/l).
function generarClaveTemporal() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let clave = '';
  for (let i = 0; i < 10; i++) clave += alfabeto[crypto.randomInt(alfabeto.length)];
  return clave;
}

// Crear un nuevo acceso (participante o mentor) — solo el mentor puede hacerlo.
router.post('/participantes', async (req, res) => {
  const { nombre, email, username, rol } = req.body || {};

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'Escribe el nombre completo de la persona.' });
  }
  const normalizedUsername = (username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(normalizedUsername)) {
    return res.status(400).json({
      error: 'El usuario debe tener entre 3 y 40 caracteres: minúsculas, números, puntos, guiones.'
    });
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Escribe un correo válido.' });
  }
  const rolFinal = rol === 'mentor' ? 'mentor' : 'mentee';
  if (db.getUserByUsername(normalizedUsername)) {
    return res.status(409).json({ error: 'Ese usuario ya existe. Elige otro.' });
  }

  const claveTemporal = generarClaveTemporal();
  const passwordHash = await bcrypt.hash(claveTemporal, 12);
  const user = db.createUser({
    username: normalizedUsername,
    nombre: nombre.trim(),
    email: normalizedEmail,
    passwordHash,
    rol: rolFinal
  });

  // La clave temporal se devuelve UNA sola vez, en esta respuesta — el
  // servidor nunca la guarda en texto plano ni la vuelve a mostrar después.
  res.status(201).json({
    ok: true,
    credenciales: { username: user.username, nombre: user.nombre, rol: user.rol, claveTemporal }
  });
});

router.get('/mentees', (req, res) => {
  const mentees = db.listMentees().map(m => {
    const data = db.getUserData(m.id);
    return {
      username: m.username,
      nombre: m.nombre,
      semaforos: allSemaforos(data),
      pasosCompletados: stepsCompleted(data),
      foda: fodaResumen(data),
      avanceFacetas: calcularAvanceFacetas(data)
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
    pasosCompletados: stepsCompleted(data),
    foda: fodaResumen(data),
    avanceFacetas: calcularAvanceFacetas(data)
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
