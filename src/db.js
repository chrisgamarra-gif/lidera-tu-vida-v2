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
    compromiso      TEXT NOT NULL DEFAULT '{"declaracion":"","fecha":"","publicoCon":"","publicoMensaje":""}',
    foda            TEXT NOT NULL DEFAULT '{"fortalezas":[],"debilidades":[],"oportunidades":[],"amenazas":[]}',
    areas           TEXT NOT NULL DEFAULT '{"laboral":{"meta":"","notas":"","metricas":[]},"personal":{"meta":"","notas":"","metricas":[]},"familiar":{"meta":"","notas":"","metricas":[]},"espiritual":{"meta":"","notas":"","metricas":[]}}',
    planificador    TEXT NOT NULL DEFAULT '[]',
    bitacora        TEXT NOT NULL DEFAULT '[]',
    compartir       TEXT NOT NULL DEFAULT '[]',
    last_semaforos  TEXT NOT NULL DEFAULT '{"laboral":"rojo","personal":"rojo","familiar":"rojo","espiritual":"rojo"}',
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

/* ---------------------------- datos de crecimiento ---------------------------- */

function rowToData(row) {
  return {
    compromiso: JSON.parse(row.compromiso),
    foda: JSON.parse(row.foda),
    areas: JSON.parse(row.areas),
    planificador: JSON.parse(row.planificador),
    bitacora: JSON.parse(row.bitacora),
    compartir: JSON.parse(row.compartir),
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

function setCompromiso(userId, compromiso) {
  db.prepare(`UPDATE user_data SET compromiso = ? WHERE user_id = ?`).run(JSON.stringify(compromiso), userId);
  touch(userId);
}

function setFoda(userId, foda) {
  db.prepare(`UPDATE user_data SET foda = ? WHERE user_id = ?`).run(JSON.stringify(foda), userId);
  touch(userId);
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
  getUserData,
  setCompromiso,
  setFoda,
  setArea,
  pushToList,
  removeFromList,
  getLastSemaforos,
  setLastSemaforos
};
