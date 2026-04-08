// ─────────────────────────────────────────────────────────────
// ResumenDidactico.jsx — Panel desplegable post-lectura
// Se inserta en ReadingAnalyzer.jsx debajo del comentario IA
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { narrarResumen, detener } from './voiceService';
import { useAuraStore } from './store';

// ─────────────────────────────────────────────────────────────
// UTILIDAD — copiar texto al portapapeles
// ─────────────────────────────────────────────────────────────
const copiarTexto = async (texto) => {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (_) {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// Props:
//   resumen: { tema, conceptos[], comprension, preguntas[], actividad }
//   alumnoNombre: string
// ─────────────────────────────────────────────────────────────
const ResumenDidactico = ({ resumen, alumnoNombre }) => {
  const muteado        = useAuraStore(s => s.muteado);
  const [abierto,      setAbierto]      = useState(false);
  const [narrando,     setNarrando]     = useState(false);
  const [copiado,      setCopiado]      = useState(false);

  if (!resumen) return null;

  const { tema, conceptos = [], comprension, preguntas = [], actividad } = resumen;

  // Texto completo para narrar o copiar
  const textoCompleto = `
Resumen de lectura de ${alumnoNombre}.
Tema: ${tema}.
Nivel de comprensión: ${comprension}.
Conceptos identificados: ${conceptos.join(', ')}.
Preguntas de comprensión:
${preguntas.map((p, i) => `${i + 1}. ${p}`).join('\n')}
${actividad ? `\nActividad sugerida: ${actividad}` : ''}
  `.trim();

  const handleNarrar = () => {
    if (narrando) { detener(); setNarrando(false); return; }
    if (muteado) return;
    setNarrando(true);
    narrarResumen(textoCompleto);
    // Estima duración aproximada y resetea el estado
    const duracionMs = textoCompleto.split(' ').length * 350;
    setTimeout(() => setNarrando(false), duracionMs);
  };

  const handleCopiar = async () => {
    const ok = await copiarTexto(textoCompleto);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // Color de comprensión
  const colorComprension =
    comprension === 'Alta'   ? '#30d158' :
    comprension === 'Media'  ? '#ffd60a' : '#ff453a';

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── BOTÓN DESPLEGABLE ── */}
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 18px',
          background:     abierto ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.05)',
          border:         `1px solid ${abierto ? 'rgba(10,132,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:   abierto ? '14px 14px 0 0' : 14,
          cursor:         'pointer',
          transition:     'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, color: '#fff', fontFamily: "'Press Start 2P', monospace", fontSize: 9, letterSpacing: '0.1em' }}>
              RESUMEN DIDÁCTICO
            </p>
            <p style={{ margin: '3px 0 0', color: '#8e8e93', fontSize: 11 }}>
              {abierto ? 'Haz clic para cerrar' : 'Ver tema, conceptos y preguntas de comprensión'}
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ color: '#0a84ff', fontSize: 20, lineHeight: 1 }}
        >
          ▾
        </motion.span>
      </button>

      {/* ── CONTENIDO DESPLEGABLE ── */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background:   'rgba(10,10,20,0.6)',
              border:       '1px solid rgba(10,132,255,0.3)',
              borderTop:    'none',
              borderRadius: '0 0 14px 14px',
              padding:      '18px 20px',
            }}>

              {/* Barra de acciones */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {!muteado && (
                  <button onClick={handleNarrar} style={{
                    display:      'flex', alignItems: 'center', gap: 6,
                    background:   narrando ? 'rgba(255,69,58,0.15)' : 'rgba(10,132,255,0.12)',
                    border:       `1px solid ${narrando ? 'rgba(255,69,58,0.4)' : 'rgba(10,132,255,0.3)'}`,
                    borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                    color:        narrando ? '#ff453a' : '#0a84ff',
                    fontSize:     12, fontWeight: 600, transition: 'all 0.2s',
                  }}>
                    {narrando ? '⏹ Detener' : '🔊 Narrar resumen'}
                  </button>
                )}
                <button onClick={handleCopiar} style={{
                  display:      'flex', alignItems: 'center', gap: 6,
                  background:   copiado ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.06)',
                  border:       `1px solid ${copiado ? 'rgba(48,209,88,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  color:        copiado ? '#30d158' : '#fff',
                  fontSize:     12, fontWeight: 600, transition: 'all 0.2s',
                }}>
                  {copiado ? '✅ Copiado' : '📋 Copiar para actividad'}
                </button>
              </div>

              {/* Tema central */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Tema central
                </p>
                <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 500, lineHeight: 1.5 }}>
                  {tema}
                </p>
              </div>

              {/* Comprensión + Conceptos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 16 }}>
                <div style={{
                  background:   `${colorComprension}12`,
                  border:       `1px solid ${colorComprension}40`,
                  borderRadius: 12, padding: '12px 16px',
                  display:      'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, color: '#8e8e93', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Comprensión
                  </p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colorComprension, fontFamily: "'Press Start 2P', monospace" }}>
                    {comprension === 'Alta' ? '🟢' : comprension === 'Media' ? '🟡' : '🔴'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: colorComprension }}>
                    {comprension}
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, color: '#8e8e93', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Conceptos identificados
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {conceptos.map((c, i) => (
                      <span key={i} style={{
                        background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)',
                        borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#0a84ff', fontWeight: 500,
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preguntas de comprensión */}
              <div style={{ marginBottom: actividad ? 16 : 0 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#8e8e93', textTransform: 'uppercase' }}>
                  Preguntas de comprensión
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {preguntas.map((p, i) => (
                    <div key={i} style={{
                      display:    'flex', gap: 10, alignItems: 'flex-start',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', background: 'rgba(10,132,255,0.2)',
                        color: '#0a84ff', fontSize: 11, fontWeight: 700, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <p style={{ margin: 0, color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actividad sugerida */}
              {actividad && (
                <div style={{
                  background:   'rgba(48,209,88,0.08)',
                  border:       '1px solid rgba(48,209,88,0.25)',
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#30d158', textTransform: 'uppercase' }}>
                    Actividad sugerida
                  </p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5 }}>
                    {actividad}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResumenDidactico;