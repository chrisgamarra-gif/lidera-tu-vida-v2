'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { signToken } = require('../auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }
});

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Endpoint público (sin auth) para que el frontend sepa si debe mostrar el
// formulario de "crear el primer acceso" o solo el de login. No expone
// ningún dato sensible, solo un booleano.
router.get('/estado', (req, res) => {
  res.json({ hayMentor: db.listMentors().length > 0 });
});

router.post('/register', authLimiter, async (req, res) => {
  // El registro público solo funciona para crear el PRIMER mentor de la
  // cuenta (arranque inicial). En cuanto ya existe un mentor, el acceso a
  // nuevas personas se otorga exclusivamente desde el panel de mentor
  // (POST /api/mentor/participantes), para que el mentor controle quién
  // entra al programa.
  if (db.listMentors().length > 0) {
    return res.status(403).json({
      error: 'El registro público está cerrado. Pide a tu mentor que te dé de alta desde su panel.'
    });
  }

  const { nombre, username, email, password, rol } = req.body || {};

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  }
  const normalizedUsername = (username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(normalizedUsername)) {
    return res.status(400).json({
      error: 'El usuario debe tener entre 3 y 40 caracteres: minúsculas, números, puntos, guiones.'
    });
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Escribe un correo válido (lo usamos para avisos, como semáforos en rojo).' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La clave debe tener al menos 8 caracteres.' });
  }
  if (db.getUserByUsername(normalizedUsername)) {
    return res.status(409).json({ error: 'Ese usuario ya existe. Elige otro o inicia sesión.' });
  }

  // El primer registro siempre se crea como mentor (es quien va a administrar el programa).
  const passwordHash = await bcrypt.hash(password, 12);
  const user = db.createUser({
    username: normalizedUsername,
    nombre: nombre.trim(),
    email: normalizedEmail,
    passwordHash,
    rol: 'mentor'
  });
  const token = signToken(user);
  res.status(201).json({ token, user: { username: user.username, nombre: user.nombre, rol: user.rol } });
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = (username || '').trim().toLowerCase();
  const user = db.getUserByUsername(normalizedUsername);

  // Mensaje genérico a propósito: no revelamos si falló el usuario o la clave.
  const genericError = () => res.status(401).json({ error: 'Usuario o clave incorrectos.' });

  if (!user) return genericError();
  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return genericError();

  const token = signToken(user);
  res.json({ token, user: { username: user.username, nombre: user.nombre, rol: user.rol } });
});

module.exports = router;
