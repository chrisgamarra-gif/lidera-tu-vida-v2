'use strict';
/**
 * Lógica de semaforización y progreso. Es la misma lógica que corre en el
 * cliente para dar retroalimentación instantánea, pero aquí se recalcula
 * en el servidor para que la vista de mentor sea siempre confiable
 * (nunca confiamos en un cálculo hecho en el navegador de otra persona).
 */

const AREA_KEYS = ['laboral', 'personal', 'familiar', 'espiritual'];

function computeAreaScore(area, planificador, areaKey) {
  let score = 0;
  let max = 0;

  max += 30;
  if (area.meta && area.meta.trim().length > 4) score += 30;

  if (area.metricas && area.metricas.length) {
    max += 40;
    const avg =
      area.metricas.reduce((s, m) => {
        const meta = parseFloat(m.meta) || 0;
        const actual = parseFloat(m.actual) || 0;
        const pct = meta > 0 ? Math.min(1, actual / meta) : 0;
        return s + pct;
      }, 0) / area.metricas.length;
    score += avg * 40;
  } else {
    max += 40;
  }

  max += 30;
  const now = Date.now();
  const reciente = (planificador || []).filter(
    p => p.area === areaKey && now - new Date(p.fecha).getTime() <= 7 * 86400000
  );
  score += Math.min(1, reciente.length / 3) * 30;

  return max > 0 ? score / max : 0;
}

function semaforoFromScore(pct) {
  if (pct >= 0.66) return 'verde';
  if (pct >= 0.33) return 'amarillo';
  return 'rojo';
}

function areaSemaforo(data, areaKey) {
  const score = computeAreaScore(data.areas[areaKey], data.planificador, areaKey);
  return semaforoFromScore(score);
}

function allSemaforos(data) {
  const out = {};
  for (const k of AREA_KEYS) out[k] = areaSemaforo(data, k);
  return out;
}

function stepsCompleted(u) {
  let n = 0;
  const ultimoCompromiso = u.compromisos[u.compromisos.length - 1];
  if (ultimoCompromiso && ultimoCompromiso.declaracion && ultimoCompromiso.declaracion.trim().length > 4) n++;
  if (ultimoCompromiso && ultimoCompromiso.publicoCon && ultimoCompromiso.publicoCon.trim().length > 1) n++;
  const f = u.foda;
  if (f.fortalezas.length || f.debilidades.length || f.oportunidades.length || f.amenazas.length) n++;
  if (u.planificador.length > 0) n++;
  if (u.bitacora.length > 0) n++;
  if (u.compartir.length > 0) n++;
  return n;
}

function fodaResumen(data) {
  const categorias = ['fortalezas', 'debilidades', 'oportunidades', 'amenazas'];
  const resumen = {};
  for (const cat of categorias) {
    const conteo = { activa: 0, en_progreso: 0, superada: 0, total: 0 };
    for (const item of data.foda[cat]) {
      conteo.total++;
      conteo[item.estado] = (conteo[item.estado] || 0) + 1;
    }
    resumen[cat] = conteo;
  }
  return resumen;
}

module.exports = {
  AREA_KEYS,
  computeAreaScore,
  semaforoFromScore,
  areaSemaforo,
  allSemaforos,
  stepsCompleted,
  fodaResumen
};
