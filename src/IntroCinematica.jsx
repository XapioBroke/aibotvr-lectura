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

  const iniciarExperiencia = () => {
    setIniciado(true);
    
    // 🐛 BUG FIX: En Vite, los archivos de la carpeta public se llaman directamente con "/"
    audioRef.current = new Audio('/intro.mpeg');
    audioRef.current.volume = 1.0;
    
    audioRef.current.play().then(() => {
      setTextoVisible(true);
      
      // Cuando el audio termine, finalizamos la intro
      audioRef.current.onended = () => {
        setTimeout(() => {
           onComplete(); // Avisamos a App.js que termine la intro y muestre la app
        }, 1500); // 1.5 segundos extra de pausa dramática al final
      };

    }).catch(err => {
      console.error("Error al reproducir audio:", err);
      // Fallback: Si el navegador bloquea el audio o el .mpeg falla, mostramos el texto y avanzamos
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
      <AnimatePresence mode="wait">
        {!iniciado ? (
          /* 🌟 NUEVA PANTALLA DE BIENVENIDA CON LA FRASE */
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
          /* 🎬 SECUENCIA CINEMÁTICA (VOZ + TYPEWRITER) */
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
             
            {/* Ecualizador visual sutil */}
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