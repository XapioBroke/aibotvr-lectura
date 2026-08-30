// ─────────────────────────────────────────────────────────────
// App.jsx — REFACTORIZADO con Zustand
// De 17 useState a 0. Todo el estado vive en store.js
// ─────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuraStore, MODOS_IDIOMA } from './store';
import * as XLSX from 'xlsx';
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
  const escuelas            = useAuraStore(s => s.escuelas);
  const cargandoEscuelas    = useAuraStore(s => s.cargandoEscuelas);
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
  const agregarAlumno         = useAuraStore(s => s.agregarAlumno);
  const agregarAlumnosMasivo  = useAuraStore(s => s.agregarAlumnosMasivo);
  const eliminarAlumno        = useAuraStore(s => s.eliminarAlumno);
  const cargarEscuelas        = useAuraStore(s => s.cargarEscuelas);
  const agregarEscuela        = useAuraStore(s => s.agregarEscuela);
  const eliminarEscuela       = useAuraStore(s => s.eliminarEscuela);
  const renombrarEscuela      = useAuraStore(s => s.renombrarEscuela);
  const agregarGrupo          = useAuraStore(s => s.agregarGrupo);
  const eliminarGrupo         = useAuraStore(s => s.eliminarGrupo);
  const renombrarGrupo        = useAuraStore(s => s.renombrarGrupo);
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
  const [nuevoAlumnoNombre, setNuevoAlumnoNombre] = React.useState('');
  const [agregandoAlumno, setAgregandoAlumno]     = React.useState(false);
  const [metodoAgregar, setMetodoAgregar]         = React.useState('individual'); // individual | pegar | archivo
  const [textoMasivoAlumnos, setTextoMasivoAlumnos] = React.useState('');
  const [agregandoMasivo, setAgregandoMasivo]       = React.useState(false);
  const [cargandoArchivoAlumnos, setCargandoArchivoAlumnos] = React.useState(false);
  const [mostrarAdminEscuelas, setMostrarAdminEscuelas] = React.useState(false);
  const [nuevaEscuelaNombre, setNuevaEscuelaNombre]     = React.useState('');

  // ── Cargar escuelas al montar (migra automáticamente si la colección está vacía) ──
  useEffect(() => { cargarEscuelas(); }, []);

  // ── Cargar alumnos automáticamente cuando cambia grupo/escuela ──
  useEffect(() => {
    if (escuelaSeleccionada && grupoSeleccionado) cargarAlumnos();
  }, [escuelaSeleccionada, grupoSeleccionado]);

  const handleAgregarEscuela = async () => {
    if (!nuevaEscuelaNombre.trim()) return;
    const resultado = await agregarEscuela(nuevaEscuelaNombre);
    if (resultado.ok) setNuevaEscuelaNombre('');
    else alert(resultado.error || 'No se pudo agregar la escuela.');
  };

  const handleEliminarEscuela = async (escuela) => {
    if (!window.confirm(`¿Eliminar "${escuela.nombre}"? Los alumnos de esta escuela no se borran.`)) return;
    const resultado = await eliminarEscuela(escuela.id);
    if (!resultado.ok) alert(resultado.error || 'No se pudo eliminar la escuela.');
  };

  const handleRenombrarEscuela = async (escuela) => {
    const nuevo = prompt('Nuevo nombre de la escuela:', escuela.nombre);
    if (!nuevo || nuevo.trim() === escuela.nombre) return;
    const resultado = await renombrarEscuela(escuela.id, nuevo);
    if (!resultado.ok) alert(resultado.error || 'No se pudo renombrar.');
  };

  const handleAgregarGrupo = async (escuela) => {
    const nuevo = prompt('Nombre del nuevo grupo (ej: 3A):');
    if (!nuevo) return;
    const resultado = await agregarGrupo(escuela.id, escuela.grupos || [], nuevo);
    if (!resultado.ok) alert(resultado.error || 'No se pudo agregar el grupo (¿ya existe?).');
  };

  const handleEliminarGrupo = async (escuela, grupo) => {
    if (!window.confirm(`¿Eliminar el grupo "${grupo}"? Los alumnos de este grupo no se borran.`)) return;
    const resultado = await eliminarGrupo(escuela.id, escuela.grupos || [], grupo);
    if (!resultado.ok) alert(resultado.error || 'No se pudo eliminar el grupo.');
  };

  const handleRenombrarGrupo = async (escuela, grupo) => {
    const nuevo = prompt('Nuevo nombre del grupo:', grupo);
    if (!nuevo || nuevo.trim() === grupo) return;
    const resultado = await renombrarGrupo(escuela.id, escuela.grupos || [], grupo, nuevo);
    if (!resultado.ok) alert(resultado.error || 'No se pudo renombrar el grupo.');
  };

  const handleAgregarAlumno = async () => {
    if (!nuevoAlumnoNombre.trim()) return;
    setAgregandoAlumno(true);
    const resultado = await agregarAlumno(nuevoAlumnoNombre);
    setAgregandoAlumno(false);
    if (resultado.ok) {
      setNuevoAlumnoNombre('');
    } else {
      alert(resultado.error || 'No se pudo agregar el alumno.');
    }
  };

  const handleEliminarAlumno = async (alumno) => {
    if (!window.confirm(`¿Eliminar a ${alumno.nombre}? Esta acción no se puede deshacer.`)) return;
    const resultado = await eliminarAlumno(alumno.id);
    if (!resultado.ok) alert(resultado.error || 'No se pudo eliminar el alumno.');
  };

  const handleAgregarMasivo = async () => {
    const nombres = textoMasivoAlumnos.split('\n').map(n => n.trim()).filter(Boolean);
    if (!nombres.length) { alert('Pega al menos un nombre.'); return; }
    setAgregandoMasivo(true);
    const resultado = await agregarAlumnosMasivo(nombres);
    setAgregandoMasivo(false);
    if (resultado.ok) {
      setTextoMasivoAlumnos('');
      alert(`¡${resultado.agregados} alumnos agregados!`);
    } else {
      alert(resultado.error || 'No se pudieron agregar los alumnos.');
    }
  };

  // Extrae nombres desde .txt/.csv (texto plano) o .xlsx/.xls (primera
  // columna de la primera hoja). Word y PDF no están soportados todavía
  // — necesitarían agregar dependencias nuevas (mammoth / pdfjs-dist).
  const procesarArchivoAlumnos = async (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;
    setCargandoArchivoAlumnos(true);
    try {
      const ext = archivo.name.split('.').pop().toLowerCase();
      let nombres = [];

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await archivo.arrayBuffer();
        const wb    = XLSX.read(buffer, { type: 'array' });
        const hoja  = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 }); // array de arrays
        nombres = filas
          .map(fila => (fila?.[0] ?? '').toString().trim())
          .filter(Boolean)
          // descarta encabezados típicos como "Nombre", "Alumno", etc.
          .filter(n => !/^(nombre|alumnos?|estudiantes?)$/i.test(n));
      } else if (ext === 'txt' || ext === 'csv') {
        const texto = await archivo.text();
        nombres = texto.split('\n').map(n => n.trim()).filter(Boolean);
      } else {
        alert('Formato no soportado todavía. Usa .txt, .csv, .xlsx o .xls (Word y PDF están pendientes).');
        setCargandoArchivoAlumnos(false);
        event.target.value = '';
        return;
      }

      if (!nombres.length) {
        alert('No se encontraron nombres en el archivo.');
      } else {
        const resultado = await agregarAlumnosMasivo(nombres);
        if (resultado.ok) alert(`¡${resultado.agregados} alumnos agregados!`);
        else alert(resultado.error || 'No se pudieron agregar los alumnos.');
      }
    } catch (e) {
      console.error('Error procesando archivo:', e);
      alert('Error al procesar el archivo. Verifica que el formato sea correcto.');
    } finally {
      setCargandoArchivoAlumnos(false);
      event.target.value = '';
    }
  };

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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <button
                  onClick={() => setMostrarAdminEscuelas(!mostrarAdminEscuelas)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {mostrarAdminEscuelas ? '❌ Cerrar' : '🏫 Administrar Escuelas'}
                </button>
              </div>

              {/* ── PANEL ADMIN ESCUELAS ── */}
              <AnimatePresence>
                {mostrarAdminEscuelas && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input
                        type="text"
                        placeholder="Nombre de la nueva escuela"
                        value={nuevaEscuelaNombre}
                        onChange={(e) => setNuevaEscuelaNombre(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAgregarEscuela()}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 14 }}
                      />
                      <button
                        onClick={handleAgregarEscuela}
                        style={{ padding: '0.5rem 1rem', background: '#4CAF50', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        ➕ Nueva Escuela
                      </button>
                    </div>

                    {escuelas.map(escuela => (
                      <div key={escuela.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '1rem', marginBottom: '0.8rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <span style={{ color: 'white', fontWeight: 600, fontSize: '1rem' }}>{escuela.nombre}</span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => handleRenombrarEscuela(escuela)}
                              style={{ padding: '0.3rem 0.7rem', background: '#2196F3', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                              ✏️ Renombrar
                            </button>
                            <button onClick={() => handleAgregarGrupo(escuela)}
                              style={{ padding: '0.3rem 0.7rem', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                              ➕ Grupo
                            </button>
                            <button onClick={() => handleEliminarEscuela(escuela)}
                              style={{ padding: '0.3rem 0.7rem', background: '#f44336', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {(escuela.grupos || []).map(grupo => (
                            <div key={grupo} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '0.2rem 0.6rem' }}>
                              <span style={{ color: 'white', fontSize: '0.85rem' }}>{grupo}</span>
                              <button onClick={() => handleRenombrarGrupo(escuela, grupo)}
                                style={{ background: 'none', border: 'none', color: '#90CAF9', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>
                                ✏️
                              </button>
                              <button onClick={() => handleEliminarGrupo(escuela, grupo)}
                                style={{ background: 'none', border: 'none', color: '#EF9A9A', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="ios-list-container">
                {cargandoEscuelas ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>Cargando escuelas...</p>
                ) : escuelas.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem' }}>
                    No hay escuelas registradas. Usa "🏫 Administrar Escuelas" para crear la primera.
                  </p>
                ) : (
                  escuelas.map(e => (
                    <button key={e.id} className="ios-list-item" onClick={() => seleccionarEscuela(e)}>
                      <div className="item-content"><h3>{e.nombre}</h3></div>
                      <span className="chevron-right">›</span>
                    </button>
                  ))
                )}
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

              {/* Agregar alumnos — visible en modo edición: individual, pegar lista, o archivo */}
              <AnimatePresence>
                {modoEdicion && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="teacher-controls ios-glass"
                    style={{ marginTop: 8, overflow: 'hidden' }}
                  >
                    {/* Pestañas de método */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {[
                        { id: 'individual', label: '📝 Uno por uno' },
                        { id: 'pegar',      label: '📋 Pegar lista' },
                        { id: 'archivo',    label: '📄 Subir archivo' },
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setMetodoAgregar(m.id)}
                          style={{
                            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${metodoAgregar === m.id ? '#4CAF50' : 'rgba(255,255,255,0.15)'}`,
                            background: metodoAgregar === m.id ? 'rgba(76,175,80,0.18)' : 'transparent',
                            color: metodoAgregar === m.id ? '#4CAF50' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Individual */}
                    {metodoAgregar === 'individual' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Nombre del nuevo alumno"
                          value={nuevoAlumnoNombre}
                          onChange={(e) => setNuevoAlumnoNombre(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAgregarAlumno()}
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 14 }}
                        />
                        <button
                          onClick={handleAgregarAlumno}
                          disabled={agregandoAlumno || !nuevoAlumnoNombre.trim()}
                          style={{ background: '#4CAF50', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: agregandoAlumno ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                          {agregandoAlumno ? '⏳...' : '➕ Agregar'}
                        </button>
                      </div>
                    )}

                    {/* Pegar lista */}
                    {metodoAgregar === 'pegar' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                          Pega varios nombres (uno por línea) y agrégalos todos juntos.
                        </p>
                        <textarea
                          placeholder={'Juan Pérez\nMaría García\nCarlos López'}
                          value={textoMasivoAlumnos}
                          onChange={(e) => setTextoMasivoAlumnos(e.target.value)}
                          rows={5}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <button
                          onClick={handleAgregarMasivo}
                          disabled={agregandoMasivo || !textoMasivoAlumnos.trim()}
                          style={{ background: '#4CAF50', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: agregandoMasivo ? 0.6 : 1, alignSelf: 'flex-start' }}
                        >
                          {agregandoMasivo ? '⏳ Agregando...' : '➕ Agregar todos'}
                        </button>
                      </div>
                    )}

                    {/* Subir archivo */}
                    {metodoAgregar === 'archivo' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>
                          Soportado hoy: <strong>.txt</strong>, <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> (nombres en la primera columna).<br />
                          Word (.docx) y PDF todavía no están soportados.
                        </p>
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px 18px', borderRadius: 10, background: 'rgba(33,150,243,0.15)',
                          border: '1px solid rgba(33,150,243,0.4)', color: '#2196F3', fontWeight: 600,
                          fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start',
                        }}>
                          {cargandoArchivoAlumnos ? '⏳ Procesando...' : '📁 Seleccionar archivo'}
                          <input
                            type="file"
                            accept=".txt,.csv,.xlsx,.xls"
                            onChange={procesarArchivoAlumnos}
                            disabled={cargandoArchivoAlumnos}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

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
                      <div className="edit-xp-buttons" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="xp-btn minus" onClick={(e) => { e.stopPropagation(); ajustarPuntosManuales(a, -5); }}>-5</div>
                        <div className="xp-btn plus"  onClick={(e) => { e.stopPropagation(); ajustarPuntosManuales(a,  5); }}>+5</div>
                        <div
                          onClick={(e) => { e.stopPropagation(); handleEliminarAlumno(a); }}
                          title="Eliminar alumno"
                          style={{ marginLeft: 6, color: '#EF5350', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
                        >
                          🗑️
                        </div>
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
