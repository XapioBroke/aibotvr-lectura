import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCPn0kMMrx4tRW1XJfrTenqPB08XzAc1x0",
  authDomain: "aibotvr1.firebaseapp.com",
  projectId: "aibotvr1",
  storageBucket: "aibotvr1.firebasestorage.app",
  messagingSenderId: "524453697028",
  appId: "1:524453697028:web:08d175b825238dbf590751"
};
const _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const _auth = getAuth(_app);

// ── Textos de práctica por nivel ─────────────────────────────
const TEXTOS_PRACTICA = [
  {
    id: 'facil1', nivel: 'Fácil', titulo: 'El agua y la vida',
    texto: 'El agua es esencial para todos los seres vivos. Cubre más del 70% de la superficie de la Tierra y constituye la mayor parte de nuestro cuerpo. Sin agua, ningún organismo podría sobrevivir. Los ríos, lagos y océanos son hogar de millones de especies. Debemos cuidar este recurso tan valioso para las generaciones futuras.',
    preguntas: [
      { p: '¿Qué porcentaje de la Tierra cubre el agua?', c: 'Más del 70%', f: ['Menos del 50%', 'Exactamente el 100%'] },
      { p: '¿Para qué es esencial el agua?', c: 'Para todos los seres vivos', f: ['Solo para las plantas', 'Solo para los animales'] },
      { p: '¿Qué debemos hacer con el agua?', c: 'Cuidarla para el futuro', f: ['Desperdiciarla', 'Contaminarla'] },
    ]
  },
  {
    id: 'facil2', nivel: 'Fácil', titulo: 'La selva amazónica',
    texto: 'La selva amazónica es el bosque tropical más grande del mundo. Se extiende por nueve países de América del Sur y alberga una biodiversidad increíble. En ella viven millones de especies de plantas, animales e insectos. El Amazonas produce una gran cantidad del oxígeno que respiramos. Por eso se le llama "el pulmón del planeta".',
    preguntas: [
      { p: '¿Cómo se llama el bosque tropical más grande del mundo?', c: 'Selva amazónica', f: ['Selva africana', 'Bosque siberiano'] },
      { p: '¿Por qué se llama "el pulmón del planeta"?', c: 'Produce mucho oxígeno', f: ['Tiene forma de pulmón', 'Es muy grande'] },
      { p: '¿Por cuántos países se extiende el Amazonas?', c: 'Nueve países', f: ['Tres países', 'Veinte países'] },
    ]
  },
  {
    id: 'medio1', nivel: 'Medio', titulo: 'La Revolución Industrial',
    texto: 'La Revolución Industrial comenzó en Inglaterra a finales del siglo XVIII y transformó radicalmente la sociedad. El invento de la máquina de vapor permitió mecanizar la producción y crear fábricas. Millones de personas migraron del campo a las ciudades en busca de trabajo. Aunque impulsó el progreso económico y tecnológico, también generó problemas sociales como jornadas laborales excesivas y condiciones de vida precarias para los obreros. Este periodo marcó el inicio de la era moderna tal como la conocemos.',
    preguntas: [
      { p: '¿Dónde comenzó la Revolución Industrial?', c: 'En Inglaterra', f: ['En Francia', 'En Alemania'] },
      { p: '¿Qué invento fue clave en este periodo?', c: 'La máquina de vapor', f: ['El automóvil', 'El teléfono'] },
      { p: '¿Qué problema social generó la industrialización?', c: 'Jornadas laborales excesivas', f: ['Falta de tecnología', 'Migración rural positiva'] },
      { p: '¿En qué siglo comenzó la Revolución Industrial?', c: 'Siglo XVIII', f: ['Siglo XV', 'Siglo XX'] },
    ]
  },
  {
    id: 'medio2', nivel: 'Medio', titulo: 'El sistema solar',
    texto: 'El sistema solar está compuesto por el Sol y todos los cuerpos celestes que orbitan a su alrededor. Los ocho planetas se dividen en interiores: Mercurio, Venus, Tierra y Marte; y exteriores: Júpiter, Saturno, Urano y Neptuno. Además de los planetas, existen lunas, asteroides, cometas y planetas enanos como Plutón. La gravedad del Sol es la fuerza que mantiene todo en órbita. La luz solar tarda aproximadamente ocho minutos en llegar a la Tierra.',
    preguntas: [
      { p: '¿Cuántos planetas tiene el sistema solar?', c: 'Ocho', f: ['Nueve', 'Doce'] },
      { p: '¿Cuánto tarda la luz solar en llegar a la Tierra?', c: 'Aproximadamente ocho minutos', f: ['Un segundo', 'Veinticuatro horas'] },
      { p: '¿Qué fuerza mantiene los planetas en órbita?', c: 'La gravedad del Sol', f: ['El viento solar', 'La rotación terrestre'] },
      { p: '¿Cuál es un planeta enano mencionado en el texto?', c: 'Plutón', f: ['Marte', 'Júpiter'] },
    ]
  },
  {
    id: 'dificil1', nivel: 'Difícil', titulo: 'La fotosíntesis y su importancia',
    texto: 'La fotosíntesis es el proceso mediante el cual las plantas, algas y algunas bacterias convierten la energía lumínica en energía química almacenada en glucosa. Este proceso ocurre principalmente en los cloroplastos, orgánulos que contienen clorofila, el pigmento que da el color verde a las plantas y que absorbe la luz solar. Durante la fotosíntesis, las plantas toman dióxido de carbono del aire y agua del suelo, y liberan oxígeno como subproducto. Sin este proceso, la vida tal como la conocemos sería imposible, ya que provee el oxígeno que respiramos y forma la base de prácticamente todas las cadenas alimentarias del planeta.',
    preguntas: [
      { p: '¿Qué producen las plantas durante la fotosíntesis?', c: 'Glucosa y oxígeno', f: ['Dióxido de carbono y agua', 'Nitrógeno y glucosa'] },
      { p: '¿Dónde ocurre la fotosíntesis dentro de la célula?', c: 'En los cloroplastos', f: ['En el núcleo', 'En las mitocondrias'] },
      { p: '¿Qué pigmento absorbe la luz solar?', c: 'La clorofila', f: ['La melanina', 'La hemoglobina'] },
      { p: '¿Qué materiales necesitan las plantas para fotosintizar?', c: 'CO₂ y agua', f: ['Oxígeno y glucosa', 'Nitrógeno y luz'] },
      { p: '¿Por qué es vital la fotosíntesis para la vida?', c: 'Provee oxígeno y es base de las cadenas alimentarias', f: ['Solo produce glucosa', 'Controla la temperatura del planeta'] },
    ]
  },
  {
    id: 'dificil2', nivel: 'Difícil', titulo: 'Inteligencia Artificial y educación',
    texto: 'La inteligencia artificial está transformando profundamente el campo educativo. Los sistemas adaptativos de aprendizaje pueden analizar el desempeño individual de cada estudiante y ajustar el contenido y la dificultad de los ejercicios en tiempo real, permitiendo una experiencia verdaderamente personalizada. Herramientas como los tutores virtuales y los asistentes de escritura ofrecen retroalimentación inmediata, reduciendo la brecha entre el momento del error y su corrección. Sin embargo, la implementación masiva de la IA en las aulas plantea desafíos éticos importantes: el riesgo de incrementar las desigualdades digitales entre regiones con distinto acceso tecnológico, la privacidad de los datos de los menores y la necesidad de repensar el rol del docente en un entorno cada vez más automatizado.',
    preguntas: [
      { p: '¿Qué pueden hacer los sistemas adaptativos de IA en educación?', c: 'Ajustar contenido y dificultad según el estudiante', f: ['Sustituir completamente al docente', 'Solo calificar exámenes'] },
      { p: '¿Cuál es una ventaja mencionada de los tutores virtuales?', c: 'Retroalimentación inmediata ante errores', f: ['Eliminar la necesidad de estudiar', 'Garantizar calificaciones perfectas'] },
      { p: '¿Qué desafío ético plantea la IA en educación?', c: 'Incrementar desigualdades digitales', f: ['Mejorar la conectividad global', 'Reducir el costo de los libros'] },
      { p: '¿Qué elemento del texto describe la privacidad?', c: 'Datos de menores en sistemas IA', f: ['Datos del docente', 'Resultados de exámenes nacionales'] },
      { p: '¿Qué rol debe repensarse según el texto?', c: 'El rol del docente', f: ['El rol del alumno', 'El rol de los padres'] },
    ]
  },
];

const ModoDemoLectura = ({ rol, onSalir }) => {
  const esAlumno = (rol || localStorage.getItem('iapprende_rol') || 'invitado') === 'alumno';
  const grupo    = localStorage.getItem('iapprende_grupo')   || '';
  const escuela  = localStorage.getItem('iapprende_escuela') || '';

  // Estados principales
  const [pantalla, setPantalla]     = useState('selector'); // selector|leyendo|resultado|metricas
  const [textoSel, setTextoSel]     = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [enviado, setEnviado]       = useState(false);
  const [tiempoInicio, setTiempo]   = useState(null);
  const [segundos, setSegundos]     = useState(0);
  const timerRef = useRef(null);

  // Métricas
  const [alumnos, setAlumnos]   = useState([]);
  const [cargMet, setCargMet]   = useState(false);
  const [periodo, setPeriodo]   = useState('tri1');

  useEffect(() => {
    if (pantalla === 'leyendo' && !enviado) {
      setTiempo(Date.now());
      timerRef.current = setInterval(() => setSegundos(s => s+1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [pantalla, enviado]);

  const cargarMetricas = async () => {
    if (!grupo || !escuela) return;
    setCargMet(true);
    try {
      const q = query(collection(db,'lecturas_metricas'), where('escuela','==',escuela), where('grupo','==',grupo));
      const snap = await getDocs(q);
      // Si no hay colección de lectura, intentar con alumnos general
      if (snap.empty) {
        const q2 = query(collection(db,'alumnos'), where('escuelaNombre','==',escuela), where('grupo','==',grupo));
        const snap2 = await getDocs(q2);
        setAlumnos(snap2.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (b.tri1||0)-(a.tri1||0)));
      } else {
        setAlumnos(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (b[periodo]||0)-(a[periodo]||0)));
      }
    } catch(e) { console.error(e); }
    finally { setCargMet(false); }
  };

  const iniciarTexto = (t) => {
    setTextoSel(t);
    setRespuestas({});
    setEnviado(false);
    setSegundos(0);
    setPantalla('leyendo');
  };

  const responder = (idx, opcion) => {
    if (enviado) return;
    setRespuestas(prev => ({ ...prev, [idx]: opcion }));
  };

  const enviar = () => {
    if (Object.keys(respuestas).length < textoSel.preguntas.length) {
      alert('Responde todas las preguntas antes de enviar.');
      return;
    }
    setEnviado(true);
    setPantalla('resultado');
  };

  const aciertos = textoSel ? textoSel.preguntas.filter((p,i) => respuestas[i]?.esCorrecto).length : 0;
  const pct      = textoSel ? Math.round((aciertos / textoSel.preguntas.length) * 100) : 0;
  const minutos  = Math.floor(segundos / 60);
  const segs     = segundos % 60;

  const cerrarSesion = async () => {
    await signOut(_auth);
    ['iapprende_rol','iapprende_codigo','iapprende_grupo','iapprende_escuela','iapprende_proyecto']
      .forEach(k => localStorage.removeItem(k));
    window.location.replace('https://iapprende.com');
  };

  // Colores por nivel
  const colorNivel = { 'Fácil':'#00FF41', 'Medio':'#FFD700', 'Difícil':'#FF4444' };

  return (
    <div style={{ background:'#050c1a', minHeight:'100vh', color:'#fff', fontFamily:'Georgia, serif', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px', background:'rgba(0,0,0,0.6)', borderBottom:'1px solid rgba(14,165,233,0.3)', flexShrink:0 }}>
        <span style={{ color:'#0ea5e9', fontWeight:'bold', fontSize:'0.9rem' }}>📖 Lectura con IA — {esAlumno ? 'ALUMNO' : 'INVITADO'}</span>
        {esAlumno && grupo && <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)' }}>· {escuela} / Gpo {grupo}</span>}
        <div style={{ flex:1 }}/>
        {pantalla === 'leyendo' && !enviado && (
          <span style={{ fontFamily:'monospace', color:'#FFD700', fontSize:'0.85rem' }}>
            ⏱ {minutos}:{String(segs).padStart(2,'0')}
          </span>
        )}
        {pantalla !== 'selector' && (
          <button onClick={() => { clearInterval(timerRef.current); setPantalla('selector'); }}
            style={{ background:'rgba(255,200,0,0.12)', border:'1px solid #FFC80044', borderRadius:'6px', color:'#FFC800', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer' }}>
            ← Textos
          </button>
        )}
        {esAlumno && grupo && pantalla !== 'metricas' && (
          <button onClick={() => { setPantalla('metricas'); cargarMetricas(); }}
            style={{ background:'rgba(0,255,65,0.1)', border:'1px solid #00FF4144', borderRadius:'6px', color:'#00FF41', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer' }}>
            📊 Métricas
          </button>
        )}
        <button onClick={cerrarSesion}
          style={{ background:'rgba(255,69,58,0.15)', border:'1px solid rgba(255,69,58,0.3)', borderRadius:'6px', color:'#ff453a', fontSize:'0.65rem', padding:'3px 10px', cursor:'pointer' }}>
          Salir
        </button>
      </header>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>

        {/* ══ SELECTOR DE TEXTOS ══ */}
        {pantalla === 'selector' && (
          <>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'8px' }}>📚</div>
              <h2 style={{ color:'#0ea5e9', fontSize:'clamp(1.2rem,3vw,1.8rem)', margin:'0 0 6px' }}>Práctica de Lectura</h2>
              <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', fontSize:'0.88rem', margin:0 }}>
                {esAlumno ? 'Lee el texto, responde las preguntas y analiza tu comprensión.' : 'Modo demo: practica lectura comprensiva sin registro de estadísticas.'}
              </p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'16px', width:'100%', maxWidth:'900px' }}>
              {TEXTOS_PRACTICA.map(t => (
                <button key={t.id} onClick={() => iniciarTexto(t)}
                  style={{ background:'rgba(14,165,233,0.06)', border:`2px solid ${colorNivel[t.nivel]}44`, borderRadius:'16px', padding:'20px', textAlign:'left', cursor:'pointer', color:'#fff', transition:'all .2s', display:'flex', flexDirection:'column', gap:'8px' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor=colorNivel[t.nivel]; e.currentTarget.style.background='rgba(14,165,233,0.12)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor=colorNivel[t.nivel]+'44'; e.currentTarget.style.background='rgba(14,165,233,0.06)'; e.currentTarget.style.transform='translateY(0)'; }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ background:colorNivel[t.nivel]+'22', border:`1px solid ${colorNivel[t.nivel]}55`, borderRadius:'100px', padding:'2px 10px', fontSize:'0.7rem', fontWeight:'700', color:colorNivel[t.nivel], fontFamily:'system-ui' }}>{t.nivel}</span>
                    <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.35)', fontFamily:'system-ui' }}>{t.preguntas.length} preguntas</span>
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'1rem', color:'#0ea5e9' }}>{t.titulo}</div>
                  <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', fontFamily:'system-ui', lineHeight:1.5 }}>
                    {t.texto.substring(0,100)}...
                  </div>
                </button>
              ))}
            </div>

            {!esAlumno && (
              <div style={{ background:'rgba(14,165,233,0.05)', border:'1px solid rgba(14,165,233,0.15)', borderRadius:'10px', padding:'12px 18px', maxWidth:'480px', textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', fontSize:'0.82rem', margin:0 }}>
                  💡 Para ver métricas del grupo y estadísticas de progreso, solicita un código de acceso a tu docente.
                </p>
              </div>
            )}

            <button onClick={cerrarSesion}
              style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', color:'rgba(255,255,255,0.35)', fontSize:'0.72rem', padding:'7px 18px', cursor:'pointer', fontFamily:'system-ui' }}>
              ← Volver al inicio
            </button>
          </>
        )}

        {/* ══ LECTURA ══ */}
        {pantalla === 'leyendo' && textoSel && (
          <div style={{ width:'100%', maxWidth:'720px', display:'flex', flexDirection:'column', gap:'20px' }}>
            <div style={{ textAlign:'center' }}>
              <span style={{ background:colorNivel[textoSel.nivel]+'22', border:`1px solid ${colorNivel[textoSel.nivel]}55`, borderRadius:'100px', padding:'3px 12px', fontSize:'0.72rem', fontWeight:'700', color:colorNivel[textoSel.nivel], fontFamily:'system-ui' }}>{textoSel.nivel}</span>
              <h2 style={{ color:'#0ea5e9', margin:'10px 0 0', fontSize:'1.4rem' }}>{textoSel.titulo}</h2>
            </div>

            {/* Texto */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(14,165,233,0.2)', borderRadius:'14px', padding:'24px', lineHeight:1.9, fontSize:'1.05rem', color:'rgba(255,255,255,0.9)' }}>
              {textoSel.texto}
            </div>

            {/* Preguntas */}
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <h3 style={{ color:'#0ea5e9', margin:0, fontFamily:'system-ui', fontSize:'1rem', fontWeight:'700', letterSpacing:'0.05em' }}>PREGUNTAS DE COMPRENSIÓN</h3>
              {textoSel.preguntas.map((p, idx) => {
                const opcs = [{ texto:p.c, esCorrecto:true }, ...p.f.map(f => ({ texto:f, esCorrecto:false }))].sort(() => Math.random() - 0.5);
                // IMPORTANTE: mezclar solo una vez
                if (!textoSel._mezcladas) textoSel._mezcladas = {};
                if (!textoSel._mezcladas[idx]) textoSel._mezcladas[idx] = opcs;
                const opcsFijas = textoSel._mezcladas[idx];

                return (
                  <div key={idx} style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'16px' }}>
                    <p style={{ margin:'0 0 12px', fontFamily:'system-ui', fontSize:'0.92rem', color:'rgba(255,255,255,0.9)', fontWeight:'500' }}>{idx+1}. {p.p}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {opcsFijas.map((op, oi) => {
                        const sel = respuestas[idx] === op;
                        const mostrar = enviado;
                        return (
                          <button key={oi} onClick={() => responder(idx, op)}
                            style={{
                              textAlign:'left', padding:'10px 14px', borderRadius:'8px', cursor:enviado?'default':'pointer', fontFamily:'system-ui', fontSize:'0.88rem',
                              background: mostrar ? (op.esCorrecto ? 'rgba(0,255,65,0.15)' : sel ? 'rgba(255,69,58,0.15)' : 'rgba(255,255,255,0.03)') : (sel ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)'),
                              border: mostrar ? `1px solid ${op.esCorrecto ? '#00FF41' : sel ? '#FF453A' : 'rgba(255,255,255,0.1)'}` : `1px solid ${sel ? '#0ea5e9' : 'rgba(255,255,255,0.1)'}`,
                              color: mostrar ? (op.esCorrecto ? '#00FF41' : sel ? '#FF453A' : 'rgba(255,255,255,0.4)') : (sel ? '#fff' : 'rgba(255,255,255,0.65)'),
                              transition:'all .15s',
                            }}>
                            {mostrar && op.esCorrecto ? '✅ ' : mostrar && sel ? '❌ ' : ''}{op.texto}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {!enviado && (
              <button onClick={enviar}
                style={{ background:'#0ea5e9', color:'#fff', border:'none', borderRadius:'10px', padding:'13px', fontSize:'1rem', fontWeight:'700', cursor:'pointer', fontFamily:'system-ui' }}>
                Enviar respuestas →
              </button>
            )}
          </div>
        )}

        {/* ══ RESULTADO ══ */}
        {pantalla === 'resultado' && textoSel && (
          <div style={{ width:'100%', maxWidth:'560px', display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'4rem', marginBottom:'8px' }}>{pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}</div>
              <h2 style={{ color: pct >= 80 ? '#00FF41' : pct >= 60 ? '#FFD700' : '#FF4444', margin:'0 0 4px', fontSize:'2rem' }}>{pct}%</h2>
              <p style={{ color:'rgba(255,255,255,0.5)', fontFamily:'system-ui', fontSize:'0.9rem', margin:0 }}>
                {aciertos} de {textoSel.preguntas.length} respuestas correctas · {minutos}:{String(segs).padStart(2,'0')} de lectura
              </p>
            </div>

            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'12px', padding:'16px 20px', width:'100%', textAlign:'center' }}>
              <p style={{ color:'rgba(255,255,255,0.6)', fontFamily:'system-ui', fontSize:'0.85rem', margin:0, lineHeight:1.6 }}>
                {pct >= 80 ? '¡Excelente comprensión lectora! Entendiste muy bien el texto.' :
                 pct >= 60 ? 'Buena lectura. Puedes mejorar repasando las secciones que fallaste.' :
                 'Te recomendamos leer el texto de nuevo con más atención.'}
              </p>
              {!esAlumno && <p style={{ color:'rgba(255,255,255,0.25)', fontFamily:'system-ui', fontSize:'0.75rem', margin:'8px 0 0' }}>Modo invitado — estadísticas no guardadas</p>}
            </div>

            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={() => { setEnviado(false); setRespuestas({}); setSegundos(0); setPantalla('leyendo'); if (textoSel._mezcladas) delete textoSel._mezcladas; }}
                style={{ background:'rgba(14,165,233,0.15)', border:'2px solid #0ea5e9', borderRadius:'10px', color:'#0ea5e9', fontFamily:'system-ui', fontSize:'0.85rem', padding:'11px 22px', cursor:'pointer', fontWeight:'600' }}>
                🔄 Releer texto
              </button>
              <button onClick={() => { setPantalla('selector'); setTextoSel(null); }}
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'10px', color:'#fff', fontFamily:'system-ui', fontSize:'0.85rem', padding:'11px 22px', cursor:'pointer' }}>
                📚 Otros textos
              </button>
            </div>
          </div>
        )}

        {/* ══ MÉTRICAS (solo alumno) ══ */}
        {pantalla === 'metricas' && esAlumno && (
          <div style={{ width:'100%', maxWidth:'560px', display:'flex', flexDirection:'column', gap:'16px' }}>
            <div style={{ textAlign:'center' }}>
              <h2 style={{ color:'#00FF41', fontFamily:'system-ui', fontSize:'1.5rem', margin:'0 0 4px' }}>📊 Métricas del Grupo</h2>
              <p style={{ color:'rgba(255,255,255,0.35)', fontFamily:'system-ui', fontSize:'0.82rem', margin:0 }}>{escuela} · Grupo {grupo} · 🔒 Solo lectura</p>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
              {[{id:'tri1',l:'Tri 1'},{id:'tri2',l:'Tri 2'},{id:'tri3',l:'Tri 3'}].map(p => (
                <button key={p.id} onClick={() => { setPeriodo(p.id); cargarMetricas(); }}
                  style={{ padding:'5px 12px', borderRadius:'100px', border:`1px solid ${periodo===p.id?'#00FF41':'rgba(255,255,255,0.2)'}`, background:periodo===p.id?'rgba(0,255,65,0.2)':'transparent', color:periodo===p.id?'#00FF41':'rgba(255,255,255,0.4)', cursor:'pointer', fontFamily:'system-ui', fontSize:'0.7rem', fontWeight:'600' }}>
                  {p.l}
                </button>
              ))}
            </div>
            {cargMet ? <p style={{ color:'rgba(255,255,255,0.4)', fontFamily:'system-ui', textAlign:'center' }}>Cargando...</p> : (
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
                      <td style={{ padding:'8px 12px', color:'#00FF41', textAlign:'right', fontWeight:'bold' }}>{a[periodo]||a.tri1||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ color:'rgba(255,255,255,0.2)', fontFamily:'system-ui', fontSize:'0.7rem', textAlign:'center' }}>🔒 Solo lectura</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModoDemoLectura;
