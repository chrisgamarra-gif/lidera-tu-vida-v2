'use strict';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env. Copia .env.example a .env y define un valor único y secreto.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, rol: user.rol }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado. Falta el token de acceso.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Tu sesión expiró o el token no es válido. Inicia sesión de nuevo.' });
  }
}

function requireMentor(req, res, next) {
  if (req.user.rol !== 'mentor') {
    return res.status(403).json({ error: 'Esta sección es solo para mentores.' });
  }
  next();
}

module.exports = { signToken, requireAuth, requireMentor };
