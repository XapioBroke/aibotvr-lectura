// ─────────────────────────────────────────────────────────────
// RachaDisplay.jsx — Componente visual de racha
// Usar en: HUD fullscreen, lista alumnos, pantalla resultado
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────
// VARIANTE: HUD (compacto, para la barra del fullscreen)
// ─────────────────────────────────────────────────────────────
export const RachaHUD = ({ racha = 0 }) => {
  if (racha === 0) return null;
  const color = racha >= 30 ? '#ff453a' : racha >= 7 ? '#bf5af2' : racha >= 3 ? '#ff9f0a' : '#30d158';
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            5,
        background:     `${color}18`,
        border:         `1px solid ${color}44`,
        borderRadius:   20,
        padding:        '3px 10px',
        flexShrink:     0,
      }}
    >
      <span style={{ fontSize: 14 }}>🔥</span>
      <span style={{
        fontFamily:   'var(--rfs-hud, monospace)',
        fontSize:     13,
        fontWeight:   700,
        color,
        textShadow:   `0 0 10px ${color}`,
        letterSpacing: '0.05em',
      }}>
        {racha}
      </span>
      <span style={{ fontSize: 10, color, opacity: 0.7, letterSpacing: '0.1em' }}>
        DÍAS
      </span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// VARIANTE: BADGE (para la lista de alumnos en el sidebar)
// ─────────────────────────────────────────────────────────────
export const RachaBadge = ({ racha = 0 }) => {
  if (racha === 0) return null;
  const color  = racha >= 30 ? '#ff453a' : racha >= 7 ? '#bf5af2' : racha >= 3 ? '#ff9f0a' : '#30d158';
  const icono  = racha >= 30 ? '💎' : racha >= 7 ? '⚡' : '🔥';
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        3,
      background: `${color}20`,
      border:     `1px solid ${color}50`,
      borderRadius: 12,
      padding:    '2px 7px',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11 }}>{icono}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{racha}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// VARIANTE: HERO (pantalla resultado — grande y deslumbrante)
// ─────────────────────────────────────────────────────────────
export const RachaHero = ({ racha = 0, esNueva = false }) => {
  const color  = racha >= 30 ? '#ff453a' : racha >= 7 ? '#bf5af2' : racha >= 3 ? '#ff9f0a' : '#30d158';
  const icono  = racha >= 30 ? '💎' : racha >= 7 ? '⚡' : racha >= 3 ? '🔥' : '✨';
  const titulo = racha >= 30 ? '¡MES IMPARABLE!'
               : racha >= 7  ? '¡SEMANA PERFECTA!'
               : racha >= 3  ? '¡EN RACHA!'
               : '¡PRIMER DÍA!';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            8,
        padding:        '20px 32px',
        background:     `linear-gradient(135deg, ${color}18, ${color}08)`,
        border:         `2px solid ${color}44`,
        borderRadius:   20,
        boxShadow:      `0 0 40px ${color}30, inset 0 0 20px ${color}08`,
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Brillo de fondo animado */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        style={{
          position:     'absolute',
          width:        200,
          height:       200,
          borderRadius: '50%',
          background:   `conic-gradient(${color}20, transparent, ${color}20)`,
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Icono principal */}
      <motion.span
        animate={esNueva ? {
          scale:  [1, 1.3, 1],
          filter: [`drop-shadow(0 0 10px ${color})`, `drop-shadow(0 0 30px ${color})`, `drop-shadow(0 0 10px ${color})`],
        } : {}}
        transition={{ duration: 1.2, repeat: esNueva ? 3 : 0 }}
        style={{ fontSize: '3rem', position: 'relative', zIndex: 1 }}
      >
        {icono}
      </motion.span>

      {/* Número grande */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display:    'flex',
          alignItems: 'baseline',
          gap:        6,
          position:   'relative',
          zIndex:     1,
        }}
      >
        <span style={{
          fontSize:   '4rem',
          fontWeight: 900,
          fontFamily: "'Press Start 2P', monospace",
          color,
          lineHeight: 1,
          textShadow: `0 0 30px ${color}, 0 0 60px ${color}80`,
        }}>
          {racha}
        </span>
        <span style={{
          fontSize:   '1.2rem',
          fontFamily: "'Press Start 2P', monospace",
          color,
          opacity:    0.7,
          marginBottom: 6,
        }}>
          {racha === 1 ? 'DÍA' : 'DÍAS'}
        </span>
      </motion.div>

      {/* Título */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          fontFamily:    "'Press Start 2P', monospace",
          fontSize:      '0.7rem',
          color,
          letterSpacing: '0.15em',
          margin:        0,
          position:      'relative',
          zIndex:        1,
          textShadow:    `0 0 10px ${color}`,
        }}
      >
        {titulo}
      </motion.p>

      {/* Etiqueta "RACHA" */}
      <span style={{
        fontSize:      10,
        color,
        opacity:       0.6,
        letterSpacing: '0.3em',
        fontFamily:    'monospace',
        position:      'relative',
        zIndex:        1,
      }}>
        RACHA ACTIVA
      </span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// VARIANTE: CELEBRACIÓN (aparece cuando sube la racha)
// Portal — se monta sobre todo
// ─────────────────────────────────────────────────────────────
export const RachaCelebracion = ({ racha, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, []);

  const color  = racha >= 30 ? '#ff453a' : racha >= 7 ? '#bf5af2' : racha >= 3 ? '#ff9f0a' : '#30d158';
  const mensaje = racha >= 30 ? `¡${racha} días seguidos! ¡Eres imparable!`
                : racha >= 7  ? `¡Una semana completa! ¡Increíble!`
                : racha >= 3  ? `¡${racha} días seguidos! ¡Sigue así!`
                : '¡Racha iniciada! ¡Vuelve mañana!';

  return (
    <motion.div
      initial={{ y: -120, opacity: 0 }}
      animate={{ y: 0,    opacity: 1 }}
      exit={{   y: -120,  opacity: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      onClick={onDismiss}
      style={{
        position:       'fixed',
        top:            24,
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         999999,
        background:     '#000',
        border:         `2px solid ${color}`,
        borderRadius:   40,
        padding:        '14px 28px',
        display:        'flex',
        alignItems:     'center',
        gap:            14,
        boxShadow:      `0 10px 40px ${color}40, 0 0 20px ${color}20`,
        cursor:         'pointer',
        minWidth:       280,
        justifyContent: 'center',
      }}
    >
      <motion.span
        animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
        transition={{ duration: 0.6, delay: 0.3 }}
        style={{ fontSize: '2rem' }}
      >
        🔥
      </motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily:    "'Press Start 2P', monospace",
          fontSize:      '0.65rem',
          color,
          letterSpacing: '0.1em',
          textShadow:    `0 0 10px ${color}`,
        }}>
          RACHA · {racha} {racha === 1 ? 'DÍA' : 'DÍAS'}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          {mensaje}
        </span>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// VARIANTE: PANEL BADGES (para mostrar logros del alumno)
// ─────────────────────────────────────────────────────────────
export const PanelBadges = ({ badges = [], badgesNuevos = [] }) => {
  const { BADGES } = require('./gamification');
  if (!badges.length) return null;

  return (
    <div style={{
      background:   'rgba(28,28,30,0.6)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding:      16,
    }}>
      <p style={{
        fontFamily:    'monospace',
        fontSize:      10,
        letterSpacing: '0.2em',
        color:         '#8e8e93',
        margin:        '0 0 12px',
      }}>
        LOGROS
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {BADGES.filter(b => badges.includes(b.id)).map(b => {
          const esNuevo = badgesNuevos.includes(b.id);
          return (
            <motion.div
              key={b.id}
              initial={esNuevo ? { scale: 0 } : { scale: 1 }}
              animate={{ scale: 1 }}
              transition={esNuevo ? { type: 'spring', stiffness: 300 } : {}}
              title={b.desc}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                padding:      '6px 12px',
                background:   esNuevo ? 'rgba(255,214,10,0.15)' : 'rgba(255,255,255,0.06)',
                border:       `1px solid ${esNuevo ? 'rgba(255,214,10,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20,
                cursor:       'default',
              }}
            >
              <span style={{ fontSize: 16 }}>{b.icono}</span>
              <span style={{ fontSize: 11, color: esNuevo ? '#ffd60a' : '#fff', fontWeight: 500 }}>
                {b.nombre}
              </span>
              {esNuevo && (
                <span style={{
                  fontSize:   9,
                  background: '#ffd60a',
                  color:      '#000',
                  padding:    '1px 5px',
                  borderRadius: 6,
                  fontWeight: 700,
                }}>
                  NEW
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};