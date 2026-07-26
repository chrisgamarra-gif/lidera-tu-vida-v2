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

// Las 12 leyes restantes de las 15 Leyes del Crecimiento. Cada una tiene
// preguntas de reflexión de redacción propia (inspiradas en los conceptos
// generales de cada ley, no citas textuales de ningún libro). Cada pregunta
// admite varias respuestas a lo largo del tiempo.
const LEYES_EXTRA = {
  espejo: {
    nombre: 'Ley del Espejo',
    frase: 'Debes verte con valor para darte valor a ti mismo.',
    preguntas: [
      { id: 1, texto: '¿Qué valor te das a ti mismo en el trabajo, la familia y otras áreas de tu vida?' },
      { id: 2, texto: '¿En qué área te gustaría aumentar tu autoestima?' },
      { id: 3, texto: '¿Qué te dices a ti mismo que nunca permitirías que otra persona te dijera?' },
      { id: 4, texto: '¿Con quién o con qué te comparas, y qué puedes hacer al respecto?' },
      { id: 5, texto: '¿Qué creencia limitante te gustaría cambiar y cómo te limita hoy?' },
      { id: 6, texto: '¿Qué pequeña victoria puedes celebrar hoy en esta área?' }
    ]
  },
  persistencia: {
    nombre: 'Ley de la Persistencia',
    frase: 'La motivación te pone en marcha; la disciplina te mantiene creciendo.',
    preguntas: [
      { id: 1, texto: '¿Qué necesitas mejorar para ser más constante?' },
      { id: 2, texto: '¿Qué pasos vas a tomar para mejorar esto?' },
      { id: 3, texto: '¿Cuál es tu razón específica para querer mejorar?' },
      { id: 4, texto: '¿Qué estás aprendiendo sobre ti mismo en este proceso?' },
      { id: 5, texto: '¿Qué haces diariamente que agrega valor a tu crecimiento?' },
      { id: 6, texto: '¿Qué deberías dejar de hacer porque no te agrega valor?' }
    ]
  },
  entorno: {
    nombre: 'Ley del Entorno',
    frase: 'El crecimiento prospera en un entorno propicio.',
    preguntas: [
      { id: 1, texto: '¿Cuál es, en tu opinión, la relación entre cambio y crecimiento?' },
      { id: 2, texto: '¿Qué tienes actualmente en tu entorno que sea tóxico?' },
      { id: 3, texto: '¿Cómo puedes cambiar o controlar ese ambiente?' },
      { id: 4, texto: '¿Qué te están aportando las personas con las que más pasas tiempo?' },
      { id: 5, texto: '¿Qué te están quitando esas mismas personas?' },
      { id: 6, texto: '¿Quién en tu círculo te hace responsable de tus compromisos?' },
      { id: 7, texto: '¿En qué estás tomando acción ahora que beneficiará tu crecimiento futuro?' }
    ]
  },
  diseno: {
    nombre: 'Ley del Diseño',
    frase: 'Para maximizar el crecimiento, desarrolla estrategias.',
    preguntas: [
      { id: 1, texto: '¿Qué has hecho para diseñar intencionalmente tu vida, no solo tu carrera?' },
      { id: 2, texto: '¿Qué puedes hacer para simplificar tu vida ahora mismo?' },
      { id: 3, texto: '¿Qué sistemas tienes hoy que te sirven bien?' },
      { id: 4, texto: '¿Qué sistemas necesitas cambiar?' },
      { id: 5, texto: '¿Cuál es el resultado que buscas y cómo sabrás que lo lograste?' },
      { id: 6, texto: '¿Qué área de tu vida necesita más planificación estratégica (carrera, fe, familia, salud, etc.)?' }
    ]
  },
  dolor: {
    nombre: 'Ley del Dolor',
    frase: 'El buen manejo de las malas experiencias conduce a un gran crecimiento.',
    preguntas: [
      { id: 1, texto: '¿Qué experiencia dolorosa recuerdas de la que aprendiste una lección valiosa?' },
      { id: 2, texto: '¿Cómo convertiste ese dolor en algo positivo?' },
      { id: 3, texto: '¿Qué elecciones tuyas han funcionado bien desde el principio, y por qué?' },
      { id: 4, texto: '¿Te consideras alguien que evita el dolor, lo soporta, o lo procesa para aprender de él?' },
      { id: 5, texto: '¿Qué medidas de acción has tomado frente a una dificultad reciente?' }
    ]
  },
  escalera: {
    nombre: 'Ley de la Escalera',
    frase: 'El crecimiento del carácter determina la altura de tu crecimiento personal.',
    preguntas: [
      { id: 1, texto: '¿Qué significa para ti "pensar como una persona exitosa"?' },
      { id: 2, texto: 'Del 1 al 10, ¿en qué peldaño sientes que estás hoy?' },
      { id: 3, texto: '¿Qué puedes hacer esta semana para subir un peldaño?' },
      { id: 4, texto: 'Cuando cometes un error, ¿cuál es tu primera reacción?' },
      { id: 5, texto: '¿Qué tan fiel eres a lo que realmente te importa?' },
      { id: 6, texto: '¿Qué pasos estás tomando para desarrollar tu carácter?' }
    ]
  },
  banda_elastica: {
    nombre: 'Ley de la Banda Elástica',
    frase: 'El crecimiento se detiene cuando pierdes la tensión entre dónde estás y dónde podrías estar.',
    preguntas: [
      { id: 1, texto: '¿Dónde has sido "estirado" en tu vida, y qué aprendiste de eso?' },
      { id: 2, texto: '¿Dónde necesitas estirarte para crecer al siguiente nivel?' },
      { id: 3, texto: '¿Qué estás dispuesto a arriesgar para lograrlo?' },
      { id: 4, texto: '¿En qué área te has "acomodado" y dejaste de estirarte?' },
      { id: 5, texto: '¿Cuál es tu meta de estiramiento? (que sea específica, medible, alcanzable, realista y con fecha)' }
    ]
  },
  compensacion: {
    nombre: 'Ley de la Compensación',
    frase: 'Tienes que ceder algo para crecer.',
    preguntas: [
      { id: 1, texto: '¿Qué estás dispuesto a ceder para poder crecer?' },
      { id: 2, texto: '¿Qué cambio hiciste en el pasado que impulsó tu crecimiento?' },
      { id: 3, texto: '¿Vale la pena el precio del cambio que estás considerando ahora?' },
      { id: 4, texto: '¿Qué cosas no estás dispuesto a comprometer bajo ninguna circunstancia?' },
      { id: 5, texto: '¿Cuál es tu próximo nivel, y qué te costará llegar ahí?' }
    ]
  },
  curiosidad: {
    nombre: 'Ley de la Curiosidad',
    frase: 'El crecimiento se estimula al preguntar "¿por qué?"',
    preguntas: [
      { id: 1, texto: '¿De qué tienes curiosidad hoy y quieres aprender más al respecto?' },
      { id: 2, texto: '¿Qué te ha llevado a ser menos curioso últimamente?' },
      { id: 3, texto: '¿Qué aprendiste hoy?' },
      { id: 4, texto: 'Escribe al menos 5 preguntas "por qué" que te hagas sobre tu vida o tu trabajo.' },
      { id: 5, texto: '¿Sigues buscando la respuesta correcta en algo, o ya te rendiste?' }
    ]
  },
  modelo: {
    nombre: 'Ley del Modelo',
    frase: 'Es difícil superarte cuando no tienes a quién seguir sino a ti mismo.',
    preguntas: [
      { id: 1, texto: '¿A quién sigues como modelo o ejemplo, y por qué?' },
      { id: 2, texto: '¿Cómo te ha ayudado esa persona a crecer?' },
      { id: 3, texto: '¿Quién conoces que tenga experiencia, sabiduría y disponibilidad para ser tu mentor?' },
      { id: 4, texto: '¿Quién es tu entrenador de confianza (tu "Phil Jackson")?' },
      { id: 5, texto: '¿Qué preguntas reflexivas llevarías a tu próxima sesión con un mentor?' }
    ]
  },
  expansion: {
    nombre: 'Ley de la Expansión',
    frase: 'El crecimiento siempre aumenta tu capacidad.',
    preguntas: [
      { id: 1, texto: '¿Qué significa para ti "encontrar tus límites y moverlos"?' },
      { id: 2, texto: '¿Qué cambia cuando pasas de pensar "puedo" a pensar "cómo puedo"?' },
      { id: 3, texto: '¿Qué te da el mayor retorno de tu tiempo invertido?' },
      { id: 4, texto: 'Si supieras que no puedes fallar, ¿qué intentarías?' },
      { id: 5, texto: '¿Qué frontera necesitas derribar para hacer una diferencia en tu vida?' }
    ]
  },
  contribucion: {
    nombre: 'Ley de la Contribución',
    frase: 'Desarrollarte a ti mismo te capacita para desarrollar a otros.',
    preguntas: [
      { id: 1, texto: '¿Cómo estás ayudando a otros a crecer esta semana?' },
      { id: 2, texto: '¿Qué está "fluyendo" de ti hacia los demás?' },
      { id: 3, texto: '¿Quién te anima, te reta o te acompaña, y cómo puedes ser eso para alguien más?' },
      { id: 4, texto: '¿Tus esfuerzos se enfocan más en sentirte bien tú, o en el éxito de otra persona?' },
      { id: 5, texto: '¿Te consideras más un "dador" o un "recibidor"?' }
    ]
  }
};

// Orden y metadata de las 15 leyes para armar las subpestañas del
// diagnóstico. "tipo" indica qué herramienta usa cada una:
// - 'brechas': la herramienta de brechas con causas/efectos (Intencionalidad)
// - 'conciencia': el FODA + preguntas cortas (Conciencia)
// - 'reflexion': el perfil accidental/intencional + preguntas cortas (Reflexión)
// - 'preguntas': banco genérico de preguntas con varias respuestas (las otras 12)
const LEY_ORDEN = [
  { id: 'intencionalidad', nombre: 'Intencionalidad', tipo: 'brechas' },
  { id: 'conciencia', nombre: 'Conciencia', tipo: 'conciencia' },
  { id: 'espejo', nombre: 'Espejo', tipo: 'preguntas' },
  { id: 'reflexion', nombre: 'Reflexión', tipo: 'reflexion' },
  { id: 'persistencia', nombre: 'Persistencia', tipo: 'preguntas' },
  { id: 'entorno', nombre: 'Entorno', tipo: 'preguntas' },
  { id: 'diseno', nombre: 'Diseño', tipo: 'preguntas' },
  { id: 'dolor', nombre: 'Dolor', tipo: 'preguntas' },
  { id: 'escalera', nombre: 'Escalera', tipo: 'preguntas' },
  { id: 'banda_elastica', nombre: 'Banda Elástica', tipo: 'preguntas' },
  { id: 'compensacion', nombre: 'Compensación', tipo: 'preguntas' },
  { id: 'curiosidad', nombre: 'Curiosidad', tipo: 'preguntas' },
  { id: 'modelo', nombre: 'Modelo', tipo: 'preguntas' },
  { id: 'expansion', nombre: 'Expansión', tipo: 'preguntas' },
  { id: 'contribucion', nombre: 'Contribución', tipo: 'preguntas' }
];

// Lista plana de TODAS las preguntas de las leyes que usan el banco genérico
// (conciencia, reflexion, y las 12 leyes extra) — se usa para calcular el
// avance por faceta (Personal/Familiar/Laboral) en growth.js.
const TODAS_LAS_PREGUNTAS = [
  ...CONCIENCIA_PREGUNTAS.map(p => ({ leyId: 'conciencia', preguntaId: p.id })),
  ...REFLEXION_PERSONAL_PREGUNTAS.map(p => ({ leyId: 'reflexion', preguntaId: p.id })),
  ...Object.entries(LEYES_EXTRA).flatMap(([leyId, ley]) => ley.preguntas.map(p => ({ leyId, preguntaId: p.id })))
];

module.exports = {
  BRECHAS,
  PERFIL_PREGUNTAS,
  interpretarPuntaje,
  calcularPuntaje,
  CONCIENCIA_PREGUNTAS,
  REFLEXION_PERSONAL_PREGUNTAS,
  LEYES_EXTRA,
  LEY_ORDEN,
  TODAS_LAS_PREGUNTAS
};
