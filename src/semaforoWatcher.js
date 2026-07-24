'use strict';
const db = require('./db');
const { allSemaforos } = require('./growth');
const { sendSemaforoRojoAlert } = require('./mail');

const AREA_LABELS = { laboral: 'Laboral', personal: 'Personal', familiar: 'Familiar', espiritual: 'Espiritual' };

/**
 * Compara el semáforo actual de un usuario contra el último que se conocía.
 * Si alguna área ACABA de pasar a rojo (es decir, antes no era rojo y ahora sí),
 * dispara un correo al participante y a todos los mentores registrados.
 *
 * Se debe llamar después de cualquier operación que pueda cambiar un semáforo
 * (guardar meta/métricas de un área, agregar o quitar una actividad del
 * planificador).
 */
async function checkSemaforoTransitions(userId) {
  const user = db.getUserById(userId);
  if (!user) return;

  const data = db.getUserData(userId);
  const actuales = allSemaforos(data);
  const anteriores = db.getLastSemaforos(userId) || {};

  const areasQuePasaronARojo = Object.keys(actuales).filter(
    area => actuales[area] === 'rojo' && anteriores[area] !== 'rojo'
  );

  // Siempre guardamos el estado actual, haya o no transición a rojo.
  db.setLastSemaforos(userId, actuales);

  if (!areasQuePasaronARojo.length) return;

  const mentores = db.listMentors();
  const destinatarios = [user.email, ...mentores.map(m => m.email)];

  await sendSemaforoRojoAlert(destinatarios, {
    nombreParticipante: user.nombre,
    areasEnRojo: areasQuePasaronARojo.map(a => AREA_LABELS[a] || a)
  });
}

module.exports = { checkSemaforoTransitions };
