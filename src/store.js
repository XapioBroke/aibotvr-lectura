// ─────────────────────────────────────────────────────────────
// store.js — Zustand Global Store para Aura Core
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db } from './firebase';
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, writeBatch,
  getDoc, setDoc,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
export const ESCUELAS = [
  { id: 1, nombre: 'Secundaria Técnica 90',  grupos: ['2A','2B','2C','2D','1D'] },
  { id: 2, nombre: 'Secundaria Técnica 131', grupos: ['1A','1B'] },
  { id: 3, nombre: 'Secundaria Técnica 164', grupos: ['1A','1B'] },
  { id: 4, nombre: 'Secundaria Foránea 17',  grupos: ['2B','2C'] },
  { id: 5, nombre: 'Secundaria Foránea 8',   grupos: ['1C','2D','3C'] },
];

export const MODOS_IDIOMA = [
  { leer: 'es', traducir: 'es', label: '🇲🇽 / 🇲🇽', titulo: 'ES / ES', desc: 'Solo español'    },
  { leer: 'es', traducir: 'en', label: '🇲🇽 → 🇺🇸', titulo: 'ES → EN', desc: 'Español + inglés' },
  { leer: 'en', traducir: 'en', label: '🇺🇸 / 🇺🇸', titulo: 'EN / EN', desc: 'Solo inglés'     },
  { leer: 'en', traducir: 'es', label: '🇺🇸 → 🇲🇽', titulo: 'EN → ES', desc: 'Inglés + español' },
];

// ─────────────────────────────────────────────────────────────
// HELPERS DE CACHÉ
// ─────────────────────────────────────────────────────────────
const generarClaveCaché = (tema, idioma) =>
  `${tema.trim().toLowerCase().replace(/\s+/g, '_')}|${idioma}`;

const buscarEnCachéFirestore = async (clave) => {
  try {
    const snap = await getDoc(doc(db, 'cache_textos', clave));
    if (snap.exists()) return snap.data().texto;
  } catch (_) {}
  return null;
};

const guardarEnCachéFirestore = async (clave, texto, tema, idioma) => {
  try {
    await setDoc(doc(db, 'cache_textos', clave), {
      texto,
      tema,
      idioma,
      creadoEn:  new Date().toISOString(),
      usosTotal: 1,
    });
  } catch (_) {}
};

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────
export const useAuraStore = create(
  devtools(
    (set, get) => ({

      // ── UI / Navegación ──────────────────────────────────
      mostrarIntro:        true,
      vista:               'menu',

      // ── Selección jerárquica ─────────────────────────────
      escuelaSeleccionada: null,
      grupoSeleccionado:   null,
      alumnoSeleccionado:  null,

      // ── Alumnos ──────────────────────────────────────────
      alumnos:             [],
      cargandoAlumnos:     false,

      // ── Modo maestro ─────────────────────────────────────
      modoEdicion:         false,
      ultimaAccion:        null,

      // ── Idioma ───────────────────────────────────────────
      modoIdioma:          { leer: 'es', traducir: 'es' },

      // ── Generador de texto ───────────────────────────────
      temaLectura:         '',
      generandoTexto:      false,
      textoReferencia:     '',
      textosCacheados:     {},

      // ── Notificación Dynamic Island ──────────────────────
      ultimoPuntaje:       null,
       sesionLecturas:      [],   // acumula lecturas de la sesión activa

      // ── Voz global ───────────────────────────────────────
      muteado: localStorage.getItem('aura_mute') === 'true',


      // ════════════════════════════════════════════════════
      // ACCIONES
      // ════════════════════════════════════════════════════

      completarIntro: () => set({ mostrarIntro: false }, false, 'completarIntro'),
      agregarLecturaSesion: (lectura) =>
    set((s) => ({ sesionLecturas: [...s.sesionLecturas, lectura] }), false, 'agregarLectura'),
 
  limpiarSesion: () =>
    set({ sesionLecturas: [] }, false, 'limpiarSesion'),
 

      toggleMute: () => set((s) => {
        const nuevoEstado = !s.muteado;
        localStorage.setItem('aura_mute', nuevoEstado);
        return { muteado: nuevoEstado };
      }, false, 'toggleMute'),

      irAVista: (vista) => set({ vista }, false, 'irAVista'),

      seleccionarEscuela: (escuela) =>
        set(
          { escuelaSeleccionada: escuela, grupoSeleccionado: null, alumnoSeleccionado: null, alumnos: [] },
          false,
          'seleccionarEscuela',
        ),

      seleccionarGrupo: (grupo) =>
        set(
          { grupoSeleccionado: grupo, alumnoSeleccionado: null, modoEdicion: false, ultimaAccion: null },
          false,
          'seleccionarGrupo',
        ),

      seleccionarAlumno: (alumno) =>
        set({ alumnoSeleccionado: alumno }, false, 'seleccionarAlumno'),

      limpiarGrupo: () =>
        set(
          { grupoSeleccionado: null, alumnoSeleccionado: null, modoEdicion: false },
          false,
          'limpiarGrupo',
        ),

      limpiarEscuela: () =>
        set(
          { escuelaSeleccionada: null, grupoSeleccionado: null, alumnoSeleccionado: null, alumnos: [] },
          false,
          'limpiarEscuela',
        ),

      // ── Alumnos — Firebase ────────────────────────────────
      cargarAlumnos: async () => {
        const { escuelaSeleccionada, grupoSeleccionado } = get();
        if (!escuelaSeleccionada || !grupoSeleccionado) return;

        set({ cargandoAlumnos: true }, false, 'cargarAlumnos/start');
        try {
          const q = query(
            collection(db, 'alumnos'),
            where('escuelaId', '==', escuelaSeleccionada.id),
            where('grupo',     '==', grupoSeleccionado),
          );
          const snap = await getDocs(q);
          const data = snap.docs
            .map(d => {
              const d2 = d.data();
              return { id: d.id, ...d2, puntos: d2.puntosClase ?? d2.puntos ?? 0 };
            })
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          set({ alumnos: data, cargandoAlumnos: false }, false, 'cargarAlumnos/done');
        } catch (e) {
          console.error('Error cargando alumnos:', e);
          set({ cargandoAlumnos: false }, false, 'cargarAlumnos/error');
        }
      },

      // ── Modo maestro ──────────────────────────────────────
      toggleModoEdicion: () =>
        set((s) => ({ modoEdicion: !s.modoEdicion }), false, 'toggleModoEdicion'),

      ajustarPuntosManuales: async (alumno, cantidad, esDeshacer = false) => {
        try {
          await updateDoc(doc(db, 'alumnos', alumno.id), { puntosClase: increment(cantidad) });
          set(
            (s) => ({
              alumnos: s.alumnos.map(a =>
                a.id === alumno.id ? { ...a, puntos: (a.puntos || 0) + cantidad } : a,
              ),
              ultimaAccion: esDeshacer
                ? null
                : { tipo: 'AJUSTE_INDIVIDUAL', alumnoId: alumno.id, alumnoNombre: alumno.nombre, cantidadAgregada: cantidad },
            }),
            false,
            'ajustarPuntos',
          );
        } catch (e) { console.error(e); alert('Error de conexión.'); }
      },

      deshacerUltimaAccion: () => {
        const { ultimaAccion, alumnos, ajustarPuntosManuales } = get();
        if (!ultimaAccion || ultimaAccion.tipo !== 'AJUSTE_INDIVIDUAL') return;
        const alumno = alumnos.find(a => a.id === ultimaAccion.alumnoId);
        if (alumno) ajustarPuntosManuales(alumno, -ultimaAccion.cantidadAgregada, true);
      },

      reiniciarPuntosGrupo: async () => {
        const { grupoSeleccionado, alumnos } = get();
        if (!window.confirm(`¿Seguro que deseas reiniciar los XP del grupo ${grupoSeleccionado}?`)) return;
        try {
          const batch = writeBatch(db);
          alumnos.forEach(a => batch.update(doc(db, 'alumnos', a.id), { puntosClase: 0 }));
          await batch.commit();
          set(
            (s) => ({ alumnos: s.alumnos.map(a => ({ ...a, puntos: 0 })), ultimaAccion: null }),
            false,
            'reiniciarPuntos',
          );
        } catch (e) { console.error(e); alert('Error al reiniciar.'); }
      },

      // ── XP ganados ────────────────────────────────────────
      handlePuntosGanados: (puntos, alumnoId) => {
        const { alumnos, cargarAlumnos } = get();
        const alumno = alumnos.find(a => a.id === alumnoId);
        set(
          (s) => ({
            ultimoPuntaje: { puntos, nombre: alumno?.nombre },
            alumnos: s.alumnos.map(a =>
              a.id === alumnoId ? { ...a, puntos: (a.puntos || 0) + puntos } : a,
            ),
          }),
          false,
          'puntosGanados',
        );
        setTimeout(cargarAlumnos, 1500);
        setTimeout(() => set({ ultimoPuntaje: null }, false, 'clearPuntaje'), 4000);
      },

      // ── Idioma ────────────────────────────────────────────
      setModoIdioma: (modo) => set({ modoIdioma: modo }, false, 'setModoIdioma'),

      // ── Generador ─────────────────────────────────────────
      setTemaLectura:     (tema)  => set({ temaLectura: tema },      false, 'setTema'),
      setTextoReferencia: (texto) => set({ textoReferencia: texto }, false, 'setTexto'),

      // ── Generador con caché ───────────────────────────────
      generarTextoConIA: async () => {
        const { temaLectura, modoIdioma, textosCacheados } = get();
        if (!temaLectura.trim()) { alert('Por favor, escribe un tema primero.'); return; }

        const clave  = generarClaveCaché(temaLectura, modoIdioma.leer);
        const idioma = modoIdioma.leer;

        // 1. Caché en memoria (instantáneo)
        if (textosCacheados[clave]) {
          set(
            { textoReferencia: textosCacheados[clave], temaLectura: '' },
            false,
            'generarTexto/cacheMemoria',
          );
          return;
        }

        // 2. Caché en Firestore
        set({ generandoTexto: true }, false, 'generarTexto/start');
        const textoCacheado = await buscarEnCachéFirestore(clave);

        if (textoCacheado) {
          set(
            {
              textoReferencia:  textoCacheado,
              temaLectura:      '',
              generandoTexto:   false,
              textosCacheados:  { ...textosCacheados, [clave]: textoCacheado },
            },
            false,
            'generarTexto/cacheFirestore',
          );
          return;
        }

        // 3. Sin caché — llama a la IA
        const idiomaTexto = idioma === 'es' ? 'Español' : 'Inglés';
        const prompt = `Actúa como un creador de contenido educativo para Aura Core.
Escribe un texto de lectura (80-120 palabras) sobre el tema: "${temaLectura}".
El texto DEBE estar en ${idiomaTexto}.
Responde ÚNICAMENTE con un JSON válido con esta estructura exacta, sin comillas triples ni markdown:
{"titulo": "Título aquí", "contenido": "Texto aquí"}`;

        try {
          const response = await fetch('http://localhost:3001/api/analizar-lectura', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt }),
          });
          if (!response.ok) throw new Error('Error al conectar con la IA');

          const data     = await response.json();
          let textoCrudo = data.content?.[0]?.text || data.choices?.[0]?.message?.content || data.texto || '';
          textoCrudo     = textoCrudo.replace(/```json/gi, '').replace(/```/g, '').trim();

          let textoFinal = textoCrudo;
          try {
            const parsed = JSON.parse(textoCrudo);
            textoFinal   = `${parsed.titulo}\n\n${parsed.contenido}`;
          } catch (_) {}

          const textoLimpio = textoFinal.trim();

          // Guarda en Firestore y en memoria
          guardarEnCachéFirestore(clave, textoLimpio, temaLectura.trim(), idioma);

          set(
            {
              textoReferencia:  textoLimpio,
              temaLectura:      '',
              generandoTexto:   false,
              textosCacheados:  { ...get().textosCacheados, [clave]: textoLimpio },
            },
            false,
            'generarTexto/nuevo',
          );

        } catch (e) {
          console.error('Error generando texto:', e);
          alert('Error de conexión al generar el texto.');
          set({ generandoTexto: false }, false, 'generarTexto/error');
        }
      },

    }),
    { name: 'AuraStore' },
  ),
);