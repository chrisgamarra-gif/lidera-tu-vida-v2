'use strict';
/**
 * Capa de base de datos.
 *
 * Usa el módulo nativo `node:sqlite` (incluido en Node.js desde la v22.5,
 * sin dependencias externas ni compilación nativa). Si tu versión de Node
 * lo pide, arráncalo con: node --experimental-sqlite server.js
 *
 * Toda la lógica de acceso a datos vive aquí. Si tu programa crece y
 * necesitas Postgres/MySQL, este es el único archivo que debes reescribir;
 * el resto de la app solo llama a las funciones exportadas abajo.
 */
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'lidera_tu_vida.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    nombre        TEXT NOT NULL,
    email         TEXT,
    password_hash TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('mentee','mentor')),
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    compromisos     TEXT NOT NULL DEFAULT '[]',
    foda            TEXT NOT NULL DEFAULT '{"fortalezas":[],"debilidades":[],"oportunidades":[],"amenazas":[]}',
    areas           TEXT NOT NULL DEFAULT '{"laboral":{"meta":"","notas":"","metricas":[]},"personal":{"meta":"","notas":"","metricas":[]},"familiar":{"meta":"","notas":"","metricas":[]},"espiritual":{"meta":"","notas":"","metricas":[]}}',
    planificador    TEXT NOT NULL DEFAULT '[]',
    bitacora        TEXT NOT NULL DEFAULT '[]',
    compartir       TEXT NOT NULL DEFAULT '[]',
    last_semaforos  TEXT NOT NULL DEFAULT '{"laboral":"rojo","personal":"rojo","familiar":"rojo","espiritual":"rojo"}',
    brechas         TEXT NOT NULL DEFAULT '[]',
    perfil_crecimiento TEXT NOT NULL DEFAULT '[]',
    updated_at      TEXT NOT NULL
  );
`);

// Migración suave para bases de datos creadas antes de que existiera alguna columna.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('users', 'email', 'TEXT');
ensureColumn(
  'user_data',
  'last_semaforos',
  `TEXT NOT NULL DEFAULT '{"laboral":"rojo","personal":"rojo","familiar":"rojo","espiritual":"rojo"}'`
);
ensureColumn('user_data', 'compromisos', `TEXT NOT NULL DEFAULT '[]'`);
ensureColumn('user_data', 'brechas', `TEXT NOT NULL DEFAULT '[]'`);
ensureColumn('user_data', 'perfil_crecimiento', `TEXT NOT NULL DEFAULT '[]'`);

// Migración de datos: si existe una columna vieja "compromiso" (objeto único,
// versión anterior de la app) y la nueva "compromisos" (lista) sigue vacía,
// convertimos ese compromiso antiguo en la primera entrada del historial para
// no perder lo que la gente ya había escrito.
(function migrateLegacyCompromiso() {
  const cols = db.prepare(`PRAGMA table_info(user_data)`).all();
  if (!cols.some(c => c.name === 'compromiso')) return; // ya no existe la columna vieja
  const rows = db.prepare(`SELECT user_id, compromiso, compromisos FROM user_data`).all();
  for (const row of rows) {
    const actuales = JSON.parse(row.compromisos || '[]');
    if (actuales.length > 0) continue; // ya migrado o ya tiene historial propio
    try {
      const viejo = JSON.parse(row.compromiso);
      if (viejo && viejo.declaracion && viejo.declaracion.trim()) {
        const entrada = {
          declaracion: viejo.declaracion || '',
          fecha: viejo.fecha || new Date().toISOString().slice(0, 10),
          publicoCon: viejo.publicoCon || '',
          publicoMensaje: viejo.publicoMensaje || '',
          creado: new Date().toISOString()
        };
        db.prepare(`UPDATE user_data SET compromisos = ? WHERE user_id = ?`).run(
          JSON.stringify([entrada]),
          row.user_id
        );
      }
    } catch (e) {
      // si el JSON viejo estaba corrupto, simplemente lo dejamos vacío
    }
  }
})();

/* ---------------------------- usuarios ---------------------------- */

function createUser({ username, nombre, email, passwordHash, rol }) {
  const now = new Date().toISOString();
  const insertUser = db.prepare(
    `INSERT INTO users (username, nombre, email, password_hash, rol, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const info = insertUser.run(username, nombre, email || null, passwordHash, rol, now);
  const userId = Number(info.lastInsertRowid);
  db.prepare(`INSERT INTO user_data (user_id, updated_at) VALUES (?, ?)`).run(userId, now);
  return getUserById(userId);
}

function getUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) || null;
}

function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
}

function listMentees() {
  return db.prepare(`SELECT id, username, nombre, email FROM users WHERE rol = 'mentee' ORDER BY nombre`).all();
}

function listMentors() {
  return db.prepare(`SELECT id, username, nombre, email FROM users WHERE rol = 'mentor' ORDER BY nombre`).all();
}

function countUsers() {
  const row = db.prepare(`SELECT COUNT(*) as n FROM users`).get();
  return row.n;
}

/* ---------------------------- datos de crecimiento ---------------------------- */

function rowToData(row) {
  return {
    compromisos: JSON.parse(row.compromisos),
    foda: JSON.parse(row.foda),
    areas: JSON.parse(row.areas),
    planificador: JSON.parse(row.planificador),
    bitacora: JSON.parse(row.bitacora),
    compartir: JSON.parse(row.compartir),
    brechas: JSON.parse(row.brechas),
    perfilCrecimiento: JSON.parse(row.perfil_crecimiento),
    actualizado: row.updated_at
  };
}

function getUserData(userId) {
  const row = db.prepare(`SELECT * FROM user_data WHERE user_id = ?`).get(userId);
  if (!row) return null;
  return rowToData(row);
}

function touch(userId) {
  db.prepare(`UPDATE user_data SET updated_at = ? WHERE user_id = ?`).run(new Date().toISOString(), userId);
}

function setArea(userId, areaKey, areaValue) {
  const row = db.prepare(`SELECT areas FROM user_data WHERE user_id = ?`).get(userId);
  const areas = JSON.parse(row.areas);
  areas[areaKey] = areaValue;
  db.prepare(`UPDATE user_data SET areas = ? WHERE user_id = ?`).run(JSON.stringify(areas), userId);
  touch(userId);
  return areas;
}

function pushToList(userId, column, item) {
  const row = db.prepare(`SELECT ${column} FROM user_data WHERE user_id = ?`).get(userId);
  const list = JSON.parse(row[column]);
  list.push(item);
  db.prepare(`UPDATE user_data SET ${column} = ? WHERE user_id = ?`).run(JSON.stringify(list), userId);
  touch(userId);
  return list;
}

function removeFromList(userId, column, index) {
  const row = db.prepare(`SELECT ${column} FROM user_data WHERE user_id = ?`).get(userId);
  const list = JSON.parse(row[column]);
  if (index < 0 || index >= list.length) return list;
  list.splice(index, 1);
  db.prepare(`UPDATE user_data SET ${column} = ? WHERE user_id = ?`).run(JSON.stringify(list), userId);
  touch(userId);
  return list;
}

/* ---------------------------- FODA con estado por ítem ---------------------------- */

function addFodaItem(userId, categoria, texto) {
  const row = db.prepare(`SELECT foda FROM user_data WHERE user_id = ?`).get(userId);
  const foda = JSON.parse(row.foda);
  const ahora = new Date().toISOString();
  foda[categoria].push({ texto, estado: 'activa', historial: [{ estado: 'activa', fecha: ahora }] });
  db.prepare(`UPDATE user_data SET foda = ? WHERE user_id = ?`).run(JSON.stringify(foda), userId);
  touch(userId);
  return foda;
}

function removeFodaItem(userId, categoria, index) {
  const row = db.prepare(`SELECT foda FROM user_data WHERE user_id = ?`).get(userId);
  const foda = JSON.parse(row.foda);
  if (index < 0 || index >= foda[categoria].length) return foda;
  foda[categoria].splice(index, 1);
  db.prepare(`UPDATE user_data SET foda = ? WHERE user_id = ?`).run(JSON.stringify(foda), userId);
  touch(userId);
  return foda;
}

function setFodaEstado(userId, categoria, index, estado) {
  const row = db.prepare(`SELECT foda FROM user_data WHERE user_id = ?`).get(userId);
  const foda = JSON.parse(row.foda);
  const item = foda[categoria][index];
  if (!item) return foda;
  item.estado = estado;
  item.historial = item.historial || [];
  item.historial.push({ estado, fecha: new Date().toISOString() });
  db.prepare(`UPDATE user_data SET foda = ? WHERE user_id = ?`).run(JSON.stringify(foda), userId);
  touch(userId);
  return foda;
}

function getLastSemaforos(userId) {
  const row = db.prepare(`SELECT last_semaforos FROM user_data WHERE user_id = ?`).get(userId);
  return row ? JSON.parse(row.last_semaforos) : null;
}

function setLastSemaforos(userId, semaforos) {
  db.prepare(`UPDATE user_data SET last_semaforos = ? WHERE user_id = ?`).run(JSON.stringify(semaforos), userId);
}

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getUserById,
  listMentees,
  listMentors,
  countUsers,
  getUserData,
  setArea,
  pushToList,
  removeFromList,
  addFodaItem,
  removeFodaItem,
  setFodaEstado,
  getLastSemaforos,
  setLastSemaforos
};
