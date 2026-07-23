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
    id: 't1', nivel: 'Fácil', color: '#00FF41',
    titulo: 'El agua y la vida',
    texto: 'El agua es esencial para todos los seres vivos. Cubre más del setenta por ciento de la superficie de la Tierra y constituye la mayor parte de nuestro cuerpo. Sin agua ningún organismo podría sobrevivir. Los ríos lagos y océanos son hogar de millones de especies. Debemos cuidar este recurso tan valioso para las generaciones futuras.',
  },
  {
    id: 't2', nivel: 'Fácil', color: '#00FF41',
    titulo: 'La selva amazónica',
    texto: 'La selva amazónica es el bosque tropical más grande del mundo. Se extiende por nueve países de América del Sur y alberga una biodiversidad increíble. En ella viven millones de especies de plantas animales e insectos. El Amazonas produce una gran cantidad del oxígeno que respiramos. Por eso se le llama el pulmón del planeta.',
  },
  {
    id: 't3', nivel: 'Medio', color: '#FFD700',
    titulo: 'La Revolución Industrial',
    texto: 'La Revolución Industrial comenzó en Inglaterra a finales del siglo dieciocho y transformó radicalmente la sociedad. El invento de la máquina de vapor permitió mecanizar la producción y crear fábricas. Millones de personas migraron del campo a las ciudades en busca de trabajo. Este periodo marcó el inicio de la era moderna tal como la conocemos hoy en día.',
  },
  {
    id: 't4', nivel: 'Medio', color: '#FFD700',
    titulo: 'El sistema solar',
    texto: 'El sistema solar está compuesto por el Sol y todos los cuerpos celestes que orbitan a su alrededor. Los ocho planetas se dividen en interiores y exteriores. Además de los planetas existen lunas asteroides cometas y planetas enanos. La gravedad del Sol es la fuerza que mantiene todo en órbita. La luz solar tarda aproximadamente ocho minutos en llegar a la Tierra.',
  },
  {
    id: 't5', nivel: 'Difícil', color: '#FF4444',
    titulo: 'La fotosíntesis',
    texto: 'La fotosíntesis es el proceso mediante el cual las plantas algas y algunas bacterias convierten la energía lumínica en energía química almacenada en glucosa. Este proceso ocurre principalmente en los cloroplastos orgánulos que contienen clorofila el pigmento que da el color verde a las plantas. Durante la fotosíntesis las plantas toman dióxido de carbono del aire y agua del suelo y liberan oxígeno como subproducto esencial para la vida.',
  },
  {
    id: 't6', nivel: 'Difícil', color: '#FF4444',
    titulo: 'Inteligencia Artificial en educación',
    texto: 'La inteligencia artificial está transformando profundamente el campo educativo. Los sistemas adaptativos de aprendizaje pueden analizar el desempeño individual de cada estudiante y ajustar el contenido y la dificultad de los ejercicios en tiempo real permitiendo una experiencia verdaderamente personalizada. Sin embargo la implementación masiva de la inteligencia artificial en las aulas plantea desafíos éticos importantes relacionados con la privacidad de los datos y la equidad en el acceso tecnológico.',
  },
];

// ── Normalizar palabra para comparación ───────────────────────
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

// ── Calcular métricas locales ─────────────────────────────────
function calcularMetricas(palabrasRef, palabrasLeidas, segundos) {
  if (!palabrasLeidas.length) return { precision: 0, ppm: 0, fluidez: 0, errores: [] };
  let correctas = 0;
  const errores = [];
  const limite = Math.min(palabrasRef.length, palabrasLeidas.length);
  for (let i = 0; i < limite; i++) {
    const a = norm(palabrasRef[i] || '');
    const b = norm(palabrasLeidas[i] || '');
    if (a === b) { correctas++; }
    else { errores.push({ pos: i, esperada: palabrasRef[i], dicha: palabrasLeidas[i] }); }
  }
  const precision  = Math.round((correctas / limite) * 100);
  const ppm        = segundos > 0 ? Math.round((palabrasLeidas.length / segundos) * 60) : 0;
  const fluidez    = Math.min(100, Math.round((precision * 0.6) + (Math.min(ppm, 120) / 120 * 40)));
  return { precision, ppm, fluidez, errores };
}

const ModoDemoLectura = ({ rol, onSalir }) => {
  const rolEfectivo = rol || localStorage.getItem('iapprende_rol') || 'invitado';
  const esAlumno    = rolEfectivo === 'alumno';
  const grupo       = localStorage.getItem('iapprende_grupo')   || '';
  const escuela     = localStorage.getItem('iapprende_escuela') || '';

  // ── Estado principal ──────────────────────────────────────
  const [pantalla, setPantalla] = useState('selector'); // selector|practica|resultado|metricas
  const [textoSel, setTextoSel] = useState(null);

  // ── Estado de grabación ───────────────────────────────────
  const [grabando, setGrabando]         = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [palabrasLeidas, setPalabrasLeidas] = useState([]);
  const [posActual, setPosActual]       = useState(0);
  const [segundos, setSegundos]         = useState(0);
  const [completado, setCompletado]     = useState(false);
  const [resultado, setResultado]       = useState(null);

  // ── Refs ──────────────────────────────────────────────────
  const recognitionRef = useRef(null);
  const timerRef       = useRef(null);
  const palabrasRef    = useRef([]);
  const transRef       = useRef('');
  const posRef         = useRef(0);

  // ── Métricas grupo ────────────────────────────────────────
  const [alumnos, setAlumnos]   = useState([]);
  const [cargMet, setCargMet]   = useState(false);
  const [periodo, setPeriodo]   = useState('tri1');

  const cerrarSesion = async () => {
    detenerGrabacion();
    await signOut(_auth);
    ['iapprende_rol','iapprende_codigo','iapprende_grupo','iapprende_escuela','iapprende_proyecto']
      .forEach(k => localStorage.removeItem(k));
    window.location.replace('https://iapprende.com');
  };

  const elegirTexto = (t) => {
    setTextoSel(t);
    palabrasRef.current = t.texto.split(/\s+/).filter(Boolean);
    setTranscripcion('');
    setPalabrasLeidas([]);
    setPosActual(0);
    posRef.current = 0;
    transRef.current = '';
    setSegundos(0);
    setCompletado(false);
    setResultado(null);
    setPantalla('practica');
  };

  // ── Web Speech API ────────────────────────────────────────
  const iniciarGrabacion = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome.'); return; }

    const r = new SR();
    r.continuous        = false;
    r.interimResults    = true;
    r.lang              = 'es-MX';
    r.maxAlternatives   = 1;

    r.onresult = (e) => {
      let texto = '';
      for (let i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript;
      transRef.current = (transRef.current + ' ' + texto).trim();
      setTranscripcion(transRef.current);

      // Actualizar posición en el texto
      const leidas = transRef.current.split(/\s+/).filter(Boolean);
      setPalabrasLeidas(leidas);
      posRef.current = Math.min(leidas.length, palabrasRef.current.length);
      setPosActual(posRef.current);

      // ¿Completó el texto?
      if (leidas.length >= palabrasRef.current.length * 0.9) {
        terminarLectura(leidas);
      }
    };

    r.onend = () => {
      if (grabando && !completado) {
        // Reiniciar automáticamente para grabación continua
        try { r.start(); } catch(_) {}
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('SR error:', e.error);
    };

    recognitionRef.current = r;
    try { r.start(); } catch(_) {}
    setGrabando(true);

    // Timer
    timerRef.current = setInterval(() => {
      setSegundos(s => s + 1);
    }, 1000);
  }, [grabando, completado]);

  const detenerGrabacion = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(_) {}
      recognitionRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setGrabando(false);
  }, []);

  const terminarLectura = useCallback((leidas) => {
    detenerGrabacion();
    setCompletado(true);
    const pals = leidas || palabrasLeidas;
    const met  = calcularMetricas(palabrasRef.current, pals, segundos);
    setResultado(met);
    setPantalla('resultado');
  }, [palabrasLeidas, segundos, detenerGrabacion]);

  const finalizarManual = () => {
    const leidas = transRef.current.split(/\s+/).filter(Boolean);
    terminarLectura(leidas);
  };

  useEffect(() => {
    return () => { detenerGrabacion(); };
  }, []);

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

  // ── Colores métricas ──────────────────────────────────────
  const colorMetrica = (v) => v >= 80 ? '#00FF41' : v >= 60 ? '#FFD700' : '#FF4444';
  const etiqueta = (v) => v >= 80 ? 'Excelente' : v >= 60 ? 'Bien' : 'A mejorar';
  const minutos  = Math.floor(segundos / 60);
  const segs     = segundos % 60;

  // ── Palabras coloreadas del texto ─────────────────────────
  const renderTextoColoreado = () => {
    if (!textoSel) return null;
    const pals = textoSel.texto.split(/\s+/);
    return pals.map((p, i) => {
      let color = 'rgba(255,255,255,0.5)';
      let bg    = 'transparent';
      if (i < posActual) {
        const a = norm(p), b = norm((palabrasLeidas[i] || ''));
        color = a === b ? '#00FF41' : '#FF4444';
      } else if (i === posActual) {
        bg    = 'rgba(14,165,233,0.25)';
        color = '#0ea5e9';
      }
      return (
        <span key={i} style={{ color, background:bg, borderRadius:'3px', padding:'0 2px', transition:'color .2s' }}>
          {p}{' '}
        </span>
      );
    });
  };

  return (
    <div style={{ background:'#050c1a', minHeight:'100vh', color:'#fff', fontFamily:'Georgia, serif', display:'flex', flexDirection:'column' }}>

      {/* ── HEADER ── */}
      <header style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 16px', background:'rgba(0,0,0,0.7)', borderBottom:'1px solid rgba(14,165,233,0.25)', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ color:'#0ea5e9', fontWeight:'bold', fontSize:'0.88rem' }}>📖 Lectura con IA</span>

        {/* Badge de rol + datos del alumno */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', background: esAlumno?'rgba(0,255,65,0.1)':'rgba(0,255,255,0.1)', border:`1px solid ${esAlumno?'#00FF41':'#00FFFF'}33`, borderRadius:'100px', padding:'3px 10px' }}>
          <span style={{ fontSize:'0.72rem', color: esAlumno?'#00FF41':'#00FFFF', fontWeight:'600', fontFamily:'system-ui' }}>
            {esAlumno ? '🎒 ALUMNO' : '🌐 INVITADO'}
          </span>
        </div>

        {/* Info escuela/grupo — siempre visible si existe */}
        {esAlumno && grupo && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'100px', padding:'3px 12px' }}>
            <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.6)', fontFamily:'system-ui' }}>
              🏫 {escuela}
            </span>
            <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', fontFamily:'system-ui' }}>·</span>
            <span style={{ fontSize:'0.68rem', color:'#0ea5e9', fontFamily:'system-ui', fontWeight:'600' }}>
              Grupo {grupo}
            </span>
          </div>
        )}

        <div style={{ flex:1 }}/>

        {pantalla === 'practica' && grabando && (
          <span style={{ fontFamily:'monospace', color:'#FF4444', fontSize:'0.85rem', animation:'pulse 1s infinite' }}>
            🔴 {minutos}:{String(segs).padStart(2,'0')}
          </span>
        )}

        {pantalla !== 'selector' && (
          <button onClick={() => { detenerGrabacion(); setPantalla('selector'); }}
            style={{ background:'rgba(255,200,0,0.12)', border:'1px solid #FFC80033', borderRadius:'6px', color:'#FFC800', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer', fontFamily:'system-ui' }}>
            ← Textos
          </button>
        )}

        {esAlumno && grupo && pantalla !== 'metricas' && (
          <button onClick={() => { setPantalla('metricas'); cargarMetricas(); }}
            style={{ background:'rgba(0,255,65,0.08)', border:'1px solid #00FF4133', borderRadius:'6px', color:'#00FF41', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer', fontFamily:'system-ui' }}>
            📊 Métricas
          </button>
        )}

        <button onClick={cerrarSesion}
          style={{ background:'rgba(255,69,58,0.12)', border:'1px solid rgba(255,69,58,0.25)', borderRadius:'6px', color:'#ff453a', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer', fontFamily:'system-ui' }}>
          Salir
        </button>
      </header>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>

        {/* ══ SELECTOR DE TEXTOS ══ */}
        {pantalla === 'selector' && (
          <>
            <div style={{ textAlign:'center', maxWidth:'640px' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'8px' }}>📚</div>
              <h2 style={{ color:'#0ea5e9', fontSize:'clamp(1.2rem,3vw,1.8rem)', margin:'0 0 8px' }}>Práctica de Lectura</h2>
              <p style={{ color:'rgba(255,255,255,0.45)', fontFamily:'system-ui', fontSize:'0.88rem', margin:'0 0 12px', lineHeight:1.6 }}>
                {esAlumno
                  ? 'Lee el texto en voz alta. El motor analiza tu fluidez, precisión y velocidad en tiempo real usando análisis local.'
                  : 'Modo demo: practica lectura en voz alta con análisis local automático.'}
              </p>
              {/* Banner IA */}
              <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:'12px', padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:'10px', textAlign:'left' }}>
                <span style={{ fontSize:'1.2rem', flexShrink:0 }}>🤖</span>
                <div>
                  <p style={{ color:'#a78bfa', fontFamily:'system-ui', fontSize:'0.78rem', fontWeight:'700', margin:'0 0 2px' }}>
                    Análisis con IA en tiempo real — disponible en clases autorizadas
                  </p>
                  <p style={{ color:'rgba(255,255,255,0.35)', fontFamily:'system-ui', fontSize:'0.72rem', margin:0, lineHeight:1.5 }}>
                    El modo completo incluye retroalimentación de Claude IA, análisis semántico profundo, generación automática de textos personalizados y métricas avanzadas de comprensión. Disponible para docentes con acceso institucional @jaliscoedu.mx.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'14px', width:'100%', maxWidth:'860px' }}>
              {TEXTOS.map(t => (
                <button key={t.id} onClick={() => elegirTexto(t)}
                  style={{ background:'rgba(14,165,233,0.05)', border:`2px solid ${t.color}33`, borderRadius:'16px', padding:'18px', textAlign:'left', cursor:'pointer', color:'#fff', transition:'all .2s', display:'flex', flexDirection:'column', gap:'8px' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor=t.color; e.currentTarget.style.background='rgba(14,165,233,0.1)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor=t.color+'33'; e.currentTarget.style.background='rgba(14,165,233,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ background:t.color+'22', border:`1px solid ${t.color}55`, borderRadius:'100px', padding:'2px 10px', fontSize:'0.68rem', fontWeight:'700', color:t.color, fontFamily:'system-ui' }}>{t.nivel}</span>
                    <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', fontFamily:'system-ui' }}>{t.texto.split(/\s+/).length} palabras</span>
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'0.95rem', color:'#0ea5e9' }}>{t.titulo}</div>
                  <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', lineHeight:1.5 }}>
                    {t.texto.substring(0,90)}...
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px' }}>
                    <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', fontFamily:'system-ui' }}>🎙️ Análisis local en tiempo real</span>
                  </div>
                </button>
              ))}
            </div>

            {!esAlumno && (
              <div style={{ background:'rgba(0,255,255,0.04)', border:'1px solid rgba(0,255,255,0.12)', borderRadius:'10px', padding:'12px 18px', maxWidth:'480px', textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', fontSize:'0.8rem', margin:0 }}>
                  💡 Solicita un código a tu docente para acceder a métricas del grupo y análisis completo con IA.
                </p>
              </div>
            )}

            <button onClick={cerrarSesion}
              style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'rgba(255,255,255,0.3)', fontSize:'0.72rem', padding:'7px 18px', cursor:'pointer', fontFamily:'system-ui' }}>
              ← Volver al inicio
            </button>
          </>
        )}

        {/* ══ PRÁCTICA DE LECTURA ══ */}
        {pantalla === 'practica' && textoSel && (
          <div style={{ width:'100%', maxWidth:'760px', display:'flex', flexDirection:'column', gap:'16px' }}>

            {/* Título y nivel */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <span style={{ background:textoSel.color+'22', border:`1px solid ${textoSel.color}55`, borderRadius:'100px', padding:'3px 12px', fontSize:'0.7rem', fontWeight:'700', color:textoSel.color, fontFamily:'system-ui' }}>{textoSel.nivel}</span>
              <h2 style={{ color:'#0ea5e9', margin:0, fontSize:'1.3rem' }}>{textoSel.titulo}</h2>
            </div>

            {/* Instrucción */}
            {!grabando && !completado && (
              <div style={{ background:'rgba(14,165,233,0.08)', border:'1px solid rgba(14,165,233,0.2)', borderRadius:'10px', padding:'12px 16px', fontFamily:'system-ui', fontSize:'0.82rem', color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>
                📋 <strong style={{ color:'#0ea5e9' }}>Instrucciones:</strong> Lee el texto en voz alta a un ritmo natural. Las palabras se irán coloreando en verde (correctas) o rojo (error). Cuando termines, presiona "Finalizar".
              </div>
            )}

            {/* Texto coloreado */}
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'24px', lineHeight:2.0, fontSize:'1.1rem', letterSpacing:'0.01em' }}>
              {grabando || completado ? renderTextoColoreado() : (
                <span style={{ color:'rgba(255,255,255,0.6)' }}>{textoSel.texto}</span>
              )}
            </div>

            {/* Métricas en tiempo real */}
            {grabando && (
              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
                {[
                  { label:'Palabras leídas', valor: posActual, total: palabrasRef.current.length, unit:'' },
                  { label:'Tiempo', valor: `${minutos}:${String(segs).padStart(2,'0')}`, unit:'' },
                  { label:'Velocidad aprox.', valor: segundos > 5 ? Math.round((posActual/segundos)*60) : '--', unit:' PPM' },
                ].map((m,i) => (
                  <div key={i} style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(14,165,233,0.2)', borderRadius:'10px', padding:'10px 16px', textAlign:'center', minWidth:'110px' }}>
                    <div style={{ fontSize:'1.3rem', fontWeight:'bold', color:'#0ea5e9', fontFamily:'system-ui' }}>{m.valor}{m.unit}</div>
                    <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', marginTop:'2px' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Transcripción en vivo */}
            {grabando && transcripcion && (
              <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'12px 16px' }}>
                <p style={{ margin:'0 0 4px', fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', fontFamily:'system-ui', letterSpacing:'0.1em' }}>ESCUCHANDO...</p>
                <p style={{ margin:0, fontSize:'0.82rem', color:'rgba(255,255,255,0.55)', fontFamily:'system-ui', lineHeight:1.5, fontStyle:'italic' }}>
                  "{transcripcion.split(' ').slice(-20).join(' ')}"
                </p>
              </div>
            )}

            {/* Botones */}
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              {!grabando && !completado && (
                <button onClick={iniciarGrabacion}
                  style={{ background:'#0ea5e9', color:'#fff', border:'none', borderRadius:'12px', padding:'14px 36px', fontSize:'1rem', fontWeight:'700', cursor:'pointer', fontFamily:'system-ui', boxShadow:'0 0 20px rgba(14,165,233,0.4)', display:'flex', alignItems:'center', gap:'8px' }}>
                  🎙️ Iniciar lectura
                </button>
              )}
              {grabando && (
                <>
                  <button onClick={finalizarManual}
                    style={{ background:'#00FF41', color:'#000', border:'none', borderRadius:'12px', padding:'14px 36px', fontSize:'1rem', fontWeight:'700', cursor:'pointer', fontFamily:'system-ui', display:'flex', alignItems:'center', gap:'8px' }}>
                    ✅ Finalizar
                  </button>
                  <button onClick={detenerGrabacion}
                    style={{ background:'rgba(255,69,58,0.15)', border:'2px solid #ff453a', borderRadius:'12px', padding:'14px 24px', fontSize:'0.9rem', fontWeight:'600', cursor:'pointer', fontFamily:'system-ui', color:'#ff453a' }}>
                    ⏹ Pausar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ RESULTADO ══ */}
        {pantalla === 'resultado' && resultado && (
          <div style={{ width:'100%', maxWidth:'620px', display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'3.5rem', marginBottom:'8px' }}>
                {resultado.fluidez >= 80 ? '🏆' : resultado.fluidez >= 60 ? '👍' : '📚'}
              </div>
              <h2 style={{ color:'#0ea5e9', margin:'0 0 4px', fontSize:'1.6rem' }}>Análisis completado</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', fontSize:'0.82rem', margin:0 }}>
                {textoSel.titulo} · {minutos}:{String(segs).padStart(2,'0')} de lectura
              </p>
            </div>

            {/* Métricas principales */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', width:'100%' }}>
              {[
                { label:'Precisión', valor: resultado.precision, unit:'%', desc:'Palabras correctas' },
                { label:'Velocidad', valor: resultado.ppm, unit:' PPM', desc:'Palabras por minuto' },
                { label:'Fluidez', valor: resultado.fluidez, unit:'%', desc:'Índice general' },
              ].map((m,i) => (
                <div key={i} style={{ background:'rgba(0,0,0,0.4)', border:`1px solid ${colorMetrica(m.valor)}44`, borderRadius:'14px', padding:'16px', textAlign:'center' }}>
                  <div style={{ fontSize:'2rem', fontWeight:'900', color:colorMetrica(m.valor), fontFamily:'system-ui' }}>{m.valor}{m.unit}</div>
                  <div style={{ fontSize:'0.78rem', color:colorMetrica(m.valor), fontFamily:'system-ui', fontWeight:'600', margin:'2px 0' }}>{etiqueta(m.valor)}</div>
                  <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', fontFamily:'system-ui' }}>{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Errores */}
            {resultado.errores.length > 0 && (
              <div style={{ width:'100%', background:'rgba(255,69,58,0.06)', border:'1px solid rgba(255,69,58,0.2)', borderRadius:'12px', padding:'16px' }}>
                <p style={{ margin:'0 0 10px', fontSize:'0.75rem', color:'#ff453a', fontFamily:'system-ui', fontWeight:'700', letterSpacing:'0.08em' }}>
                  PALABRAS A MEJORAR ({Math.min(resultado.errores.length, 5)} de {resultado.errores.length})
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                  {resultado.errores.slice(0,5).map((e,i) => (
                    <div key={i} style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'6px 10px', fontFamily:'system-ui', fontSize:'0.78rem' }}>
                      <span style={{ color:'#ff453a' }}>{e.dicha || '(omitida)'}</span>
                      <span style={{ color:'rgba(255,255,255,0.3)', margin:'0 4px' }}>→</span>
                      <span style={{ color:'#00FF41' }}>{e.esperada}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Banner IA */}
            <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'10px', width:'100%' }}>
              <span style={{ fontSize:'1.1rem', flexShrink:0 }}>🤖</span>
              <div>
                <p style={{ color:'#a78bfa', fontFamily:'system-ui', fontSize:'0.75rem', fontWeight:'700', margin:'0 0 2px' }}>
                  Análisis con IA — solo en clases autorizadas por docentes
                </p>
                <p style={{ color:'rgba(255,255,255,0.3)', fontFamily:'system-ui', fontSize:'0.7rem', margin:0, lineHeight:1.5 }}>
                  El modo completo incluye retroalimentación semántica de Claude IA, análisis de entonación, detección de pausas, generación de textos adaptativos y reporte para el docente.
                </p>
              </div>
            </div>

            {!esAlumno && <p style={{ color:'rgba(255,255,255,0.2)', fontFamily:'system-ui', fontSize:'0.72rem', margin:0 }}>Modo invitado — análisis no guardado</p>}

            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={() => elegirTexto(textoSel)}
                style={{ background:'rgba(14,165,233,0.12)', border:'2px solid #0ea5e9', borderRadius:'10px', color:'#0ea5e9', fontFamily:'system-ui', fontSize:'0.85rem', padding:'11px 22px', cursor:'pointer', fontWeight:'600' }}>
                🔄 Releer texto
              </button>
              <button onClick={() => setPantalla('selector')}
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'#fff', fontFamily:'system-ui', fontSize:'0.85rem', padding:'11px 22px', cursor:'pointer' }}>
                📚 Otros textos
              </button>
            </div>
          </div>
        )}

        {/* ══ MÉTRICAS GRUPO (solo alumno) ══ */}
        {pantalla === 'metricas' && esAlumno && (
          <div style={{ width:'100%', maxWidth:'560px', display:'flex', flexDirection:'column', gap:'16px' }}>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ color:'#00FF41', fontFamily:'system-ui', fontSize:'1.5rem', margin:'0 0 4px', fontWeight:'700' }}>📊 Métricas del Grupo</h2>
              <p style={{ color:'rgba(255,255,255,0.35)', fontFamily:'system-ui', fontSize:'0.82rem', margin:0 }}>{escuela} · Grupo {grupo} · 🔒 Solo lectura</p>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
              {[{id:'tri1',l:'Tri 1'},{id:'tri2',l:'Tri 2'},{id:'tri3',l:'Tri 3'}].map(p => (
                <button key={p.id} onClick={() => { setPeriodo(p.id); cargarMetricas(); }}
                  style={{ padding:'5px 12px', borderRadius:'100px', border:`1px solid ${periodo===p.id?'#00FF41':'rgba(255,255,255,0.2)'}`, background:periodo===p.id?'rgba(0,255,65,0.2)':'transparent', color:periodo===p.id?'#00FF41':'rgba(255,255,255,0.4)', cursor:'pointer', fontFamily:'system-ui', fontSize:'0.7rem', fontWeight:'600', transition:'all .2s' }}>
                  {p.l}
                </button>
              ))}
            </div>
            {cargMet ? <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', textAlign:'center' }}>Cargando...</p> : (
              <div style={{ maxHeight:'50vh', overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'system-ui', fontSize:'0.95rem' }}>
                  <thead>
                    <tr style={{ background:'rgba(0,255,65,0.1)', color:'#00FF41', textAlign:'left' }}>
                      <th style={{ padding:'9px 12px', borderBottom:'2px solid rgba(0,255,65,0.3)' }}>#</th>
                      <th style={{ padding:'9px 12px', borderBottom:'2px solid rgba(0,255,65,0.3)' }}>Alumno</th>
                      <th style={{ padding:'9px 12px', borderBottom:'2px solid rgba(0,255,65,0.3)', textAlign:'right' }}>XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.map((a,i) => (
                      <tr key={a.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding:'8px 12px', color:i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'#fff', fontWeight:'bold' }}>#{i+1}</td>
                        <td style={{ padding:'8px 12px', color:'#fff' }}>{a.nombre}</td>
                        <td style={{ padding:'8px 12px', color:'#00FF41', fontWeight:'bold', textAlign:'right' }}>{a[periodo]||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color:'rgba(255,255,255,0.2)', fontFamily:'system-ui', fontSize:'0.7rem', textAlign:'center', marginTop:'10px' }}>🔒 Solo lectura</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

export default ModoDemoLectura;
