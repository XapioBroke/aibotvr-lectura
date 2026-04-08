// ─────────────────────────────────────────────────────────────
// CierreSesion.jsx — Cierre grupal de sesión de lectura
// El maestro lo activa manualmente desde el panel del grupo
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { narrarResumen, detener } from './voiceService';
import { useAuraStore } from './store';
import { generarPPTX } from './pptxGenerator';

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// Props:
//   grupo: string
//   escuela: string
//   lecturasSession: array de { alumnoNombre, transcripcion, calificacionFinal, palabrasPorMinuto }
//   onCerrar: función para cerrar el panel
// ─────────────────────────────────────────────────────────────
const CierreSesion = ({ grupo, escuela, lecturasSession = [], onCerrar }) => {
  const muteado = useAuraStore(s => s.muteado);

  const [fase,            setFase]            = useState('inicio');
  const [cierreData,      setCierreData]       = useState(null);
  const [tipoEsquema,     setTipoEsquema]      = useState('');   // vacío — maestro elige antes de generar
  const [generandoPPTX,   setGenerandoPPTX]    = useState(false);
  const [narrando,        setNarrando]         = useState(false);
  const [error,           setError]            = useState(null);

  const TIPOS_ESQUEMA = [
    { id: 'sinoptico',    label: 'Cuadro sinóptico',    desc: 'Llaves jerárquicas con tema → ramas → subramas con resumen' },
    { id: 'conceptual',   label: 'Mapa conceptual',     desc: 'Nodos conectados con proposiciones y conectores' },
    { id: 'mental',       label: 'Mapa mental',         desc: 'Concepto central con ramas irradiadas y palabras clave' },
    { id: 'ideas',        label: 'Cuadro de ideas',     desc: 'Tabla de ideas principales con explicación de cada una' },
    { id: 'comparativo',  label: 'Cuadro comparativo',  desc: 'Tabla que compara conceptos por criterios específicos' },
    { id: 'arana',        label: 'Araña didáctica',     desc: 'Concepto central con patas temáticas y detalles colgantes' },
  ];

  const totalAlumnos  = lecturasSession.length;
  const promedioGrupo = totalAlumnos > 0
    ? (lecturasSession.reduce((s, l) => s + (l.calificacionFinal || 0), 0) / totalAlumnos).toFixed(1)
    : 0;

  const generarCierre = async () => {
    if (!tipoEsquema) { setError('Selecciona un tipo de esquema antes de continuar.'); return; }
    setFase('generando'); setError(null);

    const transcripcionesTexto = lecturasSession.length > 0
      ? lecturasSession.map(l => `${l.alumnoNombre}: "${l.transcripcion?.substring(0, 400) || ''}"`).join('\n')
      : 'Sin lecturas registradas en esta sesión — genera el esquema basado en el tema del grupo.';

    const tipoLabel = TIPOS_ESQUEMA.find(t => t.id === tipoEsquema)?.label || tipoEsquema;

    // Estructura del esquema según el tipo — construida como objeto para evitar JSON inválido
    const estructuraEsquema = {
      sinoptico: `"ramas": [
        { "titulo": "Rama principal 1 del tema", "resumen": "Descripción detallada de 2-3 oraciones con datos reales del texto leído", "subramas": [{ "titulo": "Subtema 1.1", "detalle": "Dato específico del texto" }, { "titulo": "Subtema 1.2", "detalle": "Dato específico del texto" }] },
        { "titulo": "Rama principal 2 del tema", "resumen": "Descripción detallada de 2-3 oraciones con datos reales del texto leído", "subramas": [{ "titulo": "Subtema 2.1", "detalle": "Dato específico" }, { "titulo": "Subtema 2.2", "detalle": "Dato específico" }] },
        { "titulo": "Rama principal 3 del tema", "resumen": "Descripción detallada de 2-3 oraciones con datos reales del texto leído", "subramas": [{ "titulo": "Subtema 3.1", "detalle": "Dato específico" }] }
      ]`,
      conceptual: `"conceptoCentral": "Concepto principal del tema",
      "nodos": [
        { "concepto": "Concepto relacionado 1", "conector": "se origina en", "descripcion": "Explicación de 2-3 oraciones con datos reales del texto" },
        { "concepto": "Concepto relacionado 2", "conector": "generó", "descripcion": "Explicación de 2-3 oraciones con datos reales del texto" },
        { "concepto": "Concepto relacionado 3", "conector": "se caracteriza por", "descripcion": "Explicación de 2-3 oraciones con datos reales del texto" },
        { "concepto": "Concepto relacionado 4", "conector": "tuvo como consecuencia", "descripcion": "Explicación de 2-3 oraciones con datos reales del texto" }
      ],
      "relaciones": [
        { "desde": "Concepto relacionado 1", "conector": "provocó", "hacia": "Concepto relacionado 2" },
        { "desde": "Concepto relacionado 2", "conector": "llevó a", "hacia": "Concepto relacionado 3" }
      ]`,
      mental: `"conceptoCentral": "Concepto central del tema",
      "ramas": [
        { "titulo": "Rama 1", "palabrasClave": ["palabra1", "palabra2", "palabra3"], "detalle": "Explicación de 2-3 oraciones con datos del texto leído" },
        { "titulo": "Rama 2", "palabrasClave": ["palabra4", "palabra5", "palabra6"], "detalle": "Explicación de 2-3 oraciones con datos del texto leído" },
        { "titulo": "Rama 3", "palabrasClave": ["palabra7", "palabra8"], "detalle": "Explicación de 2-3 oraciones con datos del texto leído" },
        { "titulo": "Rama 4", "palabrasClave": ["palabra9", "palabra10"], "detalle": "Explicación de 2-3 oraciones con datos del texto leído" }
      ]`,
      ideas: `"ideas": [
        { "idea": "Idea principal 1 del texto", "explicacion": "Explicación completa de 3-4 oraciones con datos específicos y concretos del texto leído", "ejemplos": ["Ejemplo concreto del texto 1", "Ejemplo concreto del texto 2"] },
        { "idea": "Idea principal 2 del texto", "explicacion": "Explicación completa de 3-4 oraciones con datos específicos y concretos del texto leído", "ejemplos": ["Ejemplo concreto del texto"] },
        { "idea": "Idea principal 3 del texto", "explicacion": "Explicación completa de 3-4 oraciones con datos específicos y concretos del texto leído", "ejemplos": ["Ejemplo concreto del texto"] },
        { "idea": "Idea principal 4 del texto", "explicacion": "Explicación completa de 3-4 oraciones con datos específicos y concretos del texto leído", "ejemplos": [] }
      ]`,
      comparativo: `"criterios": ["Criterio de comparación 1", "Criterio de comparación 2", "Criterio de comparación 3", "Criterio de comparación 4"],
      "elementos": [
        { "nombre": "Elemento A del texto", "valores": ["Valor A para criterio 1", "Valor A para criterio 2", "Valor A para criterio 3", "Valor A para criterio 4"] },
        { "nombre": "Elemento B del texto", "valores": ["Valor B para criterio 1", "Valor B para criterio 2", "Valor B para criterio 3", "Valor B para criterio 4"] },
        { "nombre": "Elemento C del texto", "valores": ["Valor C para criterio 1", "Valor C para criterio 2", "Valor C para criterio 3", "Valor C para criterio 4"] }
      ],
      "conclusion": "Conclusión comparativa de 2-3 oraciones basada en los datos reales del texto"`,
      arana: `"conceptoCentral": "Concepto central con descripción de 2 oraciones del texto leído",
      "patas": [
        { "tema": "Tema de pata 1", "detalle": "Explicación de 2-3 oraciones con datos reales del texto leído", "subdetalles": ["Subdetalle específico 1.1", "Subdetalle específico 1.2"] },
        { "tema": "Tema de pata 2", "detalle": "Explicación de 2-3 oraciones con datos reales del texto leído", "subdetalles": ["Subdetalle específico 2.1"] },
        { "tema": "Tema de pata 3", "detalle": "Explicación de 2-3 oraciones con datos reales del texto leído", "subdetalles": ["Subdetalle específico 3.1"] },
        { "tema": "Tema de pata 4", "detalle": "Explicación de 2-3 oraciones con datos reales del texto leído", "subdetalles": ["Subdetalle específico 4.1"] }
      ]`,
    }[tipoEsquema] || '"contenido": "Sin estructura definida"';

    const prompt = `Eres un experto en pedagogía educativa de Aura Core.
Analiza las lecturas del grupo ${grupo} y genera un cierre de sesión COMPLETO.
TIPO DE ESQUEMA: ${tipoLabel}
LECTURAS:
${transcripcionesTexto}
PROMEDIO: ${promedioGrupo}/10

INSTRUCCIONES:
- Usa ÚNICAMENTE información real de las transcripciones, no ejemplos genéricos
- Cada campo de texto debe tener contenido sustancial basado en lo que realmente se leyó
- El esquema debe estar completamente lleno con datos del texto
- Responde SOLO con JSON puro sin markdown ni texto adicional

{"temaCentral":"Tema real identificado en las lecturas","resumenNarrativo":"Párrafo de 3-4 oraciones narrando lo que el grupo aprendió con datos concretos del texto","conceptosClave":[{"concepto":"Concepto real 1 del texto","resumen":"Explicación de 2-3 oraciones con información sustancial y concreta del texto leído"},{"concepto":"Concepto real 2 del texto","resumen":"Explicación de 2-3 oraciones con información sustancial y concreta del texto leído"},{"concepto":"Concepto real 3 del texto","resumen":"Explicación de 2-3 oraciones con información sustancial y concreta del texto leído"},{"concepto":"Concepto real 4 del texto","resumen":"Explicación de 2-3 oraciones con información sustancial y concreta del texto leído"},{"concepto":"Concepto real 5 del texto","resumen":"Explicación de 2-3 oraciones con información sustancial y concreta del texto leído"}],"mapaComprension":[{"nivel":"Alta comprensión","alumnos":["Nombre"],"descripcion":"Descripción basada en la calificación"},{"nivel":"Comprensión media","alumnos":["Nombre"],"descripcion":"Descripción basada en la calificación"},{"nivel":"Necesita apoyo","alumnos":[],"descripcion":"Descripción basada en la calificación"}],"preguntasRepaso":[{"pregunta":"Pregunta básica sobre el texto leído","dificultad":"Básica"},{"pregunta":"Pregunta de análisis causa-efecto del texto","dificultad":"Media"},{"pregunta":"Pregunta de análisis comparativo del texto","dificultad":"Media"},{"pregunta":"Pregunta de síntesis del texto","dificultad":"Avanzada"},{"pregunta":"Pregunta de reflexión crítica del texto","dificultad":"Avanzada"}],"actividadCierre":"Actividad concreta de 5-10 minutos basada en el tema leído","esquema":{"tipo":"${tipoEsquema}","titulo":"${tipoLabel} — tema real",${estructuraEsquema}}}`;

    try {
      const response = await fetch('http://localhost:3001/api/analizar-lectura', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error('Error de conexión con la IA');

      const data = await response.json();
      const texto = data.content?.[0]?.text || data.choices?.[0]?.message?.content || data.texto || '';
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('La IA no generó una respuesta estructurada');

      const parsed = JSON.parse(match[0]);
      setCierreData(parsed);
      setFase('resultado');
    } catch (e) {
      console.error(e);
      setError('Error al generar el cierre. ' + e.message);
      setFase('inicio');
    }
  };

  // ── Narrar resumen en clase ────────────────────────────────
  const handleNarrar = () => {
    if (narrando) { detener(); setNarrando(false); return; }
    if (muteado || !cierreData) return;
    setNarrando(true);
    const texto = `Cierre de sesión del grupo ${grupo}. ${cierreData.resumenNarrativo} Los conceptos clave de esta sesión fueron: ${cierreData.conceptosClave.join(', ')}. Actividad de cierre: ${cierreData.actividadCierre}`;
    narrarResumen(texto);
    const durMs = texto.split(' ').length * 380;
    setTimeout(() => setNarrando(false), durMs);
  };

  // ── Exportar PPTX ──────────────────────────────────────────
  const handleExportarPPTX = async () => {
    if (!cierreData) return;
    setGenerandoPPTX(true);
    try {
      await generarPPTX({
        tipo:       tipoEsquema,
        cierreData,
        grupo,
        escuela,
        promedioGrupo,
        totalAlumnos,
        lecturasSession,
      });
    } catch (e) {
      console.error('Error PPTX:', e);
      alert('Error al generar el PPTX: ' + e.message);
    }
    setGenerandoPPTX(false);
  };

  const colorDificultad = (d) =>
    d === 'Básica' ? '#30d158' : d === 'Media' ? '#ffd60a' : '#ff453a';

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position:     'fixed', inset: 0, zIndex: 99999,
        background:   'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display:      'flex', alignItems: 'center', justifyContent: 'center',
        padding:      '20px',
      }}
      onClick={onCerrar}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          background:   'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
          border:       '1px solid rgba(10,132,255,0.3)',
          borderRadius: 20,
          width:        '100%',
          maxWidth:     900,
          maxHeight:    '90vh',
          overflowY:    'auto',
          boxShadow:    '0 0 60px rgba(10,132,255,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          position:   'sticky', top: 0, zIndex: 10,
          background: 'rgba(10,14,39,0.97)',
          borderBottom: '1px solid rgba(10,132,255,0.2)',
          padding:    '16px 24px',
          display:    'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ margin: 0, fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#0a84ff', letterSpacing: '0.12em' }}>
              CIERRE DE SESIÓN
            </p>
            <p style={{ margin: '4px 0 0', color: '#fff', fontSize: 16, fontWeight: 600 }}>
              Grupo {grupo} — {escuela}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'right', marginRight: 8 }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0a84ff' }}>{totalAlumnos}</p>
              <p style={{ margin: 0, fontSize: 10, color: '#8e8e93' }}>alumnos</p>
            </div>
            <div style={{ textAlign: 'right', marginRight: 12 }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: promedioGrupo >= 8 ? '#30d158' : promedioGrupo >= 6 ? '#ffd60a' : '#ff453a' }}>
                {promedioGrupo}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: '#8e8e93' }}>promedio</p>
            </div>
            <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#fff', width: 36, height: 36, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>

          {/* ── FASE INICIO ── */}
          {fase === 'inicio' && (
            <div style={{ padding: '10px 0' }}>
              <p style={{ margin: '0 0 16px', fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#0a84ff', letterSpacing: '0.1em' }}>
                1. ELIGE EL TIPO DE ESQUEMA
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {TIPOS_ESQUEMA.map(t => (
                  <button key={t.id} onClick={() => setTipoEsquema(t.id)} style={{
                    background:   tipoEsquema === t.id ? 'rgba(10,132,255,0.2)' : 'rgba(255,255,255,0.05)',
                    border:       `2px solid ${tipoEsquema === t.id ? '#0a84ff' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}>
                    <p style={{ margin: '0 0 4px', color: tipoEsquema === t.id ? '#0a84ff' : '#fff', fontWeight: 600, fontSize: 13 }}>{t.label}</p>
                    <p style={{ margin: 0, color: '#8e8e93', fontSize: 10, lineHeight: 1.4 }}>{t.desc}</p>
                  </button>
                ))}
              </div>

              <p style={{ margin: '0 0 10px', fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#0a84ff', letterSpacing: '0.1em' }}>
                2. GENERAR CIERRE
              </p>
              <p style={{ color: '#8e8e93', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>
                {totalAlumnos > 0
                  ? `Se analizarán ${totalAlumnos} lecturas de esta sesión (promedio ${promedioGrupo}/10)`
                  : 'Sin lecturas en esta sesión — la IA generará el esquema basándose en el tema del grupo'}
              </p>

              {error && (
                <p style={{ color: '#ff453a', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
                  {error}
                </p>
              )}

              <button onClick={generarCierre} disabled={!tipoEsquema} style={{
                width: '100%',
                background:   tipoEsquema ? 'linear-gradient(135deg, #0a84ff, #5856d6)' : 'rgba(255,255,255,0.05)',
                border:       'none', borderRadius: 14, padding: '14px',
                color:        tipoEsquema ? '#fff' : '#8e8e93',
                fontFamily:   "'Press Start 2P', monospace", fontSize: 10,
                cursor:       tipoEsquema ? 'pointer' : 'not-allowed',
                letterSpacing: '0.1em',
                boxShadow:    tipoEsquema ? '0 4px 20px rgba(10,132,255,0.3)' : 'none',
                transition:   'all 0.2s',
              }}>
                {tipoEsquema ? `GENERAR ${TIPOS_ESQUEMA.find(t => t.id === tipoEsquema)?.label.toUpperCase()}` : 'SELECCIONA UN TIPO PRIMERO'}
              </button>
            </div>
          )}

          {/* ── FASE GENERANDO ── */}
          {fase === 'generando' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 60, height: 60, border: '4px solid rgba(10,132,255,0.2)', borderTopColor: '#0a84ff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
              <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#0a84ff', letterSpacing: '0.12em' }}>
                ANALIZANDO SESIÓN...
              </p>
              <p style={{ color: '#8e8e93', fontSize: 13, marginTop: 8 }}>
                La IA está procesando {totalAlumnos} lecturas
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── FASE RESULTADO ── */}
          {fase === 'resultado' && cierreData && (
            <div>
              {/* Barra de acciones */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                {!muteado && (
                  <button onClick={handleNarrar} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background:   narrando ? 'rgba(255,69,58,0.15)' : 'rgba(10,132,255,0.12)',
                    border:       `1px solid ${narrando ? 'rgba(255,69,58,0.4)' : 'rgba(10,132,255,0.3)'}`,
                    borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
                    color:        narrando ? '#ff453a' : '#0a84ff',
                    fontSize:     12, fontWeight: 600,
                  }}>
                    {narrando ? '⏹ Detener narración' : '🔊 Narrar en clase'}
                  </button>
                )}
              </div>

              {/* Resumen narrativo */}
              <div style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#0a84ff', textTransform: 'uppercase' }}>
                  Resumen de la sesión
                </p>
                <p style={{ margin: 0, color: '#fff', fontSize: 14, lineHeight: 1.7 }}>
                  {cierreData.resumenNarrativo}
                </p>
              </div>

              {/* Conceptos clave con resúmenes */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Conceptos clave
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cierreData.conceptosClave || []).map((c, i) => {
                    const concepto = typeof c === 'string' ? c : c.concepto;
                    const resumen  = typeof c === 'object' ? c.resumen : null;
                    const colores  = ['#0a84ff','#5856d6','#30d158','#ff9f0a','#ff453a'];
                    const color    = colores[i % colores.length];
                    return (
                      <div key={i} style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: resumen ? 6 : 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color }}>{concepto}</p>
                        </div>
                        {resumen && <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingLeft: 16 }}>{resumen}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón exportar PPTX — siempre visible en resultado */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Esquema seleccionado: {TIPOS_ESQUEMA.find(t => t.id === tipoEsquema)?.label}
                </p>
                <button onClick={handleExportarPPTX} disabled={generandoPPTX} style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background:   generandoPPTX ? 'rgba(255,255,255,0.05)' : 'rgba(48,209,88,0.15)',
                  border:       `1px solid ${generandoPPTX ? 'rgba(255,255,255,0.1)' : 'rgba(48,209,88,0.3)'}`,
                  borderRadius: 12, padding: '14px', cursor: generandoPPTX ? 'not-allowed' : 'pointer',
                  color:        generandoPPTX ? '#8e8e93' : '#30d158',
                  fontSize:     14, fontWeight: 600, transition: 'all 0.2s',
                }}>
                  {generandoPPTX ? '⏳ Generando PPTX...' : `📊 Descargar ${TIPOS_ESQUEMA.find(t => t.id === tipoEsquema)?.label} en PPTX`}
                </button>
              </div>

              {/* Mapa de comprensión grupal */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Mapa de comprensión grupal
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cierreData.mapaComprension || []).map((nivel, i) => {
                    const color = i === 0 ? '#30d158' : i === 1 ? '#ffd60a' : '#ff453a';
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        background: `${color}08`, border: `1px solid ${color}25`,
                        borderRadius: 12, padding: '12px 16px',
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color }}>{nivel.nivel}</p>
                          {nivel.alumnos?.length > 0 && (
                            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#fff' }}>
                              {nivel.alumnos.join(', ')}
                            </p>
                          )}
                          <p style={{ margin: 0, fontSize: 11, color: '#8e8e93' }}>{nivel.descripcion}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preguntas de repaso */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Preguntas de repaso (5 niveles)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cierreData.preguntasRepaso || []).map((p, i) => (
                    <div key={i} style={{
                      display:    'flex', gap: 12, alignItems: 'flex-start',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                        background: `${colorDificultad(p.dificultad)}20`,
                        color: colorDificultad(p.dificultad),
                        border: `1px solid ${colorDificultad(p.dificultad)}40`,
                        marginTop: 2,
                      }}>
                        {p.dificultad}
                      </span>
                      <p style={{ margin: 0, color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{p.pregunta}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actividad de cierre */}
              {cierreData.actividadCierre && (
                <div style={{
                  background:   'rgba(48,209,88,0.08)',
                  border:       '1px solid rgba(48,209,88,0.25)',
                  borderRadius: 14, padding: '16px 20px',
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#30d158', textTransform: 'uppercase' }}>
                    Actividad de cierre sugerida
                  </p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.6 }}>
                    {cierreData.actividadCierre}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CierreSesion;