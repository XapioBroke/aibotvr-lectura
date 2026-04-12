import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, increment, getDocs, query, where, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import ReadingFullscreen from './ReadingFullscreen';
import { RachaHero, RachaCelebracion } from './RachaDisplay';
import { actualizarGamificacion, getNivel, getProgresoNivel, BADGES } from './gamification';
import './ReadingAnalyzer.css';
import { analizarLecturaLocal } from './localAnalyzer';
import { MuteButtonCompact } from './MuteButton';
import { narrarResultado, narrarRacha, narrarNivel, detener } from './voiceService';
import { useAuraStore } from './store';
import ResumenDidactico from './ResumenDidactico';

// ── SONIDOS ─────────────────────────────────────────────────
const reproducirSonido = (tipo) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (tipo === 'xp') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.03);
        g.gain.linearRampToValueAtTime(0,    ctx.currentTime + i * 0.12 + 0.18);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.2);
      });
    } else if (tipo === 'nivel') {
      [392, 523, 659, 784, 1047, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.1 + 0.02);
        g.gain.linearRampToValueAtTime(0,    ctx.currentTime + i * 0.1 + 0.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.18);
      });
    } else if (tipo === 'analisis_listo') {
      [800, 1000].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
        g.gain.linearRampToValueAtTime(0,    ctx.currentTime + i * 0.18 + 0.2);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18); osc.stop(ctx.currentTime + i * 0.18 + 0.22);
      });
    } else if (tipo === 'iniciar') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 440;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      g.gain.linearRampToValueAtTime(0,    ctx.currentTime + 0.25);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
    } else if (tipo === 'cancelar') {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
    }
  } catch (_) {}
};

// ── QR MICRÓFONO — genera QR usando API pública sin dependencias ──
// URL interna para la PC (HTTP, sin cambios)
const API_URL = 'https://api.iapprende.com';
// URL para el celular via red local (HTTPS para poder usar micrófono)
const SERVER_IP   = '192.168.1.97';
const SERVER_URL  = `https://${SERVER_IP}:3443`;

const QRMicrofono = ({ sesionId, alumnoNombre, onGrabacionIniciada, onTranscripcionRecibida, onCerrar }) => {
  const [fase, setFase] = useState('esperando'); // esperando | conectado | grabando | enviando
  const urlCelular = `${SERVER_URL}/mic/${sesionId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(urlCelular)}`;

  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/mic-status/${sesionId}`);
        if (!res.ok) return;
        const data = await res.json();

        // Celular escaneó el QR y abrió la página
        if (data.conectado && fase === 'esperando') setFase('conectado');

        // Celular inició la grabación — activar fullscreen en PC
        if (data.grabando && fase !== 'grabando') {
          setFase('grabando');
          onGrabacionIniciada(); // dispara el fullscreen en la PC
        }

        // Celular terminó y envió la transcripción
        if (data.transcripcion) {
          setFase('enviando');
          clearInterval(intervalo);
          onTranscripcionRecibida(data.transcripcion, data.tiempo || 60);
        }
      } catch (_) {}
    }, 1000); // polling cada 1 segundo para mejor sincronía
    return () => clearInterval(intervalo);
  }, [sesionId, fase]);

  const faseTexto = {
    esperando: { color: '#ffd60a', texto: 'Esperando que el alumno escanee...', dot: '#ffd60a' },
    conectado: { color: '#0a84ff', texto: '📱 Celular conectado — esperando inicio...', dot: '#0a84ff' },
    grabando:  { color: '#30d158', texto: '🔴 Grabando en el celular...', dot: '#ff453a' },
    enviando:  { color: '#30d158', texto: '✅ Enviando al PC...', dot: '#30d158' },
  }[fase];

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={fase === 'esperando' ? onCerrar : undefined}
    >
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#0a0e27', border: '1px solid rgba(10,132,255,0.4)', borderRadius: 24, padding: 32, maxWidth: 400, width: '92%', textAlign: 'center' }}
      >
        <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#0a84ff', letterSpacing: '0.12em', margin: '0 0 6px' }}>
          📱 MICRÓFONO QR
        </p>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 18px' }}>
          {alumnoNombre}
        </p>

        {/* QR solo visible mientras esperan */}
        {fase === 'esperando' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 12, display: 'inline-block', marginBottom: 18 }}>
            <img src={qrUrl} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
          </div>
        )}

        {/* Ícono de estado cuando ya está grabando */}
        {fase === 'grabando' && (
          <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'pulse 1s infinite' }}>🎙️</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: faseTexto.dot, boxShadow: `0 0 10px ${faseTexto.dot}` }} />
          <p style={{ margin: 0, color: faseTexto.color, fontSize: 13, fontWeight: 600 }}>
            {faseTexto.texto}
          </p>
        </div>

        {fase === 'esperando' && (
          <>
            <p style={{ margin: '0 0 14px', color: '#8e8e93', fontSize: 11, lineHeight: 1.5 }}>
              El alumno escanea el QR con su celular, toca Iniciar y lee. Al terminar toca Detener — el análisis comienza automáticamente.
            </p>
            <button onClick={onCerrar} style={{ background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 20, padding: '8px 20px', color: '#ff453a', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Cancelar
            </button>
          </>
        )}

        {fase === 'grabando' && (
          <p style={{ margin: 0, color: '#8e8e93', fontSize: 11, lineHeight: 1.5 }}>
            La grabación se refleja en la pantalla principal. El alumno toca Detener cuando termine.
          </p>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ReadingAnalyzer = ({
  alumno,
  grupo,
  escuelaId,
  modoIdioma = { leer: 'es', traducir: 'es' },
  textoGenerado,
  onSave,
  onBack,
  onClose,
  onIrAMenu,
  onPuntosGanados,
}) => {
  const [estado,             setEstado]             = useState('esperando');
  const [transcripcion,      setTranscripcion]      = useState('');
  const [transcripcionViva,  setTranscripcionViva]  = useState(''); // solo para QR en vivo
  const [analisis,           setAnalisis]           = useState(null);
  const [tiempoFinal,        setTiempoFinal]        = useState(0);
  const [textoReferencia,    setTextoReferencia]    = useState('');
  const [modoLectura,        setModoLectura]        = useState('libre');
  const [modoAnalisis,       setModoAnalisis]       = useState('ia');
  const [errorMicrofono,     setErrorMicrofono]     = useState(null);
  const [mostrarResultados,  setMostrarResultados]  = useState(false);
  const [feedbackListo,      setFeedbackListo]      = useState(false);
  const [isVibrating,        setIsVibrating]        = useState(false);
  const [mostrarQR,          setMostrarQR]          = useState(false);
  const [sesionQR,           setSesionQR]           = useState('');

  const muteado              = useAuraStore(s => s.muteado);
  const agregarLecturaSesion = useAuraStore(s => s.agregarLecturaSesion);

  const [racha,              setRacha]              = useState(alumno?.racha || 0);
  const [badgesNuevos,       setBadgesNuevos]       = useState([]);
  const [nivelNuevo,         setNivelNuevo]         = useState(null);
  const [nivelActual,        setNivelActual]        = useState(getNivel(alumno?.puntosClase || 0));
  const [mostrarCelebracion, setMostrarCelebracion] = useState(false);
  const [lecturasAnteriores, setLecturasAnteriores] = useState([]);
  const [resumenDidactico,   setResumenDidactico]   = useState(null);
  const [recomendaciones,    setRecomendaciones]    = useState(null);

  const transcripcionRef = useRef('');
  const tiempoRef        = useRef(0);
  const pollingQRRef     = useRef(null); // polling persistente para modo celular
  const sesionQRRef      = useRef('');   // ref para evitar stale closure en el polling
  const LANG_LABEL       = { es: 'Español', en: 'Inglés (English)' };
  useEffect(() => {
    const cargar = async () => {
      try {
        const q    = query(collection(db, 'lecturas'), where('alumnoId', '==', alumno.id), limit(50));
        const snap = await getDocs(q);
        setLecturasAnteriores(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      } catch (_) {}
    };
    if (alumno?.id) cargar();
  }, [alumno?.id]);

  useEffect(() => {
    if (textoGenerado) { setTextoReferencia(textoGenerado); setModoLectura('guiada'); }
  }, [textoGenerado]);

  const TEXTOS_REFERENCIA = [
    { id: 1, titulo: 'La Revolución Mexicana',    nivel: 'Intermedio', texto: 'La Revolución Mexicana fue un conflicto armado que tuvo lugar en México, iniciado el 20 de noviembre de 1910. Los antecedentes del conflicto se remontan a la situación de México bajo la dictadura conocida como el Porfiriato.' },
    { id: 2, titulo: 'El Sistema Solar',           nivel: 'Básico',     texto: 'El Sistema Solar es el sistema planetario que contiene al Sol y a los objetos que orbitan a su alrededor. Se formó hace aproximadamente 4600 millones de años a partir del colapso de una nube molecular.' },
    { id: 3, titulo: 'La Independencia de México', nivel: 'Avanzado',   texto: 'La Guerra de Independencia de México fue un conflicto armado que se desarrolló entre 1810 y 1821. Miguel Hidalgo y Costilla inició el movimiento independentista el 16 de septiembre de 1810 con el Grito de Dolores.' },
  ];

  useEffect(() => {
    if (feedbackListo && !mostrarResultados) {
      reproducirSonido('analisis_listo');
      const interval = setInterval(() => {
        setIsVibrating(true);
        setTimeout(() => setIsVibrating(false), 500);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [feedbackListo, mostrarResultados]);

  // ── QR — genera ID de sesión único ──
  const abrirQR = () => {
    if (modoLectura === 'guiada' && !textoReferencia) return;
    reproducirSonido('iniciar');
    setTranscripcion(''); transcripcionRef.current = ''; tiempoRef.current = 0;
    setErrorMicrofono(null); setMostrarResultados(false);
    setFeedbackListo(false); setAnalisis(null); setTiempoFinal(0);
    setBadgesNuevos([]); setNivelNuevo(null);
    setResumenDidactico(null); setRecomendaciones(null);
    const id = `${alumno.id}-${Date.now()}`;
    sesionQRRef.current = id; // sincroniza ref inmediatamente
    setSesionQR(id);
    setMostrarQR(true);
  };

  // El celular inició grabación — activar fullscreen en la PC y arrancar polling persistente
  const handleQRGrabacionIniciada = () => {
    setMostrarQR(false);
    setEstado('grabando'); // activa ReadingFullscreen en la PC

    // Polling persistente — detecta transcripción en vivo y finalización
    if (pollingQRRef.current) clearInterval(pollingQRRef.current);
    pollingQRRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/mic-status/${sesionQRRef.current}`);
        if (!res.ok) return;
        const data = await res.json();

        // Actualizar transcripción en vivo en el fullscreen
        if (data.transcripcionLive && data.transcripcionLive.trim()) {
          transcripcionRef.current = data.transcripcionLive;
          setTranscripcionViva(data.transcripcionLive); // estado dedicado → no compite con otros updates
        }

        // Celular tocó Detener — transcripción final llegó
        if (data.transcripcion && data.transcripcion.trim().length > 3) {
          clearInterval(pollingQRRef.current);
          pollingQRRef.current = null;
          const tiempo = data.tiempo || tiempoRef.current || 60;
          const textoFinal = data.transcripcion;
          transcripcionRef.current = textoFinal;
          setTranscripcion(textoFinal);
          setTiempoFinal(tiempo);
          tiempoRef.current = tiempo;
          setEstado('analizando');
          sesionQRRef.current = '';
          setSesionQR('');
          if (modoAnalisis === 'local') {
            analizarLecturaLocalHandler(textoFinal, tiempo);
          } else {
            analizarLectura(textoFinal, tiempo);
          }
        }
      } catch (_) {}
    }, 800);
  };

  // El celular terminó y envió la transcripción
  const handleQRTranscripcion = (transcripcionFinal, tiempoSegundos) => {
    setMostrarQR(false);
    transcripcionRef.current = transcripcionFinal;
    setTranscripcion(transcripcionFinal);
    setTiempoFinal(tiempoSegundos);
    tiempoRef.current = tiempoSegundos;
    setEstado('analizando');
    if (modoAnalisis === 'local') {
      analizarLecturaLocalHandler(transcripcionFinal, tiempoSegundos);
    } else {
      analizarLectura(transcripcionFinal, tiempoSegundos);
    }
  };

  const iniciarGrabacion = () => {
    if (modoLectura === 'guiada' && !textoReferencia) return;
    reproducirSonido('iniciar');
    setTranscripcion(''); transcripcionRef.current = ''; tiempoRef.current = 0;
    setErrorMicrofono(null); setMostrarResultados(false);
    setFeedbackListo(false); setAnalisis(null); setTiempoFinal(0);
    setBadgesNuevos([]); setNivelNuevo(null);
    setResumenDidactico(null); setRecomendaciones(null);
    setEstado('grabando');
  };

  const handleFullscreenDetener = (transcripcionFinal, tiempoSegundos) => {
    transcripcionRef.current = transcripcionFinal;
    setTranscripcion(transcripcionFinal);
    setTiempoFinal(tiempoSegundos);
    tiempoRef.current = tiempoSegundos;
    setEstado('analizando');
    if (modoAnalisis === 'local') {
      analizarLecturaLocalHandler(transcripcionFinal, tiempoSegundos);
    } else {
      analizarLectura(transcripcionFinal, tiempoSegundos);
    }
  };

  const procesarGamificacion = async (analisisData, transcripcionActual, palabrasPorMinuto, puntosGanados, calificacion) => {
    const gamiResultado = await actualizarGamificacion({
      alumnoId:           alumno.id,
      analisis:           { ...analisisData, palabrasPorMinuto, puntosGanados, calificacionFinal: calificacion },
      lecturasAnteriores,
      modoIdioma,
    });
    setRacha(gamiResultado.racha);
    setBadgesNuevos(gamiResultado.badgesNuevos);
    setNivelActual(gamiResultado.nivelActual);
    if (gamiResultado.nivelNuevo) { setNivelNuevo(gamiResultado.nivelNuevo); reproducirSonido('nivel'); confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#ffd60a','#bf5af2','#0a84ff'] }); }
    if (gamiResultado.racha > (alumno?.racha || 0)) setMostrarCelebracion(true);
    // FIX Bug 1: usa calificacion (no calificacionFinal) para agregarLecturaSesion
    if (agregarLecturaSesion) agregarLecturaSesion({
      alumnoNombre:      alumno.nombre,
      transcripcion:     transcripcionActual,
      calificacionFinal: calificacion,
      palabrasPorMinuto,
    });
    return gamiResultado;
  };

  const analizarLecturaLocalHandler = async (transcripcionActual, tiempoSegundos) => {
    if (!transcripcionActual || transcripcionActual.trim().length < 5) {
      alert('⚠️ No se detectó suficiente texto. Habla más cerca del micrófono e intenta de nuevo.');
      setEstado('esperando'); return;
    }
    const resultado = analizarLecturaLocal({
      transcripcion:   transcripcionActual,
      textoReferencia: modoLectura === 'guiada' ? textoReferencia : null,
      tiempoSegundos, modoLectura, modoIdioma, alumnoNombre: alumno.nombre,
    });
    if (!resultado) { alert('⚠️ Error en el análisis local.'); setEstado('esperando'); return; }

    const { puntosGanados, calificacionFinal, palabrasPorMinuto, numeroPalabras } = resultado;

    await guardarAnalisis({ ...resultado, tiempoSegundos, transcripcion: transcripcionActual,
      textoReferencia: modoLectura === 'guiada' ? textoReferencia : null, modoLectura, modoIdioma });

    await procesarGamificacion(resultado, transcripcionActual, palabrasPorMinuto, puntosGanados, calificacionFinal);

    setAnalisis({ ...resultado, palabrasPorMinuto, numeroPalabras, puntosGanados, calificacionFinal });
    setEstado('esperando'); setFeedbackListo(true); setMostrarResultados(false);
    if (onPuntosGanados) onPuntosGanados(puntosGanados);
  };

  // ── PROMPT CON RESUMEN + RECOMENDACIONES ──
  const construirPrompt = (transcripcionActual, palabrasPorMinuto) => {
    const idiomaAnalisis = LANG_LABEL[modoIdioma.leer];
    const nivelAlumno = lecturasAnteriores.length > 0
      ? (lecturasAnteriores.reduce((s, l) => s + (l.calificacionFinal || 0), 0) / lecturasAnteriores.length).toFixed(1)
      : 'desconocido';

    const sufijo = `,"resumenDidactico":{"tema":"Tema central identificado en la lectura","conceptos":["Concepto1","Concepto2","Concepto3"],"comprension":"Alta","preguntas":["¿Pregunta de comprensión 1?","¿Pregunta de comprensión 2?"],"actividad":"Actividad concreta de 5 minutos para cerrar el tema en clase"},"recomendaciones":{"libros":[{"titulo":"TÍTULO REAL de un libro existente adecuado al nivel ${nivelAlumno}/10 y al tema leído","autor":"Autor real","razon":"Por qué este libro específico ayuda a mejorar las áreas detectadas"},{"titulo":"TÍTULO REAL de segundo libro existente","autor":"Autor real","razon":"Razón específica según el resultado"}],"contenidoDigital":[{"tipo":"TikTok","descripcion":"Sugiere 1-2 cuentas reales de TikTok en español relacionadas con el tema de la lectura de hoy","plataforma":"TikTok"},{"tipo":"Artículo","descripcion":"Sugiere dónde buscar en Instagram, X o YouTube contenido breve relacionado con el tema de hoy","plataforma":"Instagram / X"}]}}`;

    if (modoLectura === 'guiada') {
      return `Actúa como un experto lingüista educativo de Aura Lexi.
Analiza esta lectura de un alumno y compárala con el texto de referencia.
IDIOMA DE ANÁLISIS: ${idiomaAnalisis}.
TEXTO DE REFERENCIA:\n${textoReferencia}
LECTURA DEL ALUMNO:\n${transcripcionActual}
Evalúa (1-10): 1.Fluidez (PPM ideal: 120-150, actual: ${palabrasPorMinuto}) 2.Dicción ${modoIdioma.leer === 'en' ? '(fonética inglesa)' : '(dicción española)'} 3.Precisión 4.Pausas 5.Expresividad
IMPORTANTE: Retroalimentación en ${idiomaAnalisis}. Los libros recomendados DEBEN ser títulos reales y existentes.
Responde SOLO con JSON puro sin markdown:
{"fluidez":{"puntuacion":8,"comentario":"..."},"diccion":{"puntuacion":7,"comentario":"..."},"precision":{"puntuacion":9,"comentario":"..."},"pausas":{"puntuacion":6,"comentario":"..."},"expresividad":{"puntuacion":7,"comentario":"..."},"calificacionFinal":7.4,"fortalezas":["f1","f2"],"areasAMejorar":["a1","a2"],"comentarioGeneral":"..."${sufijo}}`;
    }
    return `Actúa como un experto lingüista de Aura Lexi. Analiza esta lectura libre.
IDIOMA DE ANÁLISIS: ${idiomaAnalisis}.
LECTURA:\n${transcripcionActual}
Evalúa (1-10): 1.Fluidez (PPM ideal:120-150, actual:${palabrasPorMinuto}) 2.Dicción ${modoIdioma.leer === 'en' ? '(pronunciación inglesa)' : '(claridad española)'} 3.Pausas 4.Expresividad 5.Coherencia
IMPORTANTE: Retroalimentación en ${idiomaAnalisis}. Los libros recomendados DEBEN ser títulos reales y existentes.
Responde SOLO con JSON puro sin markdown:
{"fluidez":{"puntuacion":8,"comentario":"..."},"diccion":{"puntuacion":7,"comentario":"..."},"pausas":{"puntuacion":6,"comentario":"..."},"expresividad":{"puntuacion":7,"comentario":"..."},"coherencia":{"puntuacion":8,"comentario":"..."},"calificacionFinal":7.2,"fortalezas":["f1","f2"],"areasAMejorar":["a1","a2"],"comentarioGeneral":"..."${sufijo}}`;
  };

  const analizarLectura = async (transcripcionActual, tiempoSegundos) => {
    if (!transcripcionActual || transcripcionActual.trim().length < 5) {
      alert('⚠️ No se detectó suficiente texto. Habla más cerca del micrófono e intenta de nuevo.');
      setEstado('esperando'); return;
    }
    try {
      const palabras          = transcripcionActual.trim().split(/\s+/);
      const numeroPalabras    = palabras.length;
      const tiempoMinutos     = (tiempoSegundos || 1) / 60;
      const palabrasPorMinuto = Math.round(numeroPalabras / tiempoMinutos);

      const prompt = construirPrompt(transcripcionActual, palabrasPorMinuto);

      const response = await fetch(`https://api.iapprende.com/api/analizar-lectura`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error('Error en la comunicación con el servidor de IA');

      const data = await response.json();
      const respuestaTexto = data.content?.[0]?.text || data.choices?.[0]?.message?.content || data.texto || JSON.stringify(data);
      const match = respuestaTexto.match(/\{[\s\S]*\}/);
      if (!match) { alert('⚠️ La IA no generó un análisis estructurado. Intenta de nuevo.'); setEstado('esperando'); return; }

      let resultadoAnalisis;
      try { resultadoAnalisis = JSON.parse(match[0]); }
      catch (e) { alert('Respuesta inválida de la IA. Intenta de nuevo.'); setEstado('esperando'); return; }

      const calificacion  = parseFloat(resultadoAnalisis.calificacionFinal) || 0;
      const puntosGanados = Math.round((calificacion / 10) * 30);

      // Extraer resumen y recomendaciones
      if (resultadoAnalisis.resumenDidactico) setResumenDidactico(resultadoAnalisis.resumenDidactico);
      if (resultadoAnalisis.recomendaciones)  setRecomendaciones(resultadoAnalisis.recomendaciones);

      const analisisCompleto = { ...resultadoAnalisis, palabrasPorMinuto, numeroPalabras, tiempoSegundos,
        transcripcion: transcripcionActual, textoReferencia: modoLectura === 'guiada' ? textoReferencia : null,
        modoLectura, modoIdioma, puntosGanados };

      await guardarAnalisis(analisisCompleto);
      await procesarGamificacion(resultadoAnalisis, transcripcionActual, palabrasPorMinuto, puntosGanados, calificacion);

      setAnalisis({ ...resultadoAnalisis, palabrasPorMinuto, numeroPalabras, puntosGanados, calificacionFinal: calificacion });
      setEstado('esperando'); setFeedbackListo(true); setMostrarResultados(false);
      if (onPuntosGanados) onPuntosGanados(puntosGanados);

    } catch (error) {
      console.error('❌ Error analizando:', error);
      alert('❌ Error al analizar: ' + error.message);
      setEstado('esperando');
    }
  };

  const guardarAnalisis = async (datosAnalisis) => {
    try {
      await addDoc(collection(db, 'lecturas'), {
        alumnoId: alumno.id, alumnoNombre: alumno.nombre,
        escuelaId: alumno.escuelaId, grupo: alumno.grupo,
        fecha: new Date().toISOString(), ...datosAnalisis,
      });
      // FIX Bug 2: actualiza puntosClase para que Estadísticas lo lea correctamente
      if (alumno?.id && datosAnalisis.puntosGanados > 0) {
        await updateDoc(doc(db, 'alumnos', alumno.id), {
          puntosClase: increment(datosAnalisis.puntosGanados),
          puntos:      increment(datosAnalisis.puntosGanados),
        });
      }
    } catch (error) { console.error('❌ Error guardando:', error); }
  };

  const formatearTiempo     = (s) => `${Math.floor((s||0)/60)}:${((s||0)%60).toString().padStart(2,'0')}`;
  const getColorCalif       = (p) => p >= 8 ? '#00e676' : p >= 6 ? '#ffea00' : '#ff5252';
  const getEmojiCalif       = (p) => p >= 9 ? '🏆' : p >= 8 ? '⭐' : p >= 7 ? '😊' : p >= 6 ? '💪' : p >= 5 ? '📚' : '🌱';
  const getMensajeMotivador = (p) => {
    if (p >= 9) return '¡LECTURA EXCEPCIONAL! ¡ERES UN LECTOR BRILLANTE!';
    if (p >= 8) return '¡EXCELENTE LECTURA! ¡SIGUE ASÍ, VAS MUY BIEN!';
    if (p >= 7) return '¡MUY BUENA LECTURA! CON PRÁCTICA LLEGARÁS LEJOS';
    if (p >= 6) return '¡BUENA LECTURA! VAS POR BUEN CAMINO, NO TE RINDAS';
    if (p >= 5) return '¡LECTURA ACEPTABLE! CADA DÍA PUEDES MEJORAR MÁS';
    return '¡SIGUE PRACTICANDO! EL ESFUERZO SIEMPRE DA FRUTOS';
  };
  const iconosCat = { fluidez:'🏃', diccion:'🗣️', precision:'🎯', pausas:'⏸️', expresividad:'🎭', coherencia:'🧠' };

  const abrirResultados = () => {
    setEstado('resultado'); setMostrarResultados(true); setFeedbackListo(false);
    reproducirSonido('xp');
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#8c44f7','#00d2ff','#00e676'] });
    if (!muteado) {
      setTimeout(() => narrarResultado(analisis, alumno.nombre), 600);
      if (racha >= 3) setTimeout(() => narrarRacha(racha), 5000);
      if (nivelNuevo) setTimeout(() => narrarNivel(nivelNuevo), 7000);
    }
  };

  const resetear = () => {
    detener();
    if (pollingQRRef.current) { clearInterval(pollingQRRef.current); pollingQRRef.current = null; }
    sesionQRRef.current = '';
    setSesionQR('');
    setEstado('esperando'); setTranscripcion(''); setTranscripcionViva(''); transcripcionRef.current = '';
    setAnalisis(null); tiempoRef.current = 0; setTiempoFinal(0);
    setMostrarResultados(false); setFeedbackListo(false);
    setBadgesNuevos([]); setNivelNuevo(null);
    setResumenDidactico(null); setRecomendaciones(null);
  };

  const handleFullscreenCancelar = () => {
    reproducirSonido('cancelar');
    if (pollingQRRef.current) { clearInterval(pollingQRRef.current); pollingQRRef.current = null; }
    sesionQRRef.current = '';
    setSesionQR('');
    setTranscripcionViva('');
    setEstado('esperando'); setTranscripcion(''); transcripcionRef.current = '';
  };

  const progresoNivel = getProgresoNivel(alumno?.puntosClase || 0);

  return (
    <>
      {mostrarCelebracion && ReactDOM.createPortal(
        <AnimatePresence>
          <RachaCelebracion racha={racha} onDismiss={() => setMostrarCelebracion(false)} />
        </AnimatePresence>,
        document.body,
      )}

      {mostrarQR && (
        <QRMicrofono
          sesionId={sesionQR}
          alumnoNombre={alumno.nombre}
          onGrabacionIniciada={handleQRGrabacionIniciada}
          onTranscripcionRecibida={handleQRTranscripcion}
          onCerrar={() => setMostrarQR(false)}
        />
      )}

      <AnimatePresence>
        {estado === 'grabando' && (
          <ReadingFullscreen
            alumno={alumno} modoIdioma={modoIdioma} textoReferencia={textoReferencia}
            modoLectura={modoLectura} racha={racha}
            modoQR={!!sesionQR}
            transcripcionQR={transcripcionViva}
            onDetener={handleFullscreenDetener} onCancelar={handleFullscreenCancelar}
          />
        )}
      </AnimatePresence>

      {estado === 'analizando' && ReactDOM.createPortal(
        <motion.div className="ra-analizando-portal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <div className="ra-analizando-inner">
            <div className="ra-spinner" />
            <h2 className="ra-analizando-titulo">
              {modoAnalisis === 'local' ? '⚡ ANALIZANDO EN LOCAL...' : '🤖 ANALIZANDO TU LECTURA'}
            </h2>
            <p className="ra-analizando-sub">
              {modoAnalisis === 'local' ? 'Motor heurístico evaluando tu desempeño...' : 'La IA está evaluando tu desempeño...'}
            </p>
            <div className="ra-analizando-dots"><span /><span /><span /></div>
          </div>
        </motion.div>,
        document.body,
      )}

      {feedbackListo && !mostrarResultados && ReactDOM.createPortal(
        <motion.div
          initial={{ x: 200, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 200, opacity: 0 }}
          className={`pestaña-latente-ia ${isVibrating ? 'vibrate' : ''}`}
          onClick={abrirResultados}
          style={{ position: 'fixed', top: '80px', right: 0, zIndex: 99998 }}
        >
          <div className="latente-icon">{modoAnalisis === 'local' ? '⚡✨' : '🤖✨'}</div>
          <div className="latente-content">
            <span className="latente-title">¡Análisis Listo!</span>
            <span className="latente-xp">+{analisis?.puntosGanados} XP Reclamar</span>
          </div>
        </motion.div>,
        document.body,
      )}

      {estado === 'resultado' && analisis && mostrarResultados && ReactDOM.createPortal(
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0d0820', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        >
          {/* Topbar */}
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#0d1117', borderBottom: '2px solid #00ff41', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', flexShrink: 0 }}>
            <button onClick={resetear} style={{ background: '#1e2d3d', border: '1px solid #2d3e50', borderRadius: 8, color: '#94a3b8', padding: '7px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              🔄 NUEVA LECTURA
            </button>
            <button onClick={onClose} style={{ background: '#1a1a2e', border: '1px solid #444', borderRadius: 8, color: '#cbd5e1', padding: '7px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              👥 OTRO ALUMNO
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#00ff41', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📖 {alumno.nombre}
            </div>
            {onIrAMenu && (
              <button onClick={onIrAMenu} style={{ background: '#1a1a2e', border: '1px solid #444', borderRadius: 8, color: '#cbd5e1', padding: '7px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                🏠 MENÚ
              </button>
            )}
            <MuteButtonCompact />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${nivelActual.color}20`, border: `1px solid ${nivelActual.color}50`, borderRadius: 20, padding: '4px 12px', flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>{nivelActual.icono}</span>
              <span style={{ fontSize: 11, color: nivelActual.color, fontWeight: 700, fontFamily: 'monospace' }}>{nivelActual.nombre}</span>
            </div>
            {analisis.modoAnalisis === 'local' && (
              <div style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 20, padding: '4px 10px', fontSize: 10, color: '#00e5ff', fontFamily: 'monospace', flexShrink: 0 }}>
                ⚡ LOCAL
              </div>
            )}
            <button onClick={onClose} style={{ background: '#00e676', border: 'none', borderRadius: 8, color: '#000', padding: '7px 16px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              ✅ RECLAMAR +{analisis.puntosGanados} XP
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="contenido-reading resultado"
            style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '24px 20px' }}
          >
            {/* Hero calificación */}
            <div className="resultado-hero">
              <div className="resultado-emoji-grande">{getEmojiCalif(analisis.calificacionFinal)}</div>
              <div className="resultado-calificacion-circle" style={{ '--color-calif': getColorCalif(analisis.calificacionFinal) }}>
                <span className="resultado-numero">{analisis.calificacionFinal.toFixed(1)}</span>
                <span className="resultado-denom">/10</span>
              </div>
              <div className="resultado-mensaje-motivador">{getMensajeMotivador(analisis.calificacionFinal)}</div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} className="resultado-puntos-badge">
                <span className="puntos-badge-icon">⭐</span>
                <span className="puntos-badge-numero">+{analisis.puntosGanados}</span>
                <span className="puntos-badge-texto">PUNTOS GANADOS</span>
              </motion.div>
            </div>

            {/* Gamificación */}
            <div style={{ display: 'grid', gridTemplateColumns: racha > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
              {racha > 0 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <RachaHero racha={racha} esNueva={mostrarCelebracion} />
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                style={{ background: `${nivelActual.color}12`, border: `2px solid ${nivelActual.color}40`, borderRadius: 20, padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}
              >
                {nivelNuevo && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{ position: 'absolute', top: 8, right: 8, background: '#ffd60a', color: '#000', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 10, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    ¡NIVEL NUEVO!
                  </motion.div>
                )}
                <span style={{ fontSize: '2.5rem' }}>{nivelActual.icono}</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.65rem', color: nivelActual.color, textAlign: 'center', textShadow: `0 0 10px ${nivelActual.color}` }}>
                  {nivelActual.nombre}
                </span>
                {progresoNivel.siguiente && (
                  <div style={{ width: '100%' }}>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${progresoNivel.porcentaje}%` }}
                        transition={{ delay: 0.6, duration: 1, ease: 'easeOut' }}
                        style={{ height: '100%', background: nivelActual.color, borderRadius: 3, boxShadow: `0 0 8px ${nivelActual.color}` }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0', textAlign: 'center', fontFamily: 'monospace' }}>
                      {progresoNivel.xpFaltante} XP para {progresoNivel.siguiente.nombre} {progresoNivel.siguiente.icono}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Badges */}
            {badgesNuevos.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.7rem', color: '#ffd60a', textAlign: 'center', marginBottom: 12, textShadow: '0 0 10px #ffd60a' }}>
                  🏅 ¡LOGROS DESBLOQUEADOS!
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {BADGES.filter(b => badgesNuevos.includes(b.id)).map(b => (
                    <motion.div key={b.id} initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(255,214,10,0.15)', border: '2px solid rgba(255,214,10,0.5)', borderRadius: 20 }}>
                      <span style={{ fontSize: 24 }}>{b.icono}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#ffd60a', fontSize: 13 }}>{b.nombre}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{b.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Métricas */}
            <div className="resultado-metricas">
              <div className="metrica-card"><span className="metrica-icon">⚡</span><span className="metrica-big">{analisis.palabrasPorMinuto}</span><span className="metrica-sub">PPM</span></div>
              <div className="metrica-card"><span className="metrica-icon">📝</span><span className="metrica-big">{analisis.numeroPalabras}</span><span className="metrica-sub">PALABRAS</span></div>
              <div className="metrica-card"><span className="metrica-icon">⏱️</span><span className="metrica-big">{formatearTiempo(tiempoFinal)}</span><span className="metrica-sub">TIEMPO</span></div>
            </div>

            {/* Categorías */}
            <div className="resultado-categorias-titulo">📊 EVALUACIÓN DETALLADA</div>
            <div className="resultado-categorias">
              {Object.entries(analisis).map(([key, value]) => {
                if (typeof value === 'object' && value !== null && value.puntuacion !== undefined) {
                  const color = getColorCalif(value.puntuacion);
                  return (
                    <div key={key} className="cat-card">
                      <div className="cat-card-header">
                        <span className="cat-icono">{iconosCat[key] || '📌'}</span>
                        <span className="cat-nombre">{key.toUpperCase()}</span>
                        <span className="cat-puntuacion" style={{ color }}>{value.puntuacion}/10</span>
                      </div>
                      <div className="cat-barra-bg"><div className="cat-barra-fill" style={{ width: `${value.puntuacion * 10}%`, background: color }} /></div>
                      <p className="cat-comentario">{value.comentario}</p>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Feedback */}
            <div className="resultado-feedback">
              <div className="feedback-card fortalezas-card">
                <h4>💪 TUS FORTALEZAS</h4>
                <ul>{(analisis.fortalezas||[]).map((f,i) => <li key={i}><span className="feedback-bullet">✅</span>{f}</li>)}</ul>
              </div>
              <div className="feedback-card mejorar-card">
                <h4>🚀 ÁREAS A MEJORAR</h4>
                <ul>{(analisis.areasAMejorar||[]).map((a,i) => <li key={i}><span className="feedback-bullet">🎯</span>{a}</li>)}</ul>
              </div>
            </div>

            {/* Resumen didáctico */}
            <ResumenDidactico resumen={resumenDidactico} alumnoNombre={alumno.nombre} />

            {/* Recomendaciones: libros + contenido digital */}
            {recomendaciones && (
              <div style={{ marginBottom: 20 }}>

                {/* Libros */}
                {recomendaciones.libros?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 10px', fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#ff9f0a', letterSpacing: '0.15em' }}>
                      📚 LIBROS RECOMENDADOS
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recomendaciones.libros.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>📖</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px', color: '#fff', fontWeight: 600, fontSize: 13 }}>{r.titulo}</p>
                            <p style={{ margin: '0 0 5px', color: '#ff9f0a', fontSize: 11, fontWeight: 500 }}>{r.autor}</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.5 }}>{r.razon}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contenido digital */}
                {recomendaciones.contenidoDigital?.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 10px', fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#0a84ff', letterSpacing: '0.15em' }}>
                      📱 TAMBIÉN PUEDES LEER EN
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {recomendaciones.contenidoDigital.map((c, i) => {
                        const iconos = { 'TikTok': { icono: '🎵', color: '#ff2d55' }, 'Instagram': { icono: '📸', color: '#bf5af2' }, 'X': { icono: '✖', color: '#8e8e93' }, 'Facebook': { icono: '👥', color: '#0a84ff' }, 'Artículo': { icono: '📰', color: '#30d158' }, 'YouTube': { icono: '▶', color: '#ff453a' } };
                        const plat = iconos[c.tipo] || iconos['Artículo'];
                        return (
                          <div key={i} style={{ background: `${plat.color}10`, border: `1px solid ${plat.color}30`, borderRadius: 12, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 18 }}>{plat.icono}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: plat.color }}>{c.plataforma || c.tipo}</span>
                            </div>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 1.5 }}>{c.descripcion}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comentario evaluador */}
            <div className="resultado-comentario">
              <h4>💬 COMENTARIO DEL EVALUADOR {analisis.modoAnalisis === 'local' ? '⚡ LOCAL' : 'IA'}</h4>
              <p>{analisis.comentarioGeneral}</p>
            </div>

            <div className="botones-resultado" style={{ marginBottom: 32 }}>
              <button className="boton-nueva-lectura" onClick={resetear}>🔄 NUEVO DESAFÍO</button>
              <button className="boton-cerrar-resultado" onClick={onClose}>✅ RECLAMAR Y SALIR</button>
            </div>
          </motion.div>
        </motion.div>,
        document.body,
      )}

      {/* Modal principal */}
      <div className="modal-overlay-reading" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-reading" onClick={(e) => e.stopPropagation()}>
          <div className="header-reading">
            <h2>📖 {alumno.nombre}</h2>
            <button className="boton-cerrar-reading" onClick={onClose}>✕</button>
          </div>

          {errorMicrofono && (
            <div className="error-microfono">
              <p>{errorMicrofono}</p>
              <button onClick={() => setErrorMicrofono(null)}>OK</button>
            </div>
          )}

          {(estado === 'esperando' || estado === 'analizando') && !mostrarResultados && (
            <div className="contenido-reading">
              <div className="selector-modo">
                <h3>SELECCIONA EL MODO</h3>

                {/* Toggle IA vs Local */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p style={{ margin: 0, color: '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>MOTOR DE ANÁLISIS</p>
                    <p style={{ margin: '3px 0 0', color: '#8e8e93', fontSize: 11 }}>
                      {modoAnalisis === 'ia' ? '🤖 IA — análisis detallado (requiere conexión)' : '⚡ Local — sin internet, sin créditos'}
                    </p>
                  </div>
                  <button onClick={() => setModoAnalisis(m => m === 'ia' ? 'local' : 'ia')}
                    style={{ background: modoAnalisis === 'local' ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${modoAnalisis === 'local' ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 20, padding: '6px 16px', cursor: 'pointer', color: modoAnalisis === 'local' ? '#00e5ff' : '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: 8, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                    {modoAnalisis === 'ia' ? 'USAR LOCAL' : 'USAR IA'}
                  </button>
                </div>

                <div className="botones-modo">
                  <button className={`boton-modo ${modoLectura === 'libre' ? 'activo' : ''}`} onClick={() => setModoLectura('libre')}>
                    🎤 LECTURA LIBRE<span className="desc-modo">El alumno lee lo que quiera</span>
                  </button>
                  <button className={`boton-modo ${modoLectura === 'guiada' ? 'activo' : ''}`} onClick={() => setModoLectura('guiada')}>
                    📄 LECTURA GUIADA<span className="desc-modo">Leer un texto específico</span>
                  </button>
                </div>
              </div>

              {modoLectura === 'guiada' && (
                <div className="textos-referencia">
                  <h4>TEXTOS DISPONIBLES</h4>
                  <div className="lista-textos">
                    {TEXTOS_REFERENCIA.map(t => (
                      <div key={t.id} className={`card-texto ${textoReferencia === t.texto ? 'seleccionado' : ''}`} onClick={() => setTextoReferencia(t.texto)}>
                        <h5>{t.titulo}</h5>
                        <span className="badge-nivel">{t.nivel}</span>
                        <p className="preview-texto">{t.texto.substring(0, 80)}...</p>
                      </div>
                    ))}
                  </div>
                  <div className="texto-personalizado">
                    <h4>O ESCRIBE TU PROPIO TEXTO</h4>
                    <textarea placeholder="Escribe el texto que el alumno debe leer..." value={textoReferencia} onChange={(e) => setTextoReferencia(e.target.value)} rows="4" />
                  </div>
                </div>
              )}

              <div className="instrucciones-lectura">
                <h4>📋 INSTRUCCIONES</h4>
                <ul>
                  <li>✅ Usa Chrome o Edge para mejor reconocimiento</li>
                  <li>✅ Habla claramente y a ritmo natural</li>
                  <li>✅ Mantén el micrófono cerca (20-30 cm)</li>
                  <li>✅ Evita ruido de fondo</li>
                  <li>✅ Duración recomendada: 1-3 minutos</li>
                </ul>
              </div>

              {/* Botones de inicio — micrófono del PC o QR del celular */}
              <button className="boton-iniciar-lectura" onClick={iniciarGrabacion}
                disabled={modoLectura === 'guiada' && !textoReferencia || estado === 'analizando'}>
                {estado === 'analizando' ? '⏳ ANALIZANDO...' : '🎙️ INICIAR GRABACIÓN (PC)'}
              </button>

              <button
                onClick={abrirQR}
                disabled={estado === 'analizando'}
                style={{ width: '100%', marginTop: 10, padding: '14px', background: 'rgba(10,132,255,0.12)', border: '2px solid rgba(10,132,255,0.4)', borderRadius: 12, color: '#0a84ff', cursor: 'pointer', fontFamily: "'Press Start 2P', monospace", fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s', letterSpacing: '0.05em' }}
              >
                📱 USAR CELULAR (QR)
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default ReadingAnalyzer;