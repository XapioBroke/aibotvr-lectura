import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './IntroCinematica.css';
import { hablar, detener } from './voiceService';
import { useAuraStore } from './store';

const IntroCinematica = ({ onComplete }) => {
  const [iniciado, setIniciado] = useState(false);
  const [textoVisible, setTextoVisible] = useState(false);
  const audioRef = useRef(null);

  const frase = "Bienvenido al mundo del análisis de lectura que te ayudará a superar tus propios límites y te convertirá en el súper lector que estás destinado a ser.";
  const palabras = frase.split(" ");

  // ⚡ Función maestra para saltar / omitir la intro de forma limpia
  const handleOmitir = () => {
    // 1. Detener audio HTML si está sonando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // 2. Detener síntesis de voz activa (SpeechSynthesis)
    detener();

    // 3. Finalizar la intro inmediatamente
    onComplete();
  };

  const iniciarExperiencia = () => {
    setIniciado(true);
    
    audioRef.current = new Audio('/intro.mpeg');
    audioRef.current.volume = 1.0;
    
    audioRef.current.play().then(() => {
      setTextoVisible(true);
      
      audioRef.current.onended = () => {
        setTimeout(() => {
           onComplete();
        }, 1500);
      };

    }).catch(err => {
      console.error("Error al reproducir audio:", err);
      setTextoVisible(true);
      setTimeout(onComplete, 6000);
    });
  };

  // Animaciones Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.04 * i },
    }),
  };

  const childVariants = {
    visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 100 } },
    hidden: { opacity: 0, y: 20, transition: { type: "spring", damping: 12, stiffness: 100 } },
  };

  const muteado = useAuraStore(s => s.muteado);
  
  useEffect(() => {
    if (!muteado) {
      const t = setTimeout(() => hablar(
        'Aura Core. Sistema de análisis de lectura de nueva generación.',
        { idioma: 'es', rate: 0.82, pitch: 0.95 }
      ), 500);
      return () => { clearTimeout(t); detener(); };
    }
  }, []);

  return (
    <motion.div 
      className="intro-overlay"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.5 } }}
    >
      {/* 🧭 BOTÓN GLOBAL DE OMITIR (DISPONIBLE EN TODO MOMENTO PARA EL DOCENTE) */}
      <motion.button
        className="intro-skip-btn"
        onClick={handleOmitir}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
        whileTap={{ scale: 0.95 }}
        title="Omitir introducción"
      >
        <span>Omitir intro</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="4" x2="19" y2="20"></line>
        </svg>
      </motion.button>

      <AnimatePresence mode="wait">
        {!iniciado ? (
          <motion.div 
            key="pre-start"
            className="intro-pre-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="quote-text">"Un lector vive mil vidas antes de morir. El que nunca lee vive solo una."</h1>
            <p className="quote-author">— George R.R. Martin</p>
            
            <motion.button 
              className="intro-start-btn"
              onClick={iniciarExperiencia}
              whileHover={{ scale: 1.05, backgroundColor: '#ffffff', color: '#000000' }}
              whileTap={{ scale: 0.95 }}
            >
              INICIAR SISTEMA
            </motion.button>
          </motion.div>
        ) : (
          <motion.div 
            key="cinematic"
            className="intro-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {textoVisible && (
              <motion.div 
                className="intro-text-container"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {palabras.map((palabra, index) => (
                  <motion.span key={index} variants={childVariants} style={{ marginRight: '10px', display: 'inline-block' }}>
                    {palabra}
                  </motion.span>
                ))}
              </motion.div>
            )}
             
            <motion.div initial={{opacity:0}} animate={{opacity: 0.5}} transition={{delay: 1}} className="intro-audio-visualizer">
               <div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IntroCinematica;
