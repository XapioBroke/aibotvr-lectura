// ─────────────────────────────────────────────────────────────
// store.js — Zustand Global Store para Aura Core
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { db, auth } from './firebase';
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, writeBatch,
  getDoc, setDoc, addDoc, deleteDoc,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// ESCUELAS — antes vivían fijas en este arreglo (requería tocar
// código y desplegar para agregar una escuela o grupo). Ahora se
// migran a Firestore (colección 'escuelas') la primera vez que se
// cargan, con los MISMOS ids/nombres/grupos que ya usa Gamificación
// para esa misma colección — así ambos proyectos quedan consistentes
// sin importar cuál corra la migración primero.
const ESCUELAS_INICIALES = [
  { id: '1', nombre: 'Secundaria Técnica 90',  grupos: ['2A','2B','2C','2D','1D'] },
  { id: '2', nombre: 'Secundaria Técnica 131', grupos: ['1A','1B'] },
  { id: '3', nombre: 'Secundaria Técnica 164', grupos: ['1A','1B'] },
  { id: '4', nombre: 'Secundaria Foránea 17',  grupos: ['2B','2C'] },
  { id: '5', nombre: 'Secundaria Foránea 8',   grupos: ['1C','2D','3C'] },
];

// Export de RESPALDO — mantiene compatibilidad con cualquier archivo que
// todavía importe `ESCUELAS` de forma estática (por ejemplo, si hay otro
// componente del proyecto que no hemos migrado en esta ronda). El dato
// real y editable ahora vive en Firestore vía el estado `escuelas` del
// store y las acciones cargarEscuelas/agregarEscuela/etc. — este export
// es solo un respaldo de lectura, ya NO se actualiza en vivo.
export const ESCUELAS = ESCUELAS_INICIALES;

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

      // ── Escuelas (ahora dinámicas desde Firestore) ───────
      escuelas:            [],
      cargandoEscuelas:    false,

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

      // ── Escuelas — Firebase ───────────────────────────────
      cargarEscuelas: async () => {
        set({ cargandoEscuelas: true }, false, 'cargarEscuelas/start');
        const uid   = auth.currentUser?.uid;
        const email = auth.currentUser?.email?.toLowerCase();
        if (!uid) {
          // Sin sesión no hay nada que mostrar — evita fugas de datos si
          // este código se ejecuta antes de que Firebase Auth resuelva.
          set({ escuelas: [], cargandoEscuelas: false }, false, 'cargarEscuelas/sinSesion');
          return;
        }
        try {
          // Dos consultas: escuelas propias (docenteId == yo) y escuelas
          // compartidas conmigo (mi correo está en colaboradores). Firestore
          // no soporta OR entre campos distintos, así que se combinan aquí.
          const qPropias      = query(collection(db, 'escuelas'), where('docenteId', '==', uid));
          const qCompartidas  = email
            ? query(collection(db, 'escuelas'), where('colaboradores', 'array-contains', email))
            : null;

          const [snapPropias, snapCompartidas] = await Promise.all([
            getDocs(qPropias),
            qCompartidas ? getDocs(qCompartidas) : Promise.resolve({ docs: [] }),
          ]);

          const mapa = new Map();
          snapPropias.docs.forEach(d => mapa.set(d.id, { id: d.id, ...d.data(), _propia: true }));
          snapCompartidas.docs.forEach(d => {
            if (!mapa.has(d.id)) mapa.set(d.id, { id: d.id, ...d.data(), _propia: false });
          });

          const data = Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

          // Si NO tengo ninguna escuela (propia ni compartida) Y la colección
          // completa está vacía (proyecto recién creado, nadie ha sembrado
          // nada todavía), sembramos los datos iniciales como propios míos.
          // Si la colección ya tiene datos de OTRO dueño, NO se re-siembra —
          // esas escuelas simplemente no son mías y no debo verlas.
          if (data.length === 0) {
            const snapTotal = await getDocs(collection(db, 'escuelas'));
            if (snapTotal.empty) {
              await get().migrarEscuelasIniciales();
              return;
            }
          }

          set({ escuelas: data, cargandoEscuelas: false }, false, 'cargarEscuelas/done');
        } catch (e) {
          console.error('Error cargando escuelas:', e);
          set({ cargandoEscuelas: false }, false, 'cargarEscuelas/error');
        }
      },

      migrarEscuelasIniciales: async () => {
        const uid = auth.currentUser?.uid;
        try {
          for (const escuela of ESCUELAS_INICIALES) {
            await setDoc(
              doc(db, 'escuelas', escuela.id),
              { nombre: escuela.nombre, grupos: escuela.grupos, docenteId: uid || null, colaboradores: [] },
              { merge: true },
            );
          }
        } catch (e) {
          console.error('Error migrando escuelas:', e);
        }
        await get().cargarEscuelas();
      },

      // ── Reclamar escuelas "huérfanas" (sin dueño) ─────────
      // Cubre la transición: escuelas creadas ANTES de este cambio no tienen
      // docenteId. Cualquier docente sin escuelas propias puede reclamarlas
      // — pensado para un caso de uso puntual (migración inicial), no para
      // uso recurrente. También reclama los alumnos ya existentes de esas
      // escuelas, para que las reglas de seguridad puedan verificar dueño
      // directo en 'alumnos' sin tener que consultar la escuela por separado.
      reclamarEscuelasSinDueno: async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return { ok: false, error: 'No hay sesión activa.' };
        try {
          const snapEsc   = await getDocs(collection(db, 'escuelas'));
          const huerfanas = snapEsc.docs.filter(d => !d.data().docenteId);
          if (!huerfanas.length) return { ok: false, error: 'No hay escuelas sin dueño para reclamar.' };

          const batch = writeBatch(db);
          huerfanas.forEach(d => batch.update(doc(db, 'escuelas', d.id), { docenteId: uid, colaboradores: d.data().colaboradores || [] }));

          // Reclamar también los alumnos existentes de esas escuelas
          for (const escDoc of huerfanas) {
            const qAlum     = query(collection(db, 'alumnos'), where('escuelaId', '==', escDoc.id));
            const snapAlum  = await getDocs(qAlum);
            snapAlum.docs.forEach(a => {
              if (!a.data().docenteId) batch.update(doc(db, 'alumnos', a.id), { docenteId: uid });
            });
          }

          await batch.commit();
          await get().cargarEscuelas();
          return { ok: true, reclamadas: huerfanas.length };
        } catch (e) {
          console.error('Error reclamando escuelas:', e);
          return { ok: false, error: 'Error al reclamar escuelas. Si son muchos alumnos, puede exceder el límite de 500 operaciones por lote — avísame si pasa esto.' };
        }
      },

      // ── Compartir escuela con un colega (por correo) ──────
      compartirEscuela: async (escuelaId, colaboradoresActuales, emailColega) => {
        const limpio = (emailColega || '').trim().toLowerCase();
        if (!limpio) return { ok: false, error: 'Escribe un correo válido.' };
        if ((colaboradoresActuales || []).includes(limpio)) return { ok: false, error: 'Ese colega ya tiene acceso.' };
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), { colaboradores: [...(colaboradoresActuales || []), limpio] });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error compartiendo escuela:', e);
          return { ok: false, error: 'Error al compartir la escuela.' };
        }
      },

      dejarDeCompartir: async (escuelaId, colaboradoresActuales, email) => {
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), { colaboradores: (colaboradoresActuales || []).filter(c => c !== email) });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error quitando colaborador:', e);
          return { ok: false, error: 'Error al quitar colaborador.' };
        }
      },

      agregarEscuela: async (nombre) => {
        const nombreLimpio = (nombre || '').trim();
        if (!nombreLimpio) return { ok: false, error: 'Escribe un nombre.' };
        const uid = auth.currentUser?.uid;
        if (!uid) return { ok: false, error: 'No hay sesión activa.' };
        try {
          await addDoc(collection(db, 'escuelas'), {
            nombre:        nombreLimpio,
            grupos:        [],
            docenteId:     uid,
            colaboradores: [],
          });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error agregando escuela:', e);
          return { ok: false, error: 'Error de conexión al agregar escuela.' };
        }
      },

      eliminarEscuela: async (escuelaId) => {
        try {
          await deleteDoc(doc(db, 'escuelas', escuelaId));
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error eliminando escuela:', e);
          return { ok: false, error: 'Error al eliminar escuela.' };
        }
      },

      renombrarEscuela: async (escuelaId, nuevoNombre) => {
        const limpio = (nuevoNombre || '').trim();
        if (!limpio) return { ok: false };
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), { nombre: limpio });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error renombrando escuela:', e);
          return { ok: false, error: 'Error al renombrar escuela.' };
        }
      },

      agregarGrupo: async (escuelaId, gruposActuales, nuevoGrupo) => {
        const limpio = (nuevoGrupo || '').trim().toUpperCase();
        if (!limpio || gruposActuales.includes(limpio)) return { ok: false };
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), { grupos: [...gruposActuales, limpio] });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error agregando grupo:', e);
          return { ok: false, error: 'Error al agregar grupo.' };
        }
      },

      eliminarGrupo: async (escuelaId, gruposActuales, grupo) => {
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), { grupos: gruposActuales.filter(g => g !== grupo) });
          await get().cargarEscuelas();
          return { ok: true };
        } catch (e) {
          console.error('Error eliminando grupo:', e);
          return { ok: false, error: 'Error al eliminar grupo.' };
        }
      },

      renombrarGrupo: async (escuelaId, gruposActuales, grupoActual, nuevoGrupo) => {
        const limpio = (nuevoGrupo || '').trim().toUpperCase();
        if (!limpio) return { ok: false };
        try {
          await updateDoc(doc(db, 'escuelas', escuelaId), {
            grupos: gruposActuales.map(g => g === grupoActual ? limpio : g),
          });
          await get().cargarEscuelas();
          // Si el grupo renombrado es el que está seleccionado en este momento,
          // actualizar la selección para que no quede apuntando a un nombre viejo.
          const { escuelaSeleccionada, grupoSeleccionado } = get();
          if (escuelaSeleccionada?.id === escuelaId && grupoSeleccionado === grupoActual) {
            set({ grupoSeleccionado: limpio }, false, 'renombrarGrupo/syncSeleccion');
          }
          return { ok: true };
        } catch (e) {
          console.error('Error renombrando grupo:', e);
          return { ok: false, error: 'Error al renombrar grupo.' };
        }
      },

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

      // ── Agregar alumno nuevo ──────────────────────────────
      // Escribe con el MISMO esquema de campos que ya usan Gamificación
      // y Sensor de movimiento (escuelaId, escuelaNombre, grupo, nombre)
      // para que el alumno aparezca correctamente en los 3 proyectos.
      agregarAlumno: async (nombre) => {
        const { escuelaSeleccionada, grupoSeleccionado, cargarAlumnos } = get();
        const nombreLimpio = (nombre || '').trim();
        if (!nombreLimpio) return { ok: false, error: 'Escribe un nombre.' };
        if (!escuelaSeleccionada || !grupoSeleccionado) {
          return { ok: false, error: 'Selecciona escuela y grupo primero.' };
        }
        const uid = auth.currentUser?.uid;
        try {
          await addDoc(collection(db, 'alumnos'), {
            nombre:         nombreLimpio,
            escuelaId:      escuelaSeleccionada.id,
            escuelaNombre:  escuelaSeleccionada.nombre,
            grupo:          grupoSeleccionado,
            docenteId:      uid || null, // dueño directo — usado por las reglas de seguridad
            puntosClase:    0,
            puntos:         0,
            racha:          0,
            fechaCreacion:  new Date().toISOString(),
          });
          await cargarAlumnos();
          return { ok: true };
        } catch (e) {
          console.error('Error agregando alumno:', e);
          return { ok: false, error: 'Error de conexión al agregar alumno.' };
        }
      },

      // ── Agregar alumnos MASIVO (pegar lista o subir archivo) ──
      // Usa writeBatch: un solo viaje a Firestore en vez de N escrituras
      // sueltas, y un solo cargarAlumnos() al final en vez de uno por alumno.
      agregarAlumnosMasivo: async (nombres) => {
        const { escuelaSeleccionada, grupoSeleccionado, cargarAlumnos } = get();
        if (!escuelaSeleccionada || !grupoSeleccionado) {
          return { ok: false, error: 'Selecciona escuela y grupo primero.' };
        }
        const limpios = (nombres || []).map(n => (n || '').trim()).filter(Boolean);
        if (!limpios.length) return { ok: false, error: 'No se detectaron nombres válidos.' };
        const uid = auth.currentUser?.uid;
        try {
          const batch = writeBatch(db);
          limpios.forEach(nombre => {
            const ref = doc(collection(db, 'alumnos'));
            batch.set(ref, {
              nombre,
              escuelaId:      escuelaSeleccionada.id,
              escuelaNombre:  escuelaSeleccionada.nombre,
              grupo:          grupoSeleccionado,
              docenteId:      uid || null,
              puntosClase:    0,
              puntos:         0,
              racha:          0,
              fechaCreacion:  new Date().toISOString(),
            });
          });
          await batch.commit();
          await cargarAlumnos();
          return { ok: true, agregados: limpios.length };
        } catch (e) {
          console.error('Error agregando alumnos masivo:', e);
          return { ok: false, error: 'Error de conexión al agregar alumnos.' };
        }
      },

      // ── Eliminar alumno ───────────────────────────────────
      eliminarAlumno: async (alumnoId) => {
        const { cargarAlumnos } = get();
        try {
          await deleteDoc(doc(db, 'alumnos', alumnoId));
          set(
            (s) => ({ alumnos: s.alumnos.filter(a => a.id !== alumnoId) }),
            false,
            'eliminarAlumno/optimista',
          );
          await cargarAlumnos();
          return { ok: true };
        } catch (e) {
          console.error('Error eliminando alumno:', e);
          return { ok: false, error: 'Error de conexión al eliminar alumno.' };
        }
      },

      // ── Eliminar TODOS los alumnos del grupo actual ───────
      // La doble advertencia (dos confirmaciones) vive en App.jsx, aquí solo
      // se ejecuta la operación una vez confirmada.
      eliminarTodosLosAlumnos: async () => {
        const { escuelaSeleccionada, grupoSeleccionado, alumnos, cargarAlumnos } = get();
        if (!escuelaSeleccionada || !grupoSeleccionado) {
          return { ok: false, error: 'Selecciona escuela y grupo primero.' };
        }
        if (!alumnos.length) return { ok: false, error: 'No hay alumnos que eliminar en este grupo.' };
        try {
          const batch = writeBatch(db);
          alumnos.forEach(a => batch.delete(doc(db, 'alumnos', a.id)));
          await batch.commit();
          set({ alumnos: [] }, false, 'eliminarTodosLosAlumnos/optimista');
          await cargarAlumnos();
          return { ok: true, eliminados: alumnos.length };
        } catch (e) {
          console.error('Error eliminando todos los alumnos:', e);
          return { ok: false, error: 'Error de conexión al eliminar alumnos.' };
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
          const response = await fetch('https://api.iapprende.com/api/analizar-lectura', {
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
