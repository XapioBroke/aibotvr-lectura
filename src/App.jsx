// ─────────────────────────────────────────────────────────────
// App.jsx — REFACTORIZADO con Zustand
// De 17 useState a 0. Todo el estado vive en store.js
// ─────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuraStore, ESCUELAS, MODOS_IDIOMA } from './store';
import ReadingAnalyzer from './ReadingAnalyzer';
import Estadisticas from './Estadisticas';
import IntroCinematica from './IntroCinematica';
import CierreSesion from './CierreSesion';
import { MuteButtonIOS } from './MuteButton';
import { narrarBienvenida, setMuteado, detener } from './voiceService';
import './App.css';

// ─────────────────────────────────────────────────────────────
// ANIMACIÓN DE PÁGINAS (sin cambios)
// ─────────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: -20 },
  in:      { opacity: 1, x: 0, transition: { duration: 0.3 } },
  out:     { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

// ─────────────────────────────────────────────────────────────
// VENTANA DE INSPIRACIÓN AURA (sin cambios de lógica)
// ─────────────────────────────────────────────────────────────
const AuraInspirationWindow = () => {
  const [index, setIndex] = React.useState(0);
  const frases = [
    { texto: '«Un lector vive mil vidas antes de morir.»',                      autor: 'George R.R. Martin' },
    { texto: '«Today a reader, tomorrow a leader.»',                            autor: 'Margaret Fuller'    },
    { texto: '«Tu voz es la tecnología más poderosa para descubrir el mundo.»', autor: 'Aura Core'         },
    { texto: '«The more that you read, the more things you will know.»',        autor: 'Dr. Seuss'         },
    { texto: '«La lectura hace al hombre completo; la conversación lo hace ágil.»', autor: 'Francis Bacon' },
  ];
  useEffect(() => {
    const t = setInterval(() => setIndex(p => (p + 1) % frases.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="aura-hero-container">
      <div className="aura-background-overlay" />
      <div className="aura-content-wrapper">
        <div className="aura-brain-icon">🧠</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={index} className="aura-quote-box"
            initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
            exit={  { opacity: 0, y: -20, filter: 'blur(5px)' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <h2 className="aura-quote-text">{frases[index].texto}</h2>
            <p className="aura-quote-author">— {frases[index].autor}</p>
          </motion.div>
        </AnimatePresence>
        <div className="aura-standby-indicator">
          <span className="pulse-dot" /> SISTEMA IA EN ESPERA
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE HEADER iOS (sin cambios)
// ─────────────────────────────────────────────────────────────
const IosHeader = ({ titulo, onBack }) => (
  <div className="ios-header">
    {onBack
      ? <button className="ios-back-button" onClick={onBack}><span className="chevron">‹</span></button>
      : <div style={{ width: 30 }} />}
    <h2>{titulo}</h2>
    <div style={{ width: 30 }} />
  </div>
);

// ─────────────────────────────────────────────────────────────
// APP PRINCIPAL — ahora sin estado local
// ─────────────────────────────────────────────────────────────
function App() {
  // ── Leer estado del store (granular = renders óptimos) ──
  const mostrarIntro        = useAuraStore(s => s.mostrarIntro);
  const vista               = useAuraStore(s => s.vista);
  const escuelaSeleccionada = useAuraStore(s => s.escuelaSeleccionada);
  const grupoSeleccionado   = useAuraStore(s => s.grupoSeleccionado);
  const alumnoSeleccionado  = useAuraStore(s => s.alumnoSeleccionado);
  const alumnos             = useAuraStore(s => s.alumnos);
  const modoEdicion         = useAuraStore(s => s.modoEdicion);
  const ultimaAccion        = useAuraStore(s => s.ultimaAccion);
  const modoIdioma          = useAuraStore(s => s.modoIdioma);
  const temaLectura         = useAuraStore(s => s.temaLectura);
  const generandoTexto      = useAuraStore(s => s.generandoTexto);
  const textoReferencia     = useAuraStore(s => s.textoReferencia);
  const ultimoPuntaje       = useAuraStore(s => s.ultimoPuntaje);

  // ── Leer acciones del store ──
  const completarIntro        = useAuraStore(s => s.completarIntro);
  const irAVista              = useAuraStore(s => s.irAVista);
  const seleccionarEscuela    = useAuraStore(s => s.seleccionarEscuela);
  const seleccionarGrupo      = useAuraStore(s => s.seleccionarGrupo);
  const seleccionarAlumno     = useAuraStore(s => s.seleccionarAlumno);
  const limpiarGrupo          = useAuraStore(s => s.limpiarGrupo);
  const limpiarEscuela        = useAuraStore(s => s.limpiarEscuela);
  const cargarAlumnos         = useAuraStore(s => s.cargarAlumnos);
  const toggleModoEdicion     = useAuraStore(s => s.toggleModoEdicion);
  const ajustarPuntosManuales = useAuraStore(s => s.ajustarPuntosManuales);
  const deshacerUltimaAccion  = useAuraStore(s => s.deshacerUltimaAccion);
  const reiniciarPuntosGrupo  = useAuraStore(s => s.reiniciarPuntosGrupo);
  const handlePuntosGanados   = useAuraStore(s => s.handlePuntosGanados);
  const setModoIdioma         = useAuraStore(s => s.setModoIdioma);
  const setTemaLectura        = useAuraStore(s => s.setTemaLectura);
  const generarTextoConIA     = useAuraStore(s => s.generarTextoConIA);
  const sesionLecturas        = useAuraStore(s => s.sesionLecturas);
  const limpiarSesion         = useAuraStore(s => s.limpiarSesion);
  const muteado               = useAuraStore(s => s.muteado);

  const [mostrarCierre, setMostrarCierre] = React.useState(false);

  // ── Cargar alumnos automáticamente cuando cambia grupo/escuela ──
  useEffect(() => {
    if (escuelaSeleccionada && grupoSeleccionado) cargarAlumnos();
  }, [escuelaSeleccionada, grupoSeleccionado]);

  // ── Intro ──
  if (mostrarIntro) return <IntroCinematica onComplete={completarIntro} />;

  // ─────────────────────────────────────────────────────────
  // RENDER PRINCIPAL — idéntico al original, solo cambian
  // los handlers: antes setState, ahora acciones del store
  // ─────────────────────────────────────────────────────────
  return (
    <>
      {mostrarCierre && (
        <CierreSesion
          grupo={grupoSeleccionado}
          escuela={escuelaSeleccionada?.nombre}
          lecturasSession={sesionLecturas || []}
          onCerrar={() => { setMostrarCierre(false); if (limpiarSesion) limpiarSesion(); }}
        />
      )}
    <div className="tier1-desktop-layout">

      {/* ══════════ PANEL IZQUIERDO ══════════ */}
      <div className="layout-sidebar ios-dark-container">

        <AnimatePresence>
          {ultimoPuntaje && (
            <motion.div
              initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
              className="dynamic-island-notification"
            >
              <div className="di-icon">✨</div>
              <div className="di-text">
                <span className="di-name">{ultimoPuntaje.nombre}</span>
                <span className="di-points">+{ultimoPuntaje.puntos} XP</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ── MENÚ PRINCIPAL ── */}
          {vista === 'menu' && (
            <motion.div key="menu" variants={pageVariants} initial="initial" animate="in" exit="out" className="ios-page">
              <div className="ios-hero-header">
                <div className="ios-icon-app">🧠</div>
                <h1>Aura Core</h1>
                <p>Análisis de Lectura de Nueva Generación</p>
              </div>

              <div className="language-selector ios-glass">
                <p className="ls-label">MODO DE LECTURA</p>
                <div className="ls-grid">
                  {MODOS_IDIOMA.map((modo) => {
                    const activo = modoIdioma.leer === modo.leer && modoIdioma.traducir === modo.traducir;
                    return (
                      <button
                        key={`${modo.leer}-${modo.traducir}`}
                        className={`ls-btn ${activo ? 'ls-btn--active' : ''}`}
                        onClick={() => setModoIdioma({ leer: modo.leer, traducir: modo.traducir })}
                      >
                        <span className="ls-flags">{modo.label}</span>
                        <span className="ls-titulo">{modo.titulo}</span>
                        <span className="ls-desc">{modo.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ios-grid-menu">
                <button className="ios-action-card primary" onClick={() => irAVista('seleccion')}>
                  <div className="icon">🎙️</div><h3>Evaluar</h3>
                </button>
                <button className="ios-action-card secondary" onClick={() => irAVista('estadisticas')}>
                  <div className="icon">📊</div><h3>Métricas</h3>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SELECCIÓN ESCUELA ── */}
          {(vista === 'seleccion' || vista === 'estadisticas') && !escuelaSeleccionada && (
            <motion.div key="sel-escuela" variants={pageVariants} initial="initial" animate="in" exit="out" className="ios-page">
              <IosHeader titulo="Escuelas" onBack={() => irAVista('menu')} />
              <div className="ios-list-container">
                {ESCUELAS.map(e => (
                  <button key={e.id} className="ios-list-item" onClick={() => seleccionarEscuela(e)}>
                    <div className="item-content"><h3>{e.nombre}</h3></div>
                    <span className="chevron-right">›</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── SELECCIÓN GRUPO ── */}
          {(vista === 'seleccion' || vista === 'estadisticas') && escuelaSeleccionada && !grupoSeleccionado && (
            <motion.div key="sel-grupo" variants={pageVariants} initial="initial" animate="in" exit="out" className="ios-page">
              <IosHeader titulo="Grupos" onBack={limpiarEscuela} />
              <div className="ios-grid-grupos">
                {escuelaSeleccionada.grupos.map(g => (
                  <button key={g} className="ios-glass-button" onClick={() => seleccionarGrupo(g)}>
                    Grupo {g}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LISTA ALUMNOS ── */}
          {(vista === 'seleccion' || vista === 'estadisticas') && escuelaSeleccionada && grupoSeleccionado && (
            <motion.div key="sel-alumno" variants={pageVariants} initial="initial" animate="in" exit="out" className="ios-page">
              <IosHeader
                titulo={`Grupo ${grupoSeleccionado}`}
                onBack={limpiarGrupo}
              />

              {/* Controles maestro */}
              <div className="teacher-controls ios-glass">
                <div className="tc-header">
                  <span className="tc-title">Controles de Maestro</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => setMostrarCierre(true)}
                      style={{ background: 'rgba(10,132,255,0.15)', color: '#0a84ff', border: '1px solid rgba(10,132,255,0.4)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      📋 Cerrar Sesión
                    </button>
                    <button className={`tc-toggle ${modoEdicion ? 'active' : ''}`} onClick={toggleModoEdicion}>
                      {modoEdicion ? 'Terminar Edición' : 'Editar Puntos'}
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {modoEdicion && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="tc-actions">
                      <button className="tc-btn danger" onClick={reiniciarPuntosGrupo}>🔄 Reiniciar a Cero</button>
                      {ultimaAccion && (
                        <button className="tc-btn warning" onClick={deshacerUltimaAccion}>↩️ Deshacer Ajuste</button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Lista de alumnos */}
              <div className="ios-list-container alumnos-list">
                {alumnos.map(a => (
                  <button
                    key={a.id}
                    className={`ios-list-item alumno ${alumnoSeleccionado?.id === a.id ? 'active' : ''}`}
                    onClick={() => !modoEdicion && seleccionarAlumno(a)}
                  >
                    <div className="alumno-avatar">{a.nombre.charAt(0)}</div>
                    <div className="item-content">
                      <h3>{a.nombre}</h3>
                      <p className="xp-text">⭐ {a.puntos || 0} XP</p>
                    </div>
                    {modoEdicion ? (
                      <div className="edit-xp-buttons">
                        <div className="xp-btn minus" onClick={(e) => { e.stopPropagation(); ajustarPuntosManuales(a, -5); }}>-5</div>
                        <div className="xp-btn plus"  onClick={(e) => { e.stopPropagation(); ajustarPuntosManuales(a,  5); }}>+5</div>
                      </div>
                    ) : (
                      <span className="action-text">{vista === 'estadisticas' ? 'Ver Métricas ›' : 'Evaluar ›'}</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════ PANEL DERECHO ══════════ */}
      <div className="layout-canvas">
        {vista === 'seleccion' && alumnoSeleccionado ? (
          <div className="canvas-analyzer-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '10px' }}>

            {/* Generador de textos */}
            <div className="generator-card ios-glass" style={{ padding: '20px', marginBottom: '20px', borderRadius: '15px' }}>
              <h3 style={{ marginBottom: '15px', color: '#fff', fontSize: '1.2rem' }}>
                ✨ Generar texto en {modoIdioma.leer === 'es' ? 'Español' : 'Inglés'}
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={modoIdioma.leer === 'es' ? 'Ej. La exploración espacial...' : 'e.g. The solar system...'}
                  value={temaLectura}
                  onChange={(e) => setTemaLectura(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '1rem' }}
                />
                <button onClick={generarTextoConIA} className="tc-btn positive" disabled={generandoTexto} style={{ minWidth: '130px', fontWeight: 'bold' }}>
                  {generandoTexto ? 'Generando...' : 'Crear Texto'}
                </button>
              </div>
            </div>

            {/* Analizador */}
            <ReadingAnalyzer
              alumno={alumnoSeleccionado}
              modoIdioma={modoIdioma}
              textoGenerado={textoReferencia}
              onClose={() => seleccionarAlumno(null)}
              onPuntosGanados={(puntos) => handlePuntosGanados(puntos, alumnoSeleccionado.id)}
            />
          </div>

        ) : vista === 'estadisticas' ? (
          <div className="canvas-analyzer-wrapper">
            <Estadisticas
              alumno={alumnoSeleccionado}
              grupo={grupoSeleccionado}
              escuelaId={escuelaSeleccionada?.id}
              onClose={() => irAVista('menu')}
            />
          </div>
        ) : (
          <AuraInspirationWindow />
        )}
      </div>

    </div>
    </>
  );
}

export default App;