'use strict';
/**
 * Contenido del diagnóstico de crecimiento: las 8 "brechas" que suelen frenar
 * el crecimiento intencional, y un cuestionario corto para ubicar a la
 * persona en el espectro "crecimiento accidental <-> crecimiento intencional".
 *
 * El texto de este archivo es redacción propia inspirada en los conceptos
 * generales de la Ley de la Intencionalidad (crecimiento por accidente vs.
 * por diseño, y los obstáculos típicos que detienen a alguien antes de
 * empezar) — no reproduce citas ni párrafos de ningún libro.
 */

const BRECHAS = [
  {
    id: 'suposicion',
    nombre: 'Brecha de la suposición',
    descripcion: 'Doy por hecho que voy a mejorar solo con el paso del tiempo, sin proponérmelo activamente.'
  },
  {
    id: 'conocimiento',
    nombre: 'Brecha de la sabiduría',
    descripcion: 'No tengo claro qué pasos concretos debo seguir para crecer en esta área.'
  },
  {
    id: 'tiempo',
    nombre: 'Brecha del tiempo',
    descripcion: 'Siento que este no es el momento adecuado para empezar; lo dejo para más adelante.'
  },
  {
    id: 'error',
    nombre: 'Brecha del error',
    descripcion: 'Me frena el miedo a equivocarme o a hacer el ridículo en el intento.'
  },
  {
    id: 'perfeccion',
    nombre: 'Brecha de la perfección',
    descripcion: 'Quiero encontrar el plan perfecto antes de dar el primer paso, y eso me detiene.'
  },
  {
    id: 'inspiracion',
    nombre: 'Brecha de la inspiración',
    descripcion: 'Espero sentirme motivado o con ganas antes de actuar, en vez de actuar de todos modos.'
  },
  {
    id: 'comparacion',
    nombre: 'Brecha de la comparación',
    descripcion: 'Me comparo con quienes parecen ir más adelante que yo, y eso me desanima.'
  },
  {
    id: 'expectativas',
    nombre: 'Brecha de las expectativas',
    descripcion: 'Pensé que este proceso sería más fácil o más rápido de lo que está resultando.'
  }
];

// Cada par contrasta una respuesta más "accidental" (a) con una más
// "intencional" (b). No hay respuesta incorrecta: el objetivo es ubicar
// patrones, no calificar a la persona.
const PERFIL_PREGUNTAS = [
  {
    id: 1,
    texto: 'Cuando pienso en crecer, normalmente...',
    a: 'espero a que surja la oportunidad por sí sola.',
    b: 'busco activamente la oportunidad de mejorar.'
  },
  {
    id: 2,
    texto: 'Frente a mis errores, suelo...',
    a: 'aprender de ellos solo después de que ya ocurrieron.',
    b: 'anticiparlos y prepararme antes de que ocurran.'
  },
  {
    id: 3,
    texto: 'Para avanzar, confío sobre todo en...',
    a: 'que las cosas se acomoden a mi favor.',
    b: 'el esfuerzo constante y sostenido.'
  },
  {
    id: 4,
    texto: 'Ante un obstáculo grande...',
    a: 'tiendo a abandonar el intento con cierta facilidad.',
    b: 'persisto aunque cueste más de lo esperado.'
  },
  {
    id: 5,
    texto: 'Mis hábitos diarios...',
    a: 'se han ido formando solos, sin que los planee.',
    b: 'los elijo y los reviso a propósito.'
  },
  {
    id: 6,
    texto: 'Sobre mis planes de crecimiento...',
    a: 'hablo bastante de ellos, pero no siempre les doy seguimiento.',
    b: 'les doy seguimiento aunque no hable mucho de ellos.'
  },
  {
    id: 7,
    texto: 'Frente al riesgo, prefiero...',
    a: 'quedarme en lo seguro y conocido.',
    b: 'arriesgarme cuando vale la pena para crecer.'
  },
  {
    id: 8,
    texto: 'Cuando algo me sale mal, me identifico más con la idea de...',
    a: 'ser víctima de las circunstancias.',
    b: 'ser alguien que apenas empieza y puede aprender.'
  },
  {
    id: 9,
    texto: 'Para lograr resultados, confío más en...',
    a: 'mi talento natural.',
    b: 'mi carácter y mi disciplina.'
  },
  {
    id: 10,
    texto: 'Sobre seguir aprendiendo cosas nuevas...',
    a: 'siento que eso quedó atrás, en mi etapa de estudios.',
    b: 'siento que nunca debería detenerse.'
  }
];

function interpretarPuntaje(puntaje) {
  if (puntaje <= 3) return 'Predomina el crecimiento accidental: hay espacio para ser más intencional.';
  if (puntaje <= 6) return 'Estás en transición hacia un crecimiento más intencional.';
  return 'Predomina el crecimiento intencional: mantén el rumbo.';
}

function calcularPuntaje(respuestas) {
  // respuestas: array de 'a' | 'b'
  return (respuestas || []).filter(r => r === 'b').length;
}

// Preguntas de autoconocimiento inspiradas en la Ley de la Conciencia (saber
// quién eres y hacia dónde vas) y la Ley de la Reflexión (pausar para
// convertir la experiencia en aprendizaje). Cada pregunta admite varias
// respuestas a lo largo del tiempo, para ver cómo van cambiando.
const CONCIENCIA_PREGUNTAS = [
  { id: 1, texto: '¿Te gusta lo que estás haciendo?' },
  { id: 2, texto: '¿Qué te gustaría hacer?' },
  { id: 3, texto: '¿Puedes hacer lo que te gustaría hacer?' },
  { id: 4, texto: '¿Cómo vas a hacer lo que quieres hacer?' }
];

const REFLEXION_PERSONAL_PREGUNTAS = [
  { id: 1, texto: '¿Cuál es tu activo más valioso?' },
  { id: 2, texto: '¿Cuál es tu mayor responsabilidad?' },
  { id: 3, texto: '¿Qué es lo que más te hace feliz?' },
  { id: 4, texto: '¿Qué es lo que más te entristece?' },
  { id: 5, texto: '¿Cuál de tus emociones vale más la pena?' },
  { id: 6, texto: '¿Cuál de tus emociones vale menos la pena?' },
  { id: 7, texto: '¿Cuál es tu mejor hábito?' },
  { id: 8, texto: '¿Cuál es tu peor hábito?' },
  { id: 9, texto: '¿Qué es lo que más te satisface?' },
  { id: 10, texto: '¿Cuál es tu posesión más preciada?' },
  { id: 11, texto: '¿Qué es lo que todavía no sabes de ti mismo?' }
];

module.exports = {
  BRECHAS,
  PERFIL_PREGUNTAS,
  interpretarPuntaje,
  calcularPuntaje,
  CONCIENCIA_PREGUNTAS,
  REFLEXION_PERSONAL_PREGUNTAS
};
