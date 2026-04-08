import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import {
  collection, query, where, getDocs, limit,
  deleteDoc, doc, setDoc, writeBatch, addDoc,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import './Estadisticas.css';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const formatearFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

const diasSinLeer = (lecturas) => {
  if (!lecturas?.length) return 999;
  const ultima = new Date(lecturas[0].fecha);
  return Math.floor((Date.now() - ultima) / 86400000);
};

const colorCalif = (n) =>
  n >= 8 ? '#30d158' : n >= 6 ? '#ffd60a' : '#ff453a';

// ─────────────────────────────────────────────────────────────
// TOOLTIP PERSONALIZADO
// ─────────────────────────────────────────────────────────────
const TooltipCustom = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <p style={{ color: '#8e8e93', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
const Estadisticas = ({ alumno, grupo, escuelaId, onClose }) => {

  // ── Estados ──
  const [lecturasBrutas,    setLecturasBrutas]    = useState([]);
  const [lecturasVisibles,  setLecturasVisibles]  = useState([]);
  const [estadisticas,      setEstadisticas]      = useState(null);
  const [ciclos,            setCiclos]            = useState([]);
  const [vistaActual,       setVistaActual]       = useState(alumno ? 'individual' : 'grupo');
  const [cargando,          setCargando]          = useState(true);
  const [errorCarga,        setErrorCarga]        = useState(null);
  const [cicloSeleccionado, setCicloSeleccionado] = useState('all');
  const [tabActiva,         setTabActiva]         = useState('resumen'); // resumen | progreso | distribucion | alertas
  const [modoLimpieza,      setModoLimpieza]      = useState(false);
  const [ultimaAccionBorrado, setUltimaAccionBorrado] = useState(null);
  const [modoGestorCiclos,  setModoGestorCiclos]  = useState(false);
  const [nuevoCiclo,        setNuevoCiclo]        = useState({ nombre: '', inicio: '', fin: '' });

  useEffect(() => {
    if (alumno) setVistaActual('individual');
  }, [alumno]);

  // ── Carga Firebase ──
  const cargarDatos = async () => {
    if (!escuelaId || !grupo) return;
    setCargando(true); setErrorCarga(null);
    try {
      const qCiclos = query(
        collection(db, 'ciclos'),
        where('escuelaId', '==', escuelaId),
        where('grupo',     '==', grupo),
      );
      const snapCiclos = await getDocs(qCiclos);
      setCiclos(snapCiclos.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio)));

      let qLecturas;
      if (vistaActual === 'individual' && alumno) {
        qLecturas = query(collection(db, 'lecturas'), where('alumnoId', '==', alumno.id), limit(150));
      } else {
        qLecturas = query(
          collection(db, 'lecturas'),
          where('escuelaId', '==', escuelaId),
          where('grupo',     '==', grupo),
          limit(400),
        );
      }
      const snap = await getDocs(qLecturas);
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setLecturasBrutas(data);
    } catch (e) {
      console.error(e);
      setErrorCarga('Error de conexión con la base de datos.');
    }
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, [vistaActual, alumno, grupo, escuelaId]);

  // ── Motor de cálculo ──
  useEffect(() => {
    if (!lecturasBrutas) return;
    let filtradas = [...lecturasBrutas];

    if (cicloSeleccionado !== 'all') {
      const cicloDef = ciclos.find(c => c.id === cicloSeleccionado);
      if (cicloDef) {
        const inicio = new Date(cicloDef.inicio).getTime();
        const fin    = new Date(cicloDef.fin).getTime() + 86400000;
        filtradas = filtradas.filter(l => {
          const f = new Date(l.fecha).getTime();
          return f >= inicio && f <= fin;
        });
      }
    }
    setLecturasVisibles(filtradas);
    if (!filtradas.length) { setEstadisticas(null); return; }

    if (vistaActual === 'individual') {
      const sumCalf = filtradas.reduce((s, l) => s + (l.calificacionFinal || 0), 0);
      const sumPPM  = filtradas.reduce((s, l) => s + (l.palabrasPorMinuto  || 0), 0);
      const sumXP   = filtradas.reduce((s, l) => s + (l.puntosGanados      || 0), 0);
      const mejor   = filtradas.reduce((p, c) => (p.calificacionFinal||0) > (c.calificacionFinal||0) ? p : c);
      const peor    = filtradas.reduce((p, c) => (p.calificacionFinal||0) < (c.calificacionFinal||0) ? p : c);
      const tendencia = filtradas.length > 1
        ? filtradas[0].calificacionFinal - filtradas[filtradas.length - 1].calificacionFinal : 0;

      // Datos para gráfica dual (nota + PPM)
      const graficaDual = filtradas.slice().reverse().map(l => ({
        fecha: formatearFecha(l.fecha),
        nota:  +(l.calificacionFinal || 0).toFixed(1),
        ppm:   l.palabrasPorMinuto || 0,
      }));

      // Racha actual (días consecutivos con al menos 1 lectura)
      const fechasUnicas = [...new Set(filtradas.map(l =>
        new Date(l.fecha).toLocaleDateString('es-MX')))];
      let racha = 0;
      const hoy = new Date();
      for (let i = 0; i < fechasUnicas.length; i++) {
        const dia = new Date(hoy);
        dia.setDate(hoy.getDate() - i);
        if (fechasUnicas.includes(dia.toLocaleDateString('es-MX'))) racha++;
        else break;
      }

      setEstadisticas({
        total:        filtradas.length,
        promedio:     (sumCalf / filtradas.length).toFixed(1),
        ppmPromedio:  Math.round(sumPPM / filtradas.length),
        puntosTotal:  sumXP,
        tendencia:    tendencia.toFixed(1),
        mejorLectura: mejor,
        peorLectura:  peor,
        graficaDual,
        racha,
        diasSinActividad: diasSinLeer(filtradas),
      });

    } else {
      // ── Vista grupal ──
      const porAlumno = {};
      filtradas.forEach(l => {
        if (!porAlumno[l.alumnoId]) {
          porAlumno[l.alumnoId] = {
            nombre: l.alumnoNombre, lecturas: [], totalPuntos: 0,
          };
        }
        porAlumno[l.alumnoId].lecturas.push(l);
        porAlumno[l.alumnoId].totalPuntos += (l.puntosGanados || 0);
      });
      Object.values(porAlumno).forEach(a => {
        a.promedio    = a.lecturas.reduce((s, l) => s + (l.calificacionFinal||0), 0) / a.lecturas.length;
        a.ppmPromedio = Math.round(a.lecturas.reduce((s, l) => s + (l.palabrasPorMinuto||0), 0) / a.lecturas.length);
        a.diasInactivo = diasSinLeer(a.lecturas.sort((x, y) => new Date(y.fecha) - new Date(x.fecha)));
      });

      const ranking = Object.values(porAlumno)
        .sort((a, b) => b.promedio - a.promedio)
        .slice(0, 10);

      const promG = filtradas.reduce((s, l) => s + (l.calificacionFinal||0), 0) / filtradas.length;
      const ppmG  = Math.round(filtradas.reduce((s, l) => s + (l.palabrasPorMinuto||0), 0) / filtradas.length);

      // Distribución de calificaciones (rangos 0-4, 4-6, 6-8, 8-10)
      const distribucion = [
        { rango: '0 – 4',  count: 0, color: '#ff453a' },
        { rango: '4 – 6',  count: 0, color: '#ffd60a' },
        { rango: '6 – 8',  count: 0, color: '#0a84ff' },
        { rango: '8 – 10', count: 0, color: '#30d158' },
      ];
      filtradas.forEach(l => {
        const n = l.calificacionFinal || 0;
        if (n < 4) distribucion[0].count++;
        else if (n < 6) distribucion[1].count++;
        else if (n < 8) distribucion[2].count++;
        else distribucion[3].count++;
      });

      // Evolución semanal del grupo
      const porSemana = {};
      filtradas.forEach(l => {
        const d    = new Date(l.fecha);
        const lunes = new Date(d);
        lunes.setDate(d.getDate() - d.getDay() + 1);
        const key  = lunes.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        if (!porSemana[key]) porSemana[key] = { notas: [], ppms: [] };
        porSemana[key].notas.push(l.calificacionFinal || 0);
        porSemana[key].ppms.push(l.palabrasPorMinuto  || 0);
      });
      const evolucionSemanal = Object.entries(porSemana)
        .slice(-8)
        .map(([semana, d]) => ({
          semana,
          nota: +(d.notas.reduce((s, n) => s + n, 0) / d.notas.length).toFixed(1),
          ppm:  Math.round(d.ppms.reduce((s, n) => s + n, 0) / d.ppms.length),
        }));

      // Alertas — alumnos sin leer en los últimos 7 días
      const alertas = Object.values(porAlumno)
        .filter(a => a.diasInactivo >= 7)
        .sort((a, b) => b.diasInactivo - a.diasInactivo);

      setEstadisticas({
        total:            filtradas.length,
        activos:          Object.keys(porAlumno).length,
        promedioGrupo:    promG.toFixed(1),
        ppmGrupo:         ppmG,
        ranking,
        distribucion,
        evolucionSemanal,
        alertas,
      });
    }
  }, [lecturasBrutas, cicloSeleccionado, vistaActual, ciclos]);

  // ── Exportaciones ──
  const exportarExcel = () => {
    const data = lecturasVisibles.map(l => ({
      Fecha:  new Date(l.fecha).toLocaleDateString(),
      Alumno: l.alumnoNombre,
      PPM:    l.palabrasPorMinuto,
      Nota:   l.calificacionFinal,
      XP:     l.puntosGanados,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.utils.writeFile(wb, `Reporte_${grupo}.xlsx`);
  };

  const exportarPDF = async () => {
    const el     = document.getElementById('capture-area');
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#000' });
    const pdf    = new jsPDF('p', 'mm', 'a4');
    pdf.setFillColor(0, 0, 0);
    pdf.rect(0, 0, 210, 297, 'F');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 10, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`Reporte_${Date.now()}.pdf`);
  };

  // ── Limpieza ──
  const eliminarLectura = async (l) => {
    if (!window.confirm('¿Eliminar este registro permanentemente?')) return;
    await deleteDoc(doc(db, 'lecturas', l.id));
    setLecturasBrutas(prev => prev.filter(i => i.id !== l.id));
    setUltimaAccionBorrado({ tipo: 'UNICA', datos: [l] });
  };

  const reiniciarHistorial = async () => {
    const nombre = cicloSeleccionado === 'all'
      ? 'TODO el historial'
      : `el periodo "${ciclos.find(c => c.id === cicloSeleccionado)?.nombre}"`;
    if (!window.confirm(`⚠️ Borrar ${nombre} para el Grupo ${grupo}. ¿Continuar?`)) return;
    if (!window.confirm('🚨 Confirmación final: acción irreversible. ¿Proceder?')) return;
    setCargando(true);
    const batch = writeBatch(db);
    lecturasVisibles.forEach(l => batch.delete(doc(db, 'lecturas', l.id)));
    await batch.commit();
    const ids = new Set(lecturasVisibles.map(l => l.id));
    setLecturasBrutas(prev => prev.filter(l => !ids.has(l.id)));
    setCargando(false);
  };

  const deshacerBorrado = async () => {
    if (!ultimaAccionBorrado) return;
    const batch = writeBatch(db);
    ultimaAccionBorrado.datos.forEach(({ id, ...resto }) =>
      batch.set(doc(db, 'lecturas', id), resto));
    await batch.commit();
    setLecturasBrutas(prev => [...ultimaAccionBorrado.datos, ...prev]);
    setUltimaAccionBorrado(null);
  };

  const manejarCrearCiclo = async (e) => {
    e.preventDefault();
    if (!nuevoCiclo.nombre) return;
    const ref = await addDoc(collection(db, 'ciclos'), { escuelaId, grupo, ...nuevoCiclo });
    setCiclos([...ciclos, { id: ref.id, ...nuevoCiclo }]);
    setNuevoCiclo({ nombre: '', inicio: '', fin: '' });
    setModoGestorCiclos(false);
  };

  // ════════════════════════════════════════════════════════════
  // SUBCOMPONENTES DE GRÁFICAS
  // ════════════════════════════════════════════════════════════

  // Gráfica dual nota + PPM (individual)
  const GraficaDual = () => (
    <div className="stats-card ios-glass" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Progresión</h3>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#8e8e93' }}>
          <span style={{ color: '#0a84ff' }}>— Nota</span>
          <span style={{ color: '#30d158' }}>— PPM ÷ 20</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={estadisticas.graficaDual}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="fecha" stroke="#8e8e93" fontSize={10} />
          <YAxis yAxisId="nota" domain={[0, 10]} stroke="#8e8e93" fontSize={10} />
          <YAxis yAxisId="ppm"  orientation="right" stroke="#8e8e93" fontSize={10}
            tickFormatter={v => `${v}`} />
          <Tooltip content={<TooltipCustom />} />
          <ReferenceLine yAxisId="nota" y={6} stroke="rgba(255,214,10,0.3)" strokeDasharray="4 4" />
          <Line yAxisId="nota" type="monotone" dataKey="nota" stroke="#0a84ff"
            strokeWidth={2.5} dot={{ r: 3, fill: '#0a84ff' }} name="Nota" />
          <Line yAxisId="ppm"  type="monotone" dataKey="ppm"  stroke="#30d158"
            strokeWidth={2} dot={false} name="PPM" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // Evolución semanal del grupo
  const GraficaSemanal = () => (
    <div className="stats-card ios-glass" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Evolución semanal</h3>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#8e8e93' }}>
          <span style={{ color: '#0a84ff' }}>— Nota promedio</span>
          <span style={{ color: '#30d158' }}>— PPM promedio</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={estadisticas.evolucionSemanal}>
          <defs>
            <linearGradient id="gNota" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0a84ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0a84ff" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gPPM" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#30d158" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#30d158" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="semana" stroke="#8e8e93" fontSize={10} />
          <YAxis yAxisId="nota" domain={[0, 10]} stroke="#8e8e93" fontSize={10} />
          <YAxis yAxisId="ppm"  orientation="right" stroke="#8e8e93" fontSize={10} />
          <Tooltip content={<TooltipCustom />} />
          <Area yAxisId="nota" type="monotone" dataKey="nota" stroke="#0a84ff"
            fill="url(#gNota)" strokeWidth={2.5} name="Nota" />
          <Area yAxisId="ppm"  type="monotone" dataKey="ppm"  stroke="#30d158"
            fill="url(#gPPM)"  strokeWidth={2}   name="PPM" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  // Distribución de calificaciones
  const GraficaDistribucion = () => (
    <div className="stats-card ios-glass" style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem', color: '#fff' }}>
        Distribución de calificaciones
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={estadisticas.distribucion} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="rango" stroke="#8e8e93" fontSize={11} />
          <YAxis stroke="#8e8e93" fontSize={11} allowDecimals={false} />
          <Tooltip content={<TooltipCustom />} />
          <Bar dataKey="count" name="Lecturas" radius={[6, 6, 0, 0]}>
            {estadisticas.distribucion.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // Panel de alertas
  const PanelAlertas = () => {
    const alertas = estadisticas?.alertas || [];
    return (
      <div className="stats-card ios-glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>
            Alumnos sin actividad
          </h3>
          {alertas.length > 0 && (
            <span style={{
              background: 'rgba(255,69,58,0.2)', color: '#ff453a',
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            }}>
              {alertas.length} alerta{alertas.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {alertas.length === 0 ? (
          <p style={{ color: '#30d158', fontSize: 14, margin: 0 }}>
            ✓ Todos los alumnos han leído en los últimos 7 días
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'rgba(255,69,58,0.08)',
                borderRadius: 10, border: '1px solid rgba(255,69,58,0.2)',
              }}>
                <span style={{ color: '#fff', fontWeight: 500 }}>{a.nombre}</span>
                <span style={{ color: '#ff453a', fontSize: 12, fontWeight: 600 }}>
                  {a.diasInactivo === 999 ? 'Nunca ha leído' : `${a.diasInactivo} días sin leer`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <motion.div className="stats-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* HEADER */}
      <div className="stats-header ios-glass">
        <div className="header-info">
          <h2>📊 {vistaActual === 'individual' ? alumno?.nombre : `Grupo ${grupo}`}</h2>
          <div className="ciclo-selector-wrapper">
            <select className="ciclo-dropdown" value={cicloSeleccionado}
              onChange={e => setCicloSeleccionado(e.target.value)}>
              <option value="all">📅 Historial Completo</option>
              {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {!alumno && (
              <button className="btn-edit-ciclos"
                onClick={() => { setModoGestorCiclos(!modoGestorCiclos); setModoLimpieza(false); }}>
                ⚙️
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Tabs */}
          <div className="stats-tabs">
            {(['resumen', 'progreso', 'distribucion', 'alertas']).map(tab => (
              <button key={tab}
                className={`tab-btn ${tabActiva === tab ? 'active' : ''}`}
                onClick={() => setTabActiva(tab)}
              >
                {{ resumen: '📋 Resumen', progreso: '📈 Progreso',
                   distribucion: '📊 Distribución', alertas: '🔔 Alertas' }[tab]}
              </button>
            ))}
          </div>
          <div className="export-actions" style={{ display: 'flex', gap: 6 }}>
            <button className="tc-btn warning" onClick={exportarExcel}>XLSX</button>
            <button className="tc-btn danger"  onClick={exportarPDF}>PDF</button>
          </div>
          <button className="boton-cerrar-stats" onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8e8e93', fontSize: '1.4rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>

      <div className="stats-content-scroll" id="capture-area">

        {/* Gestor ciclos */}
        <AnimatePresence>
          {modoGestorCiclos && (
            <motion.div className="teacher-controls ios-glass"
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="tc-header"><span className="tc-title">Configurar Trimestre</span></div>
              <form className="ciclo-form" onSubmit={manejarCrearCiclo}>
                <input type="text" placeholder="Nombre del periodo"
                  value={nuevoCiclo.nombre} onChange={e => setNuevoCiclo({ ...nuevoCiclo, nombre: e.target.value })} />
                <div className="date-inputs">
                  <div><label>Inicio</label>
                    <input type="date" value={nuevoCiclo.inicio}
                      onChange={e => setNuevoCiclo({ ...nuevoCiclo, inicio: e.target.value })} /></div>
                  <div><label>Fin</label>
                    <input type="date" value={nuevoCiclo.fin}
                      onChange={e => setNuevoCiclo({ ...nuevoCiclo, fin: e.target.value })} /></div>
                </div>
                <button type="submit" className="tc-btn positive">Guardar Periodo</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controles limpieza */}
        <div className="teacher-controls ios-glass"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`tc-toggle ${modoLimpieza ? 'active' : ''}`}
              onClick={() => { setModoLimpieza(!modoLimpieza); setModoGestorCiclos(false); }}>
              {modoLimpieza ? '🔒 Bloquear Edición' : '🔓 Modo Limpieza'}
            </button>
            {modoLimpieza && (
              <button className="tc-btn danger" onClick={reiniciarHistorial}>
                🚨 Reiniciar Base de Datos
              </button>
            )}
          </div>
          {ultimaAccionBorrado && (
            <button className="tc-btn warning" onClick={deshacerBorrado}>↩️ Deshacer</button>
          )}
        </div>

        {/* Contenido principal */}
        {cargando ? (
          <div className="stats-loading">
            <div className="spinner-ios" />
            <p>Sincronizando registros...</p>
          </div>
        ) : !estadisticas ? (
          <div className="stats-empty-state ios-glass">
            <h3>No hay registros en este periodo</h3>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tabActiva}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            >

              {/* ── TAB RESUMEN ── */}
              {tabActiva === 'resumen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Métricas principales */}
                  <div className="metrics-grid">
                    <div className="metric-card ios-glass">
                      <span className="m-icon">📚</span>
                      <span className="m-value">{estadisticas.total}</span>
                      <span className="m-label">Lecturas</span>
                    </div>
                    <div className="metric-card ios-glass">
                      <span className="m-icon">⭐</span>
                      <span className="m-value" style={{ color: colorCalif(parseFloat(estadisticas.promedio || estadisticas.promedioGrupo)) }}>
                        {estadisticas.promedio || estadisticas.promedioGrupo}
                      </span>
                      <span className="m-label">Promedio</span>
                    </div>
                    {vistaActual === 'individual' ? (
                      <>
                        <div className="metric-card ios-glass">
                          <span className="m-icon">🏃</span>
                          <span className="m-value">{estadisticas.ppmPromedio}</span>
                          <span className="m-label">PPM</span>
                        </div>
                        <div className="metric-card ios-glass">
                          <span className="m-icon">🔥</span>
                          <span className="m-value" style={{ color: estadisticas.racha > 0 ? '#ff9f0a' : '#8e8e93' }}>
                            {estadisticas.racha}
                          </span>
                          <span className="m-label">Racha días</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="metric-card ios-glass">
                          <span className="m-icon">👥</span>
                          <span className="m-value">{estadisticas.activos}</span>
                          <span className="m-label">Alumnos activos</span>
                        </div>
                        <div className="metric-card ios-glass">
                          <span className="m-icon">🏃</span>
                          <span className="m-value">{estadisticas.ppmGrupo}</span>
                          <span className="m-label">PPM promedio</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tendencia individual */}
                  {vistaActual === 'individual' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className={`tendencia-card ios-glass ${parseFloat(estadisticas.tendencia) >= 0 ? 'positiva' : 'negativa'}`}>
                        <h3>Tendencia</h3>
                        <div className="tendencia-valor">
                          {parseFloat(estadisticas.tendencia) >= 0 ? '+' : ''}{estadisticas.tendencia}
                        </div>
                        <p>vs primera lectura</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="comp-card mejor ios-glass">
                          <h4>🏆 Mejor</h4>
                          <div className="c-score">{estadisticas.mejorLectura?.calificacionFinal?.toFixed(1)}</div>
                        </div>
                        <div className="comp-card peor ios-glass">
                          <h4>📖 Peor</h4>
                          <div className="c-score">{estadisticas.peorLectura?.calificacionFinal?.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ranking grupal */}
                  {vistaActual !== 'individual' && (
                    <div className="ranking-section ios-glass">
                      <h3>🏅 Top 10 Lectores</h3>
                      <div className="ranking-list">
                        {estadisticas.ranking.map((r, i) => (
                          <div key={i} className={`ranking-item ${i < 3 ? 'top-3' : ''}`}>
                            <span className="r-pos">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                            </span>
                            <span className="r-name">{r.nombre}</span>
                            <span style={{ color: '#0a84ff', fontSize: 12, marginRight: 8 }}>
                              {r.ppmPromedio} PPM
                            </span>
                            <span className="r-avg" style={{ color: colorCalif(r.promedio) }}>
                              {r.promedio.toFixed(1)}
                            </span>
                            <span className="r-xp">{r.totalPuntos} XP</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial individual */}
                  {vistaActual === 'individual' && (
                    <div className="history-section ios-glass">
                      <h3>📜 Historial reciente</h3>
                      <div className="history-list">
                        {lecturasVisibles.map(l => (
                          <div key={l.id} className="history-item">
                            <span className="h-date">{formatearFecha(l.fecha)}</span>
                            <span className="h-score" style={{ color: colorCalif(l.calificacionFinal) }}>
                              {l.calificacionFinal?.toFixed(1)}
                            </span>
                            <span className="h-ppm">{l.palabrasPorMinuto} PPM</span>
                            <span className="h-xp">+{l.puntosGanados} XP</span>
                            {modoLimpieza && (
                              <button className="del-btn-mini" onClick={() => eliminarLectura(l)}>🗑️</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB PROGRESO ── */}
              {tabActiva === 'progreso' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {vistaActual === 'individual' && estadisticas.graficaDual?.length > 1
                    ? <GraficaDual />
                    : estadisticas.evolucionSemanal?.length > 0
                    ? <GraficaSemanal />
                    : <div className="stats-empty-state ios-glass"><h3>Pocas lecturas para graficar</h3></div>
                  }

                  {/* Historial grupal en tab progreso */}
                  {vistaActual !== 'individual' && (
                    <div className="history-section ios-glass">
                      <h3>📜 Historial cronológico del grupo</h3>
                      <div className="history-list">
                        {lecturasVisibles.map(l => (
                          <div key={l.id} className="history-item">
                            <span className="h-date">{formatearFecha(l.fecha)}</span>
                            <span className="h-name" style={{ flex: 1, marginLeft: 10, color: '#fff' }}>
                              {l.alumnoNombre}
                            </span>
                            <span className="h-score" style={{ color: colorCalif(l.calificacionFinal) }}>
                              {l.calificacionFinal?.toFixed(1)}
                            </span>
                            <span className="h-ppm" style={{ marginLeft: 15, fontSize: '0.8rem', color: '#8e8e93' }}>
                              {l.palabrasPorMinuto} PPM
                            </span>
                            {modoLimpieza && (
                              <button className="del-btn-mini" onClick={() => eliminarLectura(l)}>🗑️</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB DISTRIBUCIÓN ── */}
              {tabActiva === 'distribucion' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {estadisticas.distribucion
                    ? <GraficaDistribucion />
                    : <div className="stats-empty-state ios-glass"><h3>Solo disponible en vista grupal</h3></div>
                  }
                  {/* Resumen por rango */}
                  {estadisticas.distribucion && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      {estadisticas.distribucion.map((d, i) => (
                        <div key={i} className="metric-card ios-glass"
                          style={{ borderColor: `${d.color}40`, background: `${d.color}10` }}>
                          <span className="m-value" style={{ color: d.color, fontSize: '1.8rem' }}>
                            {d.count}
                          </span>
                          <span className="m-label">{d.rango}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB ALERTAS ── */}
              {tabActiva === 'alertas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <PanelAlertas />

                  {/* Resumen de actividad reciente */}
                  <div className="stats-card ios-glass" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '1rem', color: '#fff' }}>
                      Actividad últimos 7 días
                    </h3>
                    {(() => {
                      const hace7 = Date.now() - 7 * 86400000;
                      const recientes = lecturasVisibles.filter(
                        l => new Date(l.fecha).getTime() >= hace7,
                      );
                      const alumnosActivos = new Set(recientes.map(l => l.alumnoId)).size;
                      const totalAlumnos   = new Set(lecturasVisibles.map(l => l.alumnoId)).size;
                      return (
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="metric-card ios-glass" style={{ flex: 1 }}>
                            <span className="m-value" style={{ color: '#30d158' }}>{recientes.length}</span>
                            <span className="m-label">Lecturas</span>
                          </div>
                          <div className="metric-card ios-glass" style={{ flex: 1 }}>
                            <span className="m-value" style={{ color: '#0a84ff' }}>{alumnosActivos}</span>
                            <span className="m-label">Alumnos activos</span>
                          </div>
                          <div className="metric-card ios-glass" style={{ flex: 1 }}>
                            <span className="m-value" style={{ color: '#ff453a' }}>
                              {totalAlumnos - alumnosActivos}
                            </span>
                            <span className="m-label">Sin actividad</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default Estadisticas;