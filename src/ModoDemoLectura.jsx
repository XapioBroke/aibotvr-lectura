import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { analizarLecturaLocal } from './localAnalyzer';

const _fbConfig = {
  apiKey: "AIzaSyCPn0kMMrx4tRW1XJfrTenqPB08XzAc1x0",
  authDomain: "aibotvr1.firebaseapp.com",
  projectId: "aibotvr1",
  storageBucket: "aibotvr1.firebasestorage.app",
  messagingSenderId: "524453697028",
  appId: "1:524453697028:web:08d175b825238dbf590751"
};
const _fbApp = getApps().length ? getApps()[0] : initializeApp(_fbConfig);
const _auth  = getAuth(_fbApp);

// ── Textos de práctica ────────────────────────────────────────
const TEXTOS = [
  {
    id: 't1', nivel: 'Fácil', color: '#00C853',
    titulo: 'El agua y la vida',
    texto: 'El agua es esencial para todos los seres vivos. Cubre más del setenta por ciento de la superficie de la Tierra y constituye la mayor parte de nuestro cuerpo. Sin agua ningún organismo podría sobrevivir. Los ríos, lagos y océanos son hogar de millones de especies. Debemos cuidar este recurso tan valioso para las generaciones futuras.',
  },
  {
    id: 't2', nivel: 'Fácil', color: '#00C853',
    titulo: 'La selva amazónica',
    texto: 'La selva amazónica es el bosque tropical más grande del mundo. Se extiende por nueve países de América del Sur y alberga una biodiversidad increíble. En ella viven millones de especies de plantas, animales e insectos. El Amazonas produce una gran cantidad del oxígeno que respiramos. Por eso se le llama el pulmón del planeta.',
  },
  {
    id: 't3', nivel: 'Medio', color: '#FFB300',
    titulo: 'La Revolución Industrial',
    texto: 'La Revolución Industrial comenzó en Inglaterra a finales del siglo dieciocho y transformó radicalmente la sociedad. El invento de la máquina de vapor permitió mecanizar la producción y crear fábricas. Millones de personas migraron del campo a las ciudades en busca de trabajo. Este periodo marcó el inicio de la era moderna tal como la conocemos hoy en día.',
  },
  {
    id: 't4', nivel: 'Medio', color: '#FFB300',
    titulo: 'El sistema solar',
    texto: 'El sistema solar está compuesto por el Sol y todos los cuerpos celestes que orbitan a su alrededor. Los ocho planetas se dividen en interiores y exteriores. Además de los planetas, existen lunas, asteroides, cometas y planetas enanos. La gravedad del Sol es la fuerza que mantiene todo en órbita. La luz solar tarda aproximadamente ocho minutos en llegar a la Tierra.',
  },
  {
    id: 't5', nivel: 'Difícil', color: '#F44336',
    titulo: 'La fotosíntesis',
    texto: 'La fotosíntesis es el proceso mediante el cual las plantas, algas y algunas bacterias convierten la energía lumínica en energía química almacenada en glucosa. Este proceso ocurre principalmente en los cloroplastos, orgánulos que contienen clorofila, el pigmento que da el color verde a las plantas. Durante la fotosíntesis las plantas toman dióxido de carbono del aire y agua del suelo, y liberan oxígeno como subproducto esencial para la vida.',
  },
  {
    id: 't6', nivel: 'Difícil', color: '#F44336',
    titulo: 'IA en educación',
    texto: 'La inteligencia artificial está transformando profundamente el campo educativo. Los sistemas adaptativos de aprendizaje pueden analizar el desempeño individual de cada estudiante y ajustar el contenido y la dificultad de los ejercicios en tiempo real, permitiendo una experiencia verdaderamente personalizada. Sin embargo, la implementación masiva de la inteligencia artificial en las aulas plantea desafíos éticos importantes relacionados con la privacidad de los datos y la equidad en el acceso tecnológico.',
  },
];

// ── Normalizar para fuzzy matching ────────────────────────────
const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').trim();

// ── Similitud Levenshtein ─────────────────────────────────────
function similitud(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const m = Array.from({ length: nb.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= na.length; j++) m[0][j] = j;
  for (let i = 1; i <= nb.length; i++)
    for (let j = 1; j <= na.length; j++)
      m[i][j] = nb[i-1] === na[j-1]
        ? m[i-1][j-1]
        : 1 + Math.min(m[i-1][j], m[i][j-1], m[i-1][j-1]);
  return 1 - m[nb.length][na.length] / maxLen;
}

// ── Fuzzy word tracker tolerante ─────────────────────────────
// Umbral bajo (0.50) para aceptar variaciones de pronunciación
// Ventana amplia (6) para manejar omisiones y repeticiones
function calcularPosicion(palabrasRef, transcripcion) {
  const leidas = transcripcion.trim().split(/\s+/).filter(Boolean);
  if (!leidas.length) return 0;

  let posRef = 0; // posición en texto original
  let posLei = 0; // posición en lo leído

  while (posLei < leidas.length && posRef < palabrasRef.length) {
    const sim = similitud(leidas[posLei], palabrasRef[posRef]);

    if (sim >= 0.50) {
      // Coincidencia aceptable → avanzar ambos
      posRef++;
      posLei++;
    } else {
      // Buscar en ventana hacia adelante en el TEXTO (omisión del lector)
      let foundRef = false;
      for (let look = posRef + 1; look < Math.min(posRef + 6, palabrasRef.length); look++) {
        if (similitud(leidas[posLei], palabrasRef[look]) >= 0.55) {
          posRef = look + 1;
          posLei++;
          foundRef = true;
          break;
        }
      }

      if (!foundRef) {
        // Buscar en ventana hacia adelante en LO LEÍDO (inserción/repetición)
        let foundLei = false;
        for (let look = posLei + 1; look < Math.min(posLei + 3, leidas.length); look++) {
          if (similitud(leidas[look], palabrasRef[posRef]) >= 0.55) {
            posRef++;
            posLei = look + 1;
            foundLei = true;
            break;
          }
        }
        if (!foundLei) posLei++; // saltar palabra no reconocida
      }
    }
  }

  return Math.min(posRef, palabrasRef.length);
}

const ModoDemoLectura = ({ rol, onSalir }) => {
  const rolEfectivo = rol || localStorage.getItem('iapprende_rol') || 'invitado';
  const esAlumno    = rolEfectivo === 'alumno';
  const grupo       = localStorage.getItem('iapprende_grupo')   || '';
  const escuela     = localStorage.getItem('iapprende_escuela') || '';

  const [pantalla, setPantalla]     = useState('selector');
  const [textoSel, setTextoSel]     = useState(null);
  const [grabando, setGrabando]     = useState(false);
  const [transcripcion, setTrans]   = useState('');
  const [posActual, setPosActual]   = useState(0);
  const [segundos, setSegundos]     = useState(0);
  const [resultado, setResultado]   = useState(null);
  const [micError, setMicError]     = useState('');
  const [alumnos, setAlumnos]       = useState([]);
  const [cargMet, setCargMet]       = useState(false);
  const [periodo, setPeriodo]       = useState('tri1');

  const recRef      = useRef(null);
  const timerRef    = useRef(null);
  const transRef    = useRef('');
  const segsRef     = useRef(0);
  const grabandoRef = useRef(false);
  const palabrasRef = useRef([]);
  const posRef      = useRef(0);

  const cerrarSesion = async () => {
    detener();
    await signOut(_auth);
    ['iapprende_rol','iapprende_codigo','iapprende_grupo','iapprende_escuela','iapprende_proyecto']
      .forEach(k => localStorage.removeItem(k));
    window.location.replace('https://iapprende.com');
  };

  const elegirTexto = (t) => {
    detener(true); // detener mic Y resetear estado
    palabrasRef.current = t.texto.split(/\s+/).filter(Boolean);
    posRef.current = 0;
    setTextoSel(t);
    setResultado(null);
    setMicError('');
    setPantalla('practica');
  };

  // ── Detener micrófono (sin borrar transcripción) ────────────
  const detener = useCallback((resetear = false) => {
    grabandoRef.current = false;
    setGrabando(false);
    if (recRef.current) {
      try { recRef.current.stop(); } catch(_) {}
      recRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (resetear) {
      transRef.current = '';
      segsRef.current  = 0;
      setTrans('');
      setPosActual(0);
      setSegundos(0);
    }
  }, []);

  // ── Iniciar sesión de reconocimiento ─────────────────────
  const iniciarSesion = useCallback(() => {
    if (!grabandoRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError('Tu navegador no soporta reconocimiento de voz. Usa Chrome en escritorio.');
      detener();
      return;
    }

    const r = new SR();
    r.lang            = 'es-MX';
    r.continuous      = false;
    r.interimResults  = true;
    r.maxAlternatives = 1;
    recRef.current    = r;

    r.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        parcial += e.results[i][0].transcript;

      const total = (transRef.current + ' ' + parcial).trim();
      transRef.current = total; // ← SIEMPRE guardar en ref
      setTrans(total);

      const pos = calcularPosicion(palabrasRef.current, total);
      posRef.current = pos;
      setPosActual(pos);

      // Auto-completar si llegó al 95% del texto
      if (pos >= palabrasRef.current.length * 0.95) {
        transRef.current = total;
        finalizarLectura(total);
      }
    };

    r.onend = () => {
      // Guardar lo que hubo hasta ahora
      if (grabandoRef.current) {
        // Pequeña pausa antes de reiniciar para evitar loops
        setTimeout(() => {
          if (grabandoRef.current) iniciarSesion();
        }, 200);
      }
    };

    r.onerror = (e) => {
      if (['no-speech', 'aborted'].includes(e.error)) return;
      if (e.error === 'not-allowed') {
        setMicError('Permiso de micrófono denegado. Habilítalo en la configuración del navegador.');
        detener();
        return;
      }
      // Otros errores: reintentar
      if (grabandoRef.current) setTimeout(() => { if (grabandoRef.current) iniciarSesion(); }, 500);
    };

    try { r.start(); }
    catch(err) {
      if (grabandoRef.current) setTimeout(() => { if (grabandoRef.current) iniciarSesion(); }, 500);
    }
  }, [detener]);

  const iniciarGrabacion = useCallback((reanudar = false) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError('Tu navegador no soporta reconocimiento de voz. Usa Chrome en escritorio.');
      return;
    }
    setMicError('');
    grabandoRef.current = true;
    setGrabando(true);

    // Solo resetear si es inicio desde cero, NO si es reanudar
    if (!reanudar) {
      transRef.current = '';
      segsRef.current  = 0;
      posRef.current   = 0;
      setTrans('');
      setPosActual(0);
      setSegundos(0);
    }

    timerRef.current = setInterval(() => {
      segsRef.current++;
      setSegundos(segsRef.current);
    }, 1000);

    iniciarSesion();
  }, [iniciarSesion]);

  const finalizarLectura = useCallback((transOverride) => {
    const transRaw        = transOverride || transRef.current;
    const tiempoCapturado = segsRef.current > 0 ? segsRef.current : 1;
    detener();

    const palabrasTexto = (textoSel?.texto || '').split(/\s+/).filter(Boolean);
    const tiempoReal    = tiempoCapturado;

    // ── Calcular posición directamente desde transcripción ───
    // No depender de posRef.current (puede tener timing issues).
    // Recalcular aquí con toda la transcripción acumulada.
    const posConfirmada = calcularPosicion(palabrasTexto, transRaw);

    // ── PPM desde tracker (fuente de verdad, sin duplicados) ─
    // posConfirmada = cuántas palabras del texto original reconoció el tracker
    const ppmReal = posConfirmada > 0
      ? Math.round((posConfirmada / tiempoReal) * 60)
      : 0;

    // ── Precisión desde tracker ───────────────────────────────
    // Porcentaje de palabras del texto que el tracker confirmó como leídas
    const pctCobertura = palabrasTexto.length > 0
      ? (posConfirmada / palabrasTexto.length)
      : 0;

    // Convertir cobertura a puntuación 1-10
    const puntuacionPrecision = Math.min(10, Math.round(
      pctCobertura >= 0.95 ? 10 :
      pctCobertura >= 0.85 ? 9  :
      pctCobertura >= 0.75 ? 8  :
      pctCobertura >= 0.65 ? 7  :
      pctCobertura >= 0.55 ? 6  :
      pctCobertura >= 0.45 ? 5  :
      pctCobertura >= 0.35 ? 4  : 3
    ));

    const comentarioPrecision =
      puntuacionPrecision >= 9 ? `Precisión del ${Math.round(pctCobertura*100)}%. Seguiste el texto de referencia con gran fidelidad.` :
      puntuacionPrecision >= 7 ? `Precisión del ${Math.round(pctCobertura*100)}%. Leíste la mayor parte correctamente.` :
      puntuacionPrecision >= 5 ? `Precisión del ${Math.round(pctCobertura*100)}%. Varias palabras fueron omitidas o cambiadas.` :
      `Precisión del ${Math.round(pctCobertura*100)}%. Practica releer el texto antes de grabarte.`;

    // ── Fluidez desde PPM real ────────────────────────────────
    const puntuacionFluidez =
      ppmReal === 0           ? 1  :
      ppmReal < 60            ? 4  :
      ppmReal >= 60  && ppmReal < 90  ? 6  :
      ppmReal >= 90  && ppmReal < 120 ? 8  :
      ppmReal >= 120 && ppmReal <= 160 ? 10 :
      ppmReal >= 161 && ppmReal <= 200 ? 8  : 6;

    const comentarioFluidez =
      ppmReal === 0           ? 'No se detectó velocidad de lectura.' :
      ppmReal < 60            ? `Leíste a ${ppmReal} PPM. Velocidad muy lenta. El rango ideal es 120-150 PPM.` :
      ppmReal < 90            ? `Leíste a ${ppmReal} PPM. Velocidad por debajo del promedio. Practica con textos cronometrados.` :
      ppmReal < 120           ? `Leíste a ${ppmReal} PPM. Buen ritmo, estás acercándote al rango ideal de 120-150 PPM.` :
      ppmReal <= 160          ? `¡Excelente! ${ppmReal} PPM está en el rango ideal de lectura fluida.` :
      ppmReal <= 200          ? `Leíste a ${ppmReal} PPM, un poco rápido. A veces la velocidad afecta la comprensión.` :
                                `${ppmReal} PPM es muy rápido. Reduce el ritmo para mejorar la comprensión.`;

    // ── Pasar transcripción a localAnalyzer solo para dicción ─
    const analisis = analizarLecturaLocal({
      transcripcion:   transRaw,
      textoReferencia: textoSel?.texto || '',
      tiempoSegundos:  tiempoReal,
      modoLectura:     'libre', // libre = no calcula precisión (la calculamos nosotros)
      modoIdioma:      { leer: 'es' },
      alumnoNombre:    esAlumno ? `Alumno Grupo ${grupo}` : 'Invitado',
    }) || {};

    // ── Construir resultado final con valores propios ─────────
    const precision    = { puntuacion: puntuacionPrecision, comentario: comentarioPrecision };
    const fluidez      = { puntuacion: puntuacionFluidez,  comentario: comentarioFluidez };
    const diccion      = analisis.diccion      || { puntuacion: 6, comentario: 'Vocabulario detectado.' };
    const pausas       = { puntuacion: 7, comentario: 'Análisis de pausas disponible en modo IA.' };
    const expresividad = { puntuacion: 7, comentario: 'Análisis de expresividad disponible en modo IA.' };

    // ── Calificación ponderada ────────────────────────────────
    const suma =
      precision.puntuacion    * 0.40 +
      fluidez.puntuacion      * 0.30 +
      diccion.puntuacion      * 0.15 +
      pausas.puntuacion       * 0.08 +
      expresividad.puntuacion * 0.07;

    const calificacionFinal = Math.round(suma * 10) / 10;

    // ── Fortalezas y áreas a mejorar ─────────────────────────
    const fortalezas = [];
    const areasAMejorar = [];
    if (puntuacionPrecision >= 8) fortalezas.push('Alta fidelidad al texto de referencia');
    if (puntuacionFluidez   >= 8) fortalezas.push('Velocidad de lectura en rango ideal');
    if (diccion.puntuacion  >= 8) fortalezas.push('Buen vocabulario y variedad léxica');
    if (fortalezas.length === 0)  fortalezas.push('Completaste la lectura con esfuerzo y dedicación');
    if (puntuacionPrecision < 7)  areasAMejorar.push('Leer más despacio para seguir el texto con precisión');
    if (puntuacionFluidez   < 7)  areasAMejorar.push('Practicar la velocidad de lectura diariamente');
    if (diccion.puntuacion  < 6)  areasAMejorar.push('Ampliar el vocabulario con lectura variada');

    const comentarioGeneral =
      calificacionFinal >= 9  ? `¡Lectura sobresaliente! Demostraste dominio en fluidez y precisión.` :
      calificacionFinal >= 7  ? `Buena lectura. Los resultados muestran un lector en desarrollo con áreas de mejora.` :
      calificacionFinal >= 5  ? `Lectura en proceso de desarrollo. Se recomienda práctica diaria de 10-15 minutos.` :
                                `Necesita apoyo adicional en lectura. Comienza con textos más cortos y sencillos.`;

    setResultado({
      calificacionFinal,
      puntosGanados: Math.round((calificacionFinal / 10) * 30),
      palabrasPorMinuto: ppmReal,
      numeroPalabras: posConfirmada,
      comentarioGeneral,
      precision, fluidez, diccion, pausas, expresividad,
      fortalezas, areasAMejorar,
      modoAnalisis: 'local',
    });
    setPantalla('resultado');
  }, [detener, textoSel, esAlumno, grupo]);

  const finalizarManual = () => {
    // transRef.current ya está actualizado por onresult
    finalizarLectura(transRef.current);
  };

  useEffect(() => () => { detener(); }, []);

  // ── Métricas grupo ────────────────────────────────────────
  const cargarMetricas = async () => {
    if (!grupo || !escuela) return;
    setCargMet(true);
    try {
      const q = query(collection(db,'alumnos'), where('escuelaNombre','==',escuela), where('grupo','==',grupo));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setAlumnos(data.sort((a,b) => (b[periodo]||0)-(a[periodo]||0)));
    } catch(e) { console.error(e); }
    finally { setCargMet(false); }
  };

  // ── Render texto con colores ──────────────────────────────
  const renderTexto = () => {
    if (!textoSel) return null;
    return textoSel.texto.split(/\s+/).map((p, i) => {
      let color = 'rgba(255,255,255,0.55)';
      let bg    = 'transparent';
      let bold  = false;
      if (grabando || resultado) {
        if (i < posActual) {
          const leidas = transcripcion.trim().split(/\s+/);
          const sim = similitud(p, leidas[i] || '');
          color = sim >= 0.70 ? '#4CAF50' : '#EF5350';
        } else if (i === posActual && grabando) {
          bg    = 'rgba(14,165,233,0.2)';
          color = '#29B6F6';
          bold  = true;
        }
      }
      return (
        <span key={i} style={{ color, background:bg, borderRadius:'3px', padding:'1px 3px', fontWeight:bold?'700':'400', transition:'all .15s' }}>
          {p}{' '}
        </span>
      );
    });
  };

  const colorVal = (v) => v >= 80 ? '#4CAF50' : v >= 60 ? '#FFC107' : '#EF5350';
  const etiq     = (v) => v >= 80 ? 'Excelente' : v >= 60 ? 'Bien' : 'A mejorar';
  const min = Math.floor(segundos/60), seg = segundos%60;

  return (
    <div style={{ position:'fixed', inset:0, background:'#050c1a', color:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', background:'rgba(0,0,0,0.75)', borderBottom:'1px solid rgba(14,165,233,0.2)', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ color:'#29B6F6', fontWeight:'700', fontSize:'0.85rem' }}>📖 Lectura con IA</span>

        <div style={{ display:'flex', alignItems:'center', gap:'5px', background:esAlumno?'rgba(76,175,80,0.12)':'rgba(41,182,246,0.1)', border:`1px solid ${esAlumno?'#4CAF5044':'#29B6F644'}`, borderRadius:'100px', padding:'2px 10px' }}>
          <span style={{ fontSize:'0.68rem', color:esAlumno?'#4CAF50':'#29B6F6', fontWeight:'600' }}>
            {esAlumno ? '🎒 ALUMNO' : '🌐 INVITADO'}
          </span>
        </div>

        {esAlumno && grupo && (
          <div style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'100px', padding:'2px 10px' }}>
            <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.5)' }}>🏫 {escuela}</span>
            <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.25)' }}>·</span>
            <span style={{ fontSize:'0.65rem', color:'#29B6F6', fontWeight:'600' }}>Gpo {grupo}</span>
          </div>
        )}

        <div style={{ flex:1 }}/>

        {grabando && (
          <span style={{ fontFamily:'monospace', color:'#EF5350', fontSize:'0.82rem' }}>
            🔴 {min}:{String(seg).padStart(2,'0')}
          </span>
        )}

        {pantalla !== 'selector' && (
          <button onClick={() => { detener(); setPantalla('selector'); }}
            style={{ background:'rgba(255,193,7,0.1)', border:'1px solid #FFC10733', borderRadius:'6px', color:'#FFC107', fontSize:'0.62rem', padding:'3px 9px', cursor:'pointer' }}>
            ← Textos
          </button>
        )}
        {esAlumno && grupo && pantalla !== 'metricas' && (
          <button onClick={() => { detener(); setPantalla('metricas'); cargarMetricas(); }}
            style={{ background:'rgba(76,175,80,0.08)', border:'1px solid #4CAF5033', borderRadius:'6px', color:'#4CAF50', fontSize:'0.62rem', padding:'3px 9px', cursor:'pointer' }}>
            📊 Métricas
          </button>
        )}
        <button onClick={cerrarSesion}
          style={{ background:'rgba(239,83,80,0.1)', border:'1px solid rgba(239,83,80,0.25)', borderRadius:'6px', color:'#EF5350', fontSize:'0.62rem', padding:'3px 9px', cursor:'pointer' }}>
          Salir
        </button>
      </header>

      {/* ── CONTENIDO ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:'18px' }}>

        {/* ══ SELECTOR ══ */}
        {pantalla === 'selector' && (
          <>
            <div style={{ textAlign:'center', maxWidth:'680px' }}>
              <div style={{ fontSize:'2.2rem', marginBottom:'8px' }}>📚</div>
              <h2 style={{ color:'#29B6F6', fontSize:'clamp(1.1rem,3vw,1.7rem)', margin:'0 0 8px', fontFamily:'Georgia, serif' }}>Práctica de Lectura</h2>
              <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.85rem', margin:'0 0 12px', lineHeight:1.6 }}>
                {esAlumno
                  ? 'Lee el texto en voz alta. El motor analiza tu fluidez, precisión y velocidad usando análisis local en tiempo real.'
                  : 'Modo demo: practica lectura en voz alta con análisis automático local.'}
              </p>
              <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:'10px', textAlign:'left' }}>
                <span style={{ fontSize:'1.1rem', flexShrink:0 }}>🤖</span>
                <div>
                  <p style={{ color:'#a78bfa', fontSize:'0.74rem', fontWeight:'700', margin:'0 0 2px' }}>
                    Análisis con IA — disponible en clases autorizadas por docentes
                  </p>
                  <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.68rem', margin:0, lineHeight:1.5 }}>
                    El modo completo incluye retroalimentación de Claude IA, análisis semántico, generación de textos adaptativos y reporte detallado para el docente.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'12px', width:'100%', maxWidth:'820px' }}>
              {TEXTOS.map(t => (
                <button key={t.id} onClick={() => elegirTexto(t)}
                  style={{ background:'rgba(14,165,233,0.04)', border:`2px solid ${t.color}33`, borderRadius:'14px', padding:'16px', textAlign:'left', cursor:'pointer', color:'#fff', transition:'all .2s', display:'flex', flexDirection:'column', gap:'7px' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor=t.color; e.currentTarget.style.background='rgba(14,165,233,0.1)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor=t.color+'33'; e.currentTarget.style.background='rgba(14,165,233,0.04)'; e.currentTarget.style.transform='translateY(0)'; }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ background:t.color+'22', border:`1px solid ${t.color}55`, borderRadius:'100px', padding:'2px 9px', fontSize:'0.65rem', fontWeight:'700', color:t.color }}>{t.nivel}</span>
                    <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)' }}>{t.texto.split(/\s+/).length} palabras</span>
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'0.9rem', color:'#29B6F6', fontFamily:'Georgia, serif' }}>{t.titulo}</div>
                  <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.38)', lineHeight:1.5 }}>
                    {t.texto.substring(0,85)}...
                  </div>
                </button>
              ))}
            </div>

            {!esAlumno && (
              <div style={{ background:'rgba(41,182,246,0.04)', border:'1px solid rgba(41,182,246,0.12)', borderRadius:'10px', padding:'10px 16px', maxWidth:'460px', textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.38)', fontSize:'0.78rem', margin:0 }}>
                  💡 Solicita un código a tu docente para acceder a métricas del grupo y análisis completo.
                </p>
              </div>
            )}

            <button onClick={cerrarSesion}
              style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'rgba(255,255,255,0.3)', fontSize:'0.7rem', padding:'6px 16px', cursor:'pointer' }}>
              ← Volver al inicio
            </button>
          </>
        )}

        {/* ══ PRÁCTICA ══ */}
        {pantalla === 'practica' && textoSel && (
          <div style={{ width:'100%', maxWidth:'740px', display:'flex', flexDirection:'column', gap:'14px' }}>

            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ background:textoSel.color+'22', border:`1px solid ${textoSel.color}55`, borderRadius:'100px', padding:'2px 10px', fontSize:'0.66rem', fontWeight:'700', color:textoSel.color }}>{textoSel.nivel}</span>
              <h2 style={{ color:'#29B6F6', margin:0, fontSize:'1.2rem', fontFamily:'Georgia, serif' }}>{textoSel.titulo}</h2>
              {grabando && (
                <span style={{ marginLeft:'auto', fontSize:'0.72rem', color:'rgba(255,255,255,0.4)' }}>
                  {posActual}/{palabrasRef.current.length} palabras
                </span>
              )}
            </div>

            {!grabando && !resultado && (
              <div style={{ background:'rgba(41,182,246,0.07)', border:'1px solid rgba(41,182,246,0.18)', borderRadius:'10px', padding:'10px 14px', fontSize:'0.78rem', color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                🎙️ Presiona <strong style={{ color:'#29B6F6' }}>Iniciar lectura</strong> y lee el texto en voz alta a ritmo natural. Las palabras se colorearán conforme avances.
              </div>
            )}

            {micError && (
              <div style={{ background:'rgba(239,83,80,0.08)', border:'1px solid rgba(239,83,80,0.25)', borderRadius:'10px', padding:'10px 14px', fontSize:'0.78rem', color:'#EF9A9A' }}>
                ⚠️ {micError}
              </div>
            )}

            {/* Texto coloreado */}
            <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'20px', lineHeight:2.1, fontSize:'1.05rem', letterSpacing:'0.01em', minHeight:'140px' }}>
              {renderTexto()}
            </div>

            {/* Métricas en vivo */}
            {grabando && (
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                {[
                  { l:'Tiempo',    v:`${min}:${String(seg).padStart(2,'0')}`, c:'#29B6F6' },
                  { l:'Palabras',  v:`${posActual}/${palabrasRef.current.length}`, c:'#4CAF50' },
                  { l:'Velocidad', v: segundos>5 ? `${Math.round((posActual/segundos)*60)} PPM` : '--', c:'#FFC107' },
                ].map((m,i) => (
                  <div key={i} style={{ background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'8px 14px', textAlign:'center', flex:1, minWidth:'90px' }}>
                    <div style={{ fontSize:'1.1rem', fontWeight:'bold', color:m.c }}>{m.v}</div>
                    <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>{m.l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Transcripción en vivo */}
            {grabando && transcripcion && (
              <div style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'10px', padding:'10px 14px' }}>
                <p style={{ margin:'0 0 3px', fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', letterSpacing:'0.1em' }}>ESCUCHANDO...</p>
                <p style={{ margin:0, fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', lineHeight:1.5, fontStyle:'italic' }}>
                  "{transcripcion.split(' ').slice(-15).join(' ')}"
                </p>
              </div>
            )}

            {/* Botones */}
            <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
              {!grabando && (
                <button onClick={() => iniciarGrabacion(!!transcripcion)}
                  style={{ background:'#29B6F6', color:'#000', border:'none', borderRadius:'10px', padding:'12px 32px', fontSize:'0.95rem', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'7px', boxShadow:'0 0 18px rgba(41,182,246,0.35)' }}>
                  {transcripcion ? '▶️ Reanudar' : '🎙️ Iniciar lectura'}
                </button>
              )}
              {grabando && (
                <>
                  <button onClick={finalizarManual}
                    style={{ background:'#4CAF50', color:'#000', border:'none', borderRadius:'10px', padding:'12px 28px', fontSize:'0.92rem', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'7px' }}>
                    ✅ Finalizar
                  </button>
                  <button onClick={() => detener(false)}
                    style={{ background:'rgba(239,83,80,0.12)', border:'2px solid #EF5350', borderRadius:'10px', padding:'12px 20px', fontSize:'0.85rem', fontWeight:'600', cursor:'pointer', color:'#EF5350' }}>
                    ⏸ Pausar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ RESULTADO ══ */}
        {pantalla === 'resultado' && resultado && (
          <div style={{ width:'100%', maxWidth:'600px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'3rem', marginBottom:'6px' }}>
                {(resultado.calificacionFinal||0) >= 8 ? '🏆' : (resultado.calificacionFinal||0) >= 6 ? '👍' : '📚'}
              </div>
              <h2 style={{ color:'#29B6F6', margin:'0 0 4px', fontSize:'1.5rem', fontFamily:'Georgia, serif' }}>Análisis completado</h2>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.78rem', margin:0 }}>
                {textoSel?.titulo} · {min}:{String(seg).padStart(2,'0')} · {resultado.numeroPalabras||0} palabras
              </p>
            </div>

            {/* Calificación general */}
            <div style={{ background:'rgba(0,0,0,0.4)', border:`2px solid ${colorVal((resultado.calificacionFinal||0)*10)}55`, borderRadius:'16px', padding:'16px 24px', textAlign:'center', width:'100%' }}>
              <div style={{ fontSize:'3.5rem', fontWeight:'900', color:colorVal((resultado.calificacionFinal||0)*10) }}>
                {resultado.calificacionFinal || 0}<span style={{ fontSize:'1.5rem', opacity:0.6 }}>/10</span>
              </div>
              <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.5)', marginTop:'4px' }}>{resultado.comentarioGeneral || ''}</div>
              <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.25)', marginTop:'4px' }}>
                {resultado.palabrasPorMinuto||0} PPM · Análisis local
              </div>
            </div>

            {/* Categorías */}
            {resultado.precision && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'10px', width:'100%' }}>
                {[
                  { l:'Precisión',    v: resultado.precision?.puntuacion,   c: resultado.precision?.comentario },
                  { l:'Fluidez',      v: resultado.fluidez?.puntuacion,     c: resultado.fluidez?.comentario },
                  { l:'Dicción',      v: resultado.diccion?.puntuacion,     c: resultado.diccion?.comentario },
                  { l:'Pausas',       v: resultado.pausas?.puntuacion,      c: resultado.pausas?.comentario },
                  { l:'Expresividad', v: resultado.expresividad?.puntuacion,c: resultado.expresividad?.comentario },
                ].filter(m => m.v !== undefined).map((m,i) => (
                  <div key={i} style={{ background:'rgba(0,0,0,0.3)', border:`1px solid ${colorVal(m.v*10)}33`, borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                    <div style={{ fontSize:'1.4rem', fontWeight:'bold', color:colorVal(m.v*10) }}>{m.v}<span style={{ fontSize:'0.7rem', opacity:0.5 }}>/10</span></div>
                    <div style={{ fontSize:'0.62rem', color:colorVal(m.v*10), fontWeight:'600', margin:'1px 0' }}>{m.l}</div>
                    <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', lineHeight:1.4 }}>{(m.c||'').substring(0,60)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Fortalezas y áreas */}
            {(resultado.fortalezas?.length > 0 || resultado.areasAMejorar?.length > 0) && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', width:'100%' }}>
                {resultado.fortalezas?.length > 0 && (
                  <div style={{ background:'rgba(76,175,80,0.06)', border:'1px solid rgba(76,175,80,0.2)', borderRadius:'10px', padding:'12px' }}>
                    <p style={{ margin:'0 0 8px', fontSize:'0.65rem', color:'#4CAF50', fontWeight:'700', letterSpacing:'0.08em' }}>✅ FORTALEZAS</p>
                    {resultado.fortalezas.map((f,i) => <p key={i} style={{ margin:'0 0 4px', fontSize:'0.72rem', color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>· {f}</p>)}
                  </div>
                )}
                {resultado.areasAMejorar?.length > 0 && (
                  <div style={{ background:'rgba(239,83,80,0.06)', border:'1px solid rgba(239,83,80,0.2)', borderRadius:'10px', padding:'12px' }}>
                    <p style={{ margin:'0 0 8px', fontSize:'0.65rem', color:'#EF5350', fontWeight:'700', letterSpacing:'0.08em' }}>📈 A MEJORAR</p>
                    {resultado.areasAMejorar.map((a,i) => <p key={i} style={{ margin:'0 0 4px', fontSize:'0.72rem', color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>· {a}</p>)}
                  </div>
                )}
              </div>
            )}

            {/* Banner IA */}
            <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.18)', borderRadius:'10px', padding:'12px 14px', display:'flex', gap:'10px', width:'100%' }}>
              <span style={{ fontSize:'1rem', flexShrink:0 }}>🤖</span>
              <div>
                <p style={{ color:'#a78bfa', fontSize:'0.72rem', fontWeight:'700', margin:'0 0 2px' }}>Análisis con IA — solo en clases autorizadas</p>
                <p style={{ color:'rgba(255,255,255,0.28)', fontSize:'0.67rem', margin:0, lineHeight:1.5 }}>
                  Con acceso docente obtienes retroalimentación de Claude IA, análisis semántico profundo, textos adaptativos y reporte completo para el grupo.
                </p>
              </div>
            </div>

            {!esAlumno && <p style={{ color:'rgba(255,255,255,0.18)', fontSize:'0.68rem', margin:0 }}>Modo invitado — análisis no guardado</p>}

            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={() => elegirTexto(textoSel)}
                style={{ background:'rgba(41,182,246,0.1)', border:'2px solid #29B6F6', borderRadius:'9px', color:'#29B6F6', fontSize:'0.82rem', padding:'10px 20px', cursor:'pointer', fontWeight:'600' }}>
                🔄 Releer
              </button>
              <button onClick={() => setPantalla('selector')}
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'9px', color:'#fff', fontSize:'0.82rem', padding:'10px 20px', cursor:'pointer' }}>
                📚 Otros textos
              </button>
            </div>
          </div>
        )}

        {/* ══ MÉTRICAS GRUPO ══ */}
        {pantalla === 'metricas' && esAlumno && (
          <div style={{ width:'100%', maxWidth:'540px', display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ color:'#4CAF50', fontSize:'1.4rem', margin:'0 0 4px', fontFamily:'Georgia, serif' }}>📊 Métricas del Grupo</h2>
              <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.78rem', margin:0 }}>{escuela} · Grupo {grupo} · 🔒 Solo lectura</p>
            </div>
            <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', justifyContent:'center' }}>
              {[{id:'tri1',l:'Tri 1'},{id:'tri2',l:'Tri 2'},{id:'tri3',l:'Tri 3'}].map(p => (
                <button key={p.id} onClick={() => { setPeriodo(p.id); cargarMetricas(); }}
                  style={{ padding:'4px 12px', borderRadius:'100px', border:`1px solid ${periodo===p.id?'#4CAF50':'rgba(255,255,255,0.18)'}`, background:periodo===p.id?'rgba(76,175,80,0.18)':'transparent', color:periodo===p.id?'#4CAF50':'rgba(255,255,255,0.38)', cursor:'pointer', fontSize:'0.68rem', fontWeight:'600', transition:'all .2s' }}>
                  {p.l}
                </button>
              ))}
            </div>
            {cargMet ? <p style={{ color:'rgba(255,255,255,0.35)', textAlign:'center' }}>Cargando...</p> : (
              <div style={{ maxHeight:'55vh', overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' }}>
                  <thead>
                    <tr style={{ background:'rgba(76,175,80,0.08)', color:'#4CAF50', textAlign:'left' }}>
                      <th style={{ padding:'9px 10px', borderBottom:'2px solid rgba(76,175,80,0.25)' }}>#</th>
                      <th style={{ padding:'9px 10px', borderBottom:'2px solid rgba(76,175,80,0.25)' }}>Alumno</th>
                      <th style={{ padding:'9px 10px', borderBottom:'2px solid rgba(76,175,80,0.25)', textAlign:'right' }}>XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.map((a,i) => (
                      <tr key={a.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'8px 10px', color:i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'#fff', fontWeight:'bold' }}>#{i+1}</td>
                        <td style={{ padding:'8px 10px', color:'#fff' }}>{a.nombre}</td>
                        <td style={{ padding:'8px 10px', color:'#4CAF50', fontWeight:'bold', textAlign:'right' }}>{a[periodo]||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color:'rgba(255,255,255,0.15)', fontSize:'0.67rem', textAlign:'center', marginTop:'10px' }}>🔒 Solo lectura</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModoDemoLectura;
