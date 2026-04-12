import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RachaHUD } from './RachaDisplay';
import { MuteButtonCompact } from './MuteButton';
import './ReadingFullscreen.css';

const LANG_CODE  = { es: 'es-MX', en: 'en-US' };
const LANG_LABEL = { es: 'Español', en: 'Inglés' };
const FLAG       = { es: '🇲🇽', en: '🇺🇸' };

// ─────────────────────────────────────────────────────────────
// FUZZY WORD TRACKER
// Encuentra la posición real del alumno en el texto de referencia
// usando distancia de Levenshtein normalizada.
// ─────────────────────────────────────────────────────────────

// Limpia una palabra: minúsculas, sin puntuación, sin acentos
const limpiarPalabra = (palabra) =>
  palabra
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .replace(/[^a-z0-9]/g, '');       // quita puntuación

// Distancia de Levenshtein entre dos strings
const levenshtein = (a, b) => {
  if (!a) return b.length;
  if (!b) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[b.length][a.length];
};

// Similaridad 0-1 entre dos palabras (1 = idénticas)
const similitud = (a, b) => {
  const pa = limpiarPalabra(a);
  const pb = limpiarPalabra(b);
  if (!pa || !pb) return 0;
  if (pa === pb) return 1;
  const maxLen = Math.max(pa.length, pb.length);
  return 1 - levenshtein(pa, pb) / maxLen;
};

// Encuentra la palabra activa en el texto de referencia
// dado el array de palabras dichas por el alumno.
//
// Estrategia:
// - Toma las últimas N palabras de la transcripción
// - Busca en una ventana del texto de referencia la posición
//   con mayor similitud acumulada
// - Devuelve el índice de la palabra activa
const encontrarPosicion = (palabrasRef, palabrasAlumno, posicionAnterior, modoQR = false) => {
  if (!palabrasAlumno.length || !palabrasRef.length) return -1;

  if (modoQR) {
    // Modo QR: el texto llega acumulado — buscar las últimas N palabras
    // en una ventana amplia desde la posición actual
    const PALABRAS_CONTEXTO = 4;
    const VENTANA_MAX       = 25;
    const UMBRAL            = 0.55;

    const contexto = palabrasAlumno
      .slice(-PALABRAS_CONTEXTO)
      .map(limpiarPalabra)
      .filter(Boolean);

    if (!contexto.length) return posicionAnterior;

    // Buscar desde posición actual hacia adelante
    const inicio = Math.max(0, posicionAnterior);
    const fin    = Math.min(palabrasRef.length - 1, posicionAnterior + VENTANA_MAX);

    let mejorPos   = posicionAnterior;
    let mejorScore = 0;

    for (let i = inicio; i <= fin; i++) {
      let score = 0;
      for (let j = 0; j < contexto.length; j++) {
        const idx = i - (contexto.length - 1) + j;
        if (idx >= 0 && idx < palabrasRef.length) {
          score += similitud(contexto[j], palabrasRef[idx]);
        }
      }
      score /= contexto.length;
      if (score > mejorScore && score >= UMBRAL) {
        mejorScore = score;
        mejorPos   = i;
      }
    }

    // Si no encontró nada adelante, hacer búsqueda global desde el inicio
    // (útil cuando el tracker se quedó atascado)
    if (mejorScore < UMBRAL && posicionAnterior < palabrasRef.length - 5) {
      for (let i = 0; i < palabrasRef.length; i++) {
        let score = 0;
        for (let j = 0; j < contexto.length; j++) {
          const idx = i - (contexto.length - 1) + j;
          if (idx >= 0 && idx < palabrasRef.length) {
            score += similitud(contexto[j], palabrasRef[idx]);
          }
        }
        score /= contexto.length;
        if (score > mejorScore && score >= 0.7) {
          mejorScore = score;
          mejorPos   = i;
        }
      }
    }

    return mejorPos;
  }

  // Modo nativo — comportamiento original sin cambios
  const VENTANA_BUSQUEDA  = 8;
  const PALABRAS_CONTEXTO = 3;
  const UMBRAL_SIMILITUD  = 0.6;

  const contextoAlumno = palabrasAlumno
    .slice(-PALABRAS_CONTEXTO)
    .map(limpiarPalabra)
    .filter(Boolean);

  if (!contextoAlumno.length) return posicionAnterior;

  const inicio = Math.max(0, posicionAnterior - 2);
  const fin    = Math.min(palabrasRef.length - 1, posicionAnterior + VENTANA_BUSQUEDA);

  let mejorPosicion = posicionAnterior;
  let mejorScore    = -1;

  for (let i = inicio; i <= fin; i++) {
    let score = 0;
    for (let j = 0; j < contextoAlumno.length; j++) {
      const idxRef = i - (contextoAlumno.length - 1) + j;
      if (idxRef >= 0 && idxRef < palabrasRef.length) {
        score += similitud(contextoAlumno[j], palabrasRef[idxRef]);
      }
    }
    score /= contextoAlumno.length;
    if (score > mejorScore && score >= UMBRAL_SIMILITUD) {
      mejorScore    = score;
      mejorPosicion = i;
    }
  }

  return mejorPosicion;
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
const ReadingFullscreen = ({
  alumno,
  modoIdioma = { leer: 'es', traducir: 'es' },
  textoReferencia = '',
  modoLectura = 'libre',
  racha = 0,
  modoQR = false,
  transcripcionQR = '',
  onDetener,
  onCancelar,
}) => {
  const conTraduccion = modoIdioma.leer !== modoIdioma.traducir;

  const [transcripcion, setTranscripcion]     = useState('');
  const [traduccion, setTraduccion]           = useState('');
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0);
  const [errorMicrofono, setErrorMicrofono]   = useState(null);
  const [estadoMic, setEstadoMic]             = useState('iniciando');
  const [palabrasCount, setPalabrasCount]     = useState(0);
  const [traduciendo, setTraduciendo]         = useState(false);
  const [palabraActiva, setPalabraActiva]     = useState(-1);
  const [ppmMax, setPpmMax]                   = useState(0);

  // ── Sincronización transcripción QR + tracker directo ───────

  const recognitionRef     = useRef(null);
  const timerRef           = useRef(null);
  const transcripcionRef   = useRef('');
  const tiempoRef          = useRef(0);
  const traduccionTimerRef = useRef(null);
  const scrollVozRef       = useRef(null);
  const scrollTradRef      = useRef(null);
  const palabraActivaRef   = useRef(-1);
  const palabrasRefCache   = useRef([]);
  const ultimoLargoQRRef   = useRef(0);

  // Pre-procesa palabras de referencia — inicialización síncrona también
  // para que esté disponible cuando llegue el primer bloque QR
  if (palabrasRefCache.current.length === 0 && textoReferencia) {
    palabrasRefCache.current = textoReferencia.split(/\s+/).filter(Boolean);
  }

  useEffect(() => {
    palabrasRefCache.current = textoReferencia
      ? textoReferencia.split(/\s+/).filter(Boolean)
      : [];
    setPalabraActiva(-1);
    palabraActivaRef.current = -1;
    ultimoLargoQRRef.current = 0;
  }, [textoReferencia]);

  // ── Sincronización QR + tracker — va DESPUÉS de palabrasRefCache ──
  useEffect(() => {
    if (!modoQR || !transcripcionQR) return;

    const palabrasNuevas = transcripcionQR.trim().split(/\s+/).filter(Boolean);
    const largoActual    = palabrasNuevas.length;

    if (largoActual <= ultimoLargoQRRef.current) return;
    ultimoLargoQRRef.current = largoActual;

    // Actualizar texto visible y contador
    setTranscripcion(transcripcionQR);
    transcripcionRef.current = transcripcionQR;
    setPalabrasCount(largoActual);

    // Tracker — palabrasRefCache ya está inicializado arriba
    const cache = palabrasRefCache.current;
    if (modoLectura === 'guiada' && cache.length > 0 && palabrasNuevas.length > 0) {
      const nuevaPosicion = encontrarPosicion(
        cache,
        palabrasNuevas,
        palabraActivaRef.current,
        true,
      );
      if (nuevaPosicion >= 0 && nuevaPosicion !== palabraActivaRef.current) {
        palabraActivaRef.current = nuevaPosicion;
        setPalabraActiva(nuevaPosicion);
      }
    }
  }, [modoQR, transcripcionQR, modoLectura]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const ppm = tiempoGrabacion > 5
    ? Math.round((palabrasCount / tiempoGrabacion) * 60) : 0;

  useEffect(() => { if (ppm > ppmMax) setPpmMax(ppm); }, [ppm]);

  // ── Traducción debounced ──
  const traducirTexto = useCallback(async (texto) => {
    if (!conTraduccion || !texto || texto.trim().length < 8) return;
    setTraduciendo(true);
    try {
      const res = await fetch('https://api.iapprende.com/api/analizar-lectura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Traduce de ${LANG_LABEL[modoIdioma.leer]} a ${LANG_LABEL[modoIdioma.traducir]}.
Responde ÚNICAMENTE con la traducción, sin explicaciones ni markdown.
TEXTO: ${texto}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        const r = data.content?.[0]?.text || data.choices?.[0]?.message?.content || data.texto || '';
        setTraduccion(r.trim());
      }
    } catch (e) { console.warn('Traducción:', e); }
    setTraduciendo(false);
  }, [conTraduccion, modoIdioma]);

  useEffect(() => {
    if (!transcripcion) return;
    if (traduccionTimerRef.current) clearTimeout(traduccionTimerRef.current);
    traduccionTimerRef.current = setTimeout(() => traducirTexto(transcripcion), 1800);
    return () => clearTimeout(traduccionTimerRef.current);
  }, [transcripcion, traducirTexto]);

  // Auto-scroll voz
  useEffect(() => {
    if (scrollVozRef.current)
      scrollVozRef.current.scrollTop = scrollVozRef.current.scrollHeight;
  }, [transcripcion]);

  // Auto-scroll traducción
  useEffect(() => {
    if (scrollTradRef.current)
      scrollTradRef.current.scrollTop = scrollTradRef.current.scrollHeight;
  }, [traduccion]);

  // ── FUZZY WORD TRACKER ────────────────────────────────────
  // Reemplaza el useEffect anterior que solo contaba palabras
  useEffect(() => {
    if (modoLectura !== 'guiada' || !transcripcion) return;

    const palabrasAlumno = transcripcion
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!palabrasAlumno.length) return;

    const nuevaPosicion = encontrarPosicion(
      palabrasRefCache.current,
      palabrasAlumno,
      palabraActivaRef.current,
      modoQR,
    );

    if (nuevaPosicion !== palabraActivaRef.current) {
      palabraActivaRef.current = nuevaPosicion;
      setPalabraActiva(nuevaPosicion);
    }
  }, [transcripcion, modoLectura]);

  // Auto-scroll a la palabra activa
  useEffect(() => {
    if (palabraActiva < 0) return;
    const el = document.getElementById(`palabra-${palabraActiva}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [palabraActiva]);

  // ── Speech Recognition ──
  const crearRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r  = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = LANG_CODE[modoIdioma.leer];
    r.maxAlternatives = 3;
    r.onresult = (event) => {
      let final = '', interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        event.results[i].isFinal ? (final += t + ' ') : (interim += t);
      }
      const completo = (final + interim).trim();
      setTranscripcion(completo);
      transcripcionRef.current = completo;
      setPalabrasCount(completo.split(/\s+/).filter(Boolean).length);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech') return;
      if (e.error === 'audio-capture' || e.error === 'not-allowed') {
        setErrorMicrofono('Sin acceso al micrófono — verifica permisos');
        setEstadoMic('error');
      }
    };
    return r;
  }, [modoIdioma.leer]);

  useEffect(() => {
    if (modoQR) {
      // Modo celular: no activar micrófono del PC, solo mostrar la pantalla
      setEstadoMic('grabando');
      timerRef.current = setInterval(() => {
        setTiempoGrabacion(p => { tiempoRef.current = p + 1; return p + 1; });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    const iniciar = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current = crearRecognition();
        recognitionRef.current.start();
        setEstadoMic('grabando');
        timerRef.current = setInterval(() => {
          setTiempoGrabacion(p => { tiempoRef.current = p + 1; return p + 1; });
        }, 1000);
      } catch (err) {
        setErrorMicrofono(err.name === 'NotAllowedError'
          ? 'Permiso denegado — activa el micrófono en el navegador'
          : 'Micrófono no encontrado');
        setEstadoMic('error');
      }
    };
    iniciar();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (traduccionTimerRef.current) clearTimeout(traduccionTimerRef.current);
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, [crearRecognition]);

  const handleDetener = () => {
    setEstadoMic('deteniendo');
    if (timerRef.current) clearInterval(timerRef.current);
    try { recognitionRef.current?.stop(); } catch (_) {}
    setTimeout(() => onDetener(transcripcionRef.current, tiempoRef.current), 400);
  };

  // ── Badge modo ──
  const modoBadge = conTraduccion
    ? `${FLAG[modoIdioma.leer]} → ${FLAG[modoIdioma.traducir]}`
    : `${FLAG[modoIdioma.leer]} / ${FLAG[modoIdioma.traducir]}`;

  // ── Velocidad hint ──
  const velocidadHint =
    ppm === 0  ? '' :
    ppm < 80   ? 'Ritmo lento' :
    ppm < 120  ? 'Buen ritmo' :
    ppm < 160  ? '✓ Ideal' :
                 'Muy rápido';

  const palabrasReferencia = palabrasRefCache.current;

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <motion.div
      className="rfs-root"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── HUD SUPERIOR ── */}
      <div className="rfs-hud">
        <div className="rfs-hud-left">
          <div className={`rfs-rec-dot ${estadoMic === 'grabando' ? 'live' : ''}`} />
          <span className="rfs-hud-name">{alumno?.nombre || 'Alumno'}</span>
          <span className="rfs-hud-badge rfs-hud-badge--mode">
            {modoLectura === 'guiada' ? '📄 GUIADA' : '🎤 LIBRE'}
          </span>
          <span className="rfs-hud-badge rfs-hud-badge--lang">{modoBadge}</span>
        </div>

        <div className="rfs-hud-center">
          <span className="rfs-hud-timer">{fmt(tiempoGrabacion)}</span>
        </div>

        <div className="rfs-hud-right">
          {ppm > 0 && (
            <span className={`rfs-hud-ppm ${ppm >= 120 && ppm <= 160 ? 'ideal' : ''}`}>
              {ppm} <small>PPM</small>
            </span>
          )}
          {palabrasCount > 0 && (
            <span className="rfs-hud-words">{palabrasCount} <small>palabras</small></span>
          )}
          <RachaHUD racha={racha} />
          {modoLectura === 'guiada' && palabrasReferencia.length > 0 && palabraActiva >= 0 && (
            <span className="rfs-hud-badge rfs-hud-badge--mode">
              {Math.round(((palabraActiva + 1) / palabrasReferencia.length) * 100)}%
            </span>
          )}
          {/* En modo QR: botón para que el maestro detenga desde la PC */}
          {modoQR && (
            <button
              onClick={handleDetener}
              title="Detener grabación desde PC"
              style={{
                background:   'rgba(255,69,58,0.2)',
                border:       '1px solid rgba(255,69,58,0.5)',
                borderRadius: 20,
                padding:      '5px 12px',
                cursor:       'pointer',
                color:        '#ff453a',
                fontSize:     12,
                fontWeight:   700,
                display:      'flex',
                alignItems:   'center',
                gap:          5,
              }}
            >
              ⏹ Detener
            </button>
          )}
          <MuteButtonCompact style={{ marginRight: 4 }} />
          <button className="rfs-hud-cancel" onClick={onCancelar} title="Cancelar">✕</button>
        </div>
      </div>

      {/* ── ERROR ── */}
      <AnimatePresence>
        {errorMicrofono && (
          <motion.div className="rfs-error-bar"
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
            ⚠️ {errorMicrofono}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════
          LIENZO PRINCIPAL
          ════════════════════════════════════════════════════ */}
      <div className={`rfs-lienzo ${conTraduccion ? 'rfs-lienzo--split' : 'rfs-lienzo--mono'}`}>

        {/* ── PANEL IZQUIERDO ── */}
        <motion.div
          className="rfs-panel-izq"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {modoLectura === 'guiada' ? (
            <div className="rfs-guiado-wrap">
              <div className="rfs-section-label rfs-section-label--cyan">
                <span className="rfs-label-line" />
                TEXTO A LEER
                {modoLectura === 'guiada' && palabrasReferencia.length > 0 && (
                  <span className="rfs-progreso-badge">
                    {palabraActiva >= 0
                      ? `${palabraActiva + 1} / ${palabrasReferencia.length}`
                      : `0 / ${palabrasReferencia.length}`}
                  </span>
                )}
              </div>

              {/* ── TEXTO CON FUZZY HIGHLIGHT ── */}
              <div className="rfs-texto-lienzo">
                {palabrasReferencia.map((palabra, idx) => (
                  <span
                    key={idx}
                    id={`palabra-${idx}`}
                    className={`rfs-palabra ${
                      idx < palabraActiva  ? 'rfs-palabra--leida'  :
                      idx === palabraActiva ? 'rfs-palabra--activa' : ''
                    }`}
                  >
                    {palabra}{' '}
                  </span>
                ))}
              </div>

              {/* Voz del alumno */}
              <div className="rfs-voz-strip">
                <div className="rfs-section-label rfs-section-label--green">
                  <span className="rfs-label-line rfs-label-line--green" />
                  VOZ DEL ALUMNO
                  {estadoMic === 'grabando' && <div className="rfs-mic-live-dot" />}
                </div>
                <div className="rfs-voz-texto" ref={scrollVozRef}>
                  {transcripcion
                    ? <p>{transcripcion}</p>
                    : <p className="rfs-voz-placeholder">Esperando voz...</p>
                  }
                </div>
              </div>
            </div>

          ) : (
            /* ── MODO LIBRE ── */
            <div className="rfs-libre-wrap">
              <div className="rfs-section-label rfs-section-label--cyan">
                <span className="rfs-label-line" />
                TRANSCRIPCIÓN EN VIVO
                {estadoMic === 'grabando' && <div className="rfs-mic-live-dot" />}
              </div>

              <div className="rfs-libre-texto" ref={scrollVozRef}>
                {transcripcion ? (
                  <p className="rfs-libre-content">{transcripcion}</p>
                ) : (
                  <div className="rfs-libre-placeholder">
                    <div className="rfs-mic-rings">
                      <div className="rfs-ring rfs-ring--1" />
                      <div className="rfs-ring rfs-ring--2" />
                      <div className="rfs-ring rfs-ring--3" />
                      <span className="rfs-mic-emoji">🎙️</span>
                    </div>
                    <p>Comienza a hablar en {LANG_LABEL[modoIdioma.leer]}...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── DIVISOR ── */}
        {conTraduccion && (
          <div className="rfs-divisor">
            <div className="rfs-divisor-line" />
            <div className="rfs-divisor-orb">
              {traduciendo
                ? <div className="rfs-trad-spinner" />
                : <span>⇄</span>
              }
            </div>
            <div className="rfs-divisor-line" />
          </div>
        )}

        {/* ── PANEL DERECHO ── */}
        <AnimatePresence>
          {conTraduccion ? (
            <motion.div
              className="rfs-panel-der"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="rfs-section-label rfs-section-label--gold">
                <span className="rfs-label-line rfs-label-line--gold" />
                {`TRADUCCIÓN AL ${LANG_LABEL[modoIdioma.traducir].toUpperCase()}`}
                {traduciendo && (
                  <div className="rfs-typing-dots">
                    <span/><span/><span/>
                  </div>
                )}
              </div>

              <div className="rfs-trad-texto" ref={scrollTradRef}>
                {traduccion ? (
                  <motion.p
                    key={traduccion.slice(0, 20)}
                    className="rfs-trad-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    {traduccion}
                  </motion.p>
                ) : (
                  <div className="rfs-trad-placeholder">
                    <span className="rfs-trad-globe">🌐</span>
                    <p>
                      {traduciendo
                        ? `Traduciendo al ${LANG_LABEL[modoIdioma.traducir]}...`
                        : `La traducción aparecerá aquí mientras ${alumno?.nombre?.split(' ')[0] || 'el alumno'} lee`
                      }
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Panel métricas modo monolingüe */
            <motion.div
              className="rfs-panel-metricas"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="rfs-metrica-big">
                <span className="rfs-metrica-big-label">VELOCIDAD</span>
                <span className={`rfs-metrica-big-num ${ppm >= 120 && ppm <= 160 ? 'rfs-num--ideal' : ''}`}>
                  {ppm}
                </span>
                <span className="rfs-metrica-big-unit">PPM</span>
                {velocidadHint && (
                  <span className={`rfs-velocidad-hint ${ppm >= 120 && ppm <= 160 ? 'hint--ideal' : ''}`}>
                    {velocidadHint}
                  </span>
                )}
                <div className="rfs-ppm-barra">
                  <div className="rfs-ppm-fill" style={{ width: `${Math.min((ppm / 180) * 100, 100)}%` }} />
                </div>
                <div className="rfs-ppm-escala">
                  <span>0</span><span>60</span><span>120</span><span>180</span>
                </div>
              </div>

              <div className="rfs-metricas-row">
                <div className="rfs-metrica-mini">
                  <span className="rfs-metrica-mini-num rfs-num--green">{palabrasCount}</span>
                  <span className="rfs-metrica-mini-label">palabras</span>
                </div>
                <div className="rfs-metrica-mini">
                  <span className="rfs-metrica-mini-num rfs-num--gold">{ppmMax}</span>
                  <span className="rfs-metrica-mini-label">PPM máx.</span>
                </div>
              </div>

              {/* Progreso modo guiado en panel de métricas */}
              {modoLectura === 'guiada' && palabrasReferencia.length > 0 && (
                <div className="rfs-progreso-card">
                  <span className="rfs-metrica-big-label">PROGRESO</span>
                  <div className="rfs-prog-barra">
                    <div
                      className="rfs-prog-fill"
                      style={{
                        width: `${palabraActiva >= 0
                          ? Math.round(((palabraActiva + 1) / palabrasReferencia.length) * 100)
                          : 0}%`
                      }}
                    />
                  </div>
                  <span className="rfs-prog-pct">
                    {palabraActiva >= 0
                      ? `${Math.round(((palabraActiva + 1) / palabrasReferencia.length) * 100)}%`
                      : '0%'}
                  </span>
                </div>
              )}

              <div className="rfs-idioma-tag">
                Analizando en <strong>{LANG_LABEL[modoIdioma.leer]}</strong>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BARRA INFERIOR ── */}
      <motion.div
        className="rfs-barra-inferior"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rfs-waveform">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i}
              className={`rfs-wbar ${estadoMic === 'grabando' ? 'rfs-wbar--live' : ''}`}
              style={{ animationDelay: `${(i * 0.065).toFixed(3)}s` }}
            />
          ))}
        </div>

        <button
          className={`rfs-btn-detener ${estadoMic === 'deteniendo' ? 'loading' : ''}`}
          onClick={handleDetener}
          disabled={estadoMic !== 'grabando'}
        >
          {estadoMic === 'deteniendo' ? (
            <><div className="rfs-btn-spinner" /> ANALIZANDO...</>
          ) : (
            <><span>⏹</span> DETENER Y ANALIZAR</>
          )}
        </button>

        <div className="rfs-waveform rfs-waveform--flip">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i}
              className={`rfs-wbar ${estadoMic === 'grabando' ? 'rfs-wbar--live' : ''}`}
              style={{ animationDelay: `${(0.065 + i * 0.065).toFixed(3)}s` }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReadingFullscreen;