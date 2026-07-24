'use strict';

/**
 * Arranque resiliente: si no existe el archivo .env (por ejemplo, porque
 * alguien descomprimió el proyecto y corrió "npm start" sin seguir el paso
 * de "cp .env.example .env"), lo creamos automáticamente con un JWT_SECRET
 * generado al azar para que la aplicación funcione desde el primer momento,
 * en vez de caerse con un error críptico.
 */
const fs = require('node:fs');
const nodePath = require('node:path');
const crypto = require('node:crypto');

const ENV_PATH = nodePath.join(__dirname, '.env');
const ENV_EXAMPLE_PATH = nodePath.join(__dirname, '.env.example');

if (!fs.existsSync(ENV_PATH)) {
  const randomSecret = crypto.randomBytes(48).toString('hex');
  let base = fs.existsSync(ENV_EXAMPLE_PATH)
    ? fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8')
    : 'PORT=3000\nJWT_SECRET=\nJWT_EXPIRES_IN=12h\nCORS_ORIGIN=\nDB_PATH=\n';
  base = base.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${randomSecret}`);
  fs.writeFileSync(ENV_PATH, base);
  console.warn(
    '⚠  No existía el archivo .env: se creó uno automáticamente con un JWT_SECRET generado al azar.\n' +
      '   Para producción, revisa y personaliza el archivo .env (puedes cambiar el secreto cuando quieras;\n' +
      '   eso simplemente cerrará las sesiones activas en ese momento).'
  );
}

require('dotenv').config({ path: ENV_PATH });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = nodePath;

const authRoutes = require('./src/routes/auth');
const dataRoutes = require('./src/routes/data');
const mentorRoutes = require('./src/routes/mentor');

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || true; // true = refleja el origen (útil en desarrollo)

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: '200kb' }));

const generalLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/mentor', mentorRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Frontend estático (la app ya compilada como HTML/JS/CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejador de errores centralizado: nunca filtra detalles internos al cliente.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Lidera tu Vida escuchando en http://localhost:${PORT}`);
});
