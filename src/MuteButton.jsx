// ─────────────────────────────────────────────────────────────
// MuteButton.jsx — Botón de mute global reutilizable
// Usar en: App.jsx, ReadingAnalyzer.jsx, ReadingFullscreen.jsx
// ─────────────────────────────────────────────────────────────
import React from 'react';
import { useAuraStore } from './store';
import { setMuteado, detener } from './voiceService';

// ── Variante compacta (para HUDs y barras) ───────────────────
export const MuteButtonCompact = ({ style = {} }) => {
  const muteado    = useAuraStore(s => s.muteado);
  const toggleMute = useAuraStore(s => s.toggleMute);

  const handleClick = () => {
    const nuevoEstado = !muteado;
    toggleMute();
    setMuteado(nuevoEstado);
    if (nuevoEstado) detener();
  };

  return (
    <button
      onClick={handleClick}
      title={muteado ? 'Activar voz' : 'Silenciar voz'}
      style={{
        background:   muteado ? 'rgba(255,69,58,0.15)' : 'rgba(255,255,255,0.08)',
        border:       `1px solid ${muteado ? 'rgba(255,69,58,0.4)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 20,
        padding:      '4px 10px',
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        transition:   'all 0.2s',
        flexShrink:   0,
        ...style,
      }}
    >
      <span style={{ fontSize: 14 }}>{muteado ? '🔇' : '🔊'}</span>
      <span style={{
        fontSize:   10,
        fontWeight: 600,
        color:      muteado ? '#ff453a' : 'rgba(255,255,255,0.6)',
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
      }}>
        {muteado ? 'VOZ OFF' : 'VOZ ON'}
      </span>
    </button>
  );
};

// ── Variante iOS (para el menú principal) ────────────────────
export const MuteButtonIOS = () => {
  const muteado    = useAuraStore(s => s.muteado);
  const toggleMute = useAuraStore(s => s.toggleMute);

  const handleClick = () => {
    const nuevoEstado = !muteado;
    toggleMute();
    setMuteado(nuevoEstado);
    if (nuevoEstado) detener();
  };

  return (
    <button
      onClick={handleClick}
      style={{
        width:        '100%',
        background:   'rgba(28,28,30,0.8)',
        border:       '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding:      '14px 18px',
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
        cursor:       'pointer',
        marginBottom: 12,
        transition:   'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{muteado ? '🔇' : '🔊'}</span>
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, color: '#fff', fontWeight: 500, fontSize: 14 }}>
            Voz de Aura
          </p>
          <p style={{ margin: 0, color: '#8e8e93', fontSize: 12 }}>
            {muteado ? 'Silenciado' : 'Narraciones activas'}
          </p>
        </div>
      </div>

      {/* Toggle estilo iOS */}
      <div
        style={{
          width:        51,
          height:       31,
          borderRadius: 16,
          background:   muteado ? '#3a3a3c' : '#30d158',
          position:     'relative',
          transition:   'background 0.3s',
          flexShrink:   0,
        }}
      >
        <div
          style={{
            position:     'absolute',
            top:          2,
            left:         muteado ? 2 : 22,
            width:        27,
            height:       27,
            borderRadius: '50%',
            background:   '#fff',
            boxShadow:    '0 2px 4px rgba(0,0,0,0.3)',
            transition:   'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      </div>
    </button>
  );
};

export default MuteButtonCompact;