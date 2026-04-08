// ─────────────────────────────────────────────────────────────
// voiceService.js — Servicio de voz global para Aura Core
// Usa Web Speech API (SpeechSynthesis) — sin dependencias externas
// ─────────────────────────────────────────────────────────────

// ── Configuración de voces ────────────────────────────────────
const CONFIG = {
  es: { lang: 'es-MX', rate: 0.92, pitch: 1.05, volume: 0.9 },
  en: { lang: 'en-US', rate: 0.88, pitch: 1.0,  volume: 0.9 },
};

// Cache de voz seleccionada por idioma
const vocesCache = {};

// Obtiene la mejor voz disponible para el idioma
const obtenerVoz = (idioma = 'es') => {
  if (vocesCache[idioma]) return vocesCache[idioma];

  const voces   = window.speechSynthesis?.getVoices() || [];
  const config  = CONFIG[idioma] || CONFIG.es;

  // Prioridad: voz nativa del idioma > voz online > cualquier voz del idioma
  const voz =
    voces.find(v => v.lang === config.lang && v.localService) ||
    voces.find(v => v.lang.startsWith(idioma))                ||
    voces.find(v => v.lang.includes(idioma))                  ||
    voces[0];

  if (voz) vocesCache[idioma] = voz;
  return voz;
};

// Asegura que las voces estén cargadas (Chrome las carga async)
const esperarVoces = () =>
  new Promise((resolve) => {
    const voces = window.speechSynthesis?.getVoices();
    if (voces?.length) { resolve(); return; }
    window.speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
    setTimeout(resolve, 1500); // fallback si el evento no llega
  });

// ─────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────

// Estado global de mute (se sincroniza con el store)
let _muteado = false;
export const setMuteado = (val) => { _muteado = val; if (val) detener(); };

// Habla un texto
export const hablar = async (texto, opciones = {}) => {
  if (_muteado || !texto || !window.speechSynthesis) return;

  detener(); // cancela cualquier narración activa

  await esperarVoces();

  const idioma = opciones.idioma || 'es';
  const config = CONFIG[idioma] || CONFIG.es;
  const voz    = obtenerVoz(idioma);

  const utterance          = new SpeechSynthesisUtterance(texto);
  utterance.lang           = config.lang;
  utterance.rate           = opciones.rate   ?? config.rate;
  utterance.pitch          = opciones.pitch  ?? config.pitch;
  utterance.volume         = opciones.volume ?? config.volume;
  if (voz) utterance.voice = voz;

  if (opciones.onEnd)   utterance.onend   = opciones.onEnd;
  if (opciones.onError) utterance.onerror = opciones.onError;

  window.speechSynthesis.speak(utterance);
};

// Detiene cualquier narración activa
export const detener = () => {
  try { window.speechSynthesis?.cancel(); } catch (_) {}
};

// ─────────────────────────────────────────────────────────────
// TEXTOS PREDEFINIDOS — narrativas de la app
// ─────────────────────────────────────────────────────────────

// Intro / bienvenida
export const narrarBienvenida = (nombre) =>
  hablar(
    `Bienvenido a Aura Core, ${nombre || 'lector'}. El sistema de análisis de lectura está listo. ¡Comencemos!`,
    { idioma: 'es', rate: 0.88 },
  );

// Resultado de lectura
export const narrarResultado = (analisis, nombre) => {
  const calif = analisis?.calificacionFinal?.toFixed(1);
  const ppm   = analisis?.palabrasPorMinuto;
  const msg   = calif >= 8
    ? `¡Excelente trabajo, ${nombre}! Obtuviste ${calif} sobre diez. Tu velocidad fue de ${ppm} palabras por minuto. ¡Sigue así!`
    : calif >= 6
    ? `Buen trabajo, ${nombre}. Tu calificación fue de ${calif} sobre diez, con ${ppm} palabras por minuto. Con un poco más de práctica llegarás muy lejos.`
    : `${nombre}, obtuviste ${calif} sobre diez. No te desanimes, cada lectura te hace más fuerte. Tu velocidad fue de ${ppm} palabras por minuto.`;
  return hablar(msg, { idioma: 'es' });
};

// Resumen didáctico del contenido
export const narrarResumen = (resumen) =>
  hablar(resumen, { idioma: 'es', rate: 0.85 });

// Celebración de racha
export const narrarRacha = (dias) =>
  hablar(
    dias >= 7
      ? `¡Increíble! Llevas ${dias} días seguidos leyendo. ¡Eres imparable!`
      : `¡Vas en racha! ${dias} días consecutivos. ¡No pares ahora!`,
    { idioma: 'es', pitch: 1.1 },
  );

// Subida de nivel
export const narrarNivel = (nivel) =>
  hablar(
    `¡Felicidades! Has alcanzado el nivel ${nivel.nombre}. ¡${nivel.icono} Sigue leyendo para llegar aún más lejos!`,
    { idioma: 'es', pitch: 1.15, rate: 0.9 },
  );

// EvoQuest — bienvenida con puntos de otras plataformas
export const narrarBienvenidaEvoQuest = (nombre, cristales) =>
  hablar(
    `¡Hola ${nombre}! Gracias a tu esfuerzo en Aura Core ganaste ${cristales} cristales extra. ¡Úsalos bien en tu aventura!`,
    { idioma: 'es', pitch: 1.05, rate: 0.88 },
  );